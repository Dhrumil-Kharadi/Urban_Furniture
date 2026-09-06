from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime

from schemas.insights import InsightResponse
from security.auth import get_auth_context, RequestContext
from services.node_client import NodeBackendClient
from services.node_client import NodeBackendError
from services.insight_service import InsightService

router = APIRouter()

@router.get("/insights", response_model=InsightResponse)
async def get_insights(
    request: Request,
    context: RequestContext = Depends(get_auth_context)
):
    """Generates and returns AI/rule-based insights for the organization."""
    try:
        auth_header = request.headers.get("Authorization")
        cookie_header = request.headers.get("Cookie")
        node_client = NodeBackendClient(
            context=context,
            authorization_header=auth_header,
            cookie_header=cookie_header,
        )
        
        insight_engine = InsightService(node_client)
        insights = await insight_engine.generate_insights()
        
        return InsightResponse(
            insights=insights,
            organization_id=context.organization_id,
            generated_at=datetime.utcnow().isoformat() + "Z"
        )
    except NodeBackendError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
