from fastapi import APIRouter, Depends, HTTPException, Request
from langchain_core.messages import HumanMessage
from typing import Dict, Any

from schemas.chat import ChatRequest, ChatResponse
from security.auth import get_auth_context, RequestContext
from services.node_client import NodeBackendClient
from services.node_client import NodeBackendError
from tools.core import get_agent_tools
from agent.graph import build_graph
from utils.logging import logger

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def process_chat(
    payload: ChatRequest,
    request: Request,
    context: RequestContext = Depends(get_auth_context)
):
    """Processes a natural language query against the accounting data."""
    try:
        # 1. Initialize HTTP client with auth context
        auth_header = request.headers.get("Authorization")
        cookie_header = request.headers.get("Cookie")
        node_client = NodeBackendClient(
            context=context,
            authorization_header=auth_header,
            cookie_header=cookie_header,
        )
        
        # 2. Get dynamic tools for this specific context
        tools = get_agent_tools(node_client)
        
        # 3. Build graph
        workflow = build_graph(tools)
        
        # 4. Prepare initial state
        initial_state = {
            "messages": [HumanMessage(content=payload.message)],
            "organization_id": context.organization_id,
            "user_id": context.user_id,
            "user_role": context.user_role,
            "contact_id": context.contact_id,
            "conversation_id": payload.conversation_id,
        }
        
        # 5. Execute LangGraph
        result = await workflow.ainvoke(initial_state)
        
        # 6. Extract response and tool calls
        final_message = result["messages"][-1]
        
        # Collect tools used during the turn
        tools_used = []
        for msg in result["messages"]:
            if getattr(msg, "tool_calls", None):
                for tc in msg.tool_calls:
                    if tc["name"] not in tools_used:
                        tools_used.append(tc["name"])

        return ChatResponse(
            response=final_message.content,
            conversation_id=payload.conversation_id,
            tools_used=tools_used,
            suggested_questions=[] # Future implementation
        )
        
    except NodeBackendError as e:
        logger.warning(f"Core backend data request failed: {e}")
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"Chat execution failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal AI Engine Error")
