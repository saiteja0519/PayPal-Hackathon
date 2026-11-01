from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

class AIChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    conversation_id: Optional[str] = None

class AIToolCall(BaseModel):
    tool_name: str
    arguments: Dict[str, Any]

class AIToolResult(BaseModel):
    tool_name: str
    result: Any

class AIChatResponse(BaseModel):
    conversation_id: str
    reply: str
    tools_executed: List[str] = []
    tool_results: List[Dict[str, Any]] = []
    provider: str
    configured: bool

class ConversationMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    role: str
    content: str
    tool_calls: Optional[str] = None
    tool_results: Optional[str] = None
    created_at: datetime

class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    created_at: datetime
    messages: List[ConversationMessageResponse] = []
