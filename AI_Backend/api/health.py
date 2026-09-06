from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
def get_health():
    return {"status": "ok", "service": "Urban Furniture AI Copilot"}
