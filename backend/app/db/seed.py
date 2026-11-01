from datetime import date, timedelta, datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from app.db.session import engine, Base, SessionLocal
from app.core.security import hash_password
from app.models.user import User
from app.models.business import Business, BusinessMember
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceItem
from app.models.payment import Payment
from app.models.reminder import Reminder
from app.services.invoice_service import quantize_money, recalculate_invoice_status

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Check if demo data already exists
    demo_user = db.query(User).filter(User.email == "demo@paypilot.ai").first()
    if demo_user:
        print("[DEMO SEED] Demo user 'demo@paypilot.ai' already exists. Skipping duplicate seeding.")
        db.close()
        return

    print("[DEMO SEED] Seeding demonstration data for PayPilot AI...")

    # 1. Demo User
    user = User(
        email="demo@paypilot.ai",
        hashed_password=hash_password("DemoPassword123!"),
        full_name="Alex Morgan (Demo Owner)",
        is_active=True
    )
    db.add(user)
    db.flush()

    # 2. Demo Business
    business = Business(
        name="Apex Digital Agency (Demo)",
        currency="USD",
        tax_id="US-DEMO-987654",
        address="100 Innovation Way, Suite 400, San Francisco, CA",
        phone="+1 (555) 019-2834",
        email="billing@apexdigital.demo",
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
    db.flush()

    # 3. Synthetic Customers
    customers_data = [
        {"name": "Nova Cloud Systems", "email": "finance@novacloud.demo", "company_name": "Nova Cloud Systems Inc.", "phone": "+1 (555) 301-4491", "address": "742 Evergreen Terrace, Seattle, WA"},
        {"name": "Beacon Media Partners", "email": "accounts@beaconmedia.demo", "company_name": "Beacon Media LLC", "phone": "+1 (555) 602-9912", "address": "1200 Sunset Blvd, Los Angeles, CA"},
        {"name": "Quantum Labs LLC", "email": "billing@quantumlabs.demo", "company_name": "Quantum Research Labs", "phone": "+1 (555) 441-8823", "address": "45 Science Park, Cambridge, MA"},
        {"name": "Elevate Marketing Co.", "email": "invoices@elevatemarketing.demo", "company_name": "Elevate Group", "phone": "+1 (555) 883-2211", "address": "300 Michigan Ave, Chicago, IL"},
        {"name": "Summit Consulting Services", "email": "payables@summitconsult.demo", "company_name": "Summit Global", "phone": "+1 (555) 912-3344", "address": "50 Wall Street, New York, NY"}
    ]

    customers = []
    for c_data in customers_data:
        c = Customer(
            business_id=business.id,
            name=c_data["name"],
            email=c_data["email"],
            company_name=c_data["company_name"],
            phone=c_data["phone"],
            address=c_data["address"]
        )
        db.add(c)
        customers.append(c)
    db.flush()

    today = date.today()

    # Helper to create invoice items and compute totals
    def make_invoice(cust, num, issue_dt, due_dt, items_list, tax_pct=Decimal("8.00")):
        subtotal = Decimal("0.00")
        items = []
        for desc, qty, price in items_list:
            q = Decimal(str(qty))
            p = Decimal(str(price))
            amt = quantize_money(q * p)
            subtotal += amt
            items.append((desc, q, p, amt))
        
        tax_amount = quantize_money(subtotal * (tax_pct / Decimal("100.00")))
        total_amount = subtotal + tax_amount

        inv = Invoice(
            business_id=business.id,
            customer_id=cust.id,
            invoice_number=num,
            issue_date=issue_dt,
            due_date=due_dt,
            currency="USD",
            status="draft",
            subtotal=subtotal,
            tax_rate=tax_pct,
            tax_amount=tax_amount,
            total_amount=total_amount,
            paid_amount=Decimal("0.00"),
            pending_amount=Decimal("0.00"),
            refunded_amount=Decimal("0.00"),
            balance_due=total_amount,
            notes="Thank you for partnering with Apex Digital Agency (Demonstration data).",
            terms="Payment due upon stated due date via PayPal Checkout."
        )
        db.add(inv)
        db.flush()

        for desc, q, p, amt in items:
            it = InvoiceItem(
                invoice_id=inv.id,
                description=desc,
                quantity=q,
                unit_price=p,
                amount=amt
            )
            db.add(it)
        return inv

    # Invoice 1: PAID Invoice (Paid via PayPal Checkout)
    inv1 = make_invoice(
        customers[0], "INV-2026-0001",
        today - timedelta(days=45), today - timedelta(days=15),
        [("UI/UX Mobile App Redesign", 1, 4500.00), ("Design System Token Library", 1, 1500.00)]
    )
    inv1.status = "paid"
    inv1.paid_amount = inv1.total_amount
    inv1.balance_due = Decimal("0.00")
    
    pay1 = Payment(
        business_id=business.id,
        invoice_id=inv1.id,
        amount=inv1.total_amount,
        currency="USD",
        status="completed",
        payment_method="paypal",
        provider="paypal",
        provider_order_id="MOCK-PAYPAL-ORDER-0001",
        provider_capture_id="MOCK-PAYPAL-CAP-0001",
        provider_payer_id="MOCK-PAYER-NOVA",
        provider_payer_email="finance@novacloud.demo",
        provider_status="COMPLETED",
        created_at=datetime.now(timezone.utc) - timedelta(days=20)
    )
    db.add(pay1)

    # Invoice 2: OVERDUE Invoice (30 days past due)
    inv2 = make_invoice(
        customers[1], "INV-2026-0002",
        today - timedelta(days=60), today - timedelta(days=30),
        [("Full-Stack Web Application MVP", 1, 6200.00), ("Cloud Hosting Architecture Setup", 1, 1800.00)]
    )
    inv2.status = "overdue"
    inv2.balance_due = inv2.total_amount

    # Send a reminder for Invoice 2
    rem2 = Reminder(
        business_id=business.id,
        invoice_id=inv2.id,
        customer_id=customers[1].id,
        channel="simulated",
        recipient_email=customers[1].email,
        subject=f"URGENT: Invoice {inv2.invoice_number} is 30 days overdue - Apex Digital Agency",
        body=f"Dear Beacon Media Partners,\n\nInvoice {inv2.invoice_number} for USD {inv2.balance_due:,.2f} is currently 30 days overdue. Please settle this balance immediately.",
        status="sent",
        sent_at=datetime.now(timezone.utc) - timedelta(days=5)
    )
    db.add(rem2)

    # Invoice 3: PARTIALLY PAID Invoice (Overdue balance remaining)
    inv3 = make_invoice(
        customers[2], "INV-2026-0003",
        today - timedelta(days=40), today - timedelta(days=10),
        [("Enterprise AI Pipeline Implementation", 1, 8000.00), ("Model Fine-tuning & Evaluation", 2, 1000.00)]
    )
    partial_paid = Decimal("4000.00")
    inv3.paid_amount = partial_paid
    inv3.balance_due = quantize_money(inv3.total_amount - partial_paid)
    inv3.status = "overdue"  # overdue because past due date and positive balance
    
    pay3 = Payment(
        business_id=business.id,
        invoice_id=inv3.id,
        amount=partial_paid,
        currency="USD",
        status="completed",
        payment_method="paypal",
        provider="paypal",
        provider_order_id="MOCK-PAYPAL-ORDER-0003",
        provider_capture_id="MOCK-PAYPAL-CAP-0003",
        provider_payer_id="MOCK-PAYER-QUANTUM",
        provider_payer_email="billing@quantumlabs.demo",
        provider_status="COMPLETED",
        created_at=datetime.now(timezone.utc) - timedelta(days=15)
    )
    db.add(pay3)

    # Invoice 4: ISSUED / UPCOMING Invoice (Due in 5 days)
    inv4 = make_invoice(
        customers[3], "INV-2026-0004",
        today - timedelta(days=10), today + timedelta(days=5),
        [("Performance Marketing Dashboard", 1, 3500.00), ("Conversion Rate Audit", 1, 1200.00)]
    )
    inv4.status = "issued"
    inv4.balance_due = inv4.total_amount

    # Invoice 5: DRAFT Invoice (Not yet issued to customer)
    inv5 = make_invoice(
        customers[4], "INV-2026-0005",
        today, today + timedelta(days=14),
        [("Executive Strategy Consulting", 10, 250.00), ("Quarterly Roadmap Presentation", 1, 1000.00)]
    )
    inv5.status = "draft"
    inv5.balance_due = inv5.total_amount

    # Invoice 6: PENDING payment attempt demo
    inv6 = make_invoice(
        customers[0], "INV-2026-0006",
        today - timedelta(days=5), today + timedelta(days=9),
        [("API Integration Security Hardening", 1, 2400.00)]
    )
    inv6.status = "issued"
    inv6.pending_amount = inv6.total_amount
    pay6 = Payment(
        business_id=business.id,
        invoice_id=inv6.id,
        amount=inv6.total_amount,
        currency="USD",
        status="initiated",
        payment_method="paypal",
        provider="paypal",
        provider_order_id="MOCK-PAYPAL-ORDER-0006",
        provider_status="CREATED",
        created_at=datetime.now(timezone.utc) - timedelta(hours=2)
    )
    db.add(pay6)

    # Payment 7: FAILED payment attempt demo
    pay_failed = Payment(
        business_id=business.id,
        invoice_id=inv2.id,
        amount=inv2.total_amount,
        currency="USD",
        status="failed",
        payment_method="paypal",
        provider="paypal",
        provider_order_id="MOCK-PAYPAL-FAILED-0002",
        provider_status="INSTRUMENT_DECLINED",
        error_message="Card declined by issuing bank during PayPal checkout.",
        created_at=datetime.now(timezone.utc) - timedelta(days=2)
    )
    db.add(pay_failed)

    db.commit()
    db.close()
    print("[DEMO SEED] Successfully created demo credentials:")
    print("  Email:    demo@paypilot.ai")
    print("  Password: DemoPassword123!")
    print("  Business: Apex Digital Agency (Demo)")

if __name__ == "__main__":
    seed_database()
