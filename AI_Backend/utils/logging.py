import logging
import sys
from typing import Any, Dict

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)]
    )

logger = logging.getLogger("ai_accounting_copilot")

def log_api_error(context: str, error: Exception, extra: Dict[str, Any] = None):
    """Log structured errors securely without leaking sensitive info."""
    err_context = extra or {}
    logger.error(
        f"API Error in {context} | Error: {str(error)} | Context: {err_context}",
        exc_info=False
    )
