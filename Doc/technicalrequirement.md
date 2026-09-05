# Urban Furniture — Accounting System
## Technical Requirements (`technicalrequirement.md`)

> **Source of truth:** `Doc/project.md`. Every functional statement here traces back to it.
> **Development rules:** `Doc/strict.md` is binding for all frontend work — colors, i18n, neumorphism, typography, file conventions.
> **Scope of this document:** HOW to build. It does not restate business requirements, and it does not change `project.md`.

---

## 0. Document Control

### 0.1 Legend — how to read every claim in this document

| Tag | Meaning |
|---|---|
| **[SPEC]** | Comes directly from `project.md`. Non-negotiable. |
| **[TECH-REQ]** | Technical requirement. Not written in `project.md`, but the spec is unimplementable without it. |
| **[TECH-REC]** | **TECHNICAL RECOMMENDATION.** A judgement call. A different choice would also work. |
| **[ASSUM]** | Assumption made to keep moving. Must be confirmed. |
| **[AMBIG]** | Ambiguity in `project.md` that blocks or risks implementation. |
| **[EXISTS]** | Already present in the codebase. Reuse it — do not rebuild. |

### 0.2 Non-negotiable constraints

1. Do **not** create a new project. Extend `Backend/` and `Frontend/` in place.
2. Do **not** replace Node.js, Express, Next.js, React, JavaScript, or PostgreSQL.
3. Do **not** convert JavaScript to TypeScript. Every new file is `.js` (backend) or `.jsx` (frontend components).
4. Do **not** introduce an ORM. The project uses `pg` with parameterised raw SQL. **[EXISTS]**
5. Do **not** introduce a charting library. `src/reusablefiles/graphs/` is a complete pure-SVG chart family. **[EXISTS]**
6. Do **not** introduce Redux, Zustand, or React Query unless a stated need in §12 is unmet.
7. Every frontend change obeys `strict.md` — no hardcoded colors, no hardcoded strings, three locale files, Orbitron/Sora only.

---

## 1. Existing System Audit

This section is the baseline. It was produced by reading the repository, not by assumption. Everything below is **[EXISTS]**.

### 1.1 Repository layout

```
D:\ODOO_Pre\
├── Backend\          Node.js + Express 5 API (CommonJS)
├── Frontend\         Next.js 16 + React 19 (App Router, JavaScript)
├── AI_Backend\       Present, out of scope for this document
├── Doc\              project.md, strict.md, auth.md  ← this file joins here
├── dashboard.html    Static design reference
└── time-tracker.html Static design reference
```

### 1.2 Backend — as built

| Aspect | Current state |
|---|---|
| Runtime | Node.js, **CommonJS** (`"type": "commonjs"`) |
| Framework | Express `^5.2.1` |
| Database driver | `pg` `^8.23.0` — a single `Pool`, exported from `src/config/db.js` |
| Architecture | Feature-based modular monolith. One folder per feature under `src/`. |
| Implemented features | `auth/` only |
| Migrations | Numbered JS files in `src/database/migrations/`, each exporting `{ name, up, down }` where `up`/`down` are raw SQL strings. Registered in an ordered array inside `run-migrations.js`. Tracked in a `migrations` table. Idempotent, transactional. |
| Response shape | `utils/response.js` → `success(res, message, data, code)`, `created(res, message, data)`, `error(res, message, code, errors)` |
| Error handling | Central `middleware/error.middleware.js` — never leaks SQL, stacks, or secrets |
| 404 | `middleware/notFound.middleware.js` |
| Security | `helmet`, `cors` (credentials, origin from env), `express.json({ limit: '10kb' })`, `cookie-parser`, `express-rate-limit` per route group |
| Logging | `utils/logger.js` (sanitising) |
| Crypto | `utils/crypto.js`, `bcrypt` with a `PASSWORD_PEPPER` |
| Email | `nodemailer` via `config/mail.js` |

### 1.3 The `auth` feature — the module template to copy

`src/auth/` establishes the file convention every new module must follow:

```
auth.routes.js       Express router, rate limiters, middleware wiring
auth.controller.js   HTTP in/out only. No SQL, no business rules.
auth.service.js      Business logic, orchestration
auth.repository.js   Parameterised SQL. No HTTP. Returns rows.
auth.validation.js   Pure functions → { isValid, errors: string[], data? }
auth.middleware.js   authenticate / authorize / authorizeOwnerOrRoles
auth.jwt.js          Token signing & verification
auth.session.js      Server-side sessions for privileged roles
auth.otp.js          OTP issue & verify
auth.captcha.js      CAPTCHA challenge
auth.email.js        Feature-specific mail templates
```

**Every new module in this document follows this exact shape.**

### 1.4 The dual authentication model — critical to understand before designing roles

This already exists and must be reused rather than replaced.

| Path | Who | Credential | Storage |
|---|---|---|---|
| **Server session** | Privileged roles (`manager`, `admin`, `super_admin`) | `sid` HttpOnly cookie, 32 random bytes, server-side session store | Cookie only |
| **JWT Bearer** | Standard role (`user`) only | 15-minute JWT + rotating refresh-token cookie | **In memory only**, never `localStorage` |

`authMiddleware.authenticate` auto-detects which path applies. It then:

- Refuses a JWT whose payload role is not `user`.
- Refuses a JWT if `payload.tokenVersion !== user.token_version` (instant revocation after password reset).
- Refuses a session whose user is not a privileged role.
- Refuses any unverified email with `403`.
- Re-reads the user row from PostgreSQL on **every** request — roles are never trusted from the token.

Authorization helpers:

- `authorize(...roles)` — strict RBAC, `403` on mismatch.
- `authorizeOwnerOrRoles(getOwnerIdFn, ...privilegedRoles)` — IDOR protection.

### 1.5 Existing database schema

| Table | Columns |
|---|---|
| `users` | `id` UUID PK `gen_random_uuid()`, `name`, `email` UNIQUE, `password_hash`, `role` CHECK IN (`user`,`manager`,`admin`,`super_admin`) DEFAULT `user`, `email_verified` BOOL, `token_version`, `created_at`, `updated_at` TIMESTAMPTZ. Indexes on `email`, `role`. |
| `otp_verifications` | Email-verification and password-reset OTPs |
| `refresh_tokens` | Rotating refresh tokens with reuse detection |
| `migrations` | Migration ledger |

**There is no `organizations` table and no `organization_id` anywhere.** Multi-tenancy is entirely unbuilt. See §3.1.

### 1.6 Frontend — as built

| Aspect | Current state |
|---|---|
| Framework | Next.js `16.3.0`, App Router, React `19.2.8` |
| Language | JavaScript. Components are `.jsx`. |
| i18n | `next-intl` `^4.13.5`. Locales `en`, `hi`, `gu`. `localePrefix: 'always'`. All routes live under `src/app/[locale]/`. |
| Route middleware | `src/proxy.js` (Next.js 16's replacement for `middleware.js`) — locale negotiation **plus** an HTTP-layer redirect that bounces authenticated visitors away from `/auth/*` |
| API client | `src/lib/api.js` — `BASE_URL` from `NEXT_PUBLIC_API_URL`, `credentials: 'include'`, in-memory JWT, **single-flight refresh lock**, automatic one-shot retry after refresh |
| Auth state | `src/context/AuthContext.jsx` — source of truth is `GET /api/auth/me`; exports `useAuth()` and `getDashboardPath(role)` |
| Icons | `lucide-react` + a local `SOLID_ICONS` set |
| Dashboard config | `src/config/dashboard.config.js` — `DASHBOARD_NAV` keyed by role, `GENERAL_NAV`, `STAT_ICONS`. **Keys only, never display text.** |
| Styling | `src/app/globals.css` holds the `:root` token block (~100 variables). Per-feature CSS files in `src/styles/`, imported in `layout.jsx`. |

### 1.7 Reusable component inventory — build on these, do not duplicate

`src/reusablefiles/`:

| Component | Import | Notes |
|---|---|---|
| `Button` | `@/reusablefiles/button` | |
| `InputBox` | `@/reusablefiles/inputbox` | `as="input" \| "select"`. **`onChange` receives the VALUE, not the event** (pass `rawEvent` for the event). Supports `label`, `placeholder`, `icon`, `hint`, `options`, `size`, `invalid`, `disabled`. |
| `Card`, `CardHead`, `CardBody` | `@/reusablefiles/card` | |
| `StatCard` | `@/reusablefiles/statcard` | `title`, `value`, `icon`, `trend {direction,label}`, `tone="light"\|"deep"`, `span`, `spark[]`, `loading` |
| `Pill`, `RolePill` | `@/reusablefiles/pill` | Status badges |
| `ListCard` | `@/reusablefiles/listcard` | |
| `DataTable` | `@/reusablefiles/datatable` | Column-driven: `columns=[{key,header,render,align,width,className}]`, `rows`, `rowKey`, `loading`, `loadingLabel`, `emptyLabel`, `onRowClick`, `caption`. **Presentational only — no built-in sorting, filtering, or pagination.** See §11.3. |
| `Skeleton`, `SkeletonText`, `DashboardSkeleton` | `@/reusablefiles/skeleton` | Loading states |
| `Avatar` | `@/reusablefiles/avatar` | |
| `DashboardShell`, `Sidebar`, `Topbar`, `PageHead` | `@/reusablefiles/dashboardshell` | Page chrome |
| `GenerativeTexture` | `@/reusablefiles/texture` | |
| `PageTransition` | `@/reusablefiles/pagetransition` | |

### 1.8 Chart inventory — **no charting library is needed**

`src/reusablefiles/graphs/` is a complete, dependency-free SVG chart family driven by `--graph-*` tokens:

`BarChart`, `GroupedBarChart`, `StackedBarChart`, `LineChart`, `AreaChart`, `BoxPlot`, `ScatterPlot`, `BubbleChart`, `HeatMap`, `SemiCircleGauge`, `ArcProgress`, `RadialGauge`, `DonutChart`, `PieChart`, `RadarChart`, `ProgressBar`, `Sparkline`, plus `ChartFrame`, `ChartLegend`, and primitives (`Grid`, `XAxis`, `YAxis`, `ChartTooltip`, `SeriesGradients`).

Helpers exported for shaping data with the same maths the charts use: `SERIES`, `seriesColor`, `scaleLinear`, `scaleBand`, `niceTicks`, `linePath`, `areaPath`, `arcPath`, `wedgePath`, `formatCompact`, `formatNumber`, `normalizeSeries`, `clamp`, `round`, `sum`.

Eight series colors exist: `--graph-series-1` … `--graph-series-8`.

> **Consequence:** every chart in §11.5 and §11.6 is specified against this library. Recharts / Chart.js / D3 must not be added.

---

## 2. Target Technical Architecture

### 2.1 Shape of the system

```
┌──────────────────────────────────────────────────────────┐
│  Next.js 16 App Router  ·  src/app/[locale]/…            │
│  Server Components for shells · Client Components for     │
│  anything interactive ('use client')                      │
│                                                           │
│  AuthContext ──┐                                          │
│  OrgContext  ──┼──► src/lib/api.js  (single-flight refresh)│
│  Feature hooks ┘                                          │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTPS, credentials: 'include'
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Express 5 modular monolith  ·  Backend/src/              │
│                                                           │
│  routes → [rateLimit] → [authenticate] → [tenant]         │
│         → [authorize]  → controller → service             │
│         → repository → pg.Pool                            │
│                                                           │
│  Cross-cutting: accounting/ (ledger engine),              │
│  sequences, audit, notifications                          │
└──────────────────────┬───────────────────────────────────┘
                       ▼
              ┌────────────────────┐
              │   PostgreSQL       │
              │  org-scoped rows   │
              │  double-entry GL   │
              └────────────────────┘
```

### 2.2 Layer contract — enforced in review

| Layer | May do | May **not** do |
|---|---|---|
| `*.routes.js` | Mount paths, rate limits, middleware chain | Contain logic |
| `*.controller.js` | Read `req`, call validation, call service, send via `utils/response` | Touch SQL, hold business rules |
| `*.service.js` | Business rules, orchestration, transactions, call other services | Touch `req`/`res` |
| `*.repository.js` | Parameterised SQL, return rows | Send HTTP, hold business rules |
| `*.validation.js` | Pure validation → `{ isValid, errors, data }` | I/O of any kind |

**[TECH-REQ]** A repository function that participates in a transaction must accept an optional `client` as its **first** argument and fall back to `pool` when absent:

```js
async function insertJournalEntry(client, { organizationId, journalId, ... }) {
  const db = client || pool;
  const result = await db.query(`INSERT INTO journal_entries (...) VALUES ($1,$2,...) RETURNING *`, [...]);
  return result.rows[0];
}
```

This is required because posting a document writes a document row, its lines, its journal entry, its journal lines, and consumes a sequence number — all of which must commit or fail together (§3.4).

### 2.3 Backend module plan

New folders under `Backend/src/`, each following the §1.3 template:

| Folder | Covers (`project.md` §) |
|---|---|
| `organizations/` | §1 multi-tenancy, §2.1 signup→org, §9.1 |
| `users/` | §2.1 Admin creates Accountant accounts, §3 User Management |
| `contacts/` | §4.1 Contact Master, §2.2 portal toggle |
| `products/` | §4.2 Product Master |
| `accounts/` | §4.3 Chart of Accounts |
| `journals/` | §4.4 Journal Master |
| `analytics/` | §4.6 Analytic Accounts |
| `budgets/` | §4.7 Budgets, §8 |
| `taxes/` | §7 Tax Handling |
| `purchases/` | §5.1 Purchase Orders + Vendor Bills |
| `sales/` | §5.2 Sales Orders + Customer Invoices |
| `payments/` | §5.1.5, §5.2.5, §5.3 |
| `reports/` | §6 Balance Sheet, P&L, Budget Report |
| `portal/` | §5.3 Contact portal |
| `dashboard/` | Aggregated KPIs |
| `accounting/` | **Shared ledger engine** — §4.5 double-entry. Not a route-owning module. |
| `shared/` | Sequences, audit, tenant middleware, pagination, money helpers |

**[TECH-REC]** `accounting/` and `shared/` expose services only and mount no routes. Keeping the ledger engine out of any single transactional module prevents `sales/` and `purchases/` from each growing their own copy of double-entry posting.

---

## 3. Cross-Cutting Design Decisions

These are decided once and applied everywhere. Get them wrong and every module inherits the mistake.

### 3.1 Multi-tenancy — **[TECH-REQ]**, from `project.md` §9.1

> *"every table needs an `organization_id` — no Org should ever see another Org's data."*

**Rules:**

1. Every domain table carries `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT`.
2. Every index on a domain table leads with `organization_id`.
3. Every uniqueness rule is scoped: `UNIQUE (organization_id, <business_key>)` — never globally unique.
4. **Every** repository query filters on `organization_id`. No exceptions.
5. `organization_id` is derived server-side from `req.user`. It is **never** read from the request body, query string, or a header.

**[TECH-REQ] `shared/tenant.middleware.js`:**

```js
function resolveTenant(req, res, next) {
  const orgId = req.user?.organization_id;
  if (!orgId) return error(res, 'No organization context for this account', 403);
  req.organizationId = orgId;
  return next();
}
```

Chain order on every domain route:

```js
router.get('/', authenticate, resolveTenant, authorize('admin','manager'), controller.list);
```

**[TECH-REC]** Also enable PostgreSQL Row-Level Security as a second line of defence, so a forgotten `WHERE organization_id = $1` fails closed instead of leaking. Add it only after the app-layer filter is working, and only if the team will maintain the session-variable plumbing (`SET LOCAL app.current_org`). Skip it for v1 if that plumbing is not going to be maintained — a half-configured RLS policy is worse than none.

### 3.2 Role mapping — the single most important decision in this document

**[AMBIG]** `project.md` §2 names three actors: **Admin (Business Owner)**, **Invoicing User (Accountant)**, **Contact**. The `users.role` CHECK constraint already in the database allows only `user`, `manager`, `admin`, `super_admin`, and the entire dual-auth model in §1.4 is hardwired to those four strings.

**[TECH-REC] — Map, do not rename.**

| `project.md` actor | Existing DB role | Auth path | Why |
|---|---|---|---|
| Admin (Business Owner) | `admin` | Server session (`sid` cookie) | Highest privilege, deserves the stronger cookie path |
| Invoicing User (Accountant) | `manager` | Server session (`sid` cookie) | Privileged internal staff; `authorize('manager','admin')` already works |
| Contact (Customer/Vendor) | `user` | JWT Bearer, in-memory | Low privilege, external. The JWT path already refuses any non-`user` role. |
| — | `super_admin` | Server session | Reserved for platform operations. **Not** an accounting actor. |

**Why this is the right call:**

- Zero changes to `users.role`'s CHECK constraint.
- Zero changes to `auth.middleware.js`, `auth.session.js`, or `auth.jwt.js`.
- `authorize('admin')` and `authorize('manager','admin')` express the `project.md` §3 permission matrix directly.
- Contacts land on the JWT path, which is exactly right: short-lived, in-memory, revocable via `token_version`.

**Cost:** the word "manager" in code and message keys means "Accountant". Mitigate by translating role labels through i18n (`dashboard.roles.manager` → `"Accountant"` / `"लेखाकार"` / `"હિસાબનીશ"`), so no user ever sees the internal string.

**Rejected alternative:** altering the CHECK constraint to add `accountant` and `contact`. This ripples into `PRIVILEGED_ROLES`, the `payload.role !== 'user'` guard, `getDashboardPath()`, `DASHBOARD_NAV`, and every existing test — a large change that buys only nicer identifiers.

**Action required:** confirm this mapping before any migration is written. Everything downstream depends on it.

### 3.3 Money and numeric handling — **[TECH-REQ]**

An accounting system that uses floating point is broken. Rules:

| Concern | Decision |
|---|---|
| Monetary columns | `NUMERIC(15,2)` |
| Quantities | `NUMERIC(15,3)` — allows fractional units |
| Percentages (tax rate, variance) | `NUMERIC(7,4)` |
| Never | `FLOAT`, `REAL`, `DOUBLE PRECISION`, or JS `Number` arithmetic on money |

**The `pg` gotcha:** node-postgres returns `NUMERIC` as a **JavaScript string** to avoid precision loss. Do not "fix" this with a global type parser — that reintroduces float error. Instead:

**[TECH-REQ] `shared/money.js`** wraps `decimal.js` and is the only place money arithmetic happens:

```js
const Decimal = require('decimal.js');
const money   = (v) => new Decimal(v ?? 0);
const toDb    = (d) => new Decimal(d).toFixed(2);   // string for pg
const isZero  = (d) => new Decimal(d).isZero();
const eq      = (a, b) => new Decimal(a).eq(b);
```

Rounding: `ROUND_HALF_UP` at 2 decimals, applied **once per document line** after tax computation, never on running totals. This keeps line totals summing exactly to the document total.

### 3.4 Transaction boundaries — **[TECH-REQ]**

Posting a document is atomic. Anything less produces an unbalanced ledger.

**[TECH-REQ] `shared/withTransaction.js`:**

```js
const { pool } = require('../config/db');

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
module.exports = { withTransaction };
```

Operations that **must** run inside one transaction:

| Operation | Writes in the same transaction |
|---|---|
| Confirm Sales Order | SO status, reserve nothing (no stock module — see §16) |
| Post Customer Invoice | consume sequence → invoice header + lines → journal entry + journal lines → SO status → audit row |
| Post Vendor Bill | consume sequence → bill header + lines → journal entry + journal lines → PO status → audit row |
| Register Payment | consume sequence → payment row → allocation rows → journal entry + lines → recompute document status → audit row |
| Portal card payment | gateway verification → payment row → allocation → journal entry + lines → invoice status → audit row |

### 3.5 Document numbering — **[TECH-REQ]**, from `project.md` §9.3

> *"PO numbers, Invoice numbers, Bill numbers should auto-increment per Organization (e.g., INV/2026/00001)."*

A PostgreSQL `SEQUENCE` cannot do this: it is global, not per-org-per-year, and it gaps on rollback. Accounting documents must not gap.

**[TECH-REQ]** A `document_sequences` table plus a row lock taken **inside the posting transaction**:

```sql
SELECT next_number FROM document_sequences
 WHERE organization_id = $1 AND doc_type = $2 AND fiscal_year = $3
   FOR UPDATE;

UPDATE document_sequences SET next_number = next_number + 1, updated_at = NOW()
 WHERE organization_id = $1 AND doc_type = $2 AND fiscal_year = $3;
```

`FOR UPDATE` serialises concurrent posters; because it shares the posting transaction, a rollback returns the number to the pool. Format is built from a stored `prefix` + `fiscal_year` + zero-padded `next_number` → `INV/2026/00001`.

**[TECH-REC]** Numbers are assigned on **post**, not on draft creation. A deleted draft must not burn an invoice number.

### 3.6 Audit trail — **[TECH-REQ]**, from `project.md` §9.2

Two complementary mechanisms:

1. **Row-level audit columns** on every domain table: `created_by`, `updated_by` (UUID → `users.id`), `created_at`, `updated_at` (TIMESTAMPTZ).
2. **An `audit_logs` table** capturing every state-changing action on financial documents: actor, action, entity type, entity id, before/after JSONB, IP, timestamp.

**[TECH-REC]** Write audit rows from the service layer inside the same transaction as the change. A trigger-based approach cannot see the authenticated actor without extra session-variable plumbing.

### 3.7 Archive, never delete — **[SPEC]** `project.md` §9.6

> *"Can't delete a Product/Contact that has existing transactions — only Archive."*

Every master-data table gets `status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived'))`. `DELETE` endpoints for master data are **archive** operations (`PATCH .../archive`). Hard deletion is permitted only for **draft** transactional documents that have never been posted.

Posting guard **[SPEC]** §9.6: *"Can't post to an Archived account/journal."* — validated in the ledger engine, not in each caller.

### 3.8 Fiscal periods and immutability — **[TECH-REQ]**

A posted journal entry is immutable. `project.md` §5 defines statuses that move forward only (`Draft → Posted → Partially Paid → Paid → Overdue`).

- Correcting a posted document is done by a **reversing entry**, never by `UPDATE` on `journal_entry_lines`.
- **[TECH-REC]** Enforce with a `BEFORE UPDATE OR DELETE` trigger on `journal_entry_lines` that raises unless the parent entry is still `draft`.
- **[AMBIG]** `project.md` does not define a fiscal-year start month. §3.5 and the P&L both need one. **[ASSUM]** April–March (Indian FY), stored per-organization as `fiscal_year_start_month SMALLINT DEFAULT 4` so it is configurable rather than hardcoded. **Confirm.**

### 3.9 Status as data, not as strings scattered in code — **[TECH-REC]**

All lifecycle values from `project.md` §5 live in one backend constants file (`shared/constants.js`) and are mirrored as i18n keys on the frontend. Enforced in the database with `CHECK` constraints so an invalid status cannot be written even by a bug.

| Entity | Statuses (`project.md` §5) |
|---|---|
| Purchase Order | `draft`, `confirmed`, `billed`, `cancelled` |
| Sales Order | `draft`, `confirmed`, `invoiced`, `cancelled` |
| Vendor Bill | `draft`, `posted`, `partially_paid`, `paid`, `overdue`, `cancelled` |
| Customer Invoice | `draft`, `posted`, `partially_paid`, `paid`, `overdue`, `cancelled` |
| Payment | `draft`, `posted`, `failed`, `cancelled` |
| Journal Entry | `draft`, `posted`, `reversed` |
| Master data | `active`, `archived` |

`overdue` is **derived**, not stored as a manual transition — see §7.6.

---

## 4. Database Architecture

Every table carries: `id UUID PK DEFAULT gen_random_uuid()`, `organization_id UUID NOT NULL REFERENCES organizations(id)` (except `organizations`), `created_by`/`updated_by UUID REFERENCES users(id)`, `created_at`/`updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. Money `NUMERIC(15,2)`, quantity `NUMERIC(15,3)`, rates `NUMERIC(7,4)`.

### 4.1 Table catalogue

| Table | Purpose (`project.md` §) | Important columns |
|---|---|---|
| `organizations` | §1 multi-tenant root | `name`, `slug` UNIQUE, `currency_code CHAR(3) DEFAULT 'INR'`, `fiscal_year_start_month SMALLINT DEFAULT 4`, `status` |
| `users` **[EXISTS — ALTER]** | §2 actors | **ADD** `organization_id UUID NULL REFERENCES organizations(id)`, `contact_id UUID NULL REFERENCES contacts(id)`, `must_change_password BOOLEAN DEFAULT false` |
| `contacts` | §4.1 | `name`, `contact_type CHECK IN (customer, vendor, both)`, `email`, `mobile`, `city`, `state`, `pincode`, `profile_image_url`, `portal_access_enabled BOOLEAN DEFAULT false`, `receivable_account_id`, `payable_account_id`, `status` |
| `products` | §4.2 | `name`, `sku`, `product_type CHECK IN (goods, service, combo)`, `sales_price`, `cost_price`, `category_id`, `sales_tax_id`, `purchase_tax_id`, `income_account_id`, `expense_account_id`, `status` |
| `product_categories` | §4.2 Category field | `name`, `status` |
| `accounts` | §4.3 Chart of Accounts | `code`, `name`, `account_type CHECK IN (asset, liability, expense, income, capital)`, `parent_account_id UUID NULL REFERENCES accounts(id)`, `opening_balance NUMERIC(15,2) DEFAULT 0`, `is_system BOOLEAN`, `status` |
| `journals` | §4.4 | `name`, `journal_type CHECK IN (sales, purchase, bank, cash, general)`, `default_debit_account_id`, `default_credit_account_id`, `sequence_prefix`, `status` |
| `journal_entries` | §4.5 | `journal_id`, `entry_number`, `entry_date DATE`, `reference`, `narration`, `status CHECK IN (draft, posted, reversed)`, `is_auto_generated BOOLEAN`, `source_type`, `source_id`, `reversed_by_entry_id`, `posted_at` |
| `journal_entry_lines` | §4.5 Journal Items | `journal_entry_id ON DELETE CASCADE`, `line_no`, `account_id`, `partner_contact_id`, `analytic_account_id`, `debit NUMERIC(15,2) DEFAULT 0`, `credit NUMERIC(15,2) DEFAULT 0`, `description` |
| `analytic_accounts` | §4.6 | `name`, `analytic_type CHECK IN (income, expense)`, `department_or_project`, `status` |
| `budgets` | §4.7, §8 | `name`, `period_start DATE`, `period_end DATE`, `responsible_user_id`, `analytic_account_id NOT NULL`, `planned_amount NUMERIC(15,2)`, `status` |
| `taxes` | §7 | `name`, `rate NUMERIC(7,4)`, `tax_scope CHECK IN (sales, purchase, both)`, `computation CHECK IN (percentage, fixed)`, `collected_account_id`, `paid_account_id`, `status` |
| `purchase_orders` | §5.1 | `po_number`, `vendor_contact_id`, `order_date`, `expected_date`, `status CHECK IN (draft, confirmed, billed, cancelled)`, `untaxed_amount`, `tax_amount`, `total_amount`, `notes` |
| `purchase_order_lines` | §5.1 | `purchase_order_id ON DELETE CASCADE`, `line_no`, `product_id`, `description`, `quantity`, `unit_price`, `tax_id`, `analytic_account_id`, `line_subtotal`, `line_tax`, `line_total` |
| `vendor_bills` | §5.1 | `bill_number`, `vendor_contact_id`, `purchase_order_id NULL`, `vendor_reference`, `bill_date`, `due_date`, `status`, totals, `amount_paid`, `amount_due`, `journal_entry_id`, `posted_at` |
| `vendor_bill_lines` | §5.1 | same line shape as PO lines, plus `account_id` |
| `sales_orders` | §5.2 | `so_number`, `customer_contact_id`, `order_date`, `status CHECK IN (draft, confirmed, invoiced, cancelled)`, totals, `notes` |
| `sales_order_lines` | §5.2 | same line shape |
| `customer_invoices` | §5.2 | `invoice_number`, `customer_contact_id`, `sales_order_id NULL`, `invoice_date`, `due_date`, `status`, totals, `amount_paid`, `amount_due`, `journal_entry_id`, `posted_at` |
| `customer_invoice_lines` | §5.2 | same line shape, plus `account_id` |
| `payments` | §5.1.5, §5.2.5, §5.3 | `payment_number`, `payment_type CHECK IN (inbound, outbound)`, `contact_id`, `payment_method CHECK IN (cash, bank, card)`, `journal_id`, `payment_date`, `amount`, `status`, `journal_entry_id`, `gateway_provider`, `gateway_payment_id`, `gateway_order_id`, `gateway_signature`, `gateway_status` |
| `payment_allocations` | §5 settlement matching | `payment_id ON DELETE CASCADE`, `invoice_id NULL`, `bill_id NULL`, `allocated_amount`, CHECK exactly one of invoice/bill is set |
| `document_sequences` | §9.3 | `doc_type`, `fiscal_year`, `prefix`, `next_number INTEGER DEFAULT 1`, `padding SMALLINT DEFAULT 5`, UNIQUE `(organization_id, doc_type, fiscal_year)` |
| `attachments` | §9.5 | `entity_type`, `entity_id`, `file_name`, `storage_key`, `mime_type`, `size_bytes`, `uploaded_by` |
| `audit_logs` | §9.2 | `actor_user_id`, `action`, `entity_type`, `entity_id`, `before JSONB`, `after JSONB`, `ip_address INET`, `created_at` |
| `notifications` | §9.7 | `recipient_user_id`, `recipient_email`, `type`, `entity_type`, `entity_id`, `channel`, `status CHECK IN (pending, sent, failed)`, `sent_at`, `error_message`, `attempts` |

### 4.2 Relationships

**One-to-many:** `organizations → *` (every domain table); `contacts → sales_orders / customer_invoices / vendor_bills / purchase_orders / payments`; `products → *_lines`; `accounts → journal_entry_lines`; `accounts → accounts` (self-referencing, hierarchical CoA per §4.3); `journals → journal_entries`; `journal_entries → journal_entry_lines`; `analytic_accounts → journal_entry_lines`; each document header → its own lines.

**One-to-one:** `customer_invoices.journal_entry_id → journal_entries` (UNIQUE); `vendor_bills.journal_entry_id` (UNIQUE); `payments.journal_entry_id` (UNIQUE); `users.contact_id → contacts` (UNIQUE — the portal login of §2.2); `budgets.analytic_account_id` is 1:1 in practice.

**Many-to-many:** `payments ↔ customer_invoices` and `payments ↔ vendor_bills`, both resolved through `payment_allocations`. This is required, not decorative: one payment may settle several invoices, and one invoice may receive several partial payments — which is exactly what the `partially_paid` status in §5.2.6 demands.

### 4.3 Indexing — each one justified

| Index | Justification |
|---|---|
| `(organization_id)` leading on every domain table | §3.1 tenant filter is present on every single query |
| `contacts (organization_id, contact_type, status)` | Vendor/customer pickers and list filters |
| `contacts (organization_id, lower(email))` UNIQUE WHERE email IS NOT NULL | Duplicate check + portal login lookup |
| `products (organization_id, status)`, `(organization_id, lower(name))` | Product picker, search |
| `products (organization_id, sku)` UNIQUE WHERE sku IS NOT NULL | §4.2 SKU uniqueness |
| `accounts (organization_id, account_type)`, `(organization_id, code)` UNIQUE | Balance Sheet / P&L group by account type |
| `journal_entries (organization_id, entry_date)` | **Every report filters by date range (§6)** |
| `journal_entries (organization_id, source_type, source_id)` | Navigate from a document to its entry |
| `journal_entry_lines (journal_entry_id)` | Line fetch |
| `journal_entry_lines (organization_id, account_id, journal_entry_id)` | **Balance Sheet / P&L aggregation — the hottest query in the system** |
| `journal_entry_lines (organization_id, analytic_account_id)` WHERE analytic_account_id IS NOT NULL | **§8 Budget Report actuals** |
| `customer_invoices (organization_id, customer_contact_id, status)` | §5.3 portal invoice list |
| `customer_invoices (organization_id, status, due_date)` | Overdue detection §7.6 |
| `vendor_bills (organization_id, vendor_contact_id, status)` | §5.3 vendor statement |
| `payment_allocations (invoice_id)`, `(bill_id)`, `(payment_id)` | Settlement rollup |
| `*_lines (<header>_id)` on all document line tables | FK join |
| `audit_logs (organization_id, entity_type, entity_id, created_at DESC)` | Audit lookup |
| `document_sequences (organization_id, doc_type, fiscal_year)` UNIQUE | §3.5 `FOR UPDATE` lock target |

Add nothing beyond these until a slow query is actually measured.

### 4.4 Data integrity

- **Foreign keys:** `ON DELETE RESTRICT` for all master data (§3.7 archive-never-delete). `ON DELETE CASCADE` only from a document header to its own lines.
- **Unique (all org-scoped):** `(organization_id, invoice_number)`, `(organization_id, bill_number)`, `(organization_id, po_number)`, `(organization_id, so_number)`, `(organization_id, payment_number)`, `(organization_id, entry_number)`, `(organization_id, code)` on accounts. `organizations.slug` is globally unique.
- **NOT NULL:** every `organization_id`, all document dates, all status fields, all monetary totals (default `0`).
- **CHECK constraints:**
  - Journal line: `debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0) AND (debit + credit) > 0` — a line is a debit or a credit, never both, never empty.
  - `budgets`: `period_end >= period_start`, `planned_amount >= 0`.
  - `taxes`: `rate >= 0 AND rate <= 100`.
  - Document lines: `quantity > 0`, `unit_price >= 0`.
  - Invoice/bill: `amount_paid >= 0 AND amount_paid <= total_amount`, and `amount_due = total_amount - amount_paid`.
  - `due_date >= invoice_date` / `bill_date`.
  - `payment_allocations`: exactly one of `invoice_id` / `bill_id` is non-null.
  - Every status field per the table in §3.9.
- **Transactions:** see §3.4.
- **[TECH-REC] Deferrable constraint trigger** enforcing `SUM(debit) = SUM(credit)` per journal entry at COMMIT time. This is the database-level guarantee of the double-entry rule from `project.md` §4.5. Application validation alone can be defeated by a bug; this cannot.

### 4.5 Migration plan

Continue the existing numbered convention (`006_…` onward). Each file exports `{ name, up, down }` and is registered in the ordered array in `run-migrations.js`. Order matters — foreign keys need their parents first:

`006_create_organizations` → `007_add_organization_to_users` → `008_create_accounts` → `009_create_contacts` → `010_create_product_categories` → `011_create_taxes` → `012_create_products` → `013_create_journals` → `014_create_analytic_accounts` → `015_create_budgets` → `016_create_journal_entries` → `017_create_journal_entry_lines` → `018_create_document_sequences` → `019_create_purchase_orders` → `020_create_vendor_bills` → `021_create_sales_orders` → `022_create_customer_invoices` → `023_create_payments` → `024_create_payment_allocations` → `025_create_attachments` → `026_create_audit_logs` → `027_create_notifications` → `028_ledger_integrity_triggers`

`contacts` and `accounts` reference each other (`contacts.receivable_account_id`), so add that FK in a follow-up `ALTER` inside `009` or defer it to `028`.

**Seeding — [TECH-REQ].** `project.md` §7.1 assumes a working Chart of Accounts already exists. A brand-new organization is unusable without one. So `organizations.service.js` seeds, inside the signup transaction: a default CoA (Cash, Bank, Debtors, Creditors, Sale Income, Purchase Expense, Output Tax Payable, Input Tax Credit, Opening Balance Equity, Payment Gateway Clearing), the four journals named in §4.4 (Sales, Purchase, Bank, Cash), and one `document_sequences` row per document type.

---

## 5. The Accounting Engine — `Backend/src/accounting/`

The shared core. `project.md` §4.5 requires every transaction to follow double-entry; this module is the **only** place journal entries are created.

### 5.1 `postJournalEntry(client, payload)`

**Input:** `{ organizationId, journalId, entryDate, reference, narration, sourceType, sourceId, isAutoGenerated, lines: [{ accountId, partnerContactId?, analyticAccountId?, debit, credit, description }], actorUserId }`

**Steps:**
1. Assert at least two lines.
2. Per line, exactly one of debit/credit is non-zero and positive.
3. `SUM(debit)` equals `SUM(credit)`, compared with `decimal.js` (§3.3) — **[SPEC]** §4.5.
4. Assert the journal is `active` and belongs to the org — **[SPEC]** §9.6, "can't post to an Archived journal".
5. Assert every `account_id` is `active` and belongs to the org.
6. Consume the `JE` sequence (§3.5) on the shared `client`.
7. Insert `journal_entries` with `status='posted'`, `posted_at=NOW()`.
8. Bulk-insert `journal_entry_lines`.
9. Write the `audit_logs` row.
10. Return the entry with its lines.

Any failure throws a typed error so the caller's transaction rolls back (§3.4).

### 5.2 `reverseJournalEntry(client, entryId, reason, actorUserId)`

Creates a mirror entry with debits and credits swapped, sets the original to `status='reversed'` and records `reversed_by_entry_id`. Posted lines are never mutated (§3.8).

### 5.3 Posting rules — **[SPEC]** `project.md` §5.1.4, §5.1.5, §5.2.4, §5.2.5

**Vendor Bill posted**

| Account | Dr | Cr |
|---|---|---|
| Purchase Expense (per line `expense_account_id`) | untaxed | |
| Input Tax Credit *(only if purchase-side tax is confirmed in scope — §7)* | tax | |
| Creditors — the vendor's payable | | total |

**Vendor Bill paid (Cash/Bank)**

| Account | Dr | Cr |
|---|---|---|
| Creditors | amount | |
| Cash / Bank (from the payment journal) | | amount |

**Customer Invoice posted**

| Account | Dr | Cr |
|---|---|---|
| Debtors — the customer's receivable | total | |
| Sale Income (per line `income_account_id`) | | untaxed |
| Output Tax Payable | | tax |

Tax posts to its **own** CoA account and is never folded into Sale Income — **[SPEC]** §7.

**Customer Invoice paid (Cash/Bank)**

| Account | Dr | Cr |
|---|---|---|
| Cash / Bank | amount | |
| Debtors | | amount |

**Portal card payment — [SPEC]** §5.3.5

| Account | Dr | Cr |
|---|---|---|
| Payment Gateway Clearing | amount | |
| Debtors | | amount |

**[TECH-REC]** A clearing account rather than Bank is the correct treatment: at that moment the money sits with the gateway, not in the bank. Actual settlement is a later `Bank ← Clearing` entry.

### 5.4 Reporting primitives — `accounting.repository.js`

| Function | SQL shape | Used by |
|---|---|---|
| `getAccountBalances(orgId, asOfDate)` | `SUM(debit) - SUM(credit)` grouped by `account_id`, joined to `accounts`, `WHERE je.status='posted' AND je.entry_date <= $2` | Balance Sheet §6 |
| `getPeriodMovements(orgId, from, to)` | Same, with `entry_date BETWEEN`, restricted to income/expense account types | P&L §6 |
| `getAnalyticActuals(orgId, analyticAccountId, from, to)` | `SUM(debit) - SUM(credit)` over lines `WHERE analytic_account_id = $2` | Budget Report §8 |
| `getContactOpenItems(orgId, contactId, kind)` | Invoices/bills having `amount_due > 0` | Portal §5.3, aging |

Each is a single grouped query. Never iterate accounts and query per account.

---

## 6. Feature Specifications

Each feature below follows the required structure. To keep the document usable, patterns that repeat identically across all master-data modules are stated once in §6.2 and referenced thereafter.

### 6.1 Feature: Organization Signup & Authentication

#### Purpose
**[SPEC]** §2.1 — Only a Business Owner may self-sign-up, and doing so creates an Organization with that user as Admin. Everyone else is created from inside the org. There is no public signup for Accountant or Contact.

#### Frontend Requirements
**[EXISTS]** `src/app/[locale]/auth/` already provides register, login, verify-email, forgot-password, reset-password pages and their forms. Extend, do not rebuild.

- **Register page** — add an "Organization Name" field. On success the backend creates the org. Copy must make clear this is business-owner signup.
- **Login page** — add an **Organization ID/slug** field, per §2.1. **[AMBIG]** §2.1 says login requires org + username/email + password, but email is already globally unique in the existing schema. **[TECH-REC]** Keep email globally unique and treat the org field as optional disambiguation; make it required only if the same person must hold accounts in multiple orgs. **Confirm.**
- **Set-password page** (new) — `/[locale]/auth/set-password?token=…` for invited Accountants and Contacts (§2.1).
- **UI states:** submitting (button disabled + spinner), field-level errors from the `errors[]` array, a general error banner, rate-limit (429) message, success redirect. Skeletons via `DashboardSkeleton` on the authenticated shell.
- **Responsive:** single-column form below 768px; the existing `auth.css` neumorphic card scales — no new breakpoints.
- **strict.md:** all strings via `useTranslations('auth')`, keys present in `en.json`, `hi.json`, `gu.json` before the component is written.

#### Backend Requirements

`POST /api/auth/register` **[EXISTS — EXTEND]**

Request:
```json
{
  "name": "Priya Shah",
  "email": "priya@urbanfurniture.in",
  "password": "••••••••",
  "organizationName": "Urban Furniture",
  "captchaId": "…",
  "captchaAnswer": "…"
}
```
Response `201`:
```json
{
  "success": true,
  "message": "Organization created. Check your email for the verification code.",
  "data": {
    "user": { "id": "uuid", "name": "Priya Shah", "email": "priya@urbanfurniture.in", "role": "admin" },
    "organization": { "id": "uuid", "name": "Urban Furniture", "slug": "urban-furniture" }
  }
}
```

`POST /api/users/invite` — Admin only, creates an Accountant (`manager`).

Request:
```json
{ "name": "Rohit Mehta", "email": "rohit@urbanfurniture.in", "role": "manager" }
```
Response `201`:
```json
{ "success": true, "message": "Invitation sent", "data": { "user": { "id": "uuid", "email": "rohit@urbanfurniture.in", "role": "manager", "status": "invited" } } }
```

`POST /api/auth/set-password` — public, consumes a single-use invite token.

**Authentication/Authorization:** register is public and rate-limited. `/api/users/*` requires `authenticate + resolveTenant + authorize('admin')` — **[SPEC]** §3, only Admin creates Accountant accounts.

#### Database Requirements
`organizations` (new); `users` gains `organization_id`, `contact_id`, `must_change_password`. Invite tokens reuse the existing OTP/token machinery rather than a new table. **[TECH-REC]**

#### Business Logic — registration
1. Validate body; verify CAPTCHA **[EXISTS]**.
2. Reject duplicate email.
3. Open a transaction (§3.4).
4. Insert `organizations`; derive a unique slug from the name.
5. Insert `users` with `role='admin'`, `organization_id`, `email_verified=false`.
6. Seed the default CoA, the four journals, and `document_sequences` (§4.5).
7. Issue the email-verification OTP **[EXISTS]**.
8. Commit; send the email **after** commit so a mail failure cannot roll back a created org.
9. Return `201`.

#### Validation
Name 2–100 chars; email format and ≤255 chars; existing password complexity (8–128, upper, lower, digit, special) **[EXISTS]**; organization name 2–150 chars; slug unique with numeric suffix on collision; role restricted to `manager` on the invite endpoint so an Admin cannot mint another Admin. **[TECH-REC]**

#### Security
- Password hashing: `bcrypt` with `PASSWORD_PEPPER` **[EXISTS]**.
- Privileged users get server sessions; contacts get in-memory JWTs (§3.2) **[EXISTS]**.
- Rate limiting on all auth routes **[EXISTS]**.
- **[TECH-REQ]** `role` and `organization_id` are never accepted from the request body on register — both are set server-side.
- Invite tokens: single-use, hashed at rest, expiring (**[TECH-REC]** 72 hours).
- Enumeration resistance: forgot-password and invite responses are identical whether or not the address exists **[EXISTS]**.

---

### 6.2 Master Data — the shared pattern

**[SPEC]** §4 defines six master-data modules. They are structurally identical, so the pattern is specified once here and each module below states only its differences.

#### Frontend pattern
- **List page** — `PageHead` (title + primary action), a filter bar (`InputBox` search + `InputBox as="select"` filters), `DataTable`, pagination footer.
- **Create/Edit** — **[TECH-REC]** a right-side drawer or modal for short forms (Category, Tax, Analytic Account); a full page for long ones (Contact, Product). Fewer context switches for quick entries, more room where it is needed.
- **Row actions** — Edit (permission-gated), Archive/Unarchive, View.
- **UI states** — loading (`Skeleton` rows), empty (illustration + "Create the first X" CTA), error (retry banner), archived rows shown with a muted `Pill`.
- **Responsive** — below 768px the table becomes stacked `ListCard`s; `DataTable` stays for ≥768px.

#### Backend pattern
| Method | Endpoint | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/<resource>` | Paginated list | admin, manager |
| `GET` | `/api/<resource>/:id` | Single record | admin, manager |
| `POST` | `/api/<resource>` | Create | admin, manager **[SPEC]** §3 |
| `PATCH` | `/api/<resource>/:id` | Modify | **admin only** **[SPEC]** §3 — see §16 Decision 1 |
| `PATCH` | `/api/<resource>/:id/archive` | Archive | **admin only** **[SPEC]** §3 |
| `PATCH` | `/api/<resource>/:id/unarchive` | Restore | admin only |

**[TECH-REQ]** Standard list contract for every collection endpoint:

Query: `?page=1&limit=25&search=chair&status=active&sortBy=name&sortOrder=asc`

Response `200`:
```json
{
  "success": true,
  "message": "Products retrieved",
  "data": {
    "items": [],
    "pagination": { "page": 1, "limit": 25, "total": 134, "totalPages": 6, "hasNext": true }
  }
}
```

**[TECH-REQ]** `sortBy` is never interpolated into SQL. It is mapped through an allow-list per module:
```js
const SORTABLE = { name: 'name', createdAt: 'created_at', salesPrice: 'sales_price' };
const column = SORTABLE[sortBy] || 'created_at';
```
This is the one place SQL injection could enter an otherwise fully parameterised codebase, because a column name cannot be a bind parameter.

#### Business logic pattern
1. Authenticate → resolve tenant → authorize.
2. Validate body; on failure return `422` with `errors[]`.
3. Duplicate check, scoped to `organization_id`.
4. Referential checks (referenced FKs exist, are active, same org).
5. Write, stamping `organization_id`, `created_by`/`updated_by`.
6. Write the audit row.
7. Return `201`/`200`.

Archive additionally: block if the record is referenced by any posted document (**[SPEC]** §9.6) — return `409` naming what blocks it.

#### Security pattern
Every endpoint: `authenticate` → `resolveTenant` → `authorize`. Every query filtered by `organization_id`. All SQL parameterised **[EXISTS]**. Output encoded by React (XSS) **[EXISTS]**. Cookie-based session flows need CSRF consideration — see §14.

---

### 6.3 Feature: Contact Master

**Purpose — [SPEC]** §4.1: maintain customers/vendors, and per §2.2 optionally provision portal logins.

**Frontend:** per §6.2, plus — Type filter (Customer/Vendor/Both), profile-image upload with preview, an **"Enable portal access"** checkbox (**[SPEC]** §2.2) with helper text explaining an invite email will be sent, and a detail page with tabs: *Details*, *Invoices*, *Bills*, *Payments*.

**Backend:** the §6.2 endpoint set at `/api/contacts`, plus:

`POST /api/contacts/:id/portal-access`
```json
{ "enabled": true }
```
```json
{ "success": true, "message": "Portal invitation sent", "data": { "contactId": "uuid", "portalUserId": "uuid", "portalAccessEnabled": true } }
```

**Database:** `contacts` per §4.1. `users.contact_id` links a portal login to its contact.

**Business logic — portal provisioning [SPEC]** §2.1/§2.2:
1. Validate the contact has an email — reject otherwise, since there is nowhere to send the invite.
2. In one transaction: create a `users` row with `role='user'`, `organization_id`, `contact_id`, `email_verified=false`, `must_change_password=true`, and a random unusable password.
3. Generate a single-use invite token.
4. Commit, then email the "set your password" link.
5. Disabling access revokes the login: increment `token_version` (invalidating live JWTs instantly, **[EXISTS]**) and delete refresh tokens.

**Validation:** name 2–150; `contact_type` in the enum; email format, unique per org (case-insensitive), required when portal access is on; mobile 10–15 digits; pincode 6 digits **[ASSUM]** — India, inferred from §4.1's Pincode field; image ≤2 MB, `jpeg`/`png`/`webp` only.

**Security:** a portal user may read **only** their own contact's documents — enforced by deriving `contact_id` from `req.user`, never from the URL (§6.11).

---

### 6.4 Feature: Product Master

**Purpose — [SPEC]** §4.2.

**Frontend:** per §6.2. Category and Type filters; price columns right-aligned and currency-formatted; **[SPEC]** §3 — the Edit action is visible only to Admin, because only Admin may change prices.

**Backend:** §6.2 set at `/api/products`.

`POST /api/products` request:
```json
{
  "name": "Office Chair",
  "sku": "UF-CHR-001",
  "productType": "goods",
  "categoryId": "uuid",
  "salesPrice": 4500.00,
  "costPrice": 3200.00,
  "salesTaxId": "uuid",
  "incomeAccountId": "uuid",
  "expenseAccountId": "uuid"
}
```
Response `201`:
```json
{ "success": true, "message": "Product created", "data": { "product": { "id": "uuid", "name": "Office Chair", "sku": "UF-CHR-001", "salesPrice": "4500.00", "status": "active" } } }
```

> Money is returned as a **string** — see §3.3. The frontend formats it and never does arithmetic on it.

**Validation:** name 2–150; type in enum; `salesPrice >= 0`, `costPrice >= 0`, both max 2 decimals; SKU unique per org when present; referenced category/tax/accounts must exist, be active, be same-org.

**Business rule — [TECH-REC]:** archiving a product does not alter historical document lines. Lines store the price at time of sale, so a later price change never rewrites history. This is essential for accounting correctness.

---

### 6.5 Feature: Chart of Accounts

**Purpose — [SPEC]** §4.3 — the master list of ledger accounts classifying every transaction.

**Frontend:** per §6.2, plus a **tree view** for the `parent_account_id` hierarchy (`project.md` §4.3 marks this optional for v1 — **[TECH-REC]** ship the flat list first, add the tree when nesting is actually used). Group the list by `account_type`. Show a computed current balance per account. Opening Balance is editable **only** while the account has no posted lines.

**Backend:** §6.2 set at `/api/accounts`, plus `GET /api/accounts/tree` returning the nested structure.

**Business logic:** system accounts (`is_system=true`, seeded per §4.5) cannot be archived or have their `account_type` changed — the ledger engine depends on them. **[TECH-REQ]**

Opening balances (**[SPEC]** §4.3 "needed to seed the Balance Sheet correctly") post as one balancing journal entry against an Opening Balance Equity account, rather than sitting as a loose column the reports must special-case. **[TECH-REC]**

**Validation:** name 2–150; `account_type` in the five values from §4.3; code unique per org; a parent must exist, be same-org, share the account type, and not create a cycle (**[TECH-REQ]** — walk the ancestor chain before saving).

---

### 6.6 Feature: Journals & Journal Entries

**Purpose — [SPEC]** §4.4/§4.5.

**Frontend:**
- **Journals** — simple list/form per §6.2 (name, type, default accounts).
- **Journal Entries list** — `DataTable` with columns Entry #, Date, Journal, Reference, Debit total, Credit total, Source, Status. Filters: journal, date range, status, auto-generated vs manual (**[SPEC]** §4.5's auto-generated flag). Default sort `entry_date DESC`.
- **Entry detail** — header plus a lines table with a **running Debit/Credit totals footer** that turns red until the two sides match.
- **Manual entry form** — dynamic line rows (add/remove), account picker, analytic picker, debit/credit inputs where typing in one clears the other; live balance indicator; Save disabled while unbalanced. **[TECH-REQ]** — the client mirrors the server rule for fast feedback; the server remains the authority.

**Backend:**

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/journal-entries` | Filtered, paginated list |
| `GET` | `/api/journal-entries/:id` | Entry with lines |
| `POST` | `/api/journal-entries` | Manual entry (posts immediately) |
| `POST` | `/api/journal-entries/:id/reverse` | Reversing entry |

`POST /api/journal-entries` request:
```json
{
  "journalId": "uuid",
  "entryDate": "2026-09-05",
  "reference": "ADJ-001",
  "narration": "Opening cash adjustment",
  "lines": [
    { "accountId": "uuid-cash", "debit": 10000.00, "credit": 0 },
    { "accountId": "uuid-equity", "debit": 0, "credit": 10000.00 }
  ]
}
```
Response `201`:
```json
{
  "success": true,
  "message": "Journal entry posted",
  "data": { "entry": { "id": "uuid", "entryNumber": "JE/2026/00042", "status": "posted", "totalDebit": "10000.00", "totalCredit": "10000.00", "lines": [] } }
}
```
Unbalanced → `422`:
```json
{ "success": false, "message": "Journal entry is not balanced", "errors": ["Total debit (10000.00) must equal total credit (9000.00)"] }
```

**Business logic:** delegates entirely to §5.1. There is no second implementation of posting.

**Security:** no `PATCH` or `DELETE` on a posted entry exists at the API surface — immutability (§3.8) is enforced by not offering the operation, by a DB trigger, and by the reverse-only correction path.

---

### 6.7 Feature: Analytic Accounts & Budgets

**Purpose — [SPEC]** §4.6, §4.7, §8 — analytic accounts tag transactions to a project/department; a budget compares a planned amount against actuals aggregated from lines carrying that tag.

**Frontend:**
- **Analytic Accounts** — list/form per §6.2 (name, type, department/project).
- **Budgets list** — columns: Name, Period, Analytic Account, Planned, Actual, Variance, Variance %, Responsible. Variance rendered as a `Pill` (over/under) and a `ProgressBar` **[EXISTS]** showing consumption.
- **Budget form** — name, date range picker, responsible-person select, analytic-account select (**required** — §4.7), planned amount.
- **Budget detail** — KPI row (Planned / Actual / Variance) via `StatCard`, plus a `GroupedBarChart` of planned vs actual by month, plus the contributing journal lines in a `DataTable`.

**Backend:**

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/analytic-accounts` | List (also feeds pickers) |
| `POST` | `/api/analytic-accounts` | Create |
| `GET` | `/api/budgets` | List with computed actuals |
| `POST` | `/api/budgets` | Create |
| `PATCH` | `/api/budgets/:id` | Modify (admin) |
| `GET` | `/api/budgets/:id` | Detail with contributing lines |

`GET /api/budgets` response:
```json
{
  "success": true,
  "message": "Budgets retrieved",
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Ahmedabad Store Q3",
        "periodStart": "2026-07-01",
        "periodEnd": "2026-09-30",
        "analyticAccount": { "id": "uuid", "name": "Retail Store - Ahmedabad" },
        "plannedAmount": "500000.00",
        "actualAmount": "412350.00",
        "variance": "87650.00",
        "variancePercent": "17.53"
      }
    ],
    "pagination": {}
  }
}
```

**Business logic — actuals (§8):**
1. Read the budget's `analytic_account_id`, `period_start`, `period_end`.
2. Sum `journal_entry_lines` where `analytic_account_id` matches, the parent entry is `posted`, and `entry_date` falls in the period.
3. Sign by analytic type: expense budgets use `SUM(debit) - SUM(credit)`; income budgets the reverse. **[TECH-REQ]** — without this, income budgets report negative actuals.
4. `variance = planned - actual`; `variancePercent = variance / planned * 100`, guarding `planned = 0` (**[TECH-REQ]** — division by zero).

**[TECH-REQ]** Actuals are computed on read, not stored. A stored `actual_amount` would drift the moment any entry is posted, reversed, or back-dated.

**[SPEC]** §8 requires transaction-level analytic tagging, so PO/SO/Bill/Invoice **lines** carry `analytic_account_id` and the ledger engine copies it onto the journal lines. Without this the Budget Report has no actuals at all.

**Validation:** name 2–150; `period_end >= period_start`; `planned_amount > 0`; analytic account required, active, same-org; responsible person must be a user in the same org.

---

### 6.8 Feature: Tax Master

**Purpose — [SPEC]** `project.md` §7 — tax must be modelled explicitly and must post to its own CoA account.

**[AMBIG]** §7 leaves open whether tax applies to purchases as well as sales (Decision 4, §16). **[TECH-REC]** Build `tax_scope` as `sales | purchase | both` now. The column costs nothing today and avoids a migration plus a rewrite of the bill-posting rules later, whichever way the decision goes.

**Frontend:** list/form per §6.2 — name, rate %, scope, computation, collected account, paid account.

**Backend:** §6.2 set at `/api/taxes`.

**Business logic — line computation [TECH-REQ]:**
```
line_subtotal = round(quantity * unit_price, 2)
line_tax      = round(line_subtotal * rate / 100, 2)
line_total    = line_subtotal + line_tax
```
Document totals sum the **rounded line values** (§3.3), so the printed lines always add up to the printed total.

Defaulting per **[SPEC]** §7: the tax defaults from the product (`sales_tax_id` / `purchase_tax_id`) and is overridable per line.

**Validation:** rate 0–100, max 4 decimals; scope and computation in enum; the tax account must exist, be active, be a liability (collected) or asset (paid) — **[TECH-REC]**, this catches a misconfiguration that would silently corrupt the Balance Sheet.

---

### 6.9 Feature: Purchase Flow — Purchase Orders & Vendor Bills

**Purpose — [SPEC]** §5.1 — PO → Vendor Bill on receipt → payment, with journal entries generated automatically.

**Frontend:**

*PO list* — columns PO #, Vendor, Order Date, Total, Status `Pill`, Actions. Filters: vendor, status, date range. Search on PO number and vendor name. Sortable on date, total, PO number. Row actions: View, Edit (draft only), Confirm, Convert to Bill (confirmed only), Cancel. **[TECH-REC]** Bulk actions are not needed in v1 — `project.md` describes no bulk workflow.

*PO form* — vendor select (vendors and "both" only), order date, expected date, then an **editable line grid**: Product → auto-fills description, unit price from `cost_price`, and purchase tax; Quantity; Unit Price; Tax; Analytic Account; computed Subtotal/Tax/Total per line. A live totals panel shows Untaxed / Tax / Total. Add and remove line rows.

*Bill form* — same grid, plus Bill Date, Due Date, Vendor Reference, and an attachments panel (**[SPEC]** §9.5).

*UI states* — draft is fully editable; posted is read-only with a "Register Payment" action; a payments sub-table lists settlements; status transitions are confirmed via modal.

**Backend:**

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/purchase-orders` | List |
| `POST` | `/api/purchase-orders` | Create draft |
| `GET` | `/api/purchase-orders/:id` | Detail with lines |
| `PATCH` | `/api/purchase-orders/:id` | Edit draft only |
| `POST` | `/api/purchase-orders/:id/confirm` | draft → confirmed |
| `POST` | `/api/purchase-orders/:id/cancel` | → cancelled |
| `POST` | `/api/purchase-orders/:id/create-bill` | **[SPEC]** §5.1.3 convert to bill |
| `GET` | `/api/vendor-bills` | List |
| `POST` | `/api/vendor-bills` | Create standalone draft |
| `GET` | `/api/vendor-bills/:id` | Detail |
| `PATCH` | `/api/vendor-bills/:id` | Edit draft only |
| `POST` | `/api/vendor-bills/:id/post` | **Draft → Posted, generates the journal entry** |
| `POST` | `/api/vendor-bills/:id/cancel` | Cancel (reverses the entry if posted) |

`POST /api/purchase-orders` request:
```json
{
  "vendorContactId": "uuid",
  "orderDate": "2026-09-05",
  "expectedDate": "2026-09-12",
  "notes": "Bulk order for Ahmedabad store",
  "lines": [
    { "productId": "uuid", "description": "Wooden Chair", "quantity": 20, "unitPrice": 3200.00, "taxId": "uuid", "analyticAccountId": "uuid" }
  ]
}
```
Response `201`:
```json
{
  "success": true,
  "message": "Purchase order created",
  "data": {
    "purchaseOrder": {
      "id": "uuid", "poNumber": "PO/2026/00017", "status": "draft",
      "vendor": { "id": "uuid", "name": "Azure Furniture" },
      "untaxedAmount": "64000.00", "taxAmount": "11520.00", "totalAmount": "75520.00",
      "lines": []
    }
  }
}
```

`POST /api/vendor-bills/:id/post` response `200`:
```json
{
  "success": true,
  "message": "Vendor bill posted",
  "data": {
    "bill": { "id": "uuid", "billNumber": "BILL/2026/00009", "status": "posted", "amountDue": "75520.00" },
    "journalEntry": { "id": "uuid", "entryNumber": "JE/2026/00051" }
  }
}
```

**Business logic — posting a bill (one transaction, §3.4):**
1. Authenticate, resolve tenant, authorize (`admin` or `manager` — **[SPEC]** §3).
2. Load the bill with lines; assert `status='draft'`, else `409`.
3. Assert it has at least one line and `total_amount > 0`.
4. Assert the vendor is active; assert every account and journal is active (**[SPEC]** §9.6).
5. Recompute all totals **server-side** from the lines. **[TECH-REQ]** — client-sent totals are never trusted.
6. Consume the `BILL` sequence (§3.5).
7. Build the journal lines per §5.3 and call `postJournalEntry`.
8. Update the bill: status, number, `journal_entry_id`, `amount_due = total`, `posted_at`.
9. If it came from a PO, set the PO to `billed` (**[SPEC]** §5.1.2).
10. Write the audit row.
11. Commit, then queue the notification (§6.13).

**Validation:** vendor exists, active, is a vendor or both, same org; ≥1 line; `quantity > 0`; `unit_price >= 0`; product active and same-org; `due_date >= bill_date`; edits allowed only in `draft`; **[TECH-REQ]** converting a PO that is already `billed` returns `409`, preventing double-billing.

**Security:** `authenticate + resolveTenant + authorize('admin','manager')` on every route. **[TECH-REQ]** `:id` is always resolved with `WHERE id = $1 AND organization_id = $2` — an id alone is never trusted, which closes the IDOR path across tenants.

---

### 6.10 Feature: Sales Flow — Sales Orders & Customer Invoices

**Purpose — [SPEC]** §5.2 — SO → Customer Invoice → payment received, with automatic journal entries.

Structurally the mirror of §6.9. Differences only:

- Contact filter is customers and "both"; unit price defaults from `sales_price`; tax defaults from `sales_tax_id`. **[SPEC]** §5.2.1 explicitly lists Tax on the Sales Order.
- Statuses: `draft → confirmed → invoiced → cancelled` (**[SPEC]** §5.2.2).
- Endpoints mirror §6.9 under `/api/sales-orders` and `/api/customer-invoices`, with `POST /api/sales-orders/:id/create-invoice` and `POST /api/customer-invoices/:id/post`.
- Journal entry per §5.3 (Dr Debtors / Cr Sale Income + Output Tax Payable).
- **[SPEC]** §9.7 — posting an invoice queues an email to the contact when portal access is enabled, including the payment link.
- Invoice detail adds a **"Send to customer"** action and a Print/PDF action (§16 Decision 6).

`POST /api/customer-invoices/:id/post` response `200`:
```json
{
  "success": true,
  "message": "Invoice posted",
  "data": {
    "invoice": { "id": "uuid", "invoiceNumber": "INV/2026/00023", "status": "posted", "totalAmount": "26550.00", "amountDue": "26550.00", "dueDate": "2026-10-05" },
    "journalEntry": { "id": "uuid", "entryNumber": "JE/2026/00052" }
  }
}
```

---

### 6.11 Feature: Payments & Settlement

**Purpose — [SPEC]** §5.1.5, §5.2.5 — register a payment against a bill or invoice, selecting bank or cash, and post the matching journal entry.

**Frontend:**
- **Register Payment modal** (opened from an invoice or bill) — payment date, method (Cash/Bank), journal select (filtered to the matching type), amount (defaults to `amount_due`), reference note. Shows the resulting remaining balance live.
- **Payments list page** — columns Payment #, Date, Contact, Method, Direction, Amount, Allocated to, Status. Filters by method, direction, date range, contact.
- **[TECH-REC]** Partial payment is supported because §5.2.6 defines a `partially_paid` status, which is only reachable if a payment can be smaller than the balance.

**Backend:**

| Method | Endpoint | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/payments` | List | admin, manager |
| `POST` | `/api/payments` | Register + post | admin, manager |
| `GET` | `/api/payments/:id` | Detail | admin, manager |
| `POST` | `/api/payments/:id/cancel` | Cancel + reverse | admin |

`POST /api/payments` request:
```json
{
  "paymentType": "inbound",
  "contactId": "uuid",
  "paymentMethod": "bank",
  "journalId": "uuid-bank-journal",
  "paymentDate": "2026-09-06",
  "amount": 10000.00,
  "reference": "NEFT-77213",
  "allocations": [ { "invoiceId": "uuid", "allocatedAmount": 10000.00 } ]
}
```
Response `201`:
```json
{
  "success": true,
  "message": "Payment recorded",
  "data": {
    "payment": { "id": "uuid", "paymentNumber": "PAY/2026/00031", "amount": "10000.00", "status": "posted" },
    "journalEntry": { "id": "uuid", "entryNumber": "JE/2026/00055" },
    "updatedDocuments": [ { "type": "customer_invoice", "id": "uuid", "status": "partially_paid", "amountDue": "16550.00" } ]
  }
}
```

**Business logic (one transaction):**
1. Validate; assert `SUM(allocations) == amount` — **[TECH-REQ]**, otherwise money posts to the ledger without a home.
2. Lock each target document `FOR UPDATE`. **[TECH-REQ]** — two concurrent payments on one invoice would otherwise both read the same `amount_due` and overpay it.
3. Assert each document is same-org, belongs to this contact, and is `posted`/`partially_paid`.
4. Assert `allocated_amount <= amount_due` per document — no overpayment.
5. Consume the `PAY` sequence.
6. Post the journal entry per §5.3.
7. Update each document: `amount_paid += allocated`, recompute `amount_due`, set `paid` when zero, else `partially_paid` (**[SPEC]** §5.1.6, §5.2.6).
8. Insert allocation rows; write audit.
9. Commit.

**Validation:** `amount > 0`, max 2 decimals; `payment_date` not in the future (**[TECH-REC]**); journal type must match the method (cash journal for cash, bank journal for bank) — **[TECH-REQ]**, or the ledger credits the wrong asset account; at least one allocation; contact matches every allocated document's contact.

**Security:** `authorize('admin','manager')` — **[SPEC]** §3, Contacts never record Cash/Bank payments. Cancellation is Admin-only and reverses rather than deletes (§3.8).

---

### 6.12 Feature: Contact Portal

**Purpose — [SPEC]** §5.3 — a Contact logs in, sees only their own documents, and a Customer can pay an invoice by card.

**Frontend:** a distinct, deliberately narrow surface under `/[locale]/portal/`:
- `/portal` — overview: Total Outstanding, Overdue, Paid This Year (`StatCard`), plus recent documents.
- `/portal/invoices` — customers only. Columns: Invoice #, Date, Due Date, Total, Paid, Due, Status. Filter by status, date range. Row action **Pay Now** on unpaid invoices.
- `/portal/bills` — vendors only. **[SPEC]** §5.3.3 — the full historical statement of bills raised against them. **[SPEC]** §5.3.7 — **no Pay Now button for vendors.** The organization pays vendors, not the reverse.
- `/portal/invoices/:id` — read-only detail plus a payment panel.
- Portal navigation is built from a separate `PORTAL_NAV` in `dashboard.config.js`, keyed to `role: 'user'`. Contacts must never see accounting navigation.

**Backend — `portal/` module. Every endpoint derives `contact_id` from `req.user.contact_id`.**

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/portal/summary` | KPI cards |
| `GET` | `/api/portal/invoices` | Own invoices (customer) |
| `GET` | `/api/portal/invoices/:id` | Own invoice detail |
| `GET` | `/api/portal/bills` | Own bills (vendor) |
| `POST` | `/api/portal/invoices/:id/pay-intent` | Create a gateway order |
| `POST` | `/api/portal/payments/verify` | Verify and post the payment |
| `POST` | `/api/webhooks/payments/:provider` | Gateway webhook — **public, signature-verified** |

`POST /api/portal/invoices/:id/pay-intent` response:
```json
{
  "success": true,
  "message": "Payment order created",
  "data": { "gatewayOrderId": "order_xxx", "amount": "26550.00", "currency": "INR", "publicKey": "rzp_test_xxx", "invoiceNumber": "INV/2026/00023" }
}
```

**Business logic — card payment [SPEC]** §5.3.4–5.3.5:
1. Authenticate the contact; load the invoice with `WHERE id=$1 AND organization_id=$2 AND customer_contact_id=$3`. **[TECH-REQ]** — all three conditions, always.
2. Assert `amount_due > 0` and status is payable.
3. Create a gateway order for **`amount_due` read from the database**. **[TECH-REQ]** — the amount is never taken from the client, or a customer could pay ₹1 against a ₹26,550 invoice.
4. On the client, the gateway's own SDK collects the card. **[TECH-REQ]** Card details never touch this application's servers, DOM, or logs.
5. Verify the gateway signature server-side.
6. In one transaction: insert the payment (`method='card'`), post the journal entry per §5.3, allocate, update invoice status.
7. Idempotency: `UNIQUE (organization_id, gateway_payment_id)`. **[TECH-REQ]** — the webhook and the browser callback will both fire for the same payment, and without this the invoice is credited twice.

**[AMBIG]** §5.3.6 — the gateway is an open decision (§16, Decision 3). **[TECH-REC]** Write a thin `payments/gateway.adapter.js` exposing `createOrder`, `verifySignature`, `fetchPayment`. Implement Razorpay first (INR context, matching the Pincode-based Indian addresses in §4.1), keeping Stripe swappable. Do not spread gateway calls through the service layer.

**Security:** the strictest surface in the system.
- `authorize('user')` plus a `requirePortalContact` guard asserting `req.user.contact_id` exists.
- Vendor-only and customer-only endpoints check `contact_type`; a vendor calling the pay endpoint gets `403` (**[SPEC]** §5.3.7).
- Webhook: signature-verified, replay-protected, and it must **never** trust an amount from the payload — always re-fetch from the gateway.
- Rate-limit pay-intent creation.
- **[TECH-REQ]** Never log gateway signatures, card data, or full payloads. The existing sanitising logger helps but must be checked for these fields.

---

### 6.13 Features: Reports, Dashboard, Notifications, Attachments, Audit

#### Reports — **[SPEC]** §6, §7.4

`GET /api/reports/balance-sheet?asOfDate=2026-09-30` — **[SPEC]** §6, real-time Assets/Liabilities/Capital.
`GET /api/reports/profit-loss?fromDate=&toDate=` — **[SPEC]** §6, income minus purchases/expenses.
`GET /api/reports/budget?budgetId=` or `?fromDate=&toDate=` — **[SPEC]** §6.
Role: `admin`, `manager` view; Contacts have no access (**[SPEC]** §3).

```json
{
  "success": true,
  "message": "Balance sheet generated",
  "data": {
    "asOfDate": "2026-09-30",
    "assets":      { "lines": [ { "accountId": "uuid", "code": "1000", "name": "Cash", "balance": "125000.00" } ], "total": "845000.00" },
    "liabilities": { "lines": [], "total": "310000.00" },
    "capital":     { "lines": [], "total": "535000.00" },
    "isBalanced": true
  }
}
```

**Business logic:** one aggregate query via §5.4, posted entries only, grouped by account type, signed correctly (assets/expenses are debit-positive; liabilities/income/capital are credit-positive). **[TECH-REQ]** `isBalanced` asserts Assets = Liabilities + Capital + Net Profit; when false the UI must show a warning rather than a silently wrong report.

**[TECH-REQ]** Net profit for the period is folded into Capital on the Balance Sheet, or Assets will not balance.

**Frontend:** `/[locale]/dashboard/reports/{balance-sheet,profit-loss,budget}`. Date controls (as-of for BS, range for P&L/Budget), a grouped table with subtotals and a grand total, print-friendly styling, an export button (§16 Decision 6), and a chart per §11.5.

#### Dashboard — **[TECH-REC]**, not specified in `project.md`

`project.md` has no dashboard section, but the codebase already has a full dashboard shell and role-routing. Populating it with existing data adds no new business requirements.

`GET /api/dashboard/summary?period=` returns KPI cards (Total Receivable, Total Payable, Income This Period, Expenses This Period, Net Profit, Overdue Invoices count), a monthly income-vs-expense series, a top-5 customers series, a receivable-aging breakdown, and recent activity. See §11.6.

#### Notifications — **[SPEC]** §9.7

`notifications` table; a service that inserts a `pending` row inside the business transaction and dispatches **after commit** via the existing `nodemailer` setup **[EXISTS]**. Triggers: invoice posted (to a portal-enabled customer), bill posted, payment received, portal invite, password reset **[EXISTS]**.

**[TECH-REC]** Do **not** add BullMQ or Redis for v1. A `setImmediate` dispatch plus a retry pass over `status='pending'` rows is sufficient at this scale and adds no infrastructure. Revisit only if volume demands it.

#### Attachments — **[SPEC]** §9.5

`POST /api/attachments` (multipart), `GET /api/attachments?entityType=&entityId=`, `DELETE /api/attachments/:id`. Requires `multer` (§13). **[TECH-REQ]** validate MIME by magic bytes not just the header, cap size (5 MB), store outside the web root with generated names, and stream downloads through an authorized endpoint — never a public static path, or one org's scanned bills become readable by another.

#### Audit — **[SPEC]** §9.2

`GET /api/audit-logs?entityType=&entityId=&page=` — Admin only. Written by services per §3.6.

---

## 7. Complete API Architecture

All endpoints are prefixed `/api`. All authenticated endpoints run `authenticate → resolveTenant → authorize`. Roles use the §3.2 mapping: `admin` = Business Owner, `manager` = Accountant, `user` = Contact.

### 7.1 Auth & Users

| Method | Endpoint | Purpose | Auth | Role | Request | Response |
|---|---|---|---|---|---|---|
| POST | `/auth/register` | Business-owner signup, creates org | No | — | name, email, password, organizationName, captcha | user + organization |
| POST | `/auth/verify-email` | Verify OTP **[EXISTS]** | No | — | email, otp | success |
| POST | `/auth/resend-verification-otp` | Resend OTP **[EXISTS]** | No | — | email | success |
| POST | `/auth/login` | Login **[EXISTS — EXTEND]** | No | — | email, password, organizationSlug?, remember | user + token/cookie |
| POST | `/auth/refresh` | Rotate token **[EXISTS]** | Cookie | — | — | token |
| POST | `/auth/logout` | Revoke **[EXISTS]** | Any | — | — | success |
| GET | `/auth/me` | Current profile **[EXISTS]** | Yes | any | — | user + organization |
| GET | `/auth/captcha` | CAPTCHA **[EXISTS]** | No | — | — | challenge |
| POST | `/auth/forgot-password` | Reset OTP **[EXISTS]** | No | — | email | success |
| POST | `/auth/verify-reset-otp` | Verify OTP **[EXISTS]** | No | — | email, otp | resetToken |
| POST | `/auth/reset-password` | Reset **[EXISTS]** | No | — | resetToken, password | success |
| POST | `/auth/set-password` | Accept invite | No | — | inviteToken, password | success |
| GET | `/users` | List org users | Yes | admin | pagination | items |
| POST | `/users/invite` | Create Accountant | Yes | admin | name, email, role | user |
| PATCH | `/users/:id/status` | Activate/deactivate | Yes | admin | status | user |
| GET | `/organizations/current` | Org profile | Yes | admin, manager | — | organization |
| PATCH | `/organizations/current` | Update org settings | Yes | admin | name, currency, fiscalYearStartMonth | organization |

### 7.2 Master Data

Each resource below exposes the §6.2 standard set. `<r>` ∈ `contacts`, `products`, `product-categories`, `accounts`, `journals`, `analytic-accounts`, `taxes`.

| Method | Endpoint | Purpose | Auth | Role |
|---|---|---|---|---|
| GET | `/<r>` | Paginated, searchable, filterable, sortable list | Yes | admin, manager |
| GET | `/<r>/:id` | Detail | Yes | admin, manager |
| POST | `/<r>` | Create — **[SPEC]** §3 both roles create | Yes | admin, manager |
| PATCH | `/<r>/:id` | Modify — **[SPEC]** §3 Admin only | Yes | admin |
| PATCH | `/<r>/:id/archive` | Archive — **[SPEC]** §3 Admin only | Yes | admin |
| PATCH | `/<r>/:id/unarchive` | Restore | Yes | admin |

Additions: `POST /contacts/:id/portal-access` (admin); `GET /accounts/tree` (admin, manager).

### 7.3 Budgets

| Method | Endpoint | Purpose | Auth | Role |
|---|---|---|---|---|
| GET | `/budgets` | List with computed actuals & variance | Yes | admin, manager |
| GET | `/budgets/:id` | Detail with contributing lines | Yes | admin, manager |
| POST | `/budgets` | Create | Yes | admin, manager |
| PATCH | `/budgets/:id` | Modify | Yes | admin |
| PATCH | `/budgets/:id/archive` | Archive | Yes | admin |

### 7.4 Transactions

| Method | Endpoint | Purpose | Auth | Role |
|---|---|---|---|---|
| GET | `/purchase-orders` | List | Yes | admin, manager |
| POST | `/purchase-orders` | Create draft | Yes | admin, manager |
| GET | `/purchase-orders/:id` | Detail with lines | Yes | admin, manager |
| PATCH | `/purchase-orders/:id` | Edit (draft only) | Yes | admin, manager |
| POST | `/purchase-orders/:id/confirm` | draft → confirmed | Yes | admin, manager |
| POST | `/purchase-orders/:id/create-bill` | **[SPEC]** §5.1.3 | Yes | admin, manager |
| POST | `/purchase-orders/:id/cancel` | → cancelled | Yes | admin, manager |
| GET | `/vendor-bills` | List | Yes | admin, manager |
| POST | `/vendor-bills` | Create draft | Yes | admin, manager |
| GET | `/vendor-bills/:id` | Detail | Yes | admin, manager |
| PATCH | `/vendor-bills/:id` | Edit (draft only) | Yes | admin, manager |
| POST | `/vendor-bills/:id/post` | Post + journal entry | Yes | admin, manager |
| POST | `/vendor-bills/:id/cancel` | Cancel + reverse | Yes | admin |
| GET | `/sales-orders` | List | Yes | admin, manager |
| POST | `/sales-orders` | Create draft | Yes | admin, manager |
| GET | `/sales-orders/:id` | Detail | Yes | admin, manager |
| PATCH | `/sales-orders/:id` | Edit (draft only) | Yes | admin, manager |
| POST | `/sales-orders/:id/confirm` | draft → confirmed | Yes | admin, manager |
| POST | `/sales-orders/:id/create-invoice` | **[SPEC]** §5.2.3 | Yes | admin, manager |
| POST | `/sales-orders/:id/cancel` | → cancelled | Yes | admin, manager |
| GET | `/customer-invoices` | List | Yes | admin, manager |
| POST | `/customer-invoices` | Create draft | Yes | admin, manager |
| GET | `/customer-invoices/:id` | Detail | Yes | admin, manager |
| PATCH | `/customer-invoices/:id` | Edit (draft only) | Yes | admin, manager |
| POST | `/customer-invoices/:id/post` | Post + journal entry | Yes | admin, manager |
| POST | `/customer-invoices/:id/send` | Email to contact | Yes | admin, manager |
| POST | `/customer-invoices/:id/cancel` | Cancel + reverse | Yes | admin |
| GET | `/payments` | List | Yes | admin, manager |
| POST | `/payments` | Register + post | Yes | admin, manager |
| GET | `/payments/:id` | Detail | Yes | admin, manager |
| POST | `/payments/:id/cancel` | Cancel + reverse | Yes | admin |

### 7.5 Ledger, Reports, Dashboard

| Method | Endpoint | Purpose | Auth | Role |
|---|---|---|---|---|
| GET | `/journal-entries` | Filtered list | Yes | admin, manager |
| GET | `/journal-entries/:id` | Entry with lines | Yes | admin, manager |
| POST | `/journal-entries` | Manual balanced entry | Yes | admin, manager |
| POST | `/journal-entries/:id/reverse` | Reversing entry | Yes | admin |
| GET | `/reports/balance-sheet` | **[SPEC]** §6 — `?asOfDate=` | Yes | admin, manager |
| GET | `/reports/profit-loss` | **[SPEC]** §6 — `?fromDate=&toDate=` | Yes | admin, manager |
| GET | `/reports/budget` | **[SPEC]** §6 — `?budgetId=` or range | Yes | admin, manager |
| GET | `/reports/:type/export` | PDF/Excel — §16 Decision 6 | Yes | admin, manager |
| GET | `/dashboard/summary` | KPIs + series | Yes | admin, manager |
| GET | `/audit-logs` | **[SPEC]** §9.2 | Yes | admin |
| POST | `/attachments` | Upload — **[SPEC]** §9.5 | Yes | admin, manager |
| GET | `/attachments` | List for an entity | Yes | admin, manager |
| GET | `/attachments/:id/download` | Authorized stream | Yes | admin, manager |
| DELETE | `/attachments/:id` | Remove | Yes | admin |

### 7.6 Portal & Webhooks

| Method | Endpoint | Purpose | Auth | Role |
|---|---|---|---|---|
| GET | `/portal/summary` | Own KPIs | Yes | user |
| GET | `/portal/invoices` | **[SPEC]** §5.3.2 own invoices | Yes | user (customer) |
| GET | `/portal/invoices/:id` | Own invoice detail | Yes | user (customer) |
| GET | `/portal/bills` | **[SPEC]** §5.3.3 own bill history | Yes | user (vendor) |
| POST | `/portal/invoices/:id/pay-intent` | Create gateway order | Yes | user (customer) |
| POST | `/portal/payments/verify` | Verify + post | Yes | user (customer) |
| POST | `/webhooks/payments/:provider` | Gateway callback | **Signature** | — |
| GET | `/health` | Liveness **[EXISTS]** | No | — |

### 7.7 Status code convention — **[TECH-REQ]**

| Code | Meaning |
|---|---|
| `200` | OK |
| `201` | Created |
| `400` | Malformed request |
| `401` | Not authenticated / token expired **[EXISTS]** |
| `403` | Authenticated but not permitted, or wrong tenant **[EXISTS]** |
| `404` | Not found in this organization |
| `409` | Business-rule conflict — wrong status, duplicate, archived in use |
| `422` | Validation failed — always with `errors[]` |
| `429` | Rate limited **[EXISTS]** |
| `500` | Internal — generic message only **[EXISTS]** |

**[TECH-REQ]** A record belonging to another organization returns `404`, not `403`. A `403` confirms the record exists, which leaks tenant data.

### 7.8 Overdue derivation — **[TECH-REQ]**

`overdue` is computed, not transitioned by a user: `status IN ('posted','partially_paid') AND due_date < CURRENT_DATE AND amount_due > 0`. Expose it as a derived `isOverdue` field and a SQL-side filter. **[TECH-REC]** No cron job is needed for v1; a nightly job would only duplicate what the predicate already gives, and would introduce drift between runs.

---

## 8. Frontend Architecture

### 8.1 Routing — all under `src/app/[locale]/`

`localePrefix: 'always'` **[EXISTS]**, so every path carries `/en`, `/hi`, or `/gu`.

| Route | Purpose | Access |
|---|---|---|
| `/auth/*` | **[EXISTS]** register, login, verify, forgot, reset | Public |
| `/auth/set-password` | **NEW** — accept invite | Public (token) |
| `/dashboard` | **[EXISTS]** role router | Any authenticated |
| `/dashboard/admin` | **[EXISTS — EXTEND]** Business Owner console | `admin` |
| `/dashboard/manager` | **[EXISTS — EXTEND]** Accountant console | `manager` |
| `/dashboard/contacts` · `/[id]` · `/new` | Contact master | `admin`, `manager` |
| `/dashboard/products` · `/[id]` · `/new` | Product master | `admin`, `manager` |
| `/dashboard/product-categories` | Categories | `admin`, `manager` |
| `/dashboard/accounts` | Chart of Accounts | `admin`, `manager` |
| `/dashboard/journals` | Journal master | `admin`, `manager` |
| `/dashboard/journal-entries` · `/[id]` · `/new` | Ledger | `admin`, `manager` |
| `/dashboard/analytic-accounts` | Analytic accounts | `admin`, `manager` |
| `/dashboard/budgets` · `/[id]` · `/new` | Budgets | `admin`, `manager` |
| `/dashboard/taxes` | Tax master | `admin`, `manager` |
| `/dashboard/purchase-orders` · `/[id]` · `/new` | POs | `admin`, `manager` |
| `/dashboard/vendor-bills` · `/[id]` · `/new` | Bills | `admin`, `manager` |
| `/dashboard/sales-orders` · `/[id]` · `/new` | SOs | `admin`, `manager` |
| `/dashboard/customer-invoices` · `/[id]` · `/new` | Invoices | `admin`, `manager` |
| `/dashboard/payments` · `/[id]` | Payments | `admin`, `manager` |
| `/dashboard/reports/balance-sheet` | **[SPEC]** §6 | `admin`, `manager` |
| `/dashboard/reports/profit-loss` | **[SPEC]** §6 | `admin`, `manager` |
| `/dashboard/reports/budget` | **[SPEC]** §6 | `admin`, `manager` |
| `/dashboard/users` | User management | `admin` |
| `/dashboard/audit-logs` | **[SPEC]** §9.2 | `admin` |
| `/dashboard/settings` | Org settings | `admin` |
| `/portal` · `/portal/invoices` · `/[id]` · `/portal/bills` | **[SPEC]** §5.3 | `user` |

**[TECH-REQ]** Extend `src/proxy.js` **[EXISTS]** so `/portal/*` and `/dashboard/*` both require a credential at the HTTP layer. Cookie presence is a UX optimisation only — the backend remains the security boundary.

**[TECH-REQ]** Extend `getDashboardPath(role)` in `AuthContext` **[EXISTS]** so `user` resolves to `/portal`, not `/dashboard/user`.

### 8.2 Component plan — `src/components/`

Following the existing `components/<page>/` convention **[EXISTS]**:

| Folder | New components |
|---|---|
| `components/shared/` | `FilterBar`, `Pagination`, `SortableHeader`, `StatusPill`, `ConfirmDialog`, `Drawer`, `Modal`, `MoneyText`, `DateText`, `EmptyState`, `ErrorState`, `FormField`, `FormActions` |
| `components/pickers/` | `ContactPicker`, `ProductPicker`, `AccountPicker`, `JournalPicker`, `TaxPicker`, `AnalyticAccountPicker`, `DateRangePicker` |
| `components/masters/` | `ContactForm`, `ContactTable`, `ProductForm`, `ProductTable`, `AccountForm`, `AccountTree`, `JournalForm`, `TaxForm`, `AnalyticAccountForm`, `BudgetForm`, `BudgetProgress` |
| `components/transactions/` | `DocumentLineGrid` (**the single most reused component** — PO, SO, Bill and Invoice all use it), `DocumentTotals`, `DocumentHeader`, `DocumentStatusBar`, `RegisterPaymentModal`, `PaymentAllocationTable`, `AttachmentPanel` |
| `components/ledger/` | `JournalEntryForm`, `JournalEntryLines`, `BalanceIndicator` |
| `components/reports/` | `ReportToolbar`, `BalanceSheetTable`, `ProfitLossTable`, `BudgetReportTable`, `ReportExportButton` |
| `components/portal/` | `PortalInvoiceTable`, `PortalBillTable`, `PayNowButton`, `GatewayCheckout` |
| `components/dashboard/` | **[EXISTS — EXTEND]** `KpiRow`, `IncomeExpenseChart`, `TopCustomersChart`, `AgingChart`, `RecentActivityList` |

**[TECH-REC]** `DocumentLineGrid` is where this project either stays maintainable or does not. Four document types share identical line behaviour (product picker → price/tax defaults → quantity → per-line totals → add/remove rows). Build it once with a config object for the differences (`priceField: 'salesPrice' | 'costPrice'`, `taxField`, `contactType`). Four near-identical copies is the most likely failure mode of this build.

### 8.3 strict.md compliance — mandatory for every new page

Per `strict.md` §5.3, before a page is considered ready:

1. Message keys added to `en.json`, `hi.json`, **and** `gu.json` — before the component is written, not after.
2. New CSS file in `src/styles/` (e.g. `masters.css`, `transactions.css`, `reports.css`, `portal.css`), imported in `src/app/layout.jsx`.
3. Every color via `var(--*)` from `globals.css`. No hex, no `rgb()`, no Tailwind color utilities.
4. Any genuinely new color is added to `:root` in `globals.css`, derived from the Frozen Lake palette. Existing variables are never modified.
5. Fonts: Orbitron for headings/numbers, Sora for body/UI. Nothing else.
6. Neumorphic dual shadows on cards and interactive surfaces; inset shadows on hover/active. Radius 6px buttons, 12–14px cards, 20–28px large containers.
7. `Link`, `useRouter`, `usePathname` imported from `@/i18n/navigation` — never from `next/link` or `next/navigation`.
8. No hardcoded user-facing strings anywhere in JSX.

**[TECH-REQ]** New i18n namespaces: `contacts`, `products`, `accounts`, `journals`, `journalEntries`, `analyticAccounts`, `budgets`, `taxes`, `purchases`, `sales`, `payments`, `reports`, `portal`, `users`, `common`. `common` holds shared strings (Save, Cancel, statuses, table states) so they are translated once.

**[TECH-REQ]** Accounting terminology in Hindi and Gujarati is specialist vocabulary. Machine translation of "Debit", "Credit", "Accounts Receivable", "Chart of Accounts", or "Analytic Account" will produce misleading text in a financial system. Budget time for a reviewer who knows the domain, and keep a glossary in `src/messages/`.

---

## 9. UI / UX Technical Requirements

### 9.1 Page pattern — every list page

**Purpose:** browse, search, filter and act on one entity.
**Access:** enforced twice — `ProtectedRoute` **[EXISTS]** in the UI for a good experience, and `authorize()` on the API as the real boundary.

Layout, top to bottom: `PageHead` (title, count, primary action) → `FilterBar` (search + selects + date range) → `DataTable` → `Pagination`.

### 9.2 Tables — the specification for every table

`DataTable` **[EXISTS]** is presentational. **[TECH-REQ]** wrap it rather than modify it, so existing dashboard tables are unaffected:

- **Sorting** — `SortableHeader` renders in `columns[].header`, holds `{ sortBy, sortOrder }` in URL state, and is applied **server-side** via the §6.2 allow-list. Never sort a paginated page client-side; it sorts only the visible slice and is simply wrong.
- **Filtering** — server-side query params, held in the URL so a filtered view is shareable and survives refresh.
- **Search** — server-side `ILIKE` on named columns, debounced 300ms client-side.
- **Pagination** — server-side, 25 per page default, with 10/25/50/100 options.
- **Row actions** — a trailing actions column rendered via `columns[].render`, permission-gated per §3.2.
- **Bulk actions** — **[TECH-REC]** none in v1. `project.md` describes no bulk workflow; selection state and bulk endpoints are real complexity for no stated requirement.
- **Empty state** — `emptyLabel` for a filtered no-match ("No products match these filters" + Clear filters); a richer `EmptyState` for a genuinely empty collection ("No products yet" + Create).
- **Loading** — `loading` + `loadingLabel`, with `Skeleton` rows on first load and a dimmed table on refetch, so the layout does not jump.
- **Error** — `ErrorState` with the server message and Retry.

Key table columns:

| Table | Columns |
|---|---|
| Contacts | Name, Type, Email, Mobile, City, Portal, Status, Actions |
| Products | Name, SKU, Type, Category, Sales Price, Cost, Status, Actions |
| Accounts | Code, Name, Type, Parent, Balance, Status, Actions |
| Journal Entries | Entry #, Date, Journal, Reference, Debit, Credit, Source, Status |
| Purchase Orders | PO #, Vendor, Order Date, Untaxed, Tax, Total, Status, Actions |
| Vendor Bills | Bill #, Vendor, Bill Date, Due Date, Total, Paid, Due, Status, Actions |
| Sales Orders | SO #, Customer, Order Date, Untaxed, Tax, Total, Status, Actions |
| Customer Invoices | Invoice #, Customer, Date, Due Date, Total, Paid, Due, Status, Actions |
| Payments | Payment #, Date, Contact, Method, Direction, Amount, Allocated, Status |
| Budgets | Name, Period, Analytic Account, Planned, Actual, Variance, Variance %, Responsible |
| Portal Invoices | Invoice #, Date, Due Date, Total, Paid, Due, Status, Pay |
| Portal Bills | Bill #, Date, Due Date, Total, Paid, Due, Status |

**[TECH-REQ]** All money columns are right-aligned, tabular-figure, and formatted with `Intl.NumberFormat` bound to the active locale — a number column that does not align on the decimal point is unreadable at a glance, which is the entire point of an accounting table.

### 9.3 Forms — the specification for every form

| Form | Fields (type, required) | Validation | Default | Submit |
|---|---|---|---|---|
| **Contact** | Name (text, ✔), Type (select, ✔), Email (email, conditional), Mobile (tel), City/State (text), Pincode (text), Image (file), Portal access (checkbox) | §6.3 | Type=customer, Portal=off | POST/PATCH → redirect to detail |
| **Product** | Name (text, ✔), SKU (text), Type (select, ✔), Category (select), Sales Price (number, ✔), Cost (number, ✔), Sales Tax (select), Income/Expense Account (select) | §6.4 | Type=goods | POST/PATCH → back to list |
| **Account** | Code (text, ✔), Name (text, ✔), Type (select, ✔), Parent (select), Opening Balance (number) | §6.5 | Opening=0 | POST/PATCH |
| **Journal** | Name (text, ✔), Type (select, ✔), Default Debit/Credit Account (select) | Enum + FK | — | POST/PATCH |
| **Tax** | Name (text, ✔), Rate (number, ✔), Scope (select, ✔), Computation (select), Collected/Paid Account (select) | §6.8 | percentage, sales | POST/PATCH |
| **Analytic Account** | Name (text, ✔), Type (select, ✔), Department/Project (text) | Enum | — | POST/PATCH |
| **Budget** | Name (text, ✔), Period Start/End (date, ✔), Responsible (select), Analytic Account (select, ✔), Planned Amount (number, ✔) | §6.7 | Period = current quarter | POST/PATCH |
| **PO / SO** | Contact (picker, ✔), Order Date (date, ✔), Expected Date (date), Notes (textarea), **Lines** (grid, ≥1) | §6.9 | Date = today | POST → draft |
| **Bill / Invoice** | Contact (picker, ✔), Date (date, ✔), Due Date (date, ✔), Reference (text), **Lines** (grid, ≥1), Attachments | §6.9 | Due = date + 30d **[ASSUM]** | POST → draft, then Post |
| **Payment** | Date (date, ✔), Method (select, ✔), Journal (select, ✔), Amount (number, ✔), Reference (text), Allocations | §6.11 | Date = today, Amount = amount due | POST → posted |
| **Journal Entry** | Journal (select, ✔), Date (date, ✔), Reference (text), Narration (textarea), **Lines** (≥2, balanced) | §6.6 | Date = today | POST → posted |

**[TECH-REQ]** Submit behaviour is uniform: disable the submit control while in flight (prevents double-posting an invoice, which would double-hit the ledger); map `errors[]` to fields where the message names one, otherwise show a form-level banner; on success show a toast and navigate; on `409` show the conflict message without clearing the user's input.

**[TECH-REC]** `useFormDraft` **[EXISTS]** already exists — reuse it on the long document forms so a mistimed refresh does not discard twenty line items.

### 9.4 Modals, drawers, tabs

- **Modal** — Register Payment, Confirm/Cancel/Post confirmations, Archive confirmation.
- **Drawer** — quick-create for Category, Tax, Analytic Account from inside a picker, so building an invoice is not interrupted by a full page change.
- **Tabs** — Contact detail (Details / Invoices / Bills / Payments); Reports (three report tabs sharing one date toolbar); Document detail (Lines / Journal Entry / Payments / Attachments / History).

### 9.5 Charts — using the existing SVG library only

**[SPEC]** §6 requires reports. **[TECH-REC]** the chart choices below; the underlying numbers are all specified.

| Chart | Type | X | Y | Data source | Filters | Aggregation | Tooltip |
|---|---|---|---|---|---|---|---|
| **Income vs Expense** | `GroupedBarChart` | Month | Amount (₹) | `/dashboard/summary` | Date range | `SUM` of posted lines by month, split income/expense | Month, income, expense, net |
| **Net profit trend** | `AreaChart` | Month | Net profit (₹) | `/reports/profit-loss` | Period | Income − expense per month | Month, net profit, MoM % |
| **Expense breakdown** | `DonutChart` | — | Share | `/reports/profit-loss` | Period | `SUM` by expense account, top 6 + Other | Account, amount, % of total |
| **Budget planned vs actual** | `GroupedBarChart` | Budget / month | Amount (₹) | `/reports/budget` | Budget, period | Planned vs §6.7 actuals | Name, planned, actual, variance, variance % |
| **Budget consumption** | `ProgressBar` | — | % consumed | `/budgets` | — | `actual / planned` | Consumed %, remaining |
| **Receivable aging** | `BarChart` | Bucket (Current, 1–30, 31–60, 61–90, 90+) | Amount (₹) | `/dashboard/summary` | — | `SUM(amount_due)` bucketed on `due_date` | Bucket, amount, invoice count |
| **Top customers** | `BarChart` (horizontal) | Amount (₹) | Customer | `/dashboard/summary` | Period | `SUM` of posted invoice totals, top 5 | Customer, revenue, invoice count |
| **Balance Sheet composition** | `StackedBarChart` | Assets vs Liabilities+Capital | Amount (₹) | `/reports/balance-sheet` | As-of date | `SUM` by type | Type, account, amount |
| **Cash & bank sparkline** | `Sparkline` | Day | Balance | `/dashboard/summary` | Last 30 days | Running balance | Date, balance |

**Empty state** — every chart renders "No data for this period" via the `--graph-empty-text` token; never a blank frame or an axis with no series, which reads as a broken component.
**Loading state** — `Skeleton` at the chart's exact height so the dashboard does not reflow.
**[TECH-REQ]** Series colors come only from `--graph-series-1..8` per `strict.md` §1.

### 9.6 Dashboard

**KPI cards** (`StatCard`, `tone="deep"` on the primary): Total Receivable, Total Payable, Income (period), Expenses (period), Net Profit, Overdue Invoices.
**Charts:** Income vs Expense, Receivable Aging, Top Customers, Expense Breakdown.
**Tables:** Recent Invoices (5), Recent Bills (5), Recent Payments (5).
**Filters:** period selector (This Month / This Quarter / This FY / Custom), applied to every KPI and chart together.
**Recent activity:** `ListCard` from `audit_logs`.
**Alerts:** overdue invoices, budgets over 90% consumed, unbalanced Balance Sheet warning.
**Role-specific:** `admin` additionally sees user-management and org-settings entry points; `manager` sees the same financials without them (**[SPEC]** §3).
**Portal dashboard** (`user`): Total Outstanding, Overdue, Paid This Year, plus their own recent documents — no org-wide figures whatsoever.

### 9.7 Responsive behaviour — **[TECH-REQ]**

| Width | Behaviour |
|---|---|
| ≥1280px | Full layout: sidebar expanded, multi-column KPI row, full tables |
| 1024–1279px | Sidebar collapses to icons; KPI row wraps to 3 |
| 768–1023px | Sidebar becomes an overlay drawer; KPIs 2-up; tables scroll horizontally in a container |
| <768px | Tables become stacked `ListCard`s; forms single-column; the line grid becomes per-line cards; charts full-width at reduced height |

**[TECH-REQ]** The document line grid is the hard case: a 7-column editable grid cannot shrink to 375px. Below 768px each line renders as a card with stacked labelled fields. Do not attempt a horizontally scrolling editable grid on mobile — it is unusable.

---

## 10. State Management

**[TECH-REC] Do not add Redux, Zustand, or React Query.** The existing primitives cover every need below, and `project.md` describes no cross-page shared mutable state that would justify a store.

| State | Where it lives | Why |
|---|---|---|
| Authentication, user, role | `AuthContext` **[EXISTS]** | Already the source of truth via `/auth/me` |
| Organization profile | **[TECH-REC]** extend `AuthContext` to expose `organization` from `/auth/me` | One fetch, avoids a second provider for data that always arrives together |
| Server data (lists, details) | Per-feature hooks in `src/hooks/` — e.g. `useContacts()`, `useInvoice(id)` | Follows `useDashboardData` **[EXISTS]** |
| Filters, search, sort, page | **URL query params** via `useSearchParams` | Shareable, refresh-survivable, back-button correct, and free of a state library |
| Form state | Local `useState` per form, drafts via `useFormDraft` **[EXISTS]** | Forms are page-scoped |
| Modal / drawer state | Local `useState` in the owning page | Never global |
| Loading / error | Returned per hook: `{ data, loading, error, refetch }` | Uniform consumption |
| Toasts | **[TECH-REC]** a small `ToastContext` (~50 lines) | Needed globally; a dependency for this is not |
| Locale | `next-intl` **[EXISTS]** | — |

**[TECH-REQ]** Standard hook contract, so every list page consumes data identically:

```js
const { data, pagination, loading, error, refetch } = useContacts({ page, limit, search, status, sortBy, sortOrder });
```

**[TECH-REQ]** Every fetching hook aborts in-flight requests on unmount or param change (`AbortController`). Without it, fast filter typing lands responses out of order and the table shows results for a filter the user already changed.

---

## 11. File & Folder Additions

Additions only. **Nothing in the existing structure is moved, renamed, or rebuilt.**

### 11.1 Backend — `Backend/src/`

```
shared/                      NEW  withTransaction.js · money.js · pagination.js
                                  tenant.middleware.js · sequence.service.js
                                  audit.service.js · constants.js · validate.js
accounting/                  NEW  accounting.service.js · accounting.repository.js
                                  accounting.rules.js
organizations/               NEW  routes · controller · service · repository · validation
users/                       NEW  (same five files)
contacts/                    NEW  + contacts.portal.js
products/                    NEW
accounts/                    NEW
journals/                    NEW  + journalEntries.* handlers
analytics/                   NEW
budgets/                     NEW
taxes/                       NEW
purchases/                   NEW  purchaseOrders.* + vendorBills.*
sales/                       NEW  salesOrders.* + customerInvoices.*
payments/                    NEW  + payments.gateway.adapter.js · payments.webhook.js
reports/                     NEW  + reports.balanceSheet.js · reports.profitLoss.js
                                  · reports.budget.js
portal/                      NEW
dashboard/                   NEW
attachments/                 NEW
audit/                       NEW
notifications/               NEW  notifications.service.js · notifications.templates.js
database/migrations/         EXTEND  006_… through 028_…
database/seeds/              EXTEND  default CoA, journals, sequences
tests/                       EXTEND  see §15
```

**Modified existing files (minimally):**
- `src/app.js` — mount the new routers where the file already reserves space with `// Future feature routes will be mounted here`.
- `src/database/migrations/run-migrations.js` — append the new migrations to the ordered array.
- `src/config/env.js` — add the new variables from §12.
- `src/auth/auth.service.js` / `auth.controller.js` / `auth.validation.js` — org creation on register, org context in `/me`.
- `src/auth/auth.repository.js` — select `organization_id`, `contact_id`.

### 11.2 Frontend — `Frontend/src/`

```
app/[locale]/dashboard/<module>/    NEW  page.jsx · [id]/page.jsx · new/page.jsx
app/[locale]/dashboard/reports/     NEW  balance-sheet · profit-loss · budget
app/[locale]/portal/                NEW  page.jsx · invoices · bills
app/[locale]/auth/set-password/     NEW  page.jsx
components/shared/                  NEW
components/pickers/                 NEW
components/masters/                 NEW
components/transactions/            NEW
components/ledger/                  NEW
components/reports/                 NEW
components/portal/                  NEW
components/dashboard/               EXTEND
hooks/                              NEW  useContacts · useProducts · useAccounts
                                         useJournalEntries · useBudgets
                                         usePurchaseOrders · useVendorBills
                                         useSalesOrders · useCustomerInvoices
                                         usePayments · useReports · usePortal
                                         usePagination · useDebounce
services/                           EXTEND  one thin module per API group
styles/                             NEW  masters.css · transactions.css
                                         reports.css · portal.css · forms.css
utils/                              NEW  format.js (money/date/number, locale-aware)
                                         status.js · permissions.js
messages/{en,hi,gu}.json            EXTEND  the §8.3 namespaces, all three files
config/dashboard.config.js          EXTEND  accounting nav per role + PORTAL_NAV
context/AuthContext.jsx             EXTEND  organization + getDashboardPath('user') → /portal
proxy.js                            EXTEND  guard /dashboard/* and /portal/*
app/layout.jsx                      EXTEND  import the new CSS files
```

**[TECH-REQ]** `utils/permissions.js` mirrors the §3.2 role matrix so the UI can hide actions a role cannot perform. It is a **UX layer only** — the backend `authorize()` remains the security boundary, exactly as the existing `AuthContext` comment already states.

---

## 12. Environment Variables

Existing variables **[EXISTS]** stay unchanged. Additions only. Never commit real values; `.env.example` carries placeholders only.

### Backend — append to `Backend/.env.example`

```env
# ===========================================
# Application
# ===========================================
APP_BASE_URL=http://localhost:3000
DEFAULT_CURRENCY=INR
DEFAULT_FISCAL_YEAR_START_MONTH=4

# ===========================================
# Invitations (Accountant + Contact portal)
# ===========================================
INVITE_TOKEN_EXPIRES_HOURS=72

# ===========================================
# File Uploads (attachments, profile images)
# ===========================================
UPLOAD_DIR=./storage/uploads
UPLOAD_MAX_SIZE_BYTES=5242880
UPLOAD_ALLOWED_MIME=image/jpeg,image/png,image/webp,application/pdf

# ===========================================
# Payment Gateway — project.md §5.3.6 open decision
# Fill in only the provider actually chosen.
# ===========================================
PAYMENT_GATEWAY_PROVIDER=razorpay
PAYMENT_GATEWAY_KEY_ID=
PAYMENT_GATEWAY_KEY_SECRET=
PAYMENT_GATEWAY_WEBHOOK_SECRET=
PAYMENT_CURRENCY=INR
```

### Frontend — `Frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_APP_NAME=Urban Furniture
NEXT_PUBLIC_DEFAULT_CURRENCY=INR
NEXT_PUBLIC_PAYMENT_GATEWAY_PROVIDER=razorpay
NEXT_PUBLIC_PAYMENT_GATEWAY_KEY_ID=
```

**[TECH-REQ]** Only the gateway's **publishable** key is ever `NEXT_PUBLIC_*`. `PAYMENT_GATEWAY_KEY_SECRET` and `PAYMENT_GATEWAY_WEBHOOK_SECRET` are backend-only. A secret prefixed `NEXT_PUBLIC_` is compiled into the JavaScript bundle and shipped to every visitor.

**[TECH-REQ]** Extend `validateEnv()` in `config/env.js` **[EXISTS]** to fail fast on missing gateway secrets **when** the portal payment feature is enabled — a silent misconfiguration here means payments appear to work and never post.

---

## 13. Libraries & External Services

### 13.1 Already present — reuse, do not replace **[EXISTS]**

`express`, `pg`, `bcrypt`, `jsonwebtoken`, `cookie-parser`, `cors`, `helmet`, `express-rate-limit`, `nodemailer`, `dotenv` · `next`, `react`, `next-intl`, `lucide-react`.

### 13.2 Recommended additions — each with a real requirement behind it

| Library | Side | Why it is needed | Feature | Problem solved |
|---|---|---|---|---|
| **`decimal.js`** | Backend | **[TECH-REQ]** `pg` returns `NUMERIC` as strings and JS floats cannot represent currency exactly. `0.1 + 0.2 !== 0.3` in a ledger means a Balance Sheet that does not balance. | §5, §6, §7 — all money | Exact decimal arithmetic (§3.3) |
| **`multer`** | Backend | **[SPEC]** §9.5 attachments and §4.1 profile image. Express 5 has no multipart parser. | Attachments, Contact images | Multipart upload handling |
| **Payment gateway SDK** — `razorpay` **or** `stripe` | Backend | **[SPEC]** §5.3.4 card payment via portal | Contact portal | Order creation, signature verification, webhooks |
| **`date-fns`** | Both | Fiscal periods, aging buckets, due-date maths, month bucketing for charts. Small and tree-shakeable. | Reports, budgets, dashboard | Date arithmetic without hand-rolled bugs |

### 13.3 Conditional — only if the corresponding decision lands in scope

| Library | Condition | Purpose |
|---|---|---|
| `pdfmake` or `puppeteer` | §16 Decision 6 selects PDF export | Invoice PDFs, report export |
| `exceljs` | Decision 6 selects Excel export | Report export |
| `sharp` | If profile images need server-side resizing | Image normalisation |
| `jest` + `supertest` | When formal automated testing is adopted (§15) | Unit and API testing |

### 13.4 Explicitly **not** recommended

| Rejected | Why |
|---|---|
| Prisma / Sequelize / TypeORM | The codebase is raw parameterised `pg` **[EXISTS]**. An ORM would be a rewrite, and the reporting queries in §5.4 are aggregate SQL an ORM only gets in the way of. |
| Recharts / Chart.js / D3 | `src/reusablefiles/graphs/` **[EXISTS]** already covers every chart in §9.5. |
| Redux / Zustand / React Query | §10 — no need that Context + hooks + URL state do not already meet. |
| Tailwind CSS | `strict.md` §1 forbids Tailwind color utilities; the project uses CSS variables and per-feature stylesheets. |
| TypeScript / `zod` | Rule 8 — the project is JavaScript. Validation follows the existing hand-rolled `{ isValid, errors, data }` contract **[EXISTS]**, factored into `shared/validate.js` helpers with no new dependency. |
| BullMQ / Redis | §6.13 — email volume at this scale does not justify new infrastructure. |
| `moment` | Deprecated and large; `date-fns` is the modern equivalent. |

### 13.5 External services

| Service | Purpose | Feature | Operations | Auth | Env vars | Webhooks | Failure handling |
|---|---|---|---|---|---|---|---|
| **Payment gateway** (Razorpay or Stripe — §16 Decision 3) | **[SPEC]** §5.3.4 card payments | Contact portal | Create order, verify signature, fetch payment, refund (future) | API key + secret; HMAC on webhooks | `PAYMENT_GATEWAY_*` | **Yes** — payment captured/failed | Timeout on order creation → `502`, invoice untouched. Verification failure → payment recorded `failed`, **no journal entry**. Webhook is the safety net when the browser callback is lost. Idempotent on `gateway_payment_id`. |
| **SMTP** (Gmail app password) **[EXISTS]** | **[SPEC]** §9.7 notifications | Invites, invoice emails, OTP | Send | App password | `SMTP_*` **[EXISTS]** | No | Never blocks a business transaction. Row marked `failed`, retried with backoff, surfaced in an admin view. |

**No other external service is required.** `project.md` names none, and adding any would be technology for its own sake.

---

## 14. Error Handling

The existing central `error.middleware.js` **[EXISTS]** already refuses to leak SQL, stacks, and secrets. Extend it rather than replacing it.

**[TECH-REQ] `shared/AppError.js`** — a typed error carrying `statusCode`, a machine-readable `code`, and an `errors[]` array, so services throw meaningfully and the existing middleware translates without a `try/catch` in every controller.

| Class | Backend behaviour | Frontend behaviour |
|---|---|---|
| **Validation** | `422` + `errors[]` naming fields | Inline field errors; focus the first invalid field; input preserved |
| **Authentication** | `401` **[EXISTS]** | `api.js` single-flight refresh **[EXISTS]**; on failure clear auth and redirect to login with a return path |
| **Authorization** | `403` with the role in the message **[EXISTS]** | "You do not have permission" page; the action should not have been visible (§11.2) |
| **Not found / wrong tenant** | `404` — never `403` (§7.7) | Not-found page with a back link |
| **Business conflict** | `409` — wrong status, duplicate, archived-in-use | Toast with the exact reason; form state preserved |
| **Database** | Caught in the repository, mapped: `23505`→`409` duplicate, `23503`→`409` referenced record, `23514`→`422` constraint violated. Raw SQL never reaches the client **[EXISTS]**. | Friendly message; full detail in server logs only |
| **Transaction rollback** | `withTransaction` rolls back and rethrows (§3.4) | "Could not complete, nothing was saved" — reassures the user no partial ledger write occurred |
| **External API (gateway)** | `502` with a generic message; full detail logged; payment left `pending`/`failed` and never posted | "Payment could not be processed. You have not been charged. If money left your account it will be reconciled." |
| **Email failure** | Never fails the parent transaction; `notifications` row `failed`, retried | Silent; visible in an admin notifications view |
| **Network failure** | — | Retry button plus offline detection; do not silently swallow |
| **Empty data** | `200` with `items: []` — an empty collection is not an error | `EmptyState`, distinguishing "nothing yet" from "nothing matches your filters" |
| **Unexpected** | `500`, generic message, full internal log **[EXISTS]** | Error boundary with reload; never renders a stack trace |

**[TECH-REQ] Rate limiting** — reuse the existing `express-rate-limit` pattern **[EXISTS]**: strict on auth and invites **[EXISTS]**, strict on pay-intent creation and webhooks, standard on writes, generous on reads and reports.

**[TECH-REQ] CSRF** — the privileged-role path is cookie-based (`sid`), which is CSRF-reachable. The existing CORS config restricts the origin **[EXISTS]**, but that is not sufficient on its own. Set `SameSite=Strict` (or `Lax`) on `sid` and the refresh cookie, and add a double-submit CSRF token for state-changing requests on the session path. The JWT/Bearer path used by Contacts is not CSRF-exposed, because a browser will not attach an `Authorization` header on its own. **Verify the current `SameSite` setting before writing new code — it may already be correct.**

**[TECH-REQ] XSS** — React escapes by default **[EXISTS]**. Never introduce `dangerouslySetInnerHTML`; escape user-supplied values in generated PDFs and emails, which have no such protection.

**[TECH-REQ] SQL injection** — every value is a bind parameter **[EXISTS]**. The one residual risk is dynamic `ORDER BY`, closed by the §6.2 allow-list.

---

## 15. Performance

Address these; add nothing beyond them without a measurement.

| Area | Action | Why |
|---|---|---|
| **Report aggregation** | Single grouped queries (§5.4) with the composite indexes in §4.3 | The `journal_entry_lines` aggregation is the hottest query; per-account looping is the classic failure here |
| **Pagination** | Server-side everywhere, 25 default (§9.2) | Invoice and journal-entry tables grow without bound |
| **List queries** | `COUNT(*) OVER()` in the same query as the page, not a second round trip | Halves queries per list request |
| **N+1 avoidance** | Fetch document headers with lines in one query, or two queries and a client-side group — never one query per line | Document lists otherwise degrade linearly |
| **Contact/product pickers** | Server-side search with `limit=20`, debounced 300ms | Never load every product into a select |
| **Dashboard** | One `/dashboard/summary` returning all KPIs and series | Six parallel requests on every dashboard load is avoidable |
| **Caching** | **[TECH-REC]** none in v1 beyond HTTP caching on truly static lookups. Reports are real-time by definition (**[SPEC]** §6 "Real-time snapshot"), so caching them would be wrong, not merely premature. | |
| **Lazy loading** | `next/dynamic` for chart-heavy report pages and the line grid | Keeps the initial dashboard bundle small |
| **Connection pool** | `max: 20` **[EXISTS]** — verify against Postgres `max_connections` before load | Pool exhaustion under concurrent posting |
| **Transaction duration** | Keep email, PDF, and gateway calls **outside** transactions | A held transaction blocks the sequence row lock (§3.5) and serialises all posting |
| **Background jobs** | **[TECH-REC]** none required for v1. Overdue is derived (§7.8); email retry is a simple pass. | |
| **Indexes** | Exactly §4.3 | Over-indexing slows the write path, which in an accounting system is the posting path |

---

## 16. Testing

The project currently has `tests/security-audit.test.js` run via `npm test` **[EXISTS]**. **[TECH-REC]** adopt `jest` + `supertest` for the new surface area, against a dedicated test database, with each test in a transaction that rolls back.

### Priority 1 — the ledger. If only one thing is tested, test this.

| Scenario | Type |
|---|---|
| Balanced entry posts successfully | Unit |
| Unbalanced entry is rejected (`SUM(debit) ≠ SUM(credit)`) | Unit |
| A line with both debit and credit non-zero is rejected | Unit / DB |
| A line with both zero is rejected | DB constraint |
| Posting to an archived account or journal is rejected (**[SPEC]** §9.6) | Unit |
| A posted entry cannot be updated or deleted | DB trigger |
| Reversal produces an exact mirror and flags the original | Integration |
| Rounding: 100 lines at ₹33.333 sum to the document total exactly | Unit |
| Invoice posting produces Dr Debtors / Cr Income + Tax (§5.3) | Integration |
| Bill posting produces Dr Expense / Cr Creditors | Integration |
| Payment posting produces Dr Cash-Bank / Cr Debtors | Integration |

### Priority 2 — multi-tenancy and permissions

| Scenario | Type |
|---|---|
| Org A cannot read, update, or archive any Org B record — every module, every endpoint | Permission |
| A cross-tenant id returns `404`, not `403` (§7.7) | Permission |
| `manager` (Accountant) can create master data but not modify or archive it (**[SPEC]** §3) | Permission |
| `user` (Contact) gets `403` on every `/api/*` accounting endpoint | Permission |
| A Contact sees only their own invoices (**[SPEC]** §5.3.2) | Permission |
| A Vendor contact cannot call pay-intent (**[SPEC]** §5.3.7) | Permission |
| Only `admin` may invite users (**[SPEC]** §3) | Permission |
| A revoked portal contact's JWT stops working immediately (`token_version`) | Integration |

### Priority 3 — transactions, money, workflow

| Scenario | Type |
|---|---|
| Concurrent invoice posting yields no duplicate invoice numbers (§3.5) | Integration (parallel) |
| A rolled-back post consumes no sequence number | Integration |
| Concurrent payments on one invoice cannot overpay it (`FOR UPDATE`, §6.11) | Integration (parallel) |
| A failed journal write rolls back the invoice too — no orphan document | Integration |
| Partial payment sets `partially_paid`; the final one sets `paid` | Integration |
| Allocation exceeding `amount_due` is rejected | API |
| Allocations not summing to the payment amount are rejected | Unit |
| PO already `billed` cannot be billed again | API |
| Non-draft documents cannot be edited | API |
| A gateway webhook delivered twice credits the invoice once (idempotency) | Integration |
| A tampered gateway signature is rejected and posts nothing | Integration |
| Pay-intent uses the DB amount, ignoring a client-supplied amount | Integration |

### Priority 4 — validation, reports, database, UI

| Scenario | Type |
|---|---|
| Every required field, type, format, range, and enum per §6 | Validation |
| Duplicate SKU / account code / contact email within an org rejected; permitted across orgs | Validation |
| `period_end < period_start` rejected; tax rate outside 0–100 rejected | Validation |
| `sortBy` outside the allow-list falls back safely and injects nothing | Security |
| Balance Sheet balances (Assets = Liabilities + Capital + Net Profit) | Integration |
| P&L equals income minus expenses for the period (**[SPEC]** §6) | Integration |
| Budget actuals match the sum of analytic-tagged posted lines in the period (**[SPEC]** §8) | Integration |
| Budget with `planned_amount = 0` does not divide by zero | Unit |
| Reports with no data return zeros, not errors | Integration |
| All FK, unique, CHECK, and cascade behaviours (§4.4) | Database |
| Migrations run clean on an empty DB and are idempotent on re-run | Database |
| Every new string exists in `en.json`, `hi.json`, **and** `gu.json` (`strict.md` §2) | UI / lint |
| No hardcoded hex/rgb color in any new CSS (`strict.md` §1) | Lint |
| Table loading, empty, filtered-empty and error states each render | UI |
| Submit is disabled in flight — an invoice cannot be double-posted | UI |
| Line grid is usable at 375px (§9.7) | UI |

**[TECH-REC]** Add a CI check for the two mechanical `strict.md` rules — locale-key parity across the three files, and no hardcoded colors in `src/styles/`. Both are easy to violate accidentally and tedious to catch by eye in review.

---

## 17. Implementation Phases

Ordered by dependency. Nothing in a later phase can be built correctly before its predecessors.

| Phase | Scope | Exit criteria |
|---|---|---|
| **0 — Decisions** | Resolve §18 blockers, above all the §3.2 role mapping and Decision 1 | Written answers recorded in `project.md` §10 |
| **1 — Foundation** | `organizations`, `users.organization_id`, tenant middleware, `withTransaction`, `money.js`, sequences, audit, constants, validate helpers. Register creates an org + seeds CoA/journals/sequences. | An Admin can sign up, log in, and land on a dashboard with a seeded CoA. Cross-tenant access proven impossible. |
| **2 — Master data** | Contacts, Products, Categories, CoA, Journals, Analytic Accounts, Taxes — full CRUD + archive, UI and API. Portal-access provisioning. | **[SPEC]** §7.1 use case passes end to end. Permission matrix tests green. |
| **3 — Ledger engine** | `accounting/`, journal entries UI, manual entries, reversal, integrity triggers. | Priority-1 tests (§16) all green. This is the correctness gate for everything after it. |
| **4 — Purchase flow** | PO → Vendor Bill → post → journal entry. Cash/Bank payment. `DocumentLineGrid`. | **[SPEC]** §7.2 passes; the entry matches §5.3 exactly. |
| **5 — Sales flow** | SO → Invoice → post → journal entry. Payment received. Reuses phase 4 components. | **[SPEC]** §7.3 passes. |
| **6 — Reports** | Balance Sheet, P&L, Budget Report + charts. | **[SPEC]** §7.4 passes; Balance Sheet balances on seeded data. |
| **7 — Contact portal** | Portal shell, own-document views, gateway integration, card payment, webhook. | **[SPEC]** §5.3 passes; idempotency and signature tests green. |
| **8 — Supporting** | Dashboard, notifications, attachments, audit-log viewer, user management. | §9.6 and §6.13 complete. |
| **9 — Hardening** | Full i18n pass (hi/gu with domain review), responsive pass, index verification under volume, `strict.md` audit, CSRF verification, security review. | §16 suite green; `strict.md` §6 checklist clean. |

**[TECH-REC]** Phase 3 is the gate. Building the transaction flows on an unverified ledger produces bugs that surface as wrong financial reports weeks later, at which point every posted document is suspect and the data may be unrecoverable. Do not let phases 4–5 start early.

---

## 18. Open Decisions, Ambiguities & Assumptions

### 18.1 Carried from `project.md` §10 — must be answered before the phase named

| # | Decision | Blocks | Impact if deferred |
|---|---|---|---|
| 1 | Accountant `Modify` rights on master data — doc-strict (Create only) vs. allowing price edits | Phase 2 | This document implements **doc-strict** per §3. A later reversal means revisiting every master-data route and every UI permission gate. |
| 2 | Contact portal access — automatic for all vs. per-contact toggle | Phase 2 | This document implements the **toggle** (§2.2). Low switching cost. |
| 3 | Payment gateway — Razorpay vs. Stripe vs. other | Phase 7 | The adapter (§6.12) contains the blast radius, but env vars, SDK, and webhook shape all follow from this. |
| 4 | Tax scope — sales only vs. sales + purchase | Phase 4 | `tax_scope` is built for both (§6.8). Answering it wrong changes the **bill posting rules** in §5.3 and therefore the P&L. |
| 5 | Multi-currency vs. single INR | Phase 1 | This document assumes **single currency**. Retrofitting multi-currency touches every monetary column, every report, and every journal line. **Answer this in Phase 0 — it is the most expensive one to defer.** |
| 6 | Report export — in-app only vs. PDF/Excel in v1 | Phase 6 | Determines whether `pdfmake` / `exceljs` enter §13.3. |
| 7 | Inventory/stock tracking depth | Phase 4 | See §18.2 below. |

### 18.2 Ambiguities found in `project.md`

| # | Ambiguity | Where | Recommendation |
|---|---|---|---|
| A1 | **Stock reports.** §1 lists "financial and stock reports", and §10 Decision 7 flags it, but no stock module, no stock fields, and no stock report are specified anywhere. §6 lists only three reports, none of them stock. | §1 vs §6 | **Treat stock as out of scope for v1** and build the three specified reports. Bill posting debits Purchase Expense (§5.3) rather than Inventory, which is the correct treatment without a stock module. If stock is genuinely wanted, it needs its own section in `project.md` first — it is a large module (valuation method, stock moves, COGS), not a report. |
| A2 | **Login identity.** §2.1 requires Organization ID + username/email + password, but the existing schema makes email globally unique, so the org field is redundant. | §2.1 | Keep email globally unique; treat the org field as optional. Make it mandatory only if one person must hold accounts in several orgs (§6.1). |
| A3 | **Fiscal year start** is never stated, yet numbering (§9.3) and the P&L both need it. | §6, §9.3 | **[ASSUM]** April–March, stored per-org as `fiscal_year_start_month` so it is configurable rather than baked in. |
| A4 | **Product type "combo"** is listed in §4.2 with no explanation of behaviour — is it a bundle that explodes into components, or just a label? | §4.2 | **[ASSUM]** a label only in v1. A true bundle needs a components table and line explosion on order — a feature, not a field. Confirm. |
| A5 | **Payment terms** are unspecified, but Vendor Bills and Invoices both have a Due Date. | §5.1.3 | **[ASSUM]** `due_date = document_date + 30 days`, user-editable. Confirm, or add payment terms to the Contact master. |
| A6 | **Vendor Bill number source** — the org's own sequence, or the vendor's invoice number? | §5.1.3 | Store **both**: `bill_number` (internal sequence) and `vendor_reference` (their number). Only the internal one can be guaranteed unique. |
| A7 | **Partial payments** are implied by the `partially_paid` status but never described. | §5.1.6, §5.2.6 | Fully supported via `payment_allocations` (§6.11). |
| A8 | **Opening balance mechanics** — §4.3 adds the field but not how it reaches the ledger. | §4.3 | Post as a balancing entry against Opening Balance Equity (§6.5), not as a column the reports special-case. |
| A9 | **Journal entry editing** — §4.5 never says whether a posted entry can be edited. | §4.5 | Immutable; correct by reversal (§3.8). This is standard accounting practice and the only defensible reading. |
| A10 | **Analytic tagging on transactions** — §8 requires it, but the §4 field lists for PO/SO/Bill/Invoice lines never mention it. | §8 vs §4 | Added to all document lines (§6.7). Without it the Budget Report has no actuals and §8 is unimplementable. |
| A11 | **Contact deletion vs. archival for portal users** — §9.6 forbids deleting a contact with transactions, but says nothing about the linked login. | §9.6 | Archiving a contact revokes the portal login (`token_version` bump) but retains the user row for audit integrity (§6.3). |
| A12 | **Notification triggers** — §9.7 requires emailing contacts on invoice/bill generation, but does not enumerate the events. | §9.7 | Enumerated in §6.13. Confirm the list. |

### 18.3 Requirements that could not be determined from `project.md`

These are genuinely absent, not merely ambiguous. Each needs a decision before the phase that depends on it:

1. **Stock/inventory module** — mentioned once in §1, never specified (A1).
2. **Credit notes / debit notes / refunds** — no mention, yet any real accounting system needs them. Out of scope for v1 unless added.
3. **Recurring invoices** — no mention. Out of scope.
4. **Bank reconciliation** — no mention, though a Bank journal exists. Out of scope.
5. **Payment terms master** — no mention (A5).
6. **Data retention and backup policy** — no mention. Operational, but a financial system needs one.
7. **Concurrent-user volume and data scale** — no figures given, so the §15 targets are qualitative. The §4.3 indexes are sized for a small-to-mid business.
8. **Invoice PDF layout and legal fields** — an Indian tax invoice typically requires GSTIN, HSN/SAC codes, and place of supply. None appear in §4. **If GST compliance is expected, §4.1 and §4.2 need more fields.** Flagging this because the Pincode field implies an Indian context, and a non-compliant invoice is a legal problem, not a cosmetic one.
9. **Multi-branch / warehouse** — no mention beyond analytic accounts serving as a rough proxy.
10. **Approval workflows** — no mention. All posting is immediate.

---

## 19. Requirement Traceability Checklist

Every `project.md` requirement mapped to where this document specifies it.

| ID | `project.md` requirement | § | Section here |
|---|---|---|---|
| R-01 | Multi-tenant orgs; Business-Owner-only signup | §1, §2.1 | §3.1, §6.1 |
| R-02 | Admin / Accountant / Contact roles | §2 | §3.2, §6.1 |
| R-03 | Login: org + email + password | §2.1 | §6.1, A2 |
| R-04 | Admin creates Accountant accounts | §2.1, §3 | §6.1, §7.1 |
| R-05 | Contact login auto-created with portal toggle | §2.1, §2.2 | §6.3 |
| R-06 | Password reset for all roles | §2.1 | §6.1 **[EXISTS]** |
| R-07 | Role-permission matrix enforced | §3 | §3.2, §6.2, §7 |
| R-08 | Contact Master with all fields | §4.1 | §4.1, §6.3 |
| R-09 | Product Master with SKU, tax, status | §4.2 | §4.1, §6.4 |
| R-10 | Chart of Accounts, 5 types, parent, opening balance | §4.3 | §4.1, §6.5 |
| R-11 | Journal master, 4 types, default accounts | §4.4 | §4.1, §6.6 |
| R-12 | Journal entries, items, auto-generated flag | §4.5 | §4.1, §5.1, §6.6 |
| R-13 | **Debit = Credit on every entry** | §4.5 | §5.1, §4.4 trigger, §16 P1 |
| R-14 | Analytic accounts | §4.6 | §4.1, §6.7 |
| R-15 | Budgets with period, planned, analytic link, actual | §4.7, §8 | §4.1, §6.7 |
| R-16 | Purchase Order + status lifecycle | §5.1 | §3.9, §6.9 |
| R-17 | PO → Vendor Bill conversion | §5.1.3 | §6.9 |
| R-18 | Bill journal entry (Dr Expense / Cr Creditor) | §5.1.4 | §5.3 |
| R-19 | Bill payment Cash/Bank + entry | §5.1.5 | §5.3, §6.11 |
| R-20 | Bill status lifecycle | §5.1.6 | §3.9, §6.11 |
| R-21 | Sales Order with tax + lifecycle | §5.2 | §3.9, §6.10 |
| R-22 | SO → Customer Invoice | §5.2.3 | §6.10 |
| R-23 | Invoice entry (Dr Debtor / Cr Income + Tax) | §5.2.4 | §5.3 |
| R-24 | Invoice payment + entry | §5.2.5 | §5.3, §6.11 |
| R-25 | Invoice status lifecycle | §5.2.6 | §3.9 |
| R-26 | Portal: contact logs in | §5.3.1 | §6.12 |
| R-27 | Portal: customer sees own invoices | §5.3.2 | §6.12 |
| R-28 | Portal: vendor sees own bill history | §5.3.3 | §6.12 |
| R-29 | Portal: card payment | §5.3.4 | §6.12 |
| R-30 | Card payment creates payment + entry | §5.3.5 | §5.3, §6.12 |
| R-31 | Gateway decision | §5.3.6 | §6.12, §18.1 #3 |
| R-32 | Vendors cannot pay | §5.3.7 | §6.12, §16 P2 |
| R-33 | Balance Sheet, as-of date | §6 | §6.13, §7.5 |
| R-34 | Profit & Loss, date range | §6 | §6.13, §7.5 |
| R-35 | Budget Report, planned vs actual | §6, §8 | §6.7, §6.13 |
| R-36 | Report date filters + export | §6 | §6.13, §18.1 #6 |
| R-37 | Tax master, per-product default, per-line override | §7 | §6.8 |
| R-38 | Tax posts to its own CoA account | §7 | §5.3, §6.8 |
| R-39 | Analytic tagging on transactions | §8 | §6.7, §6.9, A10 |
| R-40 | `organization_id` on every table | §9.1 | §3.1, §4.1 |
| R-41 | Audit trail | §9.2 | §3.6, §6.13 |
| R-42 | Per-org numbering sequences | §9.3 | §3.5, §4.1 |
| R-43 | Currency (single INR assumed) | §9.4 | §18.1 #5 |
| R-44 | Attachments on bills | §9.5 | §6.13 |
| R-45 | Archive-not-delete; no posting to archived | §9.6 | §3.7, §5.1 |
| R-46 | Email notifications to contacts | §9.7 | §6.13 |
| R-47 | Use case: create master data | §7.1 | Phase 2 |
| R-48 | Use case: record a purchase | §7.2 | Phase 4 |
| R-49 | Use case: record a sale | §7.3 | Phase 5 |
| R-50 | Use case: generate reports | §7.4 | Phase 6 |

---

## 20. Final Verification

**Contents check — this document contains:**

☑ Technical architecture (§2) · ☑ Frontend requirements (§8, §9) · ☑ Backend requirements (§2.2, §6) · ☑ API requirements (§7) · ☑ Database requirements (§4) · ☑ Tables and relationships (§4.1, §4.2) · ☑ Business logic (§5, §6) · ☑ Validation (§6) · ☑ Security (§6, §14) · ☑ Libraries (§13) · ☑ External APIs (§13.5) · ☑ UI components (§8.2) · ☑ Forms (§9.3) · ☑ Tables (§9.2) · ☑ Graphs (§9.5) · ☑ Dashboard (§9.6) · ☑ State management (§10) · ☑ File/folder additions (§11) · ☑ Environment variables (§12) · ☑ Error handling (§14) · ☑ Performance (§15) · ☑ Testing (§16) · ☑ Implementation phases (§17)

**Constraints honoured:** no new project · no replaced architecture · Node.js + Express + Next.js + React + JavaScript + PostgreSQL retained · no TypeScript · no ORM · no charting library · no state-management library · existing folder conventions followed · `strict.md` enforced throughout · no features implemented.

**Before Phase 1 begins:** answer §18.1 Decision 5 (multi-currency) and Decision 1 (Accountant rights), and confirm the §3.2 role mapping. Everything else can be decided at its phase boundary.

---

*Companion to `Doc/project.md` (business requirements) and `Doc/strict.md` (development rules). This document defines HOW; `project.md` remains the sole authority on WHAT.*
