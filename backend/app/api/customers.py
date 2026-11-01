from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from decimal import Decimal
from app.db.session import get_db
from app.models.customer import Customer
from app.models.invoice import Invoice
from app.models.business import Business
from app.models.user import User
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse
from app.services.auth_service import get_current_user, get_current_business
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/customers", tags=["Customers"])

def enrich_customer_metrics(db: Session, customer: Customer) -> CustomerResponse:
    invoices = db.query(Invoice).filter(
        Invoice.customer_id == customer.id,
        Invoice.status != "cancelled"
    ).all()

    total_invoiced = sum((inv.total_amount for inv in invoices), Decimal("0.00"))
    total_paid = sum((inv.paid_amount for inv in invoices), Decimal("0.00"))
    outstanding = sum((inv.balance_due for inv in invoices), Decimal("0.00"))

    resp = CustomerResponse.model_validate(customer)
    resp.total_invoiced = total_invoiced
    resp.total_paid = total_paid
    resp.outstanding_balance = outstanding
    resp.invoice_count = len(invoices)
    return resp

@router.get("", response_model=List[CustomerResponse])
def list_customers(
    search: Optional[str] = None,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    query = db.query(Customer).filter(Customer.business_id == business.id)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Customer.name.ilike(search_filter)) |
            (Customer.email.ilike(search_filter)) |
            (Customer.company_name.ilike(search_filter))
        )
    customers = query.order_by(Customer.name.asc()).all()
    return [enrich_customer_metrics(db, c) for c in customers]

@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    data: CustomerCreate,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    existing = db.query(Customer).filter(
        Customer.business_id == business.id,
        Customer.email == data.email.lower()
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A customer with this email already exists in your business."
        )

    customer = Customer(
        business_id=business.id,
        name=data.name,
        email=data.email.lower(),
        company_name=data.company_name,
        phone=data.phone,
        address=data.address
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)

    log_audit_event(
        db,
        business_id=business.id,
        user_id=user.id,
        action="customer.created",
        entity_type="customer",
        entity_id=customer.id,
        details={"name": customer.name, "email": customer.email}
    )

    return enrich_customer_metrics(db, customer)

@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: str,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.business_id == business.id
    ).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")
    return enrich_customer_metrics(db, customer)

@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: str,
    data: CustomerUpdate,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.business_id == business.id
    ).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")

    if data.email and data.email.lower() != customer.email:
        existing = db.query(Customer).filter(
            Customer.business_id == business.id,
            Customer.email == data.email.lower(),
            Customer.id != customer.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Another customer with this email already exists.")
        customer.email = data.email.lower()

    if data.name is not None:
        customer.name = data.name
    if data.company_name is not None:
        customer.company_name = data.company_name
    if data.phone is not None:
        customer.phone = data.phone
    if data.address is not None:
        customer.address = data.address

    db.commit()
    db.refresh(customer)
    return enrich_customer_metrics(db, customer)

@router.delete("/{customer_id}")
def delete_customer(
    customer_id: str,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.business_id == business.id
    ).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")

    active_invoices = db.query(Invoice).filter(
        Invoice.customer_id == customer.id,
        Invoice.balance_due > Decimal("0.00")
    ).count()
    if active_invoices > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete customer with active unpaid invoices."
        )

    db.delete(customer)
    db.commit()

    log_audit_event(
        db,
        business_id=business.id,
        user_id=user.id,
        action="customer.deleted",
        entity_type="customer",
        entity_id=customer_id
    )

    return {"message": "Customer deleted successfully"}
