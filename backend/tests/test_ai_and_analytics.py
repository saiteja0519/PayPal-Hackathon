import pytest
from datetime import date, timedelta
from decimal import Decimal
from app.schemas.invoice import InvoiceCreate, InvoiceItemCreate
from app.services.invoice_service import create_invoice, issue_invoice, recalculate_invoice_status
from app.services.analytics_service import get_dashboard_summary, get_aging_report
from app.services.reminder_service import generate_reminder_draft, send_reminder
from app.services.ai_service import ai_service, AITools

def test_dashboard_summary_and_aging_metrics(db, test_setup):
    biz = test_setup["business"]
    cust = test_setup["customer"]
    today = date.today()

    # Invoice 1: Overdue
    inv1 = create_invoice(db, biz, InvoiceCreate(
        customer_id=cust.id,
        issue_date=today - timedelta(days=20),
        due_date=today - timedelta(days=5),
        items=[InvoiceItemCreate(description="Service 1", quantity=Decimal("1"), unit_price=Decimal("800.00"))]
    ))
    issue_invoice(db, inv1)
    recalculate_invoice_status(inv1)

    # Invoice 2: Upcoming
    inv2 = create_invoice(db, biz, InvoiceCreate(
        customer_id=cust.id,
        issue_date=today,
        due_date=today + timedelta(days=10),
        items=[InvoiceItemCreate(description="Service 2", quantity=Decimal("1"), unit_price=Decimal("1200.00"))]
    ))
    issue_invoice(db, inv2)

    # Check dashboard summary
    summary = get_dashboard_summary(db, biz)
    assert summary.total_invoiced == Decimal("2000.00")
    assert summary.outstanding_balance == Decimal("2000.00")
    assert summary.overdue_balance == Decimal("800.00")
    assert summary.overdue_invoices_count == 1
    assert summary.unpaid_invoices_count == 2

    # Check aging report
    aging = get_aging_report(db, biz)
    assert aging.total_outstanding == Decimal("2000.00")
    assert len(aging.buckets) == 4

def test_reminder_drafting_and_sending(db, test_setup):
    biz = test_setup["business"]
    cust = test_setup["customer"]
    today = date.today()

    inv = create_invoice(db, biz, InvoiceCreate(
        customer_id=cust.id,
        issue_date=today - timedelta(days=30),
        due_date=today - timedelta(days=10),
        items=[InvoiceItemCreate(description="Quarterly Consulting", quantity=Decimal("1"), unit_price=Decimal("3000.00"))]
    ))
    issue_invoice(db, inv)
    recalculate_invoice_status(inv)

    # Draft
    draft = generate_reminder_draft(db, inv, tone="firm")
    assert "past due" in draft.subject.lower() or "reminder" in draft.subject.lower()
    assert draft.amount_due == Decimal("3000.00")
    assert draft.recipient_email == cust.email

    # Send (simulated)
    reminder = send_reminder(db, inv, subject=draft.subject, body=draft.body, simulate=True)
    assert reminder.status == "sent"
    assert reminder.channel == "simulated"
    assert reminder.sent_at is not None

def test_ai_financial_assistant_tools(db, test_setup):
    biz = test_setup["business"]
    cust = test_setup["customer"]
    user = test_setup["user"]
    today = date.today()

    inv = create_invoice(db, biz, InvoiceCreate(
        customer_id=cust.id,
        issue_date=today - timedelta(days=15),
        due_date=today - timedelta(days=2),
        items=[InvoiceItemCreate(description="App Development", quantity=Decimal("1"), unit_price=Decimal("5500.00"))]
    ))
    issue_invoice(db, inv)
    recalculate_invoice_status(inv)

    # Query 1: Overdue
    res1 = ai_service.chat(db, biz, user.id, "Show me all overdue invoices")
    assert "list_overdue_invoices" in res1["tools_executed"]
    assert "5,500.00" in res1["reply"] or "5500" in res1["reply"]

    # Query 2: Summary
    res2 = ai_service.chat(db, biz, user.id, "What is my financial status?")
    assert "get_dashboard_summary" in res2["tools_executed"]
    assert res2["configured"] is not None

    # Query 3: Reminder
    res3 = ai_service.chat(db, biz, user.id, f"Draft a reminder for {inv.invoice_number}")
    assert "draft_payment_reminder" in res3["tools_executed"]
    assert "Subject:" in res3["reply"]
