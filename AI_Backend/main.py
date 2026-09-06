from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import httpx

from api.comment_prediction import router as comment_prediction_router
from config import settings
from utils.logging import setup_logging, logger

from api.chat import router as chat_router
from api.health import router as health_router
from api.insights import router as insights_router

# Global HTTP client for reusing connection pools
http_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup logging on startup
    setup_logging()
    logger.info("Starting AI Accounting Copilot Service")
    
    # Initialize global HTTP client
    global http_client
    http_client = httpx.AsyncClient(timeout=settings.request_timeout_seconds)
    
    yield
    
    # Cleanup on shutdown
    logger.info("Shutting down AI service")
    if http_client:
        await http_client.aclose()


app = FastAPI(
    version="0.1.0",
    title="Urban Furniture AI Accounting Copilot",
    description="AI Backend integrating with Node.js accounting APIs.",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include new API routers
app.include_router(chat_router, prefix="/api/v1")
app.include_router(health_router, prefix="/api/v1")
app.include_router(insights_router, prefix="/api/v1")

# Include existing legacy routers
app.include_router(comment_prediction_router, prefix="/api/legacy")

@app.get("/")
def read_root():
    return {"message": "AI Backend server is running"}

