from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime
from decimal import Decimal

class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    company_name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = Field(None, max_length=500)

class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    company_name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = Field(None, max_length=500)

class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    business_id: str
    name: str
    email: str
    company_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    total_invoiced: Decimal = Decimal("0.00")
    total_paid: Decimal = Decimal("0.00")
    outstanding_balance: Decimal = Decimal("0.00")
    invoice_count: int = 0
