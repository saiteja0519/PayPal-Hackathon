import json
from fastapi import APIRouter, Request, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from app.db.session import get_db
from app.services.paypal_service import paypal_service

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

@router.post("/paypal")
async def receive_paypal_webhook(
    request: Request,
    db: Session = Depends(get_db),
    paypal_auth_algo: Optional[str] = Header(None, alias="PAYPAL-AUTH-ALGO"),
    paypal_cert_url: Optional[str] = Header(None, alias="PAYPAL-CERT-URL"),
    paypal_transmission_id: Optional[str] = Header(None, alias="PAYPAL-TRANSMISSION-ID"),
    paypal_transmission_sig: Optional[str] = Header(None, alias="PAYPAL-TRANSMISSION-SIG"),
    paypal_transmission_time: Optional[str] = Header(None, alias="PAYPAL-TRANSMISSION-TIME"),
):
    body_bytes = await request.body()
    body_str = body_bytes.decode("utf-8")

    headers_dict = {
        "paypal-auth-algo": paypal_auth_algo or "",
        "paypal-cert-url": paypal_cert_url or "",
        "paypal-transmission-id": paypal_transmission_id or "",
        "paypal-transmission-sig": paypal_transmission_sig or "",
        "paypal-transmission-time": paypal_transmission_time or "",
        "x-mock-synthetic-webhook": request.headers.get("x-mock-synthetic-webhook", "")
    }

    # Verify signature
    is_valid = paypal_service.verify_webhook(headers_dict, body_str)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PayPal webhook signature verification failed."
        )

    try:
        event_data = json.loads(body_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    status_code, message = paypal_service.process_webhook_event(db, event_data)
    return {"status": status_code, "message": message}

@router.post("/paypal/synthetic")
def trigger_synthetic_webhook(
    event_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Developer test endpoint to dispatch synthetic PayPal events safely."""
    status_code, message = paypal_service.process_webhook_event(db, event_data)
    return {"status": status_code, "message": message, "mode": "synthetic_test"}
