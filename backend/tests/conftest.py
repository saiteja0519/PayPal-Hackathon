import pytest
from decimal import Decimal
from datetime import date, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import email_validator
email_validator.CHECK_DELIVERABILITY = False

from app.db.session import Base
from app.models.user import User
from app.models.business import Business, BusinessMember
from app.models.customer import Customer
from app.core.security import hash_password

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def test_setup(db):
    user = User(
        email="owner@testcorp.com",
        hashed_password=hash_password("SecurePassword123!"),
        full_name="Jordan Vance",
        is_active=True
    )
    db.add(user)
    db.flush()

    business = Business(
        name="Test Corp",
        currency="USD",
        owner_id=user.id
    )
    db.add(business)
    db.flush()

    member = BusinessMember(
        business_id=business.id,
        user_id=user.id,
        role="owner"
    )
    db.add(member)

    customer = Customer(
        business_id=business.id,
        name="Acme Corp",
        email="contact@acmecorp.test",
        company_name="Acme Corporation"
    )
    db.add(customer)
    db.commit()
    db.refresh(user)
    db.refresh(business)
    db.refresh(customer)

    return {
        "user": user,
        "business": business,
        "customer": customer
    }
