import json
from typing import Optional, Any
from sqlalchemy.orm import Session
from app.models.audit import AuditLog

def log_audit_event(
    db: Session,
    business_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    details: Optional[Any] = None,
    user_id: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    details_str = None
    if details is not None:
        if isinstance(details, (dict, list)):
            details_str = json.dumps(details, default=str)
        else:
            details_str = str(details)
            
    audit = AuditLog(
        business_id=business_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details_str,
        ip_address=ip_address
    )
    db.add(audit)
    db.commit()
    return audit
