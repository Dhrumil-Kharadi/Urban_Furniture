import uuid
import datetime
from typing import List

from schemas.insights import InsightItem
from services.node_client import NodeBackendClient
from utils.logging import logger

class InsightService:
    def __init__(self, node_client: NodeBackendClient):
        self.node_client = node_client
        
    async def generate_insights(self) -> List[InsightItem]:
        insights = []
        try:
            overview = await self.node_client.get_business_overview()
            cash = await self.node_client.get_cash_position()
            
            liquid_cash = cash.get("total_liquid_balance", 0)
            if float(liquid_cash) < 10000:
                insights.append(InsightItem(
                    id=str(uuid.uuid4()),
                    title="Low Liquidity Warning",
                    description=f"Total liquid balance is critically low: ₹{liquid_cash:,.2f}.",
                    severity="high",
                    metric_value=liquid_cash,
                    action_item="Review outstanding payables and delay non-urgent expenses."
                ))
            
            profit_growth = overview.get("profit_growth_percent", 0)
            if profit_growth < -5.0:
                insights.append(InsightItem(
                    id=str(uuid.uuid4()),
                    title="Profit Margin Contraction",
                    description=f"Profit has dropped by {abs(profit_growth)}% compared to the previous period.",
                    severity="medium",
                    metric_value=profit_growth,
                    action_item="Analyze expense breakdown to identify cost drivers."
                ))
                
            if not insights:
                insights.append(InsightItem(
                    id=str(uuid.uuid4()),
                    title="Business on Track",
                    description="No critical warnings detected in recent financial periods.",
                    severity="info"
                ))

        except Exception as e:
            logger.error(f"Error generating insights: {e}", exc_info=True)
            insights.append(InsightItem(
                id=str(uuid.uuid4()),
                title="Insight Generation Failed",
                description="Unable to fetch current accounting metrics.",
                severity="low"
            ))
        return insights
