from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime
from decimal import Decimal

class ReminderDraftRequest(BaseModel):
    tone: Optional[str] = Field("polite", description="Tone: polite, firm, urgent")
    custom_note: Optional[str] = None

class ReminderDraftResponse(BaseModel):
    invoice_id: str
    customer_id: str
    customer_name: str
    recipient_email: str
    subject: str
    body: str
    amount_due: Decimal
    currency: str
    days_overdue: int

class ReminderSendRequest(BaseModel):
    subject: str
    body: str
    recipient_email: Optional[EmailStr] = None
    simulate: bool = False

class ReminderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    business_id: str
    invoice_id: str
    invoice_number: Optional[str] = None
    customer_id: str
    customer_name: Optional[str] = None
    channel: str
    recipient_email: str
    subject: str
    body: str
    status: str
    sent_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
