import re
from datetime import date
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.invoice import Invoice
from app.models.customer import Customer
from app.models.payment import Payment
from app.models.business import Business
from app.models.conversation import Conversation, Message
from app.services.analytics_service import get_dashboard_summary
from app.services.reminder_service import generate_reminder_draft
from app.services.paypal_service import paypal_service

class AITools:
    """Predefined, strictly validated tools operating safely within tenant business isolation."""

    @staticmethod
    def get_dashboard_summary_tool(db: Session, business: Business, args: Dict[str, Any]) -> Dict[str, Any]:
        summary = get_dashboard_summary(db, business)
        return {
            "currency": summary.currency,
            "total_invoiced": float(summary.total_invoiced),
            "total_paid": float(summary.total_paid),
            "outstanding_balance": float(summary.outstanding_balance),
            "overdue_balance": float(summary.overdue_balance),
            "unpaid_invoices_count": summary.unpaid_invoices_count,
            "overdue_invoices_count": summary.overdue_invoices_count,
            "paid_invoices_count": summary.paid_invoices_count,
            "total_customers_count": summary.total_customers_count,
            "status_distribution": summary.status_distribution
        }

    @staticmethod
    def list_invoices_tool(db: Session, business: Business, args: Dict[str, Any]) -> Dict[str, Any]:
        status_filter = args.get("status")
        limit = min(int(args.get("limit", 10)), 50)
        
        query = db.query(Invoice).filter(Invoice.business_id == business.id)
        if status_filter:
            query = query.filter(Invoice.status == status_filter.lower())
        
        invoices = query.order_by(Invoice.issue_date.desc()).limit(limit).all()
        return {
            "count": len(invoices),
            "invoices": [
                {
                    "invoice_number": inv.invoice_number,
                    "customer_name": inv.customer.name if inv.customer else "Unknown",
                    "status": inv.status,
                    "total_amount": float(inv.total_amount),
                    "balance_due": float(inv.balance_due),
                    "due_date": inv.due_date.isoformat(),
                    "currency": inv.currency
                }
                for inv in invoices
            ]
        }

    @staticmethod
    def list_overdue_invoices_tool(db: Session, business: Business, args: Dict[str, Any]) -> Dict[str, Any]:
        today = date.today()
        limit = min(int(args.get("limit", 10)), 50)
        invoices = (
            db.query(Invoice)
            .filter(
                Invoice.business_id == business.id,
                Invoice.balance_due > 0,
                Invoice.status.notin_(["draft", "cancelled"]),
                Invoice.due_date < today
            )
            .order_by(Invoice.due_date.asc())
            .limit(limit)
            .all()
        )
        return {
            "count": len(invoices),
            "overdue_invoices": [
                {
                    "invoice_number": inv.invoice_number,
                    "customer_name": inv.customer.name if inv.customer else "Unknown",
                    "customer_email": inv.customer.email if inv.customer else "",
                    "balance_due": float(inv.balance_due),
                    "due_date": inv.due_date.isoformat(),
                    "days_overdue": (today - inv.due_date).days,
                    "currency": inv.currency
                }
                for inv in invoices
            ]
        }

    @staticmethod
    def list_upcoming_due_invoices_tool(db: Session, business: Business, args: Dict[str, Any]) -> Dict[str, Any]:
        today = date.today()
        days_ahead = int(args.get("days", 7))
        target_date = today + timedelta(days=days_ahead)

        invoices = (
            db.query(Invoice)
            .filter(
                Invoice.business_id == business.id,
                Invoice.balance_due > 0,
                Invoice.status.notin_(["draft", "cancelled"]),
                Invoice.due_date >= today,
                Invoice.due_date <= target_date
            )
            .order_by(Invoice.due_date.asc())
            .all()
        )
        return {
            "count": len(invoices),
            "upcoming_invoices": [
                {
                    "invoice_number": inv.invoice_number,
                    "customer_name": inv.customer.name if inv.customer else "Unknown",
                    "balance_due": float(inv.balance_due),
                    "due_date": inv.due_date.isoformat(),
                    "days_remaining": (inv.due_date - today).days,
                    "currency": inv.currency
                }
                for inv in invoices
            ]
        }

    @staticmethod
    def get_invoice_details_tool(db: Session, business: Business, args: Dict[str, Any]) -> Dict[str, Any]:
        ref = args.get("invoice_id_or_number", "").strip()
        inv = db.query(Invoice).filter(
            Invoice.business_id == business.id,
            (Invoice.id == ref) | (Invoice.invoice_number.ilike(ref))
        ).first()

        if not inv:
            return {"error": f"Invoice '{ref}' not found."}

        return {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "customer_name": inv.customer.name if inv.customer else "Unknown",
            "customer_email": inv.customer.email if inv.customer else "",
            "status": inv.status,
            "total_amount": float(inv.total_amount),
            "paid_amount": float(inv.paid_amount),
            "balance_due": float(inv.balance_due),
            "issue_date": inv.issue_date.isoformat(),
            "due_date": inv.due_date.isoformat(),
            "currency": inv.currency,
            "items_count": len(inv.items)
        }

    @staticmethod
    def get_customer_payment_summary_tool(db: Session, business: Business, args: Dict[str, Any]) -> Dict[str, Any]:
        query_val = args.get("customer_name_or_id", "").strip()
        customer = db.query(Customer).filter(
            Customer.business_id == business.id,
            (Customer.id == query_val) | (Customer.name.ilike(f"%{query_val}%")) | (Customer.email.ilike(f"%{query_val}%"))
        ).first()

        if not customer:
            return {"error": f"No customer matching '{query_val}' found."}

        invoices = db.query(Invoice).filter(
            Invoice.business_id == business.id,
            Invoice.customer_id == customer.id,
            Invoice.status != "cancelled"
        ).all()

        total_invoiced = sum((inv.total_amount for inv in invoices), Decimal("0.00"))
        total_paid = sum((inv.paid_amount for inv in invoices), Decimal("0.00"))
        balance = sum((inv.balance_due for inv in invoices), Decimal("0.00"))

        return {
            "customer_id": customer.id,
            "name": customer.name,
            "email": customer.email,
            "total_invoiced": float(total_invoiced),
            "total_paid": float(total_paid),
            "outstanding_balance": float(balance),
            "invoice_count": len(invoices),
            "currency": customer.currency or business.currency
        }

    @staticmethod
    def get_payment_status_tool(db: Session, business: Business, args: Dict[str, Any]) -> Dict[str, Any]:
        ref = args.get("payment_id_or_order_id", "").strip()
        p = db.query(Payment).filter(
            Payment.business_id == business.id,
            (Payment.id == ref) | (Payment.provider_order_id == ref) | (Payment.provider_capture_id == ref)
        ).first()

        if not p:
            return {"error": f"Payment record '{ref}' not found."}

        return {
            "payment_id": p.id,
            "invoice_number": p.invoice.invoice_number if p.invoice else "",
            "amount": float(p.amount),
            "currency": p.currency,
            "status": p.status,
            "provider": p.provider,
            "provider_order_id": p.provider_order_id,
            "created_at": p.created_at.isoformat() if p.created_at else ""
        }

    @staticmethod
    def draft_payment_reminder_tool(db: Session, business: Business, args: Dict[str, Any]) -> Dict[str, Any]:
        ref = args.get("invoice_id_or_number", "").strip()
        tone = args.get("tone", "polite")

        inv = db.query(Invoice).filter(
            Invoice.business_id == business.id,
            (Invoice.id == ref) | (Invoice.invoice_number.ilike(ref))
        ).first()

        if not inv:
            return {"error": f"Invoice '{ref}' not found."}

        draft = generate_reminder_draft(db, inv, tone=tone)
        return {
            "invoice_id": draft.invoice_id,
            "invoice_number": inv.invoice_number,
            "customer_name": draft.customer_name,
            "recipient_email": draft.recipient_email,
            "subject": draft.subject,
            "body": draft.body,
            "amount_due": float(draft.amount_due),
            "currency": draft.currency,
            "note": "Reminder prepared as draft. Explicit user approval is required to dispatch email."
        }

    @staticmethod
    def prepare_checkout_tool(db: Session, business: Business, args: Dict[str, Any]) -> Dict[str, Any]:
        ref = args.get("invoice_id_or_number", "").strip()
        inv = db.query(Invoice).filter(
            Invoice.business_id == business.id,
            (Invoice.id == ref) | (Invoice.invoice_number.ilike(ref))
        ).first()

        if not inv:
            return {"error": f"Invoice '{ref}' not found."}

        if inv.balance_due <= Decimal("0.00"):
            return {"error": f"Invoice '{inv.invoice_number}' has zero outstanding balance."}

        if inv.status in ["draft", "cancelled"]:
            return {"error": f"Invoice '{inv.invoice_number}' is in '{inv.status}' state and not eligible for checkout."}

        # Create or retrieve paypal order
        order_res = paypal_service.create_order(
            business=business,
            invoice=inv,
            amount=inv.balance_due,
            currency=inv.currency,
            idempotency_key=f"ai-{inv.id}-{date.today().isoformat()}"
        )
        return {
            "invoice_id": inv.id,
            "invoice_number": inv.invoice_number,
            "amount": float(inv.balance_due),
            "currency": inv.currency,
            "paypal_order_id": order_res.provider_order_id,
            "status": order_res.status,
            "approval_url": order_res.approval_url
        }

from datetime import timedelta

TOOL_REGISTRY = {
    "get_dashboard_summary": AITools.get_dashboard_summary_tool,
    "list_invoices": AITools.list_invoices_tool,
    "list_overdue_invoices": AITools.list_overdue_invoices_tool,
    "list_upcoming_due_invoices": AITools.list_upcoming_due_invoices_tool,
    "get_invoice_details": AITools.get_invoice_details_tool,
    "get_customer_payment_summary": AITools.get_customer_payment_summary_tool,
    "get_payment_status": AITools.get_payment_status_tool,
    "draft_payment_reminder": AITools.draft_payment_reminder_tool,
    "prepare_checkout": AITools.prepare_checkout_tool,
}

class AIService:
    @classmethod
    def execute_tool(cls, db: Session, business: Business, tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        handler = TOOL_REGISTRY.get(tool_name)
        if not handler:
            return {"error": f"Tool '{tool_name}' is not recognized or permitted."}
        try:
            return handler(db, business, args)
        except Exception as e:
            return {"error": f"Failed executing tool '{tool_name}': {str(e)}"}

    @classmethod
    def _deterministic_respond(cls, db: Session, business: Business, user_message: str) -> Tuple[str, List[str], List[Dict[str, Any]]]:
        msg = user_message.lower().strip()
        tools_executed = []
        tool_results = []

        # 1. Overdue invoices
        if "overdue" in msg:
            tools_executed.append("list_overdue_invoices")
            res = AITools.list_overdue_invoices_tool(db, business, {"limit": 10})
            tool_results.append({"tool": "list_overdue_invoices", "result": res})
            
            invoices = res.get("overdue_invoices", [])
            if not invoices:
                reply = "Great news! You currently have no overdue invoices. All eligible payments are up to date."
            else:
                lines = [f"Found {len(invoices)} overdue invoice(s):"]
                for inv in invoices:
                    lines.append(f"• **{inv['invoice_number']}** ({inv['customer_name']}): {inv['currency']} {inv['balance_due']:,.2f} ({inv['days_overdue']} days overdue, due {inv['due_date']})")
                lines.append("\nWould you like me to draft payment reminders for any of these overdue customers?")
                reply = "\n".join(lines)
            return reply, tools_executed, tool_results

        # 2. Upcoming due invoices
        if "upcoming" in msg or "due in" in msg or "next 7 days" in msg or "next seven days" in msg or "due soon" in msg:
            tools_executed.append("list_upcoming_due_invoices")
            days = 7
            match_days = re.search(r"(\d+)\s*days", msg)
            if match_days:
                days = int(match_days.group(1))
            res = AITools.list_upcoming_due_invoices_tool(db, business, {"days": days})
            tool_results.append({"tool": "list_upcoming_due_invoices", "result": res})
            
            invoices = res.get("upcoming_invoices", [])
            if not invoices:
                reply = f"No invoices are scheduled due within the next {days} days."
            else:
                lines = [f"Found {len(invoices)} invoice(s) due within the next {days} days:"]
                for inv in invoices:
                    lines.append(f"• **{inv['invoice_number']}** ({inv['customer_name']}): {inv['currency']} {inv['balance_due']:,.2f} (due {inv['due_date']}, {inv['days_remaining']} days remaining)")
                reply = "\n".join(lines)
            return reply, tools_executed, tool_results

        # 3. Reminder draft (supports "draft", "reminder", or typo "remainder")
        if "draft" in msg or "reminder" in msg or "remainder" in msg:
            match_inv = re.search(r"(inv-[\w-]+)", msg, re.IGNORECASE)
            tools_executed.append("draft_payment_reminder")
            if match_inv:
                inv_ref = match_inv.group(1).upper()
                tone = "urgent" if "urgent" in msg else ("firm" if "firm" in msg else "polite")
                res = AITools.draft_payment_reminder_tool(db, business, {"invoice_id_or_number": inv_ref, "tone": tone})
                tool_results.append({"tool": "draft_payment_reminder", "result": res})
                if "error" in res:
                    reply = res["error"]
                else:
                    reply = (
                        f"Here is a drafted {tone} reminder for **{res['invoice_number']}** ({res['customer_name']}):\n\n"
                        f"**Subject:** {res['subject']}\n\n"
                        f"```\n{res['body']}\n```\n\n"
                        f"> *{res['note']} To send this reminder, navigate to the Reminders tab or confirm dispatch.*"
                    )
            else:
                # Check if a customer name was mentioned in the request (e.g. "for Quantum Labs")
                matched_cust_inv = None
                cust_candidates = db.query(Customer).filter(Customer.business_id == business.id).all()
                for cust in cust_candidates:
                    if cust.name.lower() in msg:
                        matched_cust_inv = db.query(Invoice).filter(
                            Invoice.business_id == business.id,
                            Invoice.customer_id == cust.id,
                            Invoice.balance_due > 0,
                            Invoice.status != "cancelled"
                        ).order_by(Invoice.due_date.asc()).first()
                        break

                if matched_cust_inv:
                    tone = "urgent" if "urgent" in msg else ("firm" if "firm" in msg else "polite")
                    res = AITools.draft_payment_reminder_tool(db, business, {"invoice_id_or_number": matched_cust_inv.invoice_number, "tone": tone})
                    tool_results.append({"tool": "draft_payment_reminder", "result": res})
                    reply = (
                        f"Here is a drafted {tone} reminder for **{res['invoice_number']}** ({res['customer_name']}):\n\n"
                        f"**Subject:** {res['subject']}\n\n"
                        f"```\n{res['body']}\n```\n\n"
                        f"> *{res['note']} To send this reminder, navigate to the Reminders tab or confirm dispatch.*"
                    )
                    return reply, tools_executed, tool_results

                # If no specific customer matched, check for the oldest overdue invoice
                res_overdue = AITools.list_overdue_invoices_tool(db, business, {"limit": 1})
                if res_overdue.get("overdue_invoices"):
                    first_inv = res_overdue["overdue_invoices"][0]
                    res = AITools.draft_payment_reminder_tool(db, business, {"invoice_id_or_number": first_inv["invoice_number"], "tone": "polite"})
                    tool_results.append({"tool": "draft_payment_reminder", "result": res})
                    reply = (
                        f"Drafted a reminder for your most overdue invoice **{res['invoice_number']}** ({res['customer_name']}):\n\n"
                        f"**Subject:** {res['subject']}\n\n"
                        f"```\n{res['body']}\n```\n\n"
                        f"> *{res['note']}*"
                    )
                else:
                    reply = "Please specify an invoice number to draft a reminder (e.g. `Draft a reminder for INV-2026-0001`)."
            return reply, tools_executed, tool_results

        # 4. Specific invoice details or checkout
        match_inv = re.search(r"(inv-[\w-]+)", msg, re.IGNORECASE)
        if match_inv:
            inv_ref = match_inv.group(1).upper()
            if "checkout" in msg or "pay" in msg:
                tools_executed.append("prepare_checkout")
                res = AITools.prepare_checkout_tool(db, business, {"invoice_id_or_number": inv_ref})
                tool_results.append({"tool": "prepare_checkout", "result": res})
                if "error" in res:
                    reply = res["error"]
                else:
                    reply = (
                        f"PayPal checkout prepared for **{res['invoice_number']}**.\n"
                        f"• Amount: {res['currency']} {res['amount']:,.2f}\n"
                        f"• PayPal Order ID: `{res['paypal_order_id']}`\n"
                        f"• Status: {res['status']}\n\n"
                        f"You can complete payment directly by clicking Checkout on your invoice or visiting:\n{res['approval_url']}"
                    )
            else:
                tools_executed.append("get_invoice_details")
                res = AITools.get_invoice_details_tool(db, business, {"invoice_id_or_number": inv_ref})
                tool_results.append({"tool": "get_invoice_details", "result": res})
                if "error" in res:
                    reply = res["error"]
                else:
                    reply = (
                        f"### Invoice {res['invoice_number']} Details\n"
                        f"• **Customer:** {res['customer_name']} ({res['customer_email']})\n"
                        f"• **Status:** `{res['status'].upper()}`\n"
                        f"• **Total Amount:** {res['currency']} {res['total_amount']:,.2f}\n"
                        f"• **Paid So Far:** {res['currency']} {res['paid_amount']:,.2f}\n"
                        f"• **Balance Due:** {res['currency']} {res['balance_due']:,.2f}\n"
                        f"• **Due Date:** {res['due_date']}"
                    )
            return reply, tools_executed, tool_results

        # 5. Customer search / summary
        if "customer" in msg or "owe" in msg:
            match_amount = re.search(r"(\d+[\d,.]*)", msg)
            threshold = Decimal("0.00")
            if match_amount:
                try:
                    threshold = Decimal(match_amount.group(1).replace(",", ""))
                except Exception:
                    pass

            tools_executed.append("list_invoices")
            res = AITools.list_invoices_tool(db, business, {"limit": 50})
            tool_results.append({"tool": "list_invoices", "result": res})

            customer_debt: Dict[str, Decimal] = {}
            for inv in res.get("invoices", []):
                cname = inv["customer_name"]
                customer_debt[cname] = customer_debt.get(cname, Decimal("0.00")) + Decimal(str(inv["balance_due"]))

            lines = []
            if threshold > Decimal("0.00"):
                lines.append(f"Customers with outstanding balances exceeding {business.currency} {threshold:,.2f}:")
                for cname, debt in customer_debt.items():
                    if debt > threshold:
                        lines.append(f"• **{cname}**: {business.currency} {debt:,.2f}")
            else:
                lines.append("Outstanding balances by customer:")
                for cname, debt in customer_debt.items():
                    if debt > Decimal("0.00"):
                        lines.append(f"• **{cname}**: {business.currency} {debt:,.2f}")

            reply = "\n".join(lines) if len(lines) > 1 else "No customers have outstanding balances matching your criteria."
            return reply, tools_executed, tool_results

        # 6. Default / General Financial Summary
        tools_executed.append("get_dashboard_summary")
        summary = AITools.get_dashboard_summary_tool(db, business, {})
        tool_results.append({"tool": "get_dashboard_summary", "result": summary})

        reply = (
            f"### PayPilot Financial Health Summary\n\n"
            f"Here is your current financial snapshot:\n"
            f"• **Total Invoiced:** {summary['currency']} {summary['total_invoiced']:,.2f}\n"
            f"• **Confirmed Paid:** {summary['currency']} {summary['total_paid']:,.2f}\n"
            f"• **Outstanding Balance:** {summary['currency']} {summary['outstanding_balance']:,.2f}\n"
            f"• **Overdue Balance:** {summary['currency']} {summary['overdue_balance']:,.2f} ({summary['overdue_invoices_count']} overdue invoices)\n"
            f"• **Total Active Customers:** {summary['total_customers_count']}\n\n"
            f"You can ask me to *'show overdue invoices'*, *'list invoices due this week'*, *'draft reminder for INV-...'*, or *'check customer balances'*."
        )
        return reply, tools_executed, tool_results

    @classmethod
    def chat(
        cls,
        db: Session,
        business: Business,
        user_id: str,
        message: str,
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        conversation = None
        if conversation_id:
            conversation = db.query(Conversation).filter(
                Conversation.id == conversation_id,
                Conversation.business_id == business.id
            ).first()

        if not conversation:
            conversation = Conversation(
                business_id=business.id,
                user_id=user_id,
                title=message[:40] + ("..." if len(message) > 40 else "")
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)

        # Save user message
        user_msg = Message(
            conversation_id=conversation.id,
            role="user",
            content=message
        )
        db.add(user_msg)
        db.commit()

        # Generate deterministic response using tool framework
        reply, tools_executed, tool_results = cls._deterministic_respond(db, business, message)

        # Save assistant message
        assistant_msg = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=reply,
            tool_calls=",".join(tools_executed) if tools_executed else None,
            tool_results=str(tool_results) if tool_results else None
        )
        db.add(assistant_msg)
        db.commit()

        return {
            "conversation_id": conversation.id,
            "reply": reply,
            "tools_executed": tools_executed,
            "tool_results": tool_results,
            "provider": "deterministic",
            "configured": True
        }


ai_service = AIService()
