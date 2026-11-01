from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models.business import Business
from app.models.user import User
from app.models.conversation import Conversation
from app.schemas.ai import (
    AIChatRequest,
    AIChatResponse,
    ConversationResponse,
    ConversationMessageResponse,
)
from app.services.auth_service import get_current_user, get_current_business
from app.services.ai_service import ai_service

router = APIRouter(prefix="/ai", tags=["AI Assistant"])

@router.post("/chat", response_model=AIChatResponse)
def chat_with_assistant(
    req: AIChatRequest,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    result = ai_service.chat(
        db=db,
        business=business,
        user_id=user.id,
        message=req.message,
        conversation_id=req.conversation_id
    )
    return AIChatResponse(
        conversation_id=result["conversation_id"],
        reply=result["reply"],
        tools_executed=result["tools_executed"],
        tool_results=result["tool_results"],
        provider=result["provider"],
        configured=result["configured"]
    )

@router.get("/conversations", response_model=List[ConversationResponse])
def list_conversations(
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    convs = db.query(Conversation).filter(
        Conversation.business_id == business.id,
        Conversation.user_id == user.id
    ).order_by(Conversation.updated_at.desc()).limit(20).all()
    
    return [
        ConversationResponse(
            id=c.id,
            title=c.title,
            created_at=c.created_at,
            messages=[ConversationMessageResponse.model_validate(m) for m in c.messages]
        )
        for c in convs
    ]

@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
def get_conversation(
    conversation_id: str,
    user: User = Depends(get_current_user),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.business_id == business.id,
        Conversation.user_id == user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    return ConversationResponse(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        messages=[ConversationMessageResponse.model_validate(m) for m in conv.messages]
    )
