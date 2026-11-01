from sqlalchemy import Column, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.models.base import TimestampMixin, generate_uuid

class Business(Base, TimestampMixin):
    __tablename__ = "businesses"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    currency = Column(String(3), default="USD", nullable=False)
    tax_id = Column(String(100), nullable=True)
    address = Column(String(500), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)

    # Relationships
    members = relationship("BusinessMember", back_populates="business", cascade="all, delete-orphan")
    customers = relationship("Customer", back_populates="business", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="business", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="business", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="business", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="business", cascade="all, delete-orphan")

class BusinessMember(Base, TimestampMixin):
    __tablename__ = "business_members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    business_id = Column(String(36), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), default="owner", nullable=False)  # owner, admin, member

    __table_args__ = (
        UniqueConstraint("business_id", "user_id", name="uq_business_member"),
    )

    # Relationships
    business = relationship("Business", back_populates="members")
    user = relationship("User", back_populates="businesses")
