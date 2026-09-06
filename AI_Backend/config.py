import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Server Setup
    ai_service_host: str = "0.0.0.0"
    ai_service_port: int = 8000
    request_timeout_seconds: int = 15
    
    # LLM Settings (dynamically loaded from .env)
    groq_api_key: str
    groq_model: str
    
    # Node.js Integration
    node_backend_url: str = "http://localhost:5000"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(__file__), ".env"), 
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
