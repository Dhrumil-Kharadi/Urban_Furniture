from typing import Annotated, Literal
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import AnyMessage, add_messages
from langchain_core.messages import ToolMessage, HumanMessage, SystemMessage
from langgraph.prebuilt import ToolNode

from agent.state import AccountingAgentState
from agent.prompts import system_prompt
from services.groq_client import get_llm

def build_graph(tools_list: list) -> StateGraph:
    """
    Builds the LangGraph state graph.
    Requires tools_list to be instantiated dynamically per request so they have access
    to the correct NodeBackendClient.
    """
    llm = get_llm()
    # Bind tools to model
    llm_with_tools = llm.bind_tools(tools_list)
    
    # Initialize the ToolNode
    tool_node = ToolNode(tools_list)

    async def call_model(state: AccountingAgentState):
        messages = state["messages"]
        # Ensure system prompt is first message
        if not messages or not isinstance(messages[0], SystemMessage):
            messages = [SystemMessage(content=system_prompt)] + list(messages)
            
        print("Calling LLM with messages...")
        response = await llm_with_tools.ainvoke(messages)
        return {"messages": [response]}

    # Determine whether to go to tools or end
    def should_continue(state: AccountingAgentState) -> Literal["tools", END]:
        messages = state["messages"]
        last_message = messages[-1]
        
        # If there is a tool call, route to tools
        if last_message.tool_calls:
            return "tools"
        return END

    # Initialize graph
    workflow = StateGraph(AccountingAgentState)
    
    # Add nodes
    workflow.add_node("agent", call_model)
    workflow.add_node("tools", tool_node)
    
    # Add edges
    workflow.add_edge(START, "agent")
    workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    workflow.add_edge("tools", "agent")
    
    return workflow.compile()
