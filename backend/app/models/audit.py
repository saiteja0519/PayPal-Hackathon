from sqlalchemy import Column, String, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.session import Base
from app.models.base import generate_uuid, get_utc_now

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    business_id = Column(String(36), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), nullable=True)
    action = Column(String(100), nullable=False)  # invoice.created, invoice.issued, payment.captured, reminder.sent, etc.
    entity_type = Column(String(50), nullable=False)  # invoice, payment, customer, reminder
    entity_id = Column(String(36), nullable=False)
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=get_utc_now, nullable=False, index=True)

    # Relationships
    business = relationship("Business", back_populates="audit_logs")
