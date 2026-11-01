from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status
from app.models.invoice import Invoice, InvoiceItem
from app.models.customer import Customer
from app.models.business import Business
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate, InvoiceItemCreate
from app.services.audit_service import log_audit_event

def quantize_money(amount: Decimal) -> Decimal:
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def generate_next_invoice_number(db: Session, business_id: str) -> str:
    count = db.query(func.count(Invoice.id)).filter(Invoice.business_id == business_id).scalar() or 0
    year = date.today().year
    return f"INV-{year}-{count + 1:04d}"

def calculate_invoice_totals(items: List[InvoiceItemCreate], tax_rate: Decimal) -> dict:
    subtotal = Decimal("0.00")
    processed_items = []
    
    for item in items:
        qty = Decimal(str(item.quantity))
        price = Decimal(str(item.unit_price))
        amount = quantize_money(qty * price)
        subtotal += amount
        processed_items.append({
            "description": item.description,
            "quantity": qty,
            "unit_price": price,
            "amount": amount
        })

    tax_rate_dec = Decimal(str(tax_rate))
    tax_amount = quantize_money(subtotal * (tax_rate_dec / Decimal("100.00")))
    total_amount = subtotal + tax_amount
    
    return {
        "subtotal": quantize_money(subtotal),
        "tax_rate": tax_rate_dec,
        "tax_amount": quantize_money(tax_amount),
        "total_amount": quantize_money(total_amount),
        "items": processed_items
    }

def recalculate_invoice_status(invoice: Invoice) -> str:
    if invoice.status == "cancelled":
        return "cancelled"

    today = date.today()
    net_paid = invoice.paid_amount - invoice.refunded_amount
    balance = quantize_money(invoice.total_amount - net_paid)
    if balance < Decimal("0.00"):
        balance = Decimal("0.00")
    invoice.balance_due = balance

    if balance == Decimal("0.00") and invoice.paid_amount > Decimal("0.00"):
        invoice.status = "paid"
    elif invoice.status == "draft":
        # Draft remains draft until explicitly issued
        invoice.status = "draft"
    elif invoice.due_date < today and balance > Decimal("0.00"):
        invoice.status = "overdue"
    elif invoice.paid_amount > Decimal("0.00") and balance > Decimal("0.00"):
        invoice.status = "partially_paid"
    else:
        invoice.status = "issued"

    return invoice.status

def create_invoice(db: Session, business: Business, data: InvoiceCreate, user_id: Optional[str] = None) -> Invoice:
    # Verify customer belongs to business
    customer = db.query(Customer).filter(
        Customer.id == data.customer_id,
        Customer.business_id == business.id
    ).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found in this business."
        )

    # Validate dates
    if data.due_date < data.issue_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice due date cannot precede the issue date."
        )

    invoice_number = data.invoice_number or generate_next_invoice_number(db, business.id)
    
    # Check duplicate invoice number in business
    existing = db.query(Invoice).filter(
        Invoice.business_id == business.id,
        Invoice.invoice_number == invoice_number
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invoice number '{invoice_number}' already exists."
        )

    calc = calculate_invoice_totals(data.items, data.tax_rate)
    
    invoice = Invoice(
        business_id=business.id,
        customer_id=customer.id,
        invoice_number=invoice_number,
        issue_date=data.issue_date,
        due_date=data.due_date,
        currency=data.currency or business.currency,
        status="draft",
        subtotal=calc["subtotal"],
        tax_rate=calc["tax_rate"],
        tax_amount=calc["tax_amount"],
        total_amount=calc["total_amount"],
        paid_amount=Decimal("0.00"),
        pending_amount=Decimal("0.00"),
        refunded_amount=Decimal("0.00"),
        balance_due=calc["total_amount"],
        notes=data.notes,
        terms=data.terms
    )
    db.add(invoice)
    db.flush()

    for item_data in calc["items"]:
        item = InvoiceItem(
            invoice_id=invoice.id,
            description=item_data["description"],
            quantity=item_data["quantity"],
            unit_price=item_data["unit_price"],
            amount=item_data["amount"]
        )
        db.add(item)

    db.commit()
    db.refresh(invoice)

    log_audit_event(
        db,
        business_id=business.id,
        user_id=user_id,
        action="invoice.created",
        entity_type="invoice",
        entity_id=invoice.id,
        details={"invoice_number": invoice.invoice_number, "total": str(invoice.total_amount)}
    )

    return invoice

def update_invoice(db: Session, invoice: Invoice, data: InvoiceUpdate, user_id: Optional[str] = None) -> Invoice:
    # Security requirement: Prevent changes to critical financial fields if payments exist
    if invoice.paid_amount > Decimal("0.00") and data.items is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify line items or total amounts for an invoice with recorded payments."
        )

    if data.customer_id:
        cust = db.query(Customer).filter(
            Customer.id == data.customer_id,
            Customer.business_id == invoice.business_id
        ).first()
        if not cust:
            raise HTTPException(status_code=404, detail="Customer not found.")
        invoice.customer_id = cust.id

    if data.issue_date:
        invoice.issue_date = data.issue_date
    if data.due_date:
        invoice.due_date = data.due_date
    if invoice.due_date < invoice.issue_date:
        raise HTTPException(status_code=400, detail="Due date cannot precede issue date.")

    if data.notes is not None:
        invoice.notes = data.notes
    if data.terms is not None:
        invoice.terms = data.terms

    if data.items is not None:
        # Delete existing items
        db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).delete()
        tax_rate = data.tax_rate if data.tax_rate is not None else invoice.tax_rate
        calc = calculate_invoice_totals(data.items, tax_rate)
        invoice.subtotal = calc["subtotal"]
        invoice.tax_rate = calc["tax_rate"]
        invoice.tax_amount = calc["tax_amount"]
        invoice.total_amount = calc["total_amount"]
        
        for item_data in calc["items"]:
            item = InvoiceItem(
                invoice_id=invoice.id,
                description=item_data["description"],
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"],
                amount=item_data["amount"]
            )
            db.add(item)

    recalculate_invoice_status(invoice)
    db.commit()
    db.refresh(invoice)

    log_audit_event(
        db,
        business_id=invoice.business_id,
        user_id=user_id,
        action="invoice.updated",
        entity_type="invoice",
        entity_id=invoice.id
    )
    return invoice

def issue_invoice(db: Session, invoice: Invoice, user_id: Optional[str] = None) -> Invoice:
    if invoice.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only draft invoices can be issued. Current status: '{invoice.status}'"
        )
    invoice.status = "issued"
    recalculate_invoice_status(invoice)
    db.commit()
    db.refresh(invoice)

    log_audit_event(
        db,
        business_id=invoice.business_id,
        user_id=user_id,
        action="invoice.issued",
        entity_type="invoice",
        entity_id=invoice.id
    )
    return invoice

def cancel_invoice(db: Session, invoice: Invoice, user_id: Optional[str] = None) -> Invoice:
    if invoice.paid_amount > Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel an invoice with recorded payments. Please issue a refund first."
        )
    invoice.status = "cancelled"
    db.commit()
    db.refresh(invoice)

    log_audit_event(
        db,
        business_id=invoice.business_id,
        user_id=user_id,
        action="invoice.cancelled",
        entity_type="invoice",
        entity_id=invoice.id
    )
    return invoice
