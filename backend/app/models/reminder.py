from sqlalchemy import Column, String, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.models.base import TimestampMixin, generate_uuid

class Reminder(Base, TimestampMixin):
    __tablename__ = "reminders"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    business_id = Column(String(36), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    
    channel = Column(String(50), default="email", nullable=False)  # email, simulated
    recipient_email = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String(30), default="draft", nullable=False)  # draft, scheduled, sent, failed
    sent_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    # Relationships
    business = relationship("Business", back_populates="reminders")
    invoice = relationship("Invoice", back_populates="reminders")
    customer = relationship("Customer", back_populates="reminders")
