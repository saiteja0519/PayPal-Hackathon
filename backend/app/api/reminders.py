from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.models.reminder import Reminder
from app.models.business import Business
from app.models.user import User
from app.schemas.reminder import ReminderResponse
from app.services.auth_service import get_current_user, get_current_business

router = APIRouter(prefix="/reminders", tags=["Reminders"])

def format_reminder(r: Reminder) -> ReminderResponse:
    resp = ReminderResponse.model_validate(r)
    resp.invoice_number = r.invoice.invoice_number if r.invoice else ""
    resp.customer_name = r.customer.name if r.customer else ""
    return resp

@router.get("", response_model=List[ReminderResponse])
def list_reminders(
    status_filter: Optional[str] = None,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    query = db.query(Reminder).filter(Reminder.business_id == business.id)
    if status_filter:
        query = query.filter(Reminder.status == status_filter.lower())
    reminders = query.order_by(Reminder.created_at.desc()).all()
    return [format_reminder(r) for r in reminders]

@router.get("/{reminder_id}", response_model=ReminderResponse)
def get_reminder(
    reminder_id: str,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    r = db.query(Reminder).filter(
        Reminder.id == reminder_id,
        Reminder.business_id == business.id
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found.")
    return format_reminder(r)
