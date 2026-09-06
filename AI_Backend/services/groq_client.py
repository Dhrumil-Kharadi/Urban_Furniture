from langchain_groq import ChatGroq
from config import settings

def get_llm():
    return ChatGroq(
        model=settings.groq_model,
        api_key=settings.groq_api_key,
        temperature=0.1,
        max_tokens=1024,
        timeout=settings.request_timeout_seconds
    )
