from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Optional, Tuple
from app.db.session import get_db
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.models.user import User
from app.models.business import Business, BusinessMember
from app.schemas.auth import UserRegister, UserLogin, Token, BusinessResponse
from app.services.audit_service import log_audit_event

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def register_user(db: Session, reg_data: UserRegister) -> Tuple[User, Business, str]:
    # Check if email exists
    existing = db.query(User).filter(User.email == reg_data.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    # Create user
    user = User(
        email=reg_data.email.lower(),
        hashed_password=hash_password(reg_data.password),
        full_name=reg_data.full_name,
        is_active=True
    )
    db.add(user)
    db.flush()

    # Create primary business
    business = Business(
        name=reg_data.business_name,
        currency=reg_data.currency.upper(),
        owner_id=user.id,
        email=user.email
    )
    db.add(business)
    db.flush()

    # Create membership as owner
    member = BusinessMember(
        business_id=business.id,
        user_id=user.id,
        role="owner"
    )
    db.add(member)
    db.commit()
    db.refresh(user)
    db.refresh(business)

    log_audit_event(
        db,
        business_id=business.id,
        user_id=user.id,
        action="auth.registered",
        entity_type="user",
        entity_id=user.id,
        details={"email": user.email, "business": business.name}
    )

    token = create_access_token(
        subject=user.id,
        claims={"business_id": business.id, "email": user.email}
    )
    return user, business, token

def authenticate_user(db: Session, login_data: UserLogin) -> Tuple[User, Business, str]:
    user = db.query(User).filter(User.email == login_data.email.lower()).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is deactivated."
        )

    # Get primary business
    membership = db.query(BusinessMember).filter(BusinessMember.user_id == user.id).first()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No business account found for this user."
        )

    business = db.query(Business).filter(Business.id == membership.business_id).first()
    
    token = create_access_token(
        subject=user.id,
        claims={"business_id": business.id, "email": user.email}
    )

    log_audit_event(
        db,
        business_id=business.id,
        user_id=user.id,
        action="auth.login",
        entity_type="user",
        entity_id=user.id
    )

    return user, business, token

def get_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload["sub"]
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def get_current_business(
    token: Optional[str] = Depends(oauth2_scheme),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Business:
    payload = decode_access_token(token)
    business_id = payload.get("business_id") if payload else None
    
    if business_id:
        # Verify user is actually a member of this business
        membership = db.query(BusinessMember).filter(
            BusinessMember.user_id == user.id,
            BusinessMember.business_id == business_id
        ).first()
        if membership:
            biz = db.query(Business).filter(Business.id == business_id).first()
            if biz:
                return biz

    # Fallback to user's first business
    membership = db.query(BusinessMember).filter(BusinessMember.user_id == user.id).first()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not associated with any business."
        )
    business = db.query(Business).filter(Business.id == membership.business_id).first()
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found."
        )
    return business
