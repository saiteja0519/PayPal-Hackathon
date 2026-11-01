from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal

class InvoiceItemCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    quantity: Decimal = Field(..., gt=0)
    unit_price: Decimal = Field(..., ge=0)

class InvoiceItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    invoice_id: str
    description: str
    quantity: Decimal
    unit_price: Decimal
    amount: Decimal

class InvoiceCreate(BaseModel):
    customer_id: str
    invoice_number: Optional[str] = None
    issue_date: date
    due_date: date
    currency: Optional[str] = "USD"
    tax_rate: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)
    notes: Optional[str] = None
    terms: Optional[str] = None
    items: List[InvoiceItemCreate] = Field(..., min_length=1)

class InvoiceUpdate(BaseModel):
    customer_id: Optional[str] = None
    invoice_number: Optional[str] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    tax_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    notes: Optional[str] = None
    terms: Optional[str] = None
    items: Optional[List[InvoiceItemCreate]] = None

class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    business_id: str
    customer_id: str
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    invoice_number: str
    issue_date: date
    due_date: date
    currency: str
    status: str
    subtotal: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    pending_amount: Decimal
    refunded_amount: Decimal
    balance_due: Decimal
    notes: Optional[str] = None
    terms: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[InvoiceItemResponse] = []

class InvoiceFilter(BaseModel):
    status: Optional[str] = None
    customer_id: Optional[str] = None
    search: Optional[str] = None
    is_overdue: Optional[bool] = None
    limit: int = 50
    offset: int = 0
