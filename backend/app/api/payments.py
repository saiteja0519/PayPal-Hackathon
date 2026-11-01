from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
from app.db.session import get_db
from app.models.payment import Payment
from app.models.invoice import Invoice
from app.models.business import Business
from app.models.user import User
from app.schemas.payment import (
    CaptureRequest,
    CaptureResponse,
    PaymentResponse,
)
from app.services.auth_service import get_current_user, get_current_business
from app.services.paypal_service import paypal_service

router = APIRouter(prefix="/payments", tags=["Payments"])

def format_payment_response(p: Payment) -> PaymentResponse:
    resp = PaymentResponse.model_validate(p)
    resp.invoice_number = p.invoice.invoice_number if p.invoice else ""
    resp.customer_name = p.invoice.customer.name if p.invoice and p.invoice.customer else ""
    return resp

@router.get("", response_model=List[PaymentResponse])
def list_payments(
    status_filter: Optional[str] = None,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    query = db.query(Payment).filter(Payment.business_id == business.id)
    if status_filter:
        query = query.filter(Payment.status == status_filter.lower())
    payments = query.order_by(Payment.created_at.desc()).all()
    return [format_payment_response(p) for p in payments]

@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: str,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    p = db.query(Payment).filter(
        Payment.id == payment_id,
        Payment.business_id == business.id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found.")
    return format_payment_response(p)

@router.post("/{payment_id}/capture", response_model=CaptureResponse)
def capture_payment(
    payment_id: str,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    # Verify payment belongs to business
    p = db.query(Payment).filter(
        Payment.id == payment_id,
        Payment.business_id == business.id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found in this business.")

    captured_payment = paypal_service.capture_order(db, payment_id)
    invoice = db.query(Invoice).filter(Invoice.id == captured_payment.invoice_id).first()

    return CaptureResponse(
        payment_id=captured_payment.id,
        invoice_id=captured_payment.invoice_id,
        paypal_order_id=captured_payment.provider_order_id or "",
        paypal_capture_id=captured_payment.provider_capture_id,
        status=captured_payment.status,
        amount_captured=captured_payment.amount,
        currency=captured_payment.currency,
        new_invoice_balance=invoice.balance_due if invoice else Decimal("0.00"),
        new_invoice_status=invoice.status if invoice else "unknown",
        message="Payment successfully captured and reconciled."
    )
