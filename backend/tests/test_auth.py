import pytest
from fastapi import HTTPException
from app.schemas.auth import UserRegister, UserLogin
from app.services.auth_service import register_user, authenticate_user
from app.core.security import verify_password, decode_access_token

def test_register_user_success(db):
    reg_data = UserRegister(
        email="newuser@startup.io",
        password="Password123!",
        full_name="Taylor Swift",
        business_name="Taylor Studios",
        currency="USD"
    )
    user, business, token = register_user(db, reg_data)
    assert user.email == "newuser@startup.io"
    assert business.name == "Taylor Studios"
    assert verify_password("Password123!", user.hashed_password)
    
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == user.id
    assert payload["business_id"] == business.id

def test_register_duplicate_email(db, test_setup):
    reg_data = UserRegister(
        email="owner@testcorp.com",
        password="Password123!",
        full_name="Imposter",
        business_name="Fake Business",
        currency="USD"
    )
    with pytest.raises(HTTPException) as exc_info:
        register_user(db, reg_data)
    assert exc_info.value.status_code == 400
    assert "already exists" in exc_info.value.detail

def test_authenticate_user_success(db, test_setup):
    login_data = UserLogin(
        email="owner@testcorp.com",
        password="SecurePassword123!"
    )
    user, business, token = authenticate_user(db, login_data)
    assert user.id == test_setup["user"].id
    assert business.id == test_setup["business"].id
    assert token is not None

def test_authenticate_user_invalid_password(db, test_setup):
    login_data = UserLogin(
        email="owner@testcorp.com",
        password="WrongPassword!"
    )
    with pytest.raises(HTTPException) as exc_info:
        authenticate_user(db, login_data)
    assert exc_info.value.status_code == 401
