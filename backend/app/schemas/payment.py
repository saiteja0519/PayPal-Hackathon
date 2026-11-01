from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from decimal import Decimal

class CheckoutRequest(BaseModel):
    amount: Optional[Decimal] = Field(None, gt=0, description="Amount to pay. If omitted, full balance due will be charged.")
    idempotency_key: Optional[str] = None

class CheckoutResponse(BaseModel):
    payment_id: str
    invoice_id: str
    paypal_order_id: str
    approval_url: Optional[str] = None
    amount: Decimal
    currency: str
    status: str

class CaptureRequest(BaseModel):
    paypal_order_id: str

class CaptureResponse(BaseModel):
    payment_id: str
    invoice_id: str
    paypal_order_id: str
    paypal_capture_id: Optional[str] = None
    status: str
    amount_captured: Decimal
    currency: str
    new_invoice_balance: Decimal
    new_invoice_status: str
    message: str

class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    business_id: str
    invoice_id: str
    invoice_number: Optional[str] = None
    customer_name: Optional[str] = None
    amount: Decimal
    currency: str
    status: str
    payment_method: str
    provider: str
    provider_order_id: Optional[str] = None
    provider_capture_id: Optional[str] = None
    provider_status: Optional[str] = None
    refund_amount: Decimal = Decimal("0.00")
    created_at: datetime
    updated_at: datetime

class RefundRequest(BaseModel):
    amount: Optional[Decimal] = Field(None, gt=0)
    reason: Optional[str] = "Customer requested refund"
