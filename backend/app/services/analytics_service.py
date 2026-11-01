import io
import csv
from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, List, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.customer import Customer
from app.models.business import Business
from app.schemas.analytics import (
    DashboardSummaryResponse,
    MonthlySummaryResponse,
    MonthlyDataPoint,
    AgingReportResponse,
    AgingBucket
)
from app.schemas.invoice import InvoiceResponse
from app.schemas.payment import PaymentResponse

def get_dashboard_summary(db: Session, business: Business) -> DashboardSummaryResponse:
    today = date.today()
    invoices = db.query(Invoice).filter(Invoice.business_id == business.id).all()
    
    total_invoiced = Decimal("0.00")
    total_paid = Decimal("0.00")
    outstanding_balance = Decimal("0.00")
    overdue_balance = Decimal("0.00")
    unpaid_count = 0
    overdue_count = 0
    paid_count = 0
    
    status_counts = {
        "draft": 0,
        "issued": 0,
        "partially_paid": 0,
        "paid": 0,
        "overdue": 0,
        "cancelled": 0
    }

    for inv in invoices:
        status_counts[inv.status] = status_counts.get(inv.status, 0) + 1
        
        if inv.status != "cancelled":
            total_invoiced += inv.total_amount
            total_paid += inv.paid_amount
            
            if inv.balance_due > Decimal("0.00"):
                outstanding_balance += inv.balance_due
                unpaid_count += 1
                
                if inv.due_date < today or inv.status == "overdue":
                    overdue_balance += inv.balance_due
                    overdue_count += 1
            else:
                paid_count += 1

    total_customers = db.query(func.count(Customer.id)).filter(Customer.business_id == business.id).scalar() or 0

    recent_invoices_query = (
        db.query(Invoice)
        .filter(Invoice.business_id == business.id)
        .order_by(Invoice.created_at.desc())
        .limit(6)
        .all()
    )
    
    recent_invoices_resp = []
    for inv in recent_invoices_query:
        resp = InvoiceResponse.model_validate(inv)
        resp.customer_name = inv.customer.name if inv.customer else "Unknown"
        resp.customer_email = inv.customer.email if inv.customer else ""
        recent_invoices_resp.append(resp)

    recent_payments_query = (
        db.query(Payment)
        .filter(Payment.business_id == business.id)
        .order_by(Payment.created_at.desc())
        .limit(6)
        .all()
    )

    recent_payments_resp = []
    for p in recent_payments_query:
        resp = PaymentResponse.model_validate(p)
        resp.invoice_number = p.invoice.invoice_number if p.invoice else ""
        resp.customer_name = p.invoice.customer.name if p.invoice and p.invoice.customer else ""
        recent_payments_resp.append(resp)

    return DashboardSummaryResponse(
        currency=business.currency,
        total_invoiced=total_invoiced,
        total_paid=total_paid,
        outstanding_balance=outstanding_balance,
        overdue_balance=overdue_balance,
        unpaid_invoices_count=unpaid_count,
        overdue_invoices_count=overdue_count,
        paid_invoices_count=paid_count,
        total_customers_count=total_customers,
        status_distribution=status_counts,
        recent_invoices=recent_invoices_resp,
        recent_payments=recent_payments_resp
    )

def get_monthly_summary(db: Session, business: Business, months_back: int = 6) -> MonthlySummaryResponse:
    today = date.today()
    # Build list of last N months
    months_list = []
    for i in range(months_back - 1, -1, -1):
        # calculate approximate first day of month
        year = today.year
        month = today.month - i
        while month <= 0:
            month += 12
            year -= 1
        months_list.append(f"{year:04d}-{month:02d}")

    # Gather invoices grouped by YYYY-MM
    invoices = db.query(Invoice).filter(
        Invoice.business_id == business.id,
        Invoice.status != "cancelled"
    ).all()

    payments = db.query(Payment).filter(
        Payment.business_id == business.id,
        Payment.status == "completed"
    ).all()

    invoiced_by_month: Dict[str, Decimal] = {m: Decimal("0.00") for m in months_list}
    inv_count_by_month: Dict[str, int] = {m: 0 for m in months_list}
    
    paid_by_month: Dict[str, Decimal] = {m: Decimal("0.00") for m in months_list}
    pay_count_by_month: Dict[str, int] = {m: 0 for m in months_list}

    for inv in invoices:
        m_str = inv.issue_date.strftime("%Y-%m")
        if m_str in invoiced_by_month:
            invoiced_by_month[m_str] += inv.total_amount
            inv_count_by_month[m_str] += 1

    for p in payments:
        if p.created_at:
            m_str = p.created_at.strftime("%Y-%m")
            if m_str in paid_by_month:
                paid_by_month[m_str] += p.amount
                pay_count_by_month[m_str] += 1

    datapoints = []
    for m in months_list:
        datapoints.append(MonthlyDataPoint(
            month=m,
            invoiced=invoiced_by_month[m],
            paid=paid_by_month[m],
            count_invoices=inv_count_by_month[m],
            count_payments=pay_count_by_month[m]
        ))

    return MonthlySummaryResponse(
        currency=business.currency,
        data=datapoints
    )

def get_aging_report(db: Session, business: Business) -> AgingReportResponse:
    today = date.today()
    invoices = db.query(Invoice).filter(
        Invoice.business_id == business.id,
        Invoice.balance_due > Decimal("0.00"),
        Invoice.status.notin_(["draft", "cancelled"])
    ).all()

    b_current = Decimal("0.00")
    b_30 = Decimal("0.00")
    b_60 = Decimal("0.00")
    b_90_plus = Decimal("0.00")

    c_current = 0
    c_30 = 0
    c_60 = 0
    c_90_plus = 0

    total_outstanding = Decimal("0.00")

    for inv in invoices:
        total_outstanding += inv.balance_due
        diff = (today - inv.due_date).days
        if diff <= 0:
            b_current += inv.balance_due
            c_current += 1
        elif 1 <= diff <= 30:
            b_30 += inv.balance_due
            c_30 += 1
        elif 31 <= diff <= 60:
            b_60 += inv.balance_due
            c_60 += 1
        else:
            b_90_plus += inv.balance_due
            c_90_plus += 1

    buckets = [
        AgingBucket(range="Current / Upcoming", amount=b_current, invoice_count=c_current),
        AgingBucket(range="1-30 Days Overdue", amount=b_30, invoice_count=c_30),
        AgingBucket(range="31-60 Days Overdue", amount=b_60, invoice_count=c_60),
        AgingBucket(range="61+ Days Overdue", amount=b_90_plus, invoice_count=c_90_plus)
    ]

    return AgingReportResponse(
        currency=business.currency,
        buckets=buckets,
        total_outstanding=total_outstanding
    )

def export_invoices_csv(db: Session, business: Business) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Invoice Number", "Customer Name", "Customer Email", "Issue Date", "Due Date",
        "Currency", "Subtotal", "Tax Rate (%)", "Tax Amount", "Total Amount",
        "Paid Amount", "Balance Due", "Status"
    ])

    invoices = db.query(Invoice).filter(Invoice.business_id == business.id).order_by(Invoice.issue_date.desc()).all()
    for inv in invoices:
        cust_name = inv.customer.name if inv.customer else ""
        cust_email = inv.customer.email if inv.customer else ""
        writer.writerow([
            inv.invoice_number, cust_name, cust_email, inv.issue_date, inv.due_date,
            inv.currency, f"{inv.subtotal:.2f}", f"{inv.tax_rate:.2f}", f"{inv.tax_amount:.2f}",
            f"{inv.total_amount:.2f}", f"{inv.paid_amount:.2f}", f"{inv.balance_due:.2f}", inv.status
        ])

    return output.getvalue()
