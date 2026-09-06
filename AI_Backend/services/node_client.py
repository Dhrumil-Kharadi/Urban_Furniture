import httpx
from typing import Dict, Any, List, Optional
from config import settings
from security.auth import RequestContext
from utils.logging import log_api_error
import datetime


class NodeBackendError(RuntimeError):
    """Raised when the accounting backend cannot provide trusted data."""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code

class NodeBackendClient:
    def __init__(
        self,
        context: RequestContext,
        authorization_header: Optional[str] = None,
        cookie_header: Optional[str] = None,
    ):
        self.base_url = settings.node_backend_url.rstrip('/')
        self.context = context
        self.headers = {
            "Content-Type": "application/json",
            "X-Organization-ID": context.organization_id,
            "X-User-ID": context.user_id,
            "X-User-Role": context.user_role
        }
        if authorization_header:
            self.headers["Authorization"] = authorization_header
        if cookie_header:
            self.headers["Cookie"] = cookie_header

    async def _get(self, path: str, params: dict = None) -> Any:
        try:
            from main import http_client
            client = http_client or httpx.AsyncClient(timeout=settings.request_timeout_seconds)
            response = await client.get(f"{self.base_url}{path}", params=params, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            log_api_error(f"Node.js API GET it {path}", e)
            status = e.response.status_code
            if status in [401, 403]:
                raise NodeBackendError(
                    "Core backend rejected the request. Forward a valid Node session cookie "
                    "or bearer token with the chat request.",
                    status_code=401,
                ) from e
            raise NodeBackendError(f"Core backend returned HTTP {status}", status_code=502) from e
        except Exception as e:
            log_api_error(f"Node.js API Call {path}", e)
            if isinstance(e, NodeBackendError):
                raise
            raise NodeBackendError("Unable to connect to the core backend") from e

    @staticmethod
    def _data(res: Dict[str, Any]) -> Any:
        """Unwrap the core API envelope: {success, message, data}.

        List endpoints commonly return data.items, while report endpoints
        return a report object directly under data.
        """
        if not isinstance(res, dict):
            return res
        data = res.get("data", res)
        if isinstance(data, dict) and "items" in data:
            return data["items"]
        return data

    async def _get_report(self, start_date: str, end_date: str) -> Dict[str, Any]:
        res = await self._get(
            "/api/reports/profit-loss",
            {"fromDate": start_date, "toDate": end_date},
        )
        report = self._data(res)
        if not isinstance(report, dict):
            raise NodeBackendError("Core backend returned an invalid profit-loss report")
        return report

    @staticmethod
    def _previous_period(start_date: str, end_date: str) -> tuple[str, str]:
        start = datetime.date.fromisoformat(start_date)
        end = datetime.date.fromisoformat(end_date)
        if end < start:
            raise ValueError("end_date must not be before start_date")
        length = end - start
        previous_end = start - datetime.timedelta(days=1)
        previous_start = previous_end - length
        return previous_start.isoformat(), previous_end.isoformat()
            
    async def get_accounts(self, account_type: str = "all") -> List[Dict]:
        res = await self._get("/api/accounts", {"accountType": account_type, "limit": 1000})
        items = self._data(res)
        return items if isinstance(items, list) else []
        
    async def get_journals(self) -> List[Dict]:
        res = await self._get("/api/journals", {"limit": 100})
        items = self._data(res)
        return items if isinstance(items, list) else []

    async def get_taxes(self) -> List[Dict]:
        res = await self._get("/api/taxes", {"limit": 100})
        items = self._data(res)
        return items if isinstance(items, list) else []
        
    async def get_sales_summary(self, start_date: str, end_date: str) -> Dict[str, Any]:
        report = await self._get_report(start_date, end_date)
        previous_start, previous_end = self._previous_period(start_date, end_date)
        previous_report = await self._get_report(previous_start, previous_end)
        total_sales = float(report.get("income", {}).get("total", 0))
        previous_sales = float(previous_report.get("income", {}).get("total", 0))
        return {
            "total_sales": total_sales,
            "previous_period_sales": previous_sales,
            "percentage_change": ((total_sales - previous_sales) / previous_sales * 100) if previous_sales else None,
            "period": {"start_date": start_date, "end_date": end_date},
        }
        
    async def get_purchase_summary(self, start_date: str, end_date: str) -> Dict[str, Any]:
        report = await self._get_report(start_date, end_date)
        previous_start, previous_end = self._previous_period(start_date, end_date)
        previous_report = await self._get_report(previous_start, previous_end)
        total_purchases = float(report.get("expenses", {}).get("total", 0))
        previous_purchases = float(previous_report.get("expenses", {}).get("total", 0))
        return {
            "total_purchases": total_purchases,
            "previous_period_purchases": previous_purchases,
            "percentage_change": ((total_purchases - previous_purchases) / previous_purchases * 100) if previous_purchases else None,
            "period": {"start_date": start_date, "end_date": end_date},
        }
        
    async def get_profit_loss(self, start_date: str, end_date: str) -> Dict[str, Any]:
        report = await self._get_report(start_date, end_date)
        sales_income = float(report.get("income", {}).get("total", 0))
        purchase_expense = float(report.get("expenses", {}).get("total", 0))
        net_profit = sales_income - purchase_expense
        profit_margin = (net_profit / sales_income * 100) if sales_income > 0 else 0
        return {
            "sales_income": sales_income,
            "purchase_expense": purchase_expense,
            "other_expenses": 0,
            "net_profit": net_profit,
            "profit_margin": round(profit_margin, 2),
            "period": report.get("period", {"fromDate": start_date, "toDate": end_date}),
            "income_lines": report.get("income", {}).get("lines", []),
            "expense_lines": report.get("expenses", {}).get("lines", []),
        }
        
    async def get_outstanding_invoices(self) -> Dict[str, Any]:
        return {"total_outstanding": 0, "overdue_amount": 0, "invoice_count": 0, "overdue_invoice_count": 0, "customers": [], "message": "Invoice module is not yet active in the system."}
        
    async def get_outstanding_bills(self) -> Dict[str, Any]:
        return {"total_payable": 0, "overdue_payable": 0, "vendor_count": 0, "bill_count": 0, "overdue_bill_count": 0, "message": "Bill module is not yet active in the system."}
        
    async def get_cash_position(self) -> Dict[str, Any]:
        asset_accounts = await self.get_accounts(account_type="asset")
        cash_balance = 0
        bank_balance = 0
        for acc in asset_accounts:
            name = acc.get("name", "").lower()
            balance = float(acc.get("opening_balance", 0))
            if "cash" in name: cash_balance += balance
            elif "bank" in name: bank_balance += balance
            else: bank_balance += balance
        return {"cash_balance": cash_balance, "bank_balance": bank_balance, "total_liquid_balance": cash_balance + bank_balance}
        
    async def get_business_overview(self) -> Dict[str, Any]:
        today = datetime.datetime.now().strftime("%Y-%m-%d")
        start_of_month = f"{datetime.datetime.now().year}-{datetime.datetime.now().month:02d}-01"
        sales = await self.get_sales_summary(start_of_month, today)
        profit = await self.get_profit_loss(start_of_month, today)
        cash = await self.get_cash_position()
        return {
            "sales": sales.get("total_sales", 0),
            "sales_growth_percent": sales.get("percentage_change", 0),
            "purchases": (await self.get_purchase_summary(start_of_month, today)).get("total_purchases", 0),
            "profit": profit.get("net_profit", 0),
            "profit_growth_percent": profit.get("profit_margin", 0),
            "outstanding_receivables": 0,
            "outstanding_payables": 0,
            "budget_utilization_percent": 0,
            "cash_and_bank_position": cash.get("total_liquid_balance", 0)
        }
