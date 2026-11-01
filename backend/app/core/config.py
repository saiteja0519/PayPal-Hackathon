from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "PayPilot AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Database
    DATABASE_URL: str = "sqlite:///./paypilot.db"
    
    # JWT & Auth
    SECRET_KEY: str = "paypilot_super_secret_dev_key_change_in_production_9988776655"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # PayPal Sandbox configuration
    PAYPAL_MODE: str = "sandbox"  # 'sandbox' or 'live'
    PAYPAL_CLIENT_ID: str = "mock_paypal_client_id"
    PAYPAL_CLIENT_SECRET: str = "mock_paypal_client_secret"
    PAYPAL_WEBHOOK_ID: Optional[str] = None
    PAYPAL_BASE_URL: str = "https://api-m.sandbox.paypal.com"
    
    # AI Assistant configuration
    AI_PROVIDER: str = "gemini"  # 'gemini', 'openai', or 'deterministic'
    LLM_API_KEY: Optional[str] = None
    LLM_MODEL: str = "gemini-1.5-flash"
    
    # Email / SMTP configuration (Optional for reminders)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: str = "billing@paypilot.ai"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="allow")

settings = Settings()
