from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.business import Business
from app.models.user import User
from app.schemas.analytics import DashboardSummaryResponse, MonthlySummaryResponse
from app.services.auth_service import get_current_user, get_current_business
from app.services.analytics_service import get_dashboard_summary, get_monthly_summary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary", response_model=DashboardSummaryResponse)
def get_summary(
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    return get_dashboard_summary(db, business)

@router.get("/monthly-summary", response_model=MonthlySummaryResponse)
def get_monthly(
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    return get_monthly_summary(db, business, months_back=6)
