from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models.user import User
from app.models.business import Business, BusinessMember
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    Token,
    UserResponse,
    BusinessResponse,
    BusinessUpdate,
    AuthMeResponse,
)
from app.services.auth_service import (
    register_user,
    authenticate_user,
    get_current_user,
    get_current_business,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(reg_data: UserRegister, db: Session = Depends(get_db)):
    user, business, token = register_user(db, reg_data)
    return Token(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        business_id=business.id,
        business_name=business.name,
        currency=business.currency,
        full_name=user.full_name,
        email=user.email,
    )

@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user, business, token = authenticate_user(db, login_data)
    return Token(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        business_id=business.id,
        business_name=business.name,
        currency=business.currency,
        full_name=user.full_name,
        email=user.email,
    )

@router.post("/logout")
def logout():
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=AuthMeResponse)
def get_me(
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    memberships = db.query(BusinessMember).filter(BusinessMember.user_id == user.id).all()
    businesses_list = []
    current_role = "member"

    for m in memberships:
        biz = db.query(Business).filter(Business.id == m.business_id).first()
        if biz:
            if biz.id == business.id:
                current_role = m.role
            businesses_list.append(
                BusinessResponse(
                    id=biz.id,
                    name=biz.name,
                    currency=biz.currency,
                    tax_id=biz.tax_id,
                    address=biz.address,
                    phone=biz.phone,
                    email=biz.email,
                    owner_id=biz.owner_id,
                    role=m.role
                )
            )

    curr_biz_resp = BusinessResponse(
        id=business.id,
        name=business.name,
        currency=business.currency,
        tax_id=business.tax_id,
        address=business.address,
        phone=business.phone,
        email=business.email,
        owner_id=business.owner_id,
        role=current_role
    )

    return AuthMeResponse(
        user=UserResponse.model_validate(user),
        business=curr_biz_resp,
        businesses=businesses_list
    )

@router.patch("/business", response_model=BusinessResponse)
def update_business_settings(
    update_data: BusinessUpdate,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    if update_data.name is not None:
        business.name = update_data.name
    if update_data.currency is not None:
        business.currency = update_data.currency.upper()
    if update_data.tax_id is not None:
        business.tax_id = update_data.tax_id
    if update_data.address is not None:
        business.address = update_data.address
    if update_data.phone is not None:
        business.phone = update_data.phone
    if update_data.email is not None:
        business.email = update_data.email

    db.commit()
    db.refresh(business)
    return BusinessResponse(
        id=business.id,
        name=business.name,
        currency=business.currency,
        tax_id=business.tax_id,
        address=business.address,
        phone=business.phone,
        email=business.email,
        owner_id=business.owner_id,
        role="owner"
    )
