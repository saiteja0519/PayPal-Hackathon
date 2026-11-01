from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.db.session import engine, Base
from app.api import api_router
from app.db.seed import seed_database
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("paypilot")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing PayPilot AI database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Checking and seeding demonstration data...")
    try:
        seed_database()
    except Exception as e:
        logger.error(f"Demo seeding failed: {e}")
    yield
    logger.info("PayPilot AI shutting down.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="PayPilot AI: AI-Powered Invoice and Payment Management Platform",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler to safeguard sensitive information
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again later."}
    )

# Include API Routers
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "paypal_mode": settings.PAYPAL_MODE,
        "ai_provider": settings.AI_PROVIDER
    }
