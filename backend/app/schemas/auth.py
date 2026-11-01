from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
import email_validator
email_validator.CHECK_DELIVERABILITY = False

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=100)
    business_name: str = Field(..., min_length=2, max_length=100)
    currency: str = Field("USD", min_length=3, max_length=3)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    business_id: str
    business_name: str
    currency: str
    full_name: str
    email: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    full_name: str
    is_active: bool
    created_at: datetime

class BusinessResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    currency: str
    tax_id: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    owner_id: str
    role: str

class BusinessUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    tax_id: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None

class AuthMeResponse(BaseModel):
    user: UserResponse
    business: BusinessResponse
    businesses: List[BusinessResponse]
