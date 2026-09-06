from typing import TypedDict, Annotated, Sequence, Any
import operator
from langchain_core.messages import BaseMessage

class AccountingAgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    organization_id: str
    user_id: str
    user_role: str
    contact_id: str | None
    conversation_id: str
    metrics: list[dict]
    suggested_questions: list[str]
    intent: str
