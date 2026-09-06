def format_inr(value: float) -> str:
    """Formats a float as an INR string (e.g. ₹ 1,50,000.00)."""
    
    is_negative = value < 0
    value = abs(value)
    
    val_str = f"{value:.2f}"
    parts = val_str.split(".")
    integer_part = parts[0]
    decimal_part = parts[1]
    
    if len(integer_part) > 3:
        last_three = integer_part[-3:]
        remaining = integer_part[:-3]
        
        chunks = []
        while remaining:
            chunks.insert(0, remaining[-2:])
            remaining = remaining[:-2]
            
        integer_part = ",".join(chunks) + "," + last_three

    res = f"₹ {integer_part}.{decimal_part}"
    return f"-{res}" if is_negative else res
