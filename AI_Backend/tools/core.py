from langchain_core.tools import tool, StructuredTool
from pydantic import BaseModel, Field
from typing import Dict, Any, List
from services.node_client import NodeBackendClient

class DateRange(BaseModel):
    start_date: str = Field(description="Start date in YYYY-MM-DD")
    end_date: str = Field(description="End date in YYYY-MM-DD")

class DateRangeComparison(BaseModel):
    start_date: str = Field(description="Start date in YYYY-MM-DD")
    end_date: str = Field(description="End date in YYYY-MM-DD")
    comparison: bool = Field(default=False, description="Set to true if comparison with previous period is desired")

def get_agent_tools(client: NodeBackendClient) -> List[StructuredTool]:
    """Returns tools initialized with the current request's node client."""
    
    @tool("get_sales_summary", args_schema=DateRange)
    async def get_sales_summary(start_date: str, end_date: str) -> str:
        """Get total sales and invoice counts for a given date range."""
        result = await client.get_sales_summary(start_date, end_date)
        return str(result)
        
    @tool("get_purchase_summary", args_schema=DateRange)
    async def get_purchase_summary(start_date: str, end_date: str) -> str:
        """Get total purchases and bill counts for a given date range."""
        result = await client.get_purchase_summary(start_date, end_date)
        return str(result)

    @tool("get_profit_loss", args_schema=DateRange)
    async def get_profit_loss(start_date: str, end_date: str) -> str:
        """Get profit and loss including sales, purchases, and net profit."""
        result = await client.get_profit_loss(start_date, end_date)
        return str(result)

    @tool("get_business_overview")
    async def get_business_overview() -> str:
        """Get a high-level overview of the entire business (Sales, Profit, Cash, Budgets)."""
        result = await client.get_business_overview()
        return str(result)

    @tool("get_outstanding_invoices")
    async def get_outstanding_invoices() -> str:
        """Get outstanding and overdue receivables from customers."""
        result = await client.get_outstanding_invoices()
        return str(result)

    @tool("get_outstanding_bills")
    async def get_outstanding_bills() -> str:
        """Get outstanding and overdue payables to vendors."""
        result = await client.get_outstanding_bills()
        return str(result)

    @tool("get_cash_position")
    async def get_cash_position() -> str:
        """Get current cash and bank balance position."""
        result = await client.get_cash_position()
        return str(result)

    return [
        get_sales_summary,
        get_purchase_summary,
        get_profit_loss,
        get_business_overview,
        get_outstanding_invoices,
        get_outstanding_bills,
        get_cash_position
    ]
