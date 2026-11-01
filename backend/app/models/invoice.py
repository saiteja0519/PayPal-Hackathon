from sqlalchemy import Column, String, ForeignKey, Date, Numeric, Text, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from decimal import Decimal
from app.db.session import Base
from app.models.base import TimestampMixin, generate_uuid

class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    business_id = Column(String(36), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    invoice_number = Column(String(50), nullable=False)
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    currency = Column(String(3), default="USD", nullable=False)
    status = Column(String(30), default="draft", nullable=False)  # draft, issued, partially_paid, paid, overdue, cancelled
    
    # Financial fields (fixed precision Decimal)
    subtotal = Column(Numeric(14, 2, asdecimal=True), default=Decimal("0.00"), nullable=False)
    tax_rate = Column(Numeric(5, 2, asdecimal=True), default=Decimal("0.00"), nullable=False)
    tax_amount = Column(Numeric(14, 2, asdecimal=True), default=Decimal("0.00"), nullable=False)
    total_amount = Column(Numeric(14, 2, asdecimal=True), default=Decimal("0.00"), nullable=False)
    paid_amount = Column(Numeric(14, 2, asdecimal=True), default=Decimal("0.00"), nullable=False)
    pending_amount = Column(Numeric(14, 2, asdecimal=True), default=Decimal("0.00"), nullable=False)
    refunded_amount = Column(Numeric(14, 2, asdecimal=True), default=Decimal("0.00"), nullable=False)
    balance_due = Column(Numeric(14, 2, asdecimal=True), default=Decimal("0.00"), nullable=False)
    
    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("business_id", "invoice_number", name="uq_business_invoice_number"),
        Index("idx_invoice_status_due", "business_id", "status", "due_date"),
    )

    # Relationships
    business = relationship("Business", back_populates="invoices")
    customer = relationship("Customer", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="invoice", cascade="all, delete-orphan")

class InvoiceItem(Base, TimestampMixin):
    __tablename__ = "invoice_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    invoice_id = Column(String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(String(500), nullable=False)
    quantity = Column(Numeric(10, 2, asdecimal=True), default=Decimal("1.00"), nullable=False)
    unit_price = Column(Numeric(14, 2, asdecimal=True), default=Decimal("0.00"), nullable=False)
    amount = Column(Numeric(14, 2, asdecimal=True), default=Decimal("0.00"), nullable=False)

    # Relationships
    invoice = relationship("Invoice", back_populates="items")
