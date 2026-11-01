import pytest
from datetime import date, timedelta
from decimal import Decimal
from fastapi import HTTPException
from app.schemas.invoice import InvoiceCreate, InvoiceItemCreate, InvoiceUpdate
from app.services.invoice_service import (
    create_invoice,
    update_invoice,
    issue_invoice,
    cancel_invoice,
    recalculate_invoice_status,
)

def test_create_invoice_financial_calculations(db, test_setup):
    biz = test_setup["business"]
    cust = test_setup["customer"]
    today = date.today()

    data = InvoiceCreate(
        customer_id=cust.id,
        issue_date=today,
        due_date=today + timedelta(days=14),
        tax_rate=Decimal("10.00"),
        items=[
            InvoiceItemCreate(description="Design Consultation", quantity=Decimal("2"), unit_price=Decimal("500.00")),
            InvoiceItemCreate(description="Prototyping", quantity=Decimal("1"), unit_price=Decimal("1000.00")),
        ]
    )
    inv = create_invoice(db, biz, data)
    assert inv.subtotal == Decimal("2000.00")
    assert inv.tax_amount == Decimal("200.00")
    assert inv.total_amount == Decimal("2200.00")
    assert inv.balance_due == Decimal("2200.00")
    assert inv.status == "draft"
    assert len(inv.items) == 2

def test_due_date_preceding_issue_date(db, test_setup):
    biz = test_setup["business"]
    cust = test_setup["customer"]
    today = date.today()

    data = InvoiceCreate(
        customer_id=cust.id,
        issue_date=today,
        due_date=today - timedelta(days=5),
        tax_rate=Decimal("0.00"),
        items=[InvoiceItemCreate(description="Dev", quantity=Decimal("1"), unit_price=Decimal("100.00"))]
    )
    with pytest.raises(HTTPException) as exc_info:
        create_invoice(db, biz, data)
    assert exc_info.value.status_code == 400
    assert "precede" in exc_info.value.detail

def test_invoice_lifecycle_issue_and_cancel(db, test_setup):
    biz = test_setup["business"]
    cust = test_setup["customer"]
    today = date.today()

    data = InvoiceCreate(
        customer_id=cust.id,
        issue_date=today,
        due_date=today + timedelta(days=7),
        items=[InvoiceItemCreate(description="Dev", quantity=Decimal("1"), unit_price=Decimal("500.00"))]
    )
    inv = create_invoice(db, biz, data)
    assert inv.status == "draft"

    # Issue
    issued = issue_invoice(db, inv)
    assert issued.status == "issued"

    # Cancel
    cancelled = cancel_invoice(db, inv)
    assert cancelled.status == "cancelled"

def test_cannot_modify_items_after_payment(db, test_setup):
    biz = test_setup["business"]
    cust = test_setup["customer"]
    today = date.today()

    data = InvoiceCreate(
        customer_id=cust.id,
        issue_date=today,
        due_date=today + timedelta(days=7),
        items=[InvoiceItemCreate(description="Dev", quantity=Decimal("1"), unit_price=Decimal("500.00"))]
    )
    inv = create_invoice(db, biz, data)
    inv.paid_amount = Decimal("200.00")  # Simulate partial payment recorded

    with pytest.raises(HTTPException) as exc_info:
        update_invoice(db, inv, InvoiceUpdate(items=[InvoiceItemCreate(description="Changed", quantity=Decimal("1"), unit_price=Decimal("999.00"))]))
    assert exc_info.value.status_code == 400
    assert "recorded payments" in exc_info.value.detail

def test_recalculate_overdue_status(db, test_setup):
    biz = test_setup["business"]
    cust = test_setup["customer"]
    past_due = date.today() - timedelta(days=10)

    data = InvoiceCreate(
        customer_id=cust.id,
        issue_date=past_due - timedelta(days=30),
        due_date=past_due,
        items=[InvoiceItemCreate(description="Hosting", quantity=Decimal("1"), unit_price=Decimal("300.00"))]
    )
    inv = create_invoice(db, biz, data)
    issue_invoice(db, inv)

    status = recalculate_invoice_status(inv)
    assert status == "overdue"
    assert inv.balance_due == Decimal("300.00")
