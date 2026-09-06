from pydantic import BaseModel, Field
from typing import List, Optional

class ChatRequest(BaseModel):
    message: str = Field(..., description="The user's query")
    conversation_id: str = Field(default="default-chat", description="Conversation tracking ID")

class ChatResponse(BaseModel):
    response: str = Field(..., description="The LLM's response")
    conversation_id: str
    suggested_questions: List[str] = Field(default_factory=list, description="Follow-up suggestions")
    tools_used: List[str] = Field(default_factory=list, description="List of tools invoked during this turn")
