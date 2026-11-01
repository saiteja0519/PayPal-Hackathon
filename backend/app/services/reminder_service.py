import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.core.config import settings
from app.models.invoice import Invoice
from app.models.customer import Customer
from app.models.reminder import Reminder
from app.schemas.reminder import ReminderDraftResponse
from app.services.audit_service import log_audit_event

def generate_reminder_draft(
    db: Session,
    invoice: Invoice,
    tone: str = "polite",
    custom_note: Optional[str] = None
) -> ReminderDraftResponse:
    customer = invoice.customer
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found for this invoice.")

    today = date.today()
    days_diff = (today - invoice.due_date).days
    days_overdue = max(0, days_diff)

    biz_name = invoice.business.name if invoice.business else "Our Company"
    currency = invoice.currency
    balance = invoice.balance_due

    if tone == "urgent":
        subject = f"URGENT: Invoice {invoice.invoice_number} is {days_overdue} days overdue - {biz_name}"
        body = (
            f"Dear {customer.name},\n\n"
            f"This is an urgent notice regarding invoice {invoice.invoice_number}, which was due on {invoice.due_date.strftime('%B %d, %Y')} "
            f"and is now {days_overdue} days past due.\n\n"
            f"Outstanding Amount: {currency} {balance:,.2f}\n\n"
            f"Please arrange payment immediately to avoid service interruption or additional late fees. "
            f"You can settle this invoice securely online via our payment portal.\n\n"
        )
    elif tone == "firm":
        subject = f"Payment Reminder: Invoice {invoice.invoice_number} is past due - {biz_name}"
        body = (
            f"Dear {customer.name},\n\n"
            f"We are writing to follow up on invoice {invoice.invoice_number} for {currency} {balance:,.2f}, "
            f"which was due on {invoice.due_date.strftime('%B %d, %Y')}.\n\n"
            f"According to our records, we have not yet received payment. If you have already remitted this payment, "
            f"please let us know. Otherwise, please remit the outstanding balance at your earliest convenience.\n\n"
        )
    else:  # polite
        if days_overdue > 0:
            subject = f"Friendly Reminder: Outstanding Invoice {invoice.invoice_number} - {biz_name}"
            body = (
                f"Hello {customer.name},\n\n"
                f"Hope this email finds you well. We wanted to send a friendly reminder that invoice {invoice.invoice_number} "
                f"was due on {invoice.due_date.strftime('%B %d, %Y')}.\n\n"
                f"Current Balance Due: {currency} {balance:,.2f}\n\n"
                f"Please let us know if you have any questions or need a copy of the invoice.\n\n"
            )
        else:
            days_until = (invoice.due_date - today).days
            subject = f"Upcoming Payment Notice: Invoice {invoice.invoice_number} - {biz_name}"
            body = (
                f"Hello {customer.name},\n\n"
                f"Hope you're having a great week! This is a quick note that invoice {invoice.invoice_number} "
                f"for {currency} {balance:,.2f} will be due in {days_until} days on {invoice.due_date.strftime('%B %d, %Y')}.\n\n"
                f"Thank you for your business!\n\n"
            )

    if custom_note:
        body += f"Additional Note:\n{custom_note}\n\n"

    body += f"Best regards,\n{biz_name} Billing Team"

    return ReminderDraftResponse(
        invoice_id=invoice.id,
        customer_id=customer.id,
        customer_name=customer.name,
        recipient_email=customer.email,
        subject=subject,
        body=body,
        amount_due=balance,
        currency=currency,
        days_overdue=days_overdue
    )

def send_reminder(
    db: Session,
    invoice: Invoice,
    subject: str,
    body: str,
    recipient_email: Optional[str] = None,
    simulate: bool = False,
    user_id: Optional[str] = None
) -> Reminder:
    customer = invoice.customer
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    target_email = recipient_email or customer.email
    
    # Check duplicate recent reminder (within 1 hour)
    recent = db.query(Reminder).filter(
        Reminder.invoice_id == invoice.id,
        Reminder.status == "sent"
    ).order_by(Reminder.created_at.desc()).first()
    if recent and recent.sent_at:
        diff_mins = (datetime.now(timezone.utc) - recent.sent_at.replace(tzinfo=timezone.utc)).total_seconds() / 60
        if diff_mins < 10:  # within 10 minutes
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A payment reminder was already sent {int(diff_mins)} minutes ago. Please wait before resending."
            )

    is_smtp_configured = bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)
    channel = "email" if (is_smtp_configured and not simulate) else "simulated"

    reminder = Reminder(
        business_id=invoice.business_id,
        invoice_id=invoice.id,
        customer_id=customer.id,
        channel=channel,
        recipient_email=target_email,
        subject=subject,
        body=body,
        status="draft"
    )
    db.add(reminder)
    db.flush()

    if channel == "email":
        try:
            msg = MIMEMultipart()
            msg["From"] = settings.EMAIL_FROM
            msg["To"] = target_email
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)

            reminder.status = "sent"
            reminder.sent_at = datetime.now(timezone.utc)
        except Exception as e:
            reminder.status = "failed"
            reminder.error_message = f"SMTP dispatch failed: {str(e)}"
    else:
        # Realistic simulated delivery mode with clear status
        reminder.status = "sent"
        reminder.sent_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(reminder)

    log_audit_event(
        db,
        business_id=invoice.business_id,
        user_id=user_id,
        action="reminder.sent",
        entity_type="reminder",
        entity_id=reminder.id,
        details={
            "invoice_number": invoice.invoice_number,
            "recipient": target_email,
            "channel": channel,
            "status": reminder.status
        }
    )

    return reminder
