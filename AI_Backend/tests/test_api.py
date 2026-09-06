import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "0.1.0"}

def test_chat_requires_auth():
    # Chat should fail without X-Organization-ID
    response = client.post("/api/v1/chat", json={"message": "hello"})
    assert response.status_code == 422 or response.status_code == 401

def test_insights_requires_auth():
    response = client.get("/api/v1/insights")
    assert response.status_code == 422 or response.status_code == 401
