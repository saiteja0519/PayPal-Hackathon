from fastapi import APIRouter
from app.api.auth import router as auth_router
from app.api.dashboard import router as dashboard_router
from app.api.customers import router as customers_router
from app.api.invoices import router as invoices_router
from app.api.payments import router as payments_router
from app.api.webhooks import router as webhooks_router
from app.api.ai import router as ai_router
from app.api.reminders import router as reminders_router
from app.api.analytics import router as analytics_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(dashboard_router)
api_router.include_router(customers_router)
api_router.include_router(invoices_router)
api_router.include_router(payments_router)
api_router.include_router(webhooks_router)
api_router.include_router(ai_router)
api_router.include_router(reminders_router)
api_router.include_router(analytics_router)

__all__ = ["api_router"]
