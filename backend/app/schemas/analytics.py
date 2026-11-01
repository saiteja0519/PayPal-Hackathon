from pydantic import BaseModel
from typing import List, Dict, Optional
from decimal import Decimal
from datetime import date
from app.schemas.invoice import InvoiceResponse
from app.schemas.payment import PaymentResponse

class MetricCard(BaseModel):
    value: Decimal
    formatted: str
    count: Optional[int] = None
    change_percentage: Optional[float] = None

class DashboardSummaryResponse(BaseModel):
    currency: str
    total_invoiced: Decimal
    total_paid: Decimal
    outstanding_balance: Decimal
    overdue_balance: Decimal
    unpaid_invoices_count: int
    overdue_invoices_count: int
    paid_invoices_count: int
    total_customers_count: int
    status_distribution: Dict[str, int]
    recent_invoices: List[InvoiceResponse]
    recent_payments: List[PaymentResponse]

class MonthlyDataPoint(BaseModel):
    month: str  # YYYY-MM
    invoiced: Decimal
    paid: Decimal
    count_invoices: int
    count_payments: int

class MonthlySummaryResponse(BaseModel):
    currency: str
    data: List[MonthlyDataPoint]

class AgingBucket(BaseModel):
    range: str  # e.g. "Current (0-30 days)", "31-60 days", etc.
    amount: Decimal
    invoice_count: int

class AgingReportResponse(BaseModel):
    currency: str
    buckets: List[AgingBucket]
    total_outstanding: Decimal
