import datetime

def get_fiscal_year_start(current_date: datetime.date = None, start_month: int = 4) -> datetime.date:
    """Gets the start of the fiscal year for a given date (default April 1st)"""
    if current_date is None:
        current_date = datetime.date.today()
        
    if current_date.month < start_month:
        return datetime.date(current_date.year - 1, start_month, 1)
    return datetime.date(current_date.year, start_month, 1)

def get_this_month_range(current_date: datetime.date = None) -> tuple[str, str]:
    if current_date is None:
        current_date = datetime.date.today()
    start = datetime.date(current_date.year, current_date.month, 1)
    return start.isoformat(), current_date.isoformat()
