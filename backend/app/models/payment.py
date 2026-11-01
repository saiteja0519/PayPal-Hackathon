from sqlalchemy import Column, String, ForeignKey, Numeric, Text, DateTime, Index
from sqlalchemy.orm import relationship
from decimal import Decimal
from app.db.session import Base
from app.models.base import TimestampMixin, generate_uuid

class Payment(Base, TimestampMixin):
    __tablename__ = "payments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    business_id = Column(String(36), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    
    amount = Column(Numeric(14, 2, asdecimal=True), default=Decimal("0.00"), nullable=False)
    currency = Column(String(3), default="USD", nullable=False)
    status = Column(String(30), default="initiated", nullable=False)  # initiated, pending, completed, failed, refunded
    payment_method = Column(String(50), default="paypal", nullable=False)
    
    # PayPal identifiers & details
    provider = Column(String(50), default="paypal", nullable=False)
    provider_order_id = Column(String(100), nullable=True, index=True)
    provider_capture_id = Column(String(100), nullable=True, index=True)
    provider_payer_id = Column(String(100), nullable=True)
    provider_payer_email = Column(String(255), nullable=True)
    provider_status = Column(String(50), nullable=True)
    provider_raw_response = Column(Text, nullable=True)
    
    # Safety and idempotency
    idempotency_key = Column(String(100), unique=True, nullable=True, index=True)
    error_message = Column(Text, nullable=True)
    refund_amount = Column(Numeric(14, 2, asdecimal=True), default=Decimal("0.00"), nullable=False)
    refund_reason = Column(String(255), nullable=True)
    refunded_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("idx_payment_business_status", "business_id", "status"),
    )

    # Relationships
    business = relationship("Business", back_populates="payments")
    invoice = relationship("Invoice", back_populates="payments")
