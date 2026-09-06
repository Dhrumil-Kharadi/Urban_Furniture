# AI Accounting Copilot Backend

A production-ready FastAPI service that orchestrates AI-driven financial insights by natively interfacing with an existing Node.js core accounting backend without duplicating its business logic.

## Architecture

- **Framework**: `FastAPI`
- **AI Agent Orchestrator**: `LangGraph` + `LangChain`
- **LLM**: `Groq (llama3-70b-8192)`
- **Integration Profile**: Read-only via HTTP to existing Node REST APIs

## Setup

1. Configure Environment:
```bash
cp .env.example .env
# Edit .env with your Groq API key and Node.js backend URL
```

2. Install Dependencies:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. Run the Server:
```bash
uvicorn main:app --reload --port 8000
```

## API Testing

### Chat API Example
Execute against the local server. The UUID headers identify the AI request, but they do
not authenticate against the Node.js backend. Forward the same `sid` cookie used by a
privileged Node session, or a valid `Authorization: Bearer ...` token:

```bash
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-Organization-ID: dev-org-123" \
  -H "X-User-ID: dev-user" \
  -H "X-User-Role: business_owner" \
  -H "Cookie: sid=<node-session-id>" \
  -d '{"message":"What are our total sales this month?"}'
```

### Insights Engine
```bash
curl -X GET http://localhost:8000/api/v1/insights \
  -H "X-Organization-ID: dev-org-123" \
  -H "X-User-ID: dev-user" \
  -H "X-User-Role: admin"
```

## Security

The AI API requires `X-Organization-ID`, `X-User-ID`, and `X-User-Role` for request
context, plus the Node.js authentication credential: either the `sid` session cookie
for `business_owner`/`accountant`, or `Authorization: Bearer <JWT>` for standard Node
users. Node derives the real organization and role from that credential and never trusts
the UUID or role headers for authorization.
