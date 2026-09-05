# Modular Monolith Secure Backend

A feature-based modular monolith backend built with **Node.js, Express, PostgreSQL, bcrypt, JWT, and in-memory privileged sessions**.

For complete architecture flows, sequence diagrams, and security specifications, refer directly to [auth.md](file:///d:/ODOO_Pre/Backend/auth.md).

---

## Quick Start

### 1. Prerequisites
- Node.js >= 18
- PostgreSQL server running locally or remotely

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and verify credentials:
```bash
cp .env.example .env
```

### 4. Run Migrations
```bash
npm run migrate
```

### 5. Start the Development Server
```bash
npm run dev
```
The server will start at `http://localhost:5000`.

---

## Automated Security Audit & Testing
Run the complete 47-point end-to-end security test suite:
```bash
npm test
```

---

## Key Security Architecture Summary
1. **Feature-Based Architecture**: All authentication logic is strictly contained inside `src/auth/`.
2. **Dual-Strategy Auth Model**:
   - **Standard Users (`role: 'user'`)**: 15-minute JWT (`sub`, `role: 'user'`, `tokenVersion`).
   - **Privileged Users (`manager`, `admin`, `super_admin`)**: 32-byte crypto session IDs stored in-memory and delivered via secure, HTTP-only, `sameSite: strict` cookies.
3. **Defense-in-Depth Passwords**: `password + pepper -> bcrypt (12 rounds) -> database password_hash`. Pepper is loaded exclusively from `.env` and never exists in PostgreSQL.
4. **Email OTP Verification**: 6-digit `crypto.randomInt` code stored as an HMAC-SHA256 hash with a 10-minute expiry, max 5 attempts, and single-use enforcement.
5. **Server-Side Arithmetic CAPTCHA**: Dynamic challenges generated via `crypto.randomInt`, HMAC hashed answers, 5-minute expiry, 3-attempt lockout, and single-use consumption.
6. **Two-Step Password Reset**: Generic response prevents account enumeration. Verifying OTP delivers a short-lived 64-char `resetToken`. Consuming the token updates the password, increments `token_version` (revoking all issued JWTs), and purges active privileged sessions.
7. **Role-Based Access Control (RBAC)**: Strict separation across `user`, `manager`, `admin`, and `super_admin` with precise `401 Unauthorized` vs `403 Forbidden` status codes.
8. **Insecure Direct Object Reference (IDOR) Defense**: Resource ownership authorization ensures standard users cannot access another user's records.

Detailed documentation and mermaid flow diagrams are in [auth.md](file:///d:/Urban_Furniture/Doc/auth.md).

---

## Multi-Tenancy Architecture & Conventions

Urban Furniture Accounting is a multi-tenant system where each Organization is strictly isolated. The tenant boundary is non-negotiable across every domain module.

### The Six Tenancy Conventions (technicalrequirement.md §3.1)
Every subsequent phase and module **must** obey these six rules:

1. **Mandatory Foreign Key**: Every domain table must have `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT`.
2. **Leading Composite Indexes**: Every index on a domain table must lead with `organization_id` (e.g. `CREATE INDEX idx_<table>_org_<col> ON <table>(organization_id, <col>)`).
3. **Tenant-Scoped Uniqueness**: Uniqueness constraints are always scoped to the organization (`UNIQUE (organization_id, <key>)`) — **never** globally unique.
4. **Universal Query Filtering**: Every repository query must filter on `organization_id`. No exceptions.
5. **Server-Authoritative Tenant Context**: `organization_id` is derived server-side from `req.user.organization_id` via `resolveTenant` middleware. It is **never** read from `req.body`, `req.query`, `req.params`, or request headers. The validation layer strips any incoming `organization_id` from request bodies.
6. **404 on Cross-Tenant Access (Anti-Enumeration)**: Resolving an entity by ID always uses `WHERE id = $1 AND organization_id = $2`. Attempting to access an entity belonging to another organization must return **`404 Not Found`, never `403 Forbidden`** (a 403 leaks data by confirming the entity's existence in another tenant).

### Middleware Chain on Domain Routes
Every route serving domain resources must wire middleware in this exact order:
```javascript
router.get('/', authenticate, resolveTenant, authorize('admin', 'manager'), controller.list);
```
- `authenticate`: Validates session cookie or JWT and attaches `req.user`.
- `resolveTenant`: Checks `req.user.organization_id`, attaches `req.organizationId`, and rejects unassigned users with 403.
- `authorize`: Enforces role-based access control.
