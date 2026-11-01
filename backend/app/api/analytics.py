from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.business import Business
from app.models.user import User
from app.schemas.analytics import DashboardSummaryResponse, AgingReportResponse
from app.services.auth_service import get_current_user, get_current_business
from app.services.analytics_service import (
    get_dashboard_summary,
    get_aging_report,
    export_invoices_csv,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/overview", response_model=DashboardSummaryResponse)
def get_analytics_overview(
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    return get_dashboard_summary(db, business)

@router.get("/aging", response_model=AgingReportResponse)
def get_invoice_aging(
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    return get_aging_report(db, business)

@router.get("/export")
def export_invoices(
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    csv_data = export_invoices_csv(db, business)
    filename = f"paypilot_invoices_{business.name.lower().replace(' ', '_')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
