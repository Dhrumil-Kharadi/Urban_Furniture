import unittest
from unittest.mock import AsyncMock

from security.auth import RequestContext
from services.node_client import NodeBackendClient


class NodeBackendClientTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.client = NodeBackendClient(
            RequestContext("org-1", "user-1", "business_owner"),
            authorization_header="Bearer token",
            cookie_header="sid=session-id",
        )

    def test_forwards_authentication_and_unwraps_nested_items(self):
        self.assertEqual(self.client.headers["Authorization"], "Bearer token")
        self.assertEqual(self.client.headers["Cookie"], "sid=session-id")
        self.assertEqual(
            self.client._data({"success": True, "data": {"items": [{"id": "a1"}]}}),
            [{"id": "a1"}],
        )

    async def test_profit_loss_uses_requested_dates_and_report_totals(self):
        self.client._get = AsyncMock(return_value={
            "success": True,
            "data": {
                "period": {"fromDate": "2026-09-01", "toDate": "2026-09-06"},
                "income": {"total": "1250.00", "lines": []},
                "expenses": {"total": "250.00", "lines": []},
            },
        })

        result = await self.client.get_profit_loss("2026-09-01", "2026-09-06")

        self.assertEqual(result["sales_income"], 1250.0)
        self.assertEqual(result["purchase_expense"], 250.0)
        self.assertEqual(result["net_profit"], 1000.0)
        self.client._get.assert_awaited_once_with(
            "/api/reports/profit-loss",
            {"fromDate": "2026-09-01", "toDate": "2026-09-06"},
        )


if __name__ == "__main__":
    unittest.main()
