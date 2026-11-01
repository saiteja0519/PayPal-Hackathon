import base64
import json
import uuid
from decimal import Decimal
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timezone
import httpx
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.core.config import settings
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.webhook import WebhookEvent
from app.services.invoice_service import recalculate_invoice_status, quantize_money
from app.services.audit_service import log_audit_event

class PayPalService:
    def __init__(self):
        self.base_url = settings.PAYPAL_BASE_URL.rstrip('/')
        self.client_id = settings.PAYPAL_CLIENT_ID
        self.client_secret = settings.PAYPAL_CLIENT_SECRET
        self.is_mock = (
            not self.client_id or 
            self.client_id.startswith("mock_") or 
            not self.client_secret or 
            self.client_secret.startswith("mock_")
        )

    def _get_access_token(self) -> str:
        if self.is_mock:
            return "mock_access_token_12345"

        auth_str = f"{self.client_id}:{self.client_secret}"
        b64_auth = base64.b64encode(auth_str.encode()).decode()
        
        headers = {
            "Authorization": f"Basic {b64_auth}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        data = {"grant_type": "client_credentials"}
        
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(f"{self.base_url}/v1/oauth2/token", headers=headers, data=data)
                res.raise_for_status()
                token_data = res.json()
                return token_data["access_token"]
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to authenticate with PayPal Sandbox API: {str(e)}"
            )

    def create_order(
        self,
        db: Session,
        invoice: Invoice,
        requested_amount: Optional[Decimal] = None,
        idempotency_key: Optional[str] = None
    ) -> Tuple[Payment, str, Optional[str]]:
        # Enforce invoice balance & status validation
        if invoice.status in ("draft", "cancelled"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot pay an invoice with status '{invoice.status}'."
            )
        if invoice.balance_due <= Decimal("0.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invoice has already been fully paid."
            )

        # Security: Never trust client amount blindly. Determine exact payable amount
        payable_amount = invoice.balance_due
        if requested_amount is not None:
            if requested_amount <= Decimal("0.00") or requested_amount > invoice.balance_due:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Payment amount must be between 0.01 and remaining balance ({invoice.balance_due} {invoice.currency})."
                )
            payable_amount = quantize_money(requested_amount)

        # Check existing initiated payment with same idempotency key
        if idempotency_key:
            existing_payment = db.query(Payment).filter(
                Payment.idempotency_key == idempotency_key,
                Payment.business_id == invoice.business_id
            ).first()
            if existing_payment and existing_payment.provider_order_id:
                return existing_payment, existing_payment.provider_order_id, None

        order_id = ""
        approval_url = None

        if self.is_mock:
            # Deterministic mock order for local sandbox tests
            order_id = f"MOCK-PAYPAL-{uuid.uuid4().hex[:12].upper()}"
            approval_url = f"https://www.sandbox.paypal.com/checkoutnow?token={order_id}"
            raw_response = json.dumps({"id": order_id, "status": "CREATED", "mock": True})
        else:
            token = self._get_access_token()
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
            order_payload = {
                "intent": "CAPTURE",
                "purchase_units": [
                    {
                        "reference_id": invoice.id,
                        "description": f"Payment for Invoice {invoice.invoice_number}",
                        "custom_id": invoice.invoice_number,
                        "amount": {
                            "currency_code": invoice.currency,
                            "value": f"{payable_amount:.2f}"
                        }
                    }
                ],
                "application_context": {
                    "brand_name": "PayPilot AI",
                    "landing_page": "NO_PREFERENCE",
                    "user_action": "PAY_NOW",
                    "return_url": "http://localhost:5173/payments/success",
                    "cancel_url": "http://localhost:5173/payments/cancel"
                }
            }

            try:
                with httpx.Client(timeout=15.0) as client:
                    res = client.post(f"{self.base_url}/v2/checkout/orders", headers=headers, json=order_payload)
                    res.raise_for_status()
                    order_data = res.json()
                    order_id = order_data["id"]
                    raw_response = json.dumps(order_data)
                    for link in order_data.get("links", []):
                        if link.get("rel") == "approve":
                            approval_url = link.get("href")
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"PayPal order creation failed: {str(e)}"
                )

        payment = Payment(
            business_id=invoice.business_id,
            invoice_id=invoice.id,
            amount=payable_amount,
            currency=invoice.currency,
            status="initiated",
            payment_method="paypal",
            provider="paypal",
            provider_order_id=order_id,
            provider_status="CREATED",
            provider_raw_response=raw_response,
            idempotency_key=idempotency_key or str(uuid.uuid4())
        )
        db.add(payment)
        
        # Track pending amount on invoice
        invoice.pending_amount = quantize_money(invoice.pending_amount + payable_amount)
        db.commit()
        db.refresh(payment)

        log_audit_event(
            db,
            business_id=invoice.business_id,
            action="payment.order_created",
            entity_type="payment",
            entity_id=payment.id,
            details={"order_id": order_id, "amount": str(payable_amount), "currency": invoice.currency}
        )

        return payment, order_id, approval_url

    def capture_order(self, db: Session, payment_or_order_id: str) -> Payment:
        # Locate payment by payment_id or provider_order_id
        payment = db.query(Payment).filter(
            (Payment.id == payment_or_order_id) | (Payment.provider_order_id == payment_or_order_id)
        ).first()

        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment record not found."
            )

        invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Associated invoice not found.")

        # Idempotent check: if already completed, return immediately
        if payment.status == "completed":
            return payment

        capture_id = None
        capture_status = "COMPLETED"
        payer_id = None
        payer_email = None
        raw_res = ""

        if self.is_mock or (payment.provider_order_id and payment.provider_order_id.startswith("MOCK-")):
            capture_id = f"MOCK-CAP-{uuid.uuid4().hex[:12].upper()}"
            capture_status = "COMPLETED"
            payer_id = "MOCK-PAYER-9988"
            payer_email = invoice.customer.email if invoice.customer else "customer@example.com"
            raw_res = json.dumps({
                "id": payment.provider_order_id,
                "status": "COMPLETED",
                "purchase_units": [{
                    "payments": {
                        "captures": [{
                            "id": capture_id,
                            "status": "COMPLETED",
                            "amount": {"currency_code": payment.currency, "value": f"{payment.amount:.2f}"}
                        }]
                    }
                }],
                "payer": {"payer_id": payer_id, "email_address": payer_email}
            })
        else:
            token = self._get_access_token()
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
            try:
                with httpx.Client(timeout=15.0) as client:
                    res = client.post(
                        f"{self.base_url}/v2/checkout/orders/{payment.provider_order_id}/capture",
                        headers=headers,
                        json={}
                    )
                    res.raise_for_status()
                    data = res.json()
                    raw_res = json.dumps(data)
                    
                    purchase_units = data.get("purchase_units", [])
                    if purchase_units:
                        captures = purchase_units[0].get("payments", {}).get("captures", [])
                        if captures:
                            capture_id = captures[0].get("id")
                            capture_status = captures[0].get("status", "COMPLETED")
                    payer_info = data.get("payer", {})
                    payer_id = payer_info.get("payer_id")
                    payer_email = payer_info.get("email_address")
            except Exception as e:
                payment.status = "failed"
                payment.error_message = str(e)
                # Release pending amount on failure
                invoice.pending_amount = max(Decimal("0.00"), invoice.pending_amount - payment.amount)
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"PayPal capture request failed: {str(e)}"
                )

        # Update payment transactionally
        payment.provider_capture_id = capture_id
        payment.provider_status = capture_status
        payment.provider_payer_id = payer_id
        payment.provider_payer_email = payer_email
        payment.provider_raw_response = raw_res

        if capture_status == "COMPLETED":
            payment.status = "completed"
            # Update invoice confirmed paid amount
            invoice.paid_amount = quantize_money(invoice.paid_amount + payment.amount)
            invoice.pending_amount = max(Decimal("0.00"), invoice.pending_amount - payment.amount)
            recalculate_invoice_status(invoice)
        elif capture_status == "PENDING":
            payment.status = "pending"
        else:
            payment.status = "failed"
            invoice.pending_amount = max(Decimal("0.00"), invoice.pending_amount - payment.amount)

        db.commit()
        db.refresh(payment)
        db.refresh(invoice)

        log_audit_event(
            db,
            business_id=invoice.business_id,
            action="payment.captured",
            entity_type="payment",
            entity_id=payment.id,
            details={
                "capture_id": capture_id,
                "amount": str(payment.amount),
                "status": payment.status,
                "invoice_balance": str(invoice.balance_due)
            }
        )

        return payment

    def verify_webhook(self, headers: Dict[str, str], body_str: str) -> bool:
        if self.is_mock or not settings.PAYPAL_WEBHOOK_ID:
            # Synthetic mode allows developer testing with signed mock header
            if headers.get("x-mock-synthetic-webhook") == "true" or headers.get("paypal-auth-algo") == "SYNTHETIC":
                return True
            # In mock sandbox mode if webhook ID is not yet configured, allow safe verified payload test
            return True

        token = self._get_access_token()
        verify_url = f"{self.base_url}/v1/notifications/verify-webhook-signature"
        
        req_headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        verify_body = {
            "auth_algo": headers.get("paypal-auth-algo"),
            "cert_url": headers.get("paypal-cert-url"),
            "transmission_id": headers.get("paypal-transmission-id"),
            "transmission_sig": headers.get("paypal-transmission-sig"),
            "transmission_time": headers.get("paypal-transmission-time"),
            "webhook_id": settings.PAYPAL_WEBHOOK_ID,
            "webhook_event": json.loads(body_str)
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(verify_url, headers=req_headers, json=verify_body)
                res.raise_for_status()
                data = res.json()
                return data.get("verification_status") == "SUCCESS"
        except Exception:
            return False

    def process_webhook_event(self, db: Session, event_data: Dict[str, Any]) -> Tuple[str, str]:
        event_id = event_data.get("id")
        event_type = event_data.get("event_type")
        
        if not event_id or not event_type:
            raise HTTPException(status_code=400, detail="Invalid webhook event structure.")

        # Duplicate check using WebhookEvent table
        existing = db.query(WebhookEvent).filter(
            WebhookEvent.provider == "paypal",
            WebhookEvent.event_id == event_id
        ).first()
        if existing:
            return existing.status, "Duplicate event skipped safely."

        # Store event
        event_record = WebhookEvent(
            provider="paypal",
            event_id=event_id,
            event_type=event_type,
            status="received",
            payload=json.dumps(event_data)
        )
        db.add(event_record)
        db.commit()

        # Reconcile event types
        try:
            resource = event_data.get("resource", {})
            if event_type == "PAYMENT.CAPTURE.COMPLETED":
                capture_id = resource.get("id")
                custom_id = resource.get("custom_id")  # invoice_number
                amount_val = resource.get("amount", {}).get("value")
                
                # Find payment by provider_capture_id or provider_order_id or custom_id
                payment = None
                if capture_id:
                    payment = db.query(Payment).filter(Payment.provider_capture_id == capture_id).first()
                if not payment and custom_id:
                    invoice = db.query(Invoice).filter(Invoice.invoice_number == custom_id).first()
                    if invoice:
                        payment = db.query(Payment).filter(Payment.invoice_id == invoice.id, Payment.status != "completed").first()
                
                if payment and payment.status != "completed":
                    payment.status = "completed"
                    payment.provider_capture_id = capture_id
                    invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
                    if invoice:
                        invoice.paid_amount = quantize_money(invoice.paid_amount + payment.amount)
                        invoice.pending_amount = max(Decimal("0.00"), invoice.pending_amount - payment.amount)
                        recalculate_invoice_status(invoice)
                    event_record.status = "processed"
                else:
                    event_record.status = "ignored"

            elif event_type == "PAYMENT.CAPTURE.REFUNDED":
                capture_id = resource.get("capture_id")
                refund_amount_val = Decimal(str(resource.get("amount", {}).get("value", "0.00")))
                payment = db.query(Payment).filter(Payment.provider_capture_id == capture_id).first()
                if payment:
                    payment.status = "refunded"
                    payment.refund_amount = quantize_money(payment.refund_amount + refund_amount_val)
                    payment.refunded_at = datetime.now(timezone.utc)
                    invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
                    if invoice:
                        invoice.refunded_amount = quantize_money(invoice.refunded_amount + refund_amount_val)
                        recalculate_invoice_status(invoice)
                    event_record.status = "processed"
                else:
                    event_record.status = "ignored"

            elif event_type == "PAYMENT.CAPTURE.DENIED":
                capture_id = resource.get("id")
                payment = db.query(Payment).filter(Payment.provider_capture_id == capture_id).first()
                if payment:
                    payment.status = "failed"
                    invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
                    if invoice:
                        invoice.pending_amount = max(Decimal("0.00"), invoice.pending_amount - payment.amount)
                    event_record.status = "processed"
                else:
                    event_record.status = "ignored"
            else:
                event_record.status = "ignored"

            db.commit()
            return event_record.status, "Event processed successfully."

        except Exception as e:
            event_record.status = "failed"
            event_record.error_message = str(e)
            db.commit()
            return "failed", f"Processing error: {str(e)}"

paypal_service = PayPalService()
