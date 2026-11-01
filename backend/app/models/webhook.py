from sqlalchemy import Column, String, Text, UniqueConstraint
from app.db.session import Base
from app.models.base import TimestampMixin, generate_uuid

class WebhookEvent(Base, TimestampMixin):
    __tablename__ = "webhook_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    provider = Column(String(50), default="paypal", nullable=False)
    event_id = Column(String(100), nullable=False)
    event_type = Column(String(100), nullable=False)
    status = Column(String(30), default="received", nullable=False)  # received, processed, ignored, failed
    payload = Column(Text, nullable=False)
    error_message = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("provider", "event_id", name="uq_webhook_provider_event_id"),
    )
