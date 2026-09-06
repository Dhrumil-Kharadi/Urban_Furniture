from pydantic import BaseModel, Field
from typing import List, Optional

class InsightItem(BaseModel):
    id: str
    title: str
    description: str
    severity: str = Field(..., description="E.g., high, medium, low, info")
    metric_value: Optional[float] = None
    action_item: Optional[str] = None

class InsightResponse(BaseModel):
    insights: List[InsightItem]
    organization_id: str
    generated_at: str
