from sqlalchemy import Column, String, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.models.base import TimestampMixin, generate_uuid

class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    business_id = Column(String(36), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(String(500), nullable=True)

    __table_args__ = (
        Index("idx_customer_business_email", "business_id", "email"),
    )

    # Relationships
    business = relationship("Business", back_populates="customers")
    invoices = relationship("Invoice", back_populates="customer", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="customer", cascade="all, delete-orphan")
