import pytest
from datetime import date, timedelta
from decimal import Decimal
from fastapi import HTTPException
from app.schemas.invoice import InvoiceCreate, InvoiceItemCreate
from app.services.invoice_service import create_invoice, issue_invoice
from app.services.paypal_service import paypal_service

def test_paypal_order_creation_and_capture_flow(db, test_setup):
    biz = test_setup["business"]
    cust = test_setup["customer"]
    today = date.today()

    data = InvoiceCreate(
        customer_id=cust.id,
        issue_date=today,
        due_date=today + timedelta(days=10),
        items=[InvoiceItemCreate(description="Service Package", quantity=Decimal("1"), unit_price=Decimal("1200.00"))]
    )
    inv = create_invoice(db, biz, data)
    issue_invoice(db, inv)

    # 1. Create PayPal Order
    payment, order_id, approval_url = paypal_service.create_order(
        db, invoice=inv, idempotency_key="unique-test-key-01"
    )
    assert payment.status == "initiated"
    assert payment.amount == Decimal("1200.00")
    assert payment.provider_order_id == order_id
    assert inv.pending_amount == Decimal("1200.00")

    # 2. Capture Order
    captured = paypal_service.capture_order(db, payment.id)
    assert captured.status == "completed"
    assert captured.provider_capture_id is not None
    assert inv.paid_amount == Decimal("1200.00")
    assert inv.balance_due == Decimal("0.00")
    assert inv.status == "paid"

    # 3. Idempotent re-capture should return without error
    re_captured = paypal_service.capture_order(db, payment.id)
    assert re_captured.status == "completed"
    assert inv.paid_amount == Decimal("1200.00")

def test_cannot_checkout_draft_invoice(db, test_setup):
    biz = test_setup["business"]
    cust = test_setup["customer"]
    today = date.today()

    data = InvoiceCreate(
        customer_id=cust.id,
        issue_date=today,
        due_date=today + timedelta(days=10),
        items=[InvoiceItemCreate(description="Dev", quantity=Decimal("1"), unit_price=Decimal("500.00"))]
    )
    inv = create_invoice(db, biz, data)  # draft

    with pytest.raises(HTTPException) as exc_info:
        paypal_service.create_order(db, invoice=inv)
    assert exc_info.value.status_code == 400
    assert "draft" in exc_info.value.detail

def test_synthetic_webhook_processing_and_deduplication(db):
    event_data = {
        "id": "WH-TEST-UNIQUE-001",
        "event_type": "PAYMENT.CAPTURE.COMPLETED",
        "resource": {
            "id": "CAP-MOCK-9999",
            "custom_id": "INV-MOCK-9999",
            "amount": {"value": "450.00", "currency_code": "USD"}
        }
    }
    status1, msg1 = paypal_service.process_webhook_event(db, event_data)
    assert status1 in ("processed", "ignored")

    # Duplicate call
    status2, msg2 = paypal_service.process_webhook_event(db, event_data)
    assert "Duplicate" in msg2
