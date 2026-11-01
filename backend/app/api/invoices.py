from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from decimal import Decimal
from app.db.session import get_db
from app.models.invoice import Invoice
from app.models.business import Business
from app.models.user import User
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceResponse,
    InvoiceItemResponse,
)
from app.schemas.payment import CheckoutRequest, CheckoutResponse
from app.schemas.reminder import (
    ReminderDraftRequest,
    ReminderDraftResponse,
    ReminderSendRequest,
    ReminderResponse,
)
from app.services.auth_service import get_current_user, get_current_business
from app.services.invoice_service import (
    create_invoice,
    update_invoice,
    issue_invoice,
    cancel_invoice,
    recalculate_invoice_status,
)
from app.services.paypal_service import paypal_service
from app.services.reminder_service import generate_reminder_draft, send_reminder

router = APIRouter(prefix="/invoices", tags=["Invoices"])

def format_invoice_response(inv: Invoice) -> InvoiceResponse:
    recalculate_invoice_status(inv)
    resp = InvoiceResponse.model_validate(inv)
    resp.customer_name = inv.customer.name if inv.customer else "Unknown"
    resp.customer_email = inv.customer.email if inv.customer else ""
    resp.items = [InvoiceItemResponse.model_validate(item) for item in inv.items]
    return resp

@router.get("", response_model=List[InvoiceResponse])
def list_invoices(
    status_filter: Optional[str] = Query(None, alias="status"),
    customer_id: Optional[str] = None,
    search: Optional[str] = None,
    is_overdue: Optional[bool] = None,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    query = db.query(Invoice).filter(Invoice.business_id == business.id)

    if status_filter:
        query = query.filter(Invoice.status == status_filter.lower())
    if customer_id:
        query = query.filter(Invoice.customer_id == customer_id)
    if is_overdue:
        today = date.today()
        query = query.filter(
            Invoice.balance_due > Decimal("0.00"),
            (Invoice.status == "overdue") | ((Invoice.due_date < today) & (Invoice.status != "draft") & (Invoice.status != "cancelled"))
        )
    if search:
        search_filter = f"%{search}%"
        query = query.filter(Invoice.invoice_number.ilike(search_filter))

    invoices = query.order_by(Invoice.issue_date.desc(), Invoice.created_at.desc()).all()
    return [format_invoice_response(inv) for inv in invoices]

@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_new_invoice(
    data: InvoiceCreate,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    inv = create_invoice(db, business, data, user_id=user.id)
    return format_invoice_response(inv)

@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: str,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    inv = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.business_id == business.id
    ).first()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")
    return format_invoice_response(inv)

@router.patch("/{invoice_id}", response_model=InvoiceResponse)
def update_existing_invoice(
    invoice_id: str,
    data: InvoiceUpdate,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    inv = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.business_id == business.id
    ).first()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")
    updated = update_invoice(db, inv, data, user_id=user.id)
    return format_invoice_response(updated)

@router.post("/{invoice_id}/issue", response_model=InvoiceResponse)
def issue_existing_invoice(
    invoice_id: str,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    inv = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.business_id == business.id
    ).first()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")
    issued = issue_invoice(db, inv, user_id=user.id)
    return format_invoice_response(issued)

@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
def cancel_existing_invoice(
    invoice_id: str,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    inv = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.business_id == business.id
    ).first()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")
    cancelled = cancel_invoice(db, inv, user_id=user.id)
    return format_invoice_response(cancelled)

@router.post("/{invoice_id}/checkout", response_model=CheckoutResponse)
def checkout_invoice(
    invoice_id: str,
    req: CheckoutRequest,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    inv = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.business_id == business.id
    ).first()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")

    payment, order_id, approval_url = paypal_service.create_order(
        db,
        invoice=inv,
        requested_amount=req.amount,
        idempotency_key=req.idempotency_key
    )

    return CheckoutResponse(
        payment_id=payment.id,
        invoice_id=inv.id,
        paypal_order_id=order_id,
        approval_url=approval_url,
        amount=payment.amount,
        currency=payment.currency,
        status=payment.status
    )

@router.post("/{invoice_id}/reminders/draft", response_model=ReminderDraftResponse)
def draft_reminder_endpoint(
    invoice_id: str,
    req: ReminderDraftRequest,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    inv = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.business_id == business.id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    return generate_reminder_draft(db, inv, tone=req.tone, custom_note=req.custom_note)

@router.post("/{invoice_id}/reminders/send", response_model=ReminderResponse)
def send_reminder_endpoint(
    invoice_id: str,
    req: ReminderSendRequest,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    inv = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.business_id == business.id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    rem = send_reminder(
        db=db,
        invoice=inv,
        subject=req.subject,
        body=req.body,
        recipient_email=req.recipient_email,
        simulate=req.simulate,
        user_id=user.id
    )

    resp = ReminderResponse.model_validate(rem)
    resp.invoice_number = inv.invoice_number
    resp.customer_name = inv.customer.name if inv.customer else ""
    return resp
