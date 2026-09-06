from fastapi import Header, HTTPException, Depends
from dataclasses import dataclass
from typing import Optional

@dataclass
class RequestContext:
    organization_id: str
    user_id: str
    user_role: str
    contact_id: Optional[str] = None

def get_auth_context(
    x_organization_id: str = Header(..., description="Organization UUID for tenancy"),
    x_user_id: str = Header(..., description="User UUID"),
    x_user_role: str = Header(..., description="Role: business_owner, accountant, or user"),
    x_contact_id: Optional[str] = Header(None, description="Contact ID if role is user")
) -> RequestContext:
    """
    FastAPI Dependency to extract authenticated user context.
    For development/testing, these are passed directly as headers.
    In a real app, this would decode a JWT or call an auth service.
    """
    
    if not x_organization_id:
        raise HTTPException(status_code=401, detail="Missing X-Organization-ID header")
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-ID header")
    if not x_user_role:
        raise HTTPException(status_code=401, detail="Missing X-User-Role header")
        
    valid_roles = ["business_owner", "accountant", "admin", "manager", "user", "super_admin", "customer", "vendor"]
    if x_user_role not in valid_roles:
        raise HTTPException(status_code=403, detail=f"Invalid User Role: {x_user_role}")
        
    return RequestContext(
        organization_id=x_organization_id,
        user_id=x_user_id,
        user_role=x_user_role,
        contact_id=x_contact_id
    )

def require_role(allowed_roles: list[str]):
    def role_checker(context: RequestContext = Depends(get_auth_context)):
        if context.user_role not in allowed_roles:
            raise HTTPException(
                status_code=403, 
                detail=f"Access denied: {context.user_role} is not authorized for this resource"
            )
        return context
    return role_checker
