# Urban Furniture — Accounting System
## Implementation Phases (`phase.md`)

> **Companions:** `Doc/project.md` (WHAT — business requirements, sole authority) · `Doc/technicalrequirement.md` (HOW — technical blueprint) · `Doc/strict.md` (development rules, binding on all frontend work).
> **This document:** the execution order. 15 phases (P0–P14), each with an explicit dependency chain, deliverable list, security bar, test set, and exit gate.
> **Rule:** a phase is not "done" when the code is written. It is done when its **Exit Gate** passes. No phase starts before its dependencies have passed theirs.

---

## Phase Map

```
P0  Decisions & Preparation
        │
P1  Database Foundation & Multi-Tenancy ──────────┐
        │                                          │
P2  Shared Backend Infrastructure                  │
        │                                          │
P3  Auth Extension & Organization Bootstrap        │
        │                                          │
P4  Frontend Foundation ───────────────────────────┤
        │                                          │
P5  Master Data A — Accounting Core                │
        │                                          │
P6  Master Data B — Contacts, Products             │
        │                                          │
P7  ★ LEDGER ENGINE ★  ← CORRECTNESS GATE          │
        │                                          │
   ┌────┴────┐                                     │
P8 Purchase  P9 Sales                              │
   └────┬────┘                                     │
        │                                          │
P10 Payments & Settlement                          │
        │                                          │
   ┌────┴──────────┐                               │
P11 Budgets &      P12 Contact Portal              │
    Reports            & Gateway                   │
   └────┬──────────┘                               │
        │                                          │
P13 Dashboard, Notifications, Attachments, Audit ──┘
        │
P14 Hardening, Security, Performance & Release
```

### Summary table

| # | Phase | Depends on | Core output | Effort |
|---|---|---|---|---|
| P0 | Decisions & Preparation | — | Answered blockers, tooling, branch strategy | 1–2 d |
| P1 | Database Foundation & Multi-Tenancy | P0 | `organizations`, org-scoped `users`, migrations 006–007 | 2–3 d |
| P2 | Shared Backend Infrastructure | P1 | `shared/` — transactions, money, sequences, audit, validation | 3–4 d |
| P3 | Auth Extension & Org Bootstrap | P2 | Signup→org, invites, seeded CoA/journals/sequences | 3–4 d |
| P4 | Frontend Foundation | P3 | Shell, nav, i18n namespaces, styles, shared components, hooks | 4–5 d |
| P5 | Master Data A — Accounting Core | P4 | CoA, Journals, Taxes, Analytic Accounts | 4–5 d |
| P6 | Master Data B — Business Entities | P5 | Contacts, Products, Categories, portal provisioning | 4–5 d |
| P7 | **Ledger Engine** | P5 | `accounting/`, journal entries, integrity triggers | 5–6 d |
| P8 | Purchase Flow | P6, P7 | PO → Vendor Bill → posted entry | 5–6 d |
| P9 | Sales Flow | P8 | SO → Customer Invoice → posted entry | 3–4 d |
| P10 | Payments & Settlement | P9 | Cash/Bank payments, allocations, status rollup | 4–5 d |
| P11 | Budgets & Financial Reports | P10 | Budgets, Balance Sheet, P&L, Budget Report, charts | 5–6 d |
| P12 | Contact Portal & Gateway | P10 | Portal shell, own-document views, card payment | 5–6 d |
| P13 | Dashboard, Notifications, Attachments, Audit | P11, P12 | Supporting modules | 4–5 d |
| P14 | Hardening, Security, Performance, Release | All | i18n completion, security review, load check | 5–7 d |

**Total: ~58–75 developer-days.** Phases P8/P9 and P11/P12 can be parallelised across two developers, compressing the calendar by roughly 20%.

**Legend used throughout:** **[SPEC]** = from `project.md` · **[TECH-REQ]** = technically required · **[TECH-REC]** = recommendation · **[EXISTS]** = already in the codebase.

---

# Phase 0 — Decisions & Project Preparation

### Goal
Close the decisions that cannot be reversed cheaply later, and set up the working environment. **No production code is written in this phase.**

### Depends on
Nothing.

### Blocks
Everything. P1 cannot start with Decision 5 open.

### Tasks

**0.1 — Answer the blocking decisions** (from `project.md` §10, expanded in `technicalrequirement.md` §18.1). Record every answer **in `project.md` §10**, not in a chat message.

| # | Decision | Why it must be answered now | Default if unanswered |
|---|---|---|---|
| **5** | **Multi-currency vs. single INR** | **Most expensive to defer.** Retrofitting touches every monetary column, every journal line, every report. | Single currency, INR |
| **1** | Accountant `Modify` rights on master data | Determines route authorization and UI gating across all 7 master modules | Doc-strict: Create only |
| **3.2 mapping** | Confirm Admin→`admin`, Accountant→`manager`, Contact→`user` | Every migration and every `authorize()` call depends on it | The mapping as specified |
| **4** | Tax scope — sales only, or sales + purchase | Changes the **bill posting rules**, therefore the P&L | Build `tax_scope` for both |
| **2** | Contact portal access — automatic vs. per-contact toggle | Low switching cost, but decide before P6 | Per-contact toggle |
| **A3** | Fiscal year start month | Numbering and P&L both need it | April (Indian FY) |
| **A1** | Is stock/inventory in scope? | It is a module, not a report. In scope means a new `project.md` section. | Out of scope for v1 |
| **A8** | GST compliance expected? | If yes, `project.md` §4.1/§4.2 need GSTIN, HSN/SAC, place-of-supply fields | Not required for v1 |

Deferrable to their own phase boundary: Decision 3 (gateway) → P12 · Decision 6 (report export) → P11.

**0.2 — Environment**
- Verify PostgreSQL is reachable and `gen_random_uuid()` is available (`pgcrypto` or PG 13+).
- Create a **separate test database**; never run tests against development data.
- Confirm `npm run migrate` **[EXISTS]** runs clean on an empty database.
- Confirm `npm run dev` starts both apps and `GET /api/health` **[EXISTS]** responds.

**0.3 — Tooling**
- Add `jest` + `supertest` as devDependencies **[TECH-REC]**.
- Add `decimal.js` and `date-fns` **[TECH-REQ]** — see `technicalrequirement.md` §13.2.
- Branch strategy: one branch per phase, merged only after its Exit Gate passes.

**0.4 — Read-in**
Every developer reads `project.md`, `technicalrequirement.md` §1–§5, and **all** of `strict.md` before writing a line.

### Exit Gate
- [ ] All eight decisions above answered and written into `project.md` §10
- [ ] Test database exists; existing migrations run clean on it
- [ ] `jest`, `supertest`, `decimal.js`, `date-fns` installed
- [ ] Health check green on a fresh clone

### Risks
| Risk | Mitigation |
|---|---|
| "We'll decide multi-currency later" | Refuse. This is the single most expensive retrofit in the project. |
| Decisions made verbally and forgotten | They go into `project.md` §10 or they did not happen. |

---

# Phase 1 — Database Foundation & Multi-Tenancy

### Goal
Establish the tenant boundary before a single domain table exists. Every table built after this point inherits it automatically.

### Depends on
P0 (Decision 5, and the role-mapping confirmation).

### Blocks
Every subsequent phase. A tenant boundary retrofitted later means auditing every query in the system.

### Scope
**In:** `organizations` table, org columns on `users`, tenant middleware, the org-scoping conventions.
**Out:** any domain table (P5+), any UI (P4).

### Deliverables

**Database — migrations** (continuing the existing numbered convention, registered in `run-migrations.js`)

| Migration | Contents |
|---|---|
| `006_create_organizations` | `id` UUID PK, `name`, `slug` UNIQUE, `currency_code CHAR(3) DEFAULT 'INR'`, `fiscal_year_start_month SMALLINT DEFAULT 4`, `status`, audit columns |
| `007_add_organization_to_users` | `ALTER users` ADD `organization_id UUID NULL REFERENCES organizations(id)`, `contact_id UUID NULL`, `must_change_password BOOLEAN DEFAULT false`; index `users(organization_id)` |

`users.contact_id`'s foreign key is added later (P6), once `contacts` exists.

**Backend**
- `src/shared/tenant.middleware.js` — `resolveTenant` (`technicalrequirement.md` §3.1)
- `src/organizations/` — full five-file module (routes, controller, service, repository, validation)
- `src/organizations/organizations.repository.js` — slug generation with collision suffixing

### The conventions this phase establishes — non-negotiable from here on

1. Every domain table has `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT`.
2. Every index leads with `organization_id`.
3. Every uniqueness rule is `UNIQUE (organization_id, <business_key>)` — **never** globally unique.
4. Every repository query filters on `organization_id`. No exceptions, ever.
5. `organization_id` comes from `req.user` only — never from body, query, params, or headers.
6. A record from another org returns **`404`, not `403`** (a `403` confirms it exists, which leaks tenant data).

### Security
- `resolveTenant` runs **after** `authenticate` and **before** `authorize` on every domain route.
- A user with no `organization_id` gets `403` with no detail.
- `organization_id` is stripped from every inbound request body at the validation layer **[TECH-REQ]**.

### Tests
| Test | Type |
|---|---|
| Migrations run clean on empty DB; re-running is a no-op | Database |
| `down` migrations reverse cleanly | Database |
| Slug collision produces `urban-furniture-2`, not a failure | Unit |
| `resolveTenant` sets `req.organizationId` from `req.user` only | Unit |
| A request with `organization_id` in the body cannot override the tenant | Security |
| A user without an org is refused with `403` | Unit |

### Exit Gate
- [ ] `npm run migrate` clean on empty DB, idempotent on re-run
- [ ] `resolveTenant` unit-tested including the body-override attack
- [ ] The six conventions above documented in the repo (README or code comments)
- [ ] Existing auth tests **[EXISTS]** still pass — nothing regressed

---

# Phase 2 — Shared Backend Infrastructure

### Goal
Build the primitives every later module depends on. Written once here, they are never re-implemented — which is exactly how four copies of a buggy rounding function are avoided.

### Depends on
P1.

### Blocks
P3 onward. Building a module before these exist guarantees duplication.

### Deliverables — `Backend/src/shared/`

| File | Responsibility | Reference |
|---|---|---|
| `withTransaction.js` | `BEGIN` / `COMMIT` / `ROLLBACK` wrapper, always releasing the client | `technicalrequirement.md` §3.4 |
| `money.js` | `decimal.js` wrapper — `money()`, `toDb()`, `add`, `sub`, `mul`, `round2`, `eq`, `isZero`. **The only place money arithmetic happens.** | §3.3 |
| `sequence.service.js` | `nextDocumentNumber(client, orgId, docType, fiscalYear)` using `SELECT … FOR UPDATE` | §3.5 |
| `audit.service.js` | `recordAudit(client, {...})` — writes inside the caller's transaction | §3.6 |
| `pagination.js` | Parse/normalise `page`, `limit`, `sortBy`, `sortOrder`; build the standard response envelope | §6.2 |
| `validate.js` | Reusable validators returning the existing `{ isValid, errors, data }` shape **[EXISTS pattern]** | §6.2 |
| `constants.js` | All status enums, document types, role constants | §3.9 |
| `AppError.js` | Typed error with `statusCode`, `code`, `errors[]` | §14 |
| `dbErrors.js` | Map PG codes: `23505`→`409`, `23503`→`409`, `23514`→`422` | §14 |

**Also in this phase — migrations**

| Migration | Contents |
|---|---|
| `018_create_document_sequences` | `doc_type`, `fiscal_year`, `prefix`, `next_number`, `padding`, UNIQUE `(organization_id, doc_type, fiscal_year)` |
| `026_create_audit_logs` | `actor_user_id`, `action`, `entity_type`, `entity_id`, `before JSONB`, `after JSONB`, `ip_address INET` |

> Migration numbers follow `technicalrequirement.md` §4.5's final ordering; they are built early here because P3 needs them.

### The `pg` NUMERIC rule — state it loudly

`pg` returns `NUMERIC` as a **JavaScript string**. Do **not** install a global type parser to "fix" this — that reintroduces float error. All money arithmetic goes through `money.js`. Money is returned to the client as a string; the frontend formats it and never computes with it.

### Repository transaction convention

Every repository function that can participate in a transaction takes `client` as its **first** parameter and falls back to `pool`:

```js
async function insertX(client, payload) {
  const db = client || pool;
  // ...
}
```

### Security
- `sequence.service.js` locks with `FOR UPDATE` inside the caller's transaction, so a rollback returns the number to the pool. **Accounting documents must not have gaps.**
- `audit.service.js` records the actor from `req.user`, never from the payload.
- `dbErrors.js` never lets a raw PG message reach the client **[EXISTS behaviour]**.

### Tests
| Test | Type |
|---|---|
| `withTransaction` commits on success, rolls back on throw, always releases the client | Unit |
| Rollback leaves no partial rows | Integration |
| `money.add('0.1','0.2')` is exactly `'0.30'` | Unit |
| 100 lines of `33.333` sum to the document total exactly | Unit |
| Two concurrent `nextDocumentNumber` calls produce different numbers | Integration (parallel) |
| A rolled-back transaction consumes no sequence number | Integration |
| PG error codes map to the correct HTTP status | Unit |
| `sortBy` outside the allow-list falls back and injects nothing | Security |

### Exit Gate
- [ ] All nine shared files implemented with JSDoc matching the existing style
- [ ] Money precision tests green, including the 100-line rounding case
- [ ] Concurrent sequence test green — **run it in parallel, not sequentially, or it proves nothing**
- [ ] Transaction rollback verified to leave zero rows

### Risks
| Risk | Mitigation |
|---|---|
| A developer bypasses `money.js` and uses `Number()` | Code review checklist item; grep for `parseFloat` in CI |
| Sequence lock held too long | Never place email, PDF, or gateway calls inside a transaction |

---

# Phase 3 — Auth Extension & Organization Bootstrap

### Goal
**[SPEC]** §2.1 — Business Owner self-signup creates an Organization. Everyone else is invited from inside it. A new org must be immediately usable, which means it needs a Chart of Accounts on day one.

### Depends on
P2.

### Blocks
P4 onward.

### Scope
**In:** register→org, invite flow, set-password, org context in `/me`, seeding.
**Out:** any master-data CRUD UI (P5/P6).

### Deliverables

**Backend — extend, do not rebuild [EXISTS]**

| File | Change |
|---|---|
| `auth/auth.validation.js` | Accept and validate `organizationName` (2–150) |
| `auth/auth.service.js` | Register in a transaction: org → admin user → **seed** → OTP. Email sent **after** commit. |
| `auth/auth.controller.js` | Return `{ user, organization }` |
| `auth/auth.repository.js` | Select `organization_id`, `contact_id` on user reads |
| `auth/auth.routes.js` | Add `POST /auth/set-password` (public, rate-limited) |
| `users/` | **NEW** module: `GET /users`, `POST /users/invite`, `PATCH /users/:id/status` — **admin only** |
| `organizations/` | `GET|PATCH /organizations/current` |

**Seeding — [TECH-REQ], runs inside the signup transaction**

`project.md` §7.1 assumes a working CoA exists. Without seeding, a new org cannot record anything.

- **Accounts:** Cash, Bank, Debtors, Creditors, Sale Income, Purchase Expense, Output Tax Payable, Input Tax Credit, Opening Balance Equity, Payment Gateway Clearing — all `is_system = true`
- **Journals** (**[SPEC]** §4.4): Sales, Purchase, Bank, Cash
- **Sequences:** one `document_sequences` row per doc type (`PO`, `SO`, `BILL`, `INV`, `PAY`, `JE`)

Seeding requires `accounts` and `journals` to exist, so migrations `008_create_accounts` and `013_create_journals` land in this phase.

### Business logic — registration
1. Validate; verify CAPTCHA **[EXISTS]**
2. Reject duplicate email
3. `withTransaction`: insert org (unique slug) → insert user `role='admin'` → seed CoA + journals + sequences → issue OTP **[EXISTS]**
4. Commit
5. **Then** send email — a mail failure must never roll back a created organization
6. `201` with `{ user, organization }`

### Security
- `role` and `organization_id` are **never** read from the request body on register — both set server-side **[TECH-REQ]**
- `POST /users/invite` restricted to `authorize('admin')` (**[SPEC]** §3) and to `role='manager'` only — an Admin cannot mint another Admin **[TECH-REC]**
- Invite tokens: single-use, hashed at rest, 72h expiry
- Enumeration resistance: identical responses whether or not the email exists **[EXISTS]**
- Existing rate limiters applied to the new routes **[EXISTS]**
- bcrypt + `PASSWORD_PEPPER` unchanged **[EXISTS]**

### Tests
| Test | Type |
|---|---|
| Register creates org + admin + full seed in one transaction | Integration |
| A seed failure rolls back the org **and** the user — no orphans | Integration |
| A mail failure does **not** roll back the org | Integration |
| `role: "super_admin"` in the register body is ignored | Security |
| `organization_id` in the body is ignored | Security |
| `manager` calling `/users/invite` gets `403` | Permission |
| Invite token is single-use and expires | Integration |
| A seeded org has 10 accounts, 4 journals, 6 sequences | Integration |
| Existing auth suite **[EXISTS]** still green | Regression |

### Exit Gate
- [ ] An Admin can sign up, verify email, log in, and reach a dashboard
- [ ] The new org has a complete CoA, four journals, and six sequences
- [ ] An Admin can invite an Accountant who can set a password and log in
- [ ] Privilege-escalation attempts via the register body are proven ineffective
- [ ] Every existing auth test still passes

---

# Phase 4 — Frontend Foundation

### Goal
Build the shell, conventions, and shared components once, so the seven master-data modules that follow are assembly rather than invention.

### Depends on
P3.

### Blocks
P5 onward.

### Scope
**In:** navigation, i18n namespaces, stylesheets, shared components, pickers, hooks, formatting, permission helper, route guards.
**Out:** any feature page (P5+).

### Deliverables

**i18n — `strict.md` §2 is binding**

Create these namespaces in **all three** of `en.json`, `hi.json`, `gu.json` — **before** any component is written:

`common`, `contacts`, `products`, `accounts`, `journals`, `journalEntries`, `analyticAccounts`, `budgets`, `taxes`, `purchases`, `sales`, `payments`, `reports`, `portal`, `users`

`common` holds shared strings (Save, Cancel, Delete, Archive, statuses, table loading/empty/error) so they are translated once.

> **Accounting terminology in Hindi and Gujarati is specialist vocabulary.** Machine-translating "Debit", "Credit", "Accounts Receivable", "Chart of Accounts" or "Analytic Account" produces misleading text in a financial system. Budget a domain-aware reviewer and keep a glossary in `src/messages/`.

**Styles — `strict.md` §5.1**

New files in `src/styles/`, each imported in `src/app/layout.jsx`: `masters.css`, `transactions.css`, `reports.css`, `portal.css`, `forms.css`.

Every color via `var(--*)` from `globals.css`. Any genuinely new variable is added to `:root` in `globals.css`, derived from the Frozen Lake palette. **No existing `:root` value is modified.** Fonts: Orbitron (headings/numbers) and Sora (body/UI) only.

**Shared components — `src/components/shared/`**

`FilterBar` · `Pagination` · `SortableHeader` · `StatusPill` · `ConfirmDialog` · `Drawer` · `Modal` · `MoneyText` · `DateText` · `EmptyState` · `ErrorState` · `FormField` · `FormActions` · `ToastProvider`

**Pickers — `src/components/pickers/`**

`ContactPicker` · `ProductPicker` · `AccountPicker` · `JournalPicker` · `TaxPicker` · `AnalyticAccountPicker` · `DateRangePicker` — all server-side searched, `limit=20`, debounced 300ms. **Never load every product into a `<select>`.**

**Hooks & utils**

- `src/hooks/usePagination.js`, `useDebounce.js`, and the generic list-hook factory
- `src/utils/format.js` — locale-aware money/date/number via `Intl.NumberFormat`
- `src/utils/status.js` — status → label key + tone
- `src/utils/permissions.js` — mirrors the §3.2 role matrix. **UX layer only**; the backend `authorize()` remains the security boundary.

**Shell extensions [EXISTS — EXTEND]**

- `config/dashboard.config.js` — accounting nav per role, plus a separate `PORTAL_NAV`
- `context/AuthContext.jsx` — expose `organization`; `getDashboardPath('user')` → `/portal`
- `proxy.js` — guard `/dashboard/*` and `/portal/*` at the HTTP layer

### The standard hook contract — [TECH-REQ]

```js
const { data, pagination, loading, error, refetch } =
  useContacts({ page, limit, search, status, sortBy, sortOrder });
```

Every fetching hook aborts in-flight requests on unmount or param change (`AbortController`). Without it, fast filter typing lands responses out of order and the table shows results for a filter the user already changed.

### State management — [TECH-REC], do not add a library

| State | Where |
|---|---|
| Auth, user, role, organization | `AuthContext` **[EXISTS]** |
| Server data | Per-feature hooks |
| Filters, search, sort, page | **URL query params** — shareable, refresh-proof, back-button correct |
| Form state | Local `useState` + `useFormDraft` **[EXISTS]** |
| Modal/drawer | Local `useState` |
| Toasts | Small `ToastContext` (~50 lines) |

No Redux, no Zustand, no React Query.

### Responsive contract — [TECH-REQ]
| Width | Behaviour |
|---|---|
| ≥1280 | Full layout |
| 1024–1279 | Sidebar collapses to icons; KPIs wrap to 3 |
| 768–1023 | Sidebar becomes an overlay drawer; tables scroll in a container |
| <768 | Tables become stacked `ListCard`s; forms single-column |

### Tests
| Test | Type |
|---|---|
| Locale-key parity across `en`/`hi`/`gu` | Lint / CI |
| No hardcoded hex/rgb in any new CSS | Lint / CI |
| Money formats correctly per locale | Unit |
| Pickers debounce and abort correctly | Unit |
| `proxy.js` redirects unauthenticated `/dashboard` and `/portal` | Integration |
| Shell renders correctly at 375 / 768 / 1280 | UI |

### Exit Gate
- [ ] All 15 namespaces exist in all three locale files with matching key trees
- [ ] Shared components and pickers built and rendering
- [ ] CI checks for locale parity and hardcoded colors are **running**
- [ ] `strict.md` §6 checklist passes on every new file
- [ ] Route guards verified for both `/dashboard` and `/portal`

### Risks
| Risk | Mitigation |
|---|---|
| Building feature pages before shared components exist | Refuse to merge P5 work that duplicates a P4 component |
| "Add translations later" | `strict.md` §2.2 forbids it. CI enforces parity. |

---

# Phase 5 — Master Data A: Accounting Core

### Goal
**[SPEC]** §4.3, §4.4, §4.6, §7 — the accounting scaffolding the ledger engine will validate against.

### Depends on
P4. (`accounts` and `journals` tables already exist from P3's seeding.)

### Blocks
P7 — the ledger engine validates accounts and journals, so they must be real first.

### Scope
Chart of Accounts · Journals · Taxes · Analytic Accounts. Full CRUD + archive, backend and UI.

### Deliverables

**Migrations:** `011_create_taxes`, `014_create_analytic_accounts` (`008` accounts and `013` journals landed in P3).

**Backend modules:** `accounts/`, `journals/`, `taxes/`, `analytics/` — each the standard five files.

**Endpoints** — the standard master-data set per resource:

| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/<r>` | admin, manager |
| GET | `/api/<r>/:id` | admin, manager |
| POST | `/api/<r>` | admin, manager — **[SPEC]** §3, both create |
| PATCH | `/api/<r>/:id` | **admin only** — **[SPEC]** §3 |
| PATCH | `/api/<r>/:id/archive` | **admin only** |
| PATCH | `/api/<r>/:id/unarchive` | admin only |

Plus `GET /api/accounts/tree`.

**Frontend routes:** `/dashboard/accounts`, `/journals`, `/taxes`, `/analytic-accounts`.

### Feature-specific rules

**Chart of Accounts (§4.3)**
- Five types: asset, liability, expense, income, capital
- `parent_account_id` self-reference. **[TECH-REQ]** walk the ancestor chain before saving — a cycle would hang the tree renderer
- A parent must share the child's `account_type`
- **System accounts (`is_system=true`) cannot be archived or have their type changed** — the ledger engine depends on them **[TECH-REQ]**
- Opening balance posts as a balancing entry against Opening Balance Equity in P7, **not** as a column reports special-case **[TECH-REC]**
- `UNIQUE (organization_id, code)`

**Journals (§4.4)** — five types (sales, purchase, bank, cash, general) with default accounts.

**Taxes (§7)**
- `rate NUMERIC(7,4)` CHECK 0–100; `tax_scope` = sales | purchase | both
- **[TECH-REC]** build `both` now regardless of Decision 4 — the column costs nothing today and avoids a migration plus a rewrite of the bill-posting rules later
- The tax account must be a liability (collected) or asset (paid). **[TECH-REC]** validate this — a misconfiguration here silently corrupts the Balance Sheet
- **[SPEC]** §7: tax posts to its **own** CoA account, never folded into Sale Income

**Analytic Accounts (§4.6)** — name, type (income/expense), department/project.

### The list contract — [TECH-REQ], identical for every collection

`?page=1&limit=25&search=&status=&sortBy=&sortOrder=`

```json
{ "success": true, "message": "…", "data": { "items": [], "pagination": { "page":1, "limit":25, "total":134, "totalPages":6, "hasNext":true } } }
```

`sortBy` is **never** interpolated into SQL. Map it through a per-module allow-list — this is the one place injection could enter an otherwise fully parameterised codebase, because a column name cannot be a bind parameter.

### Security
- `authenticate → resolveTenant → authorize` on every route
- Every query filtered by `organization_id`
- Modify/archive restricted to `admin` (**[SPEC]** §3 — see P0 Decision 1)
- Archive blocked when the record is referenced by a posted document → `409` naming the blocker
- Cross-tenant id → `404`, not `403`

### Tests
| Test | Type |
|---|---|
| Full CRUD per resource | API |
| `manager` can create but not modify or archive | Permission |
| Org A cannot touch Org B's records — every endpoint | Permission |
| Cross-tenant id returns `404` | Security |
| Account parent cycle rejected | Unit |
| Parent with a different account type rejected | Unit |
| System account cannot be archived or retyped | API |
| Duplicate code within an org rejected; permitted across orgs | Validation |
| Tax rate outside 0–100 rejected | Validation |
| `sortBy` allow-list holds against injection | Security |

### Exit Gate
- [ ] Four modules fully CRUD-able through the UI
- [ ] Permission matrix tests green for both roles
- [ ] Cross-tenant isolation proven on every endpoint
- [ ] `strict.md` checklist clean on all four pages

---

# Phase 6 — Master Data B: Contacts, Products & Portal Provisioning

### Goal
**[SPEC]** §4.1, §4.2, §2.2 — the business entities transactions reference, plus contact portal logins.

### Depends on
P5 (contacts and products reference accounts and taxes).

### Blocks
P8.

### Deliverables

**Migrations:** `009_create_contacts`, `010_create_product_categories`, `012_create_products`, plus the deferred `users.contact_id` FK.

**Backend modules:** `contacts/` (+ `contacts.portal.js`), `products/`, `product-categories/`.

**Frontend routes:** `/dashboard/contacts` (+ `/[id]`, `/new`), `/dashboard/products` (+ `/[id]`, `/new`), `/dashboard/product-categories`.

### Feature rules

**Contacts (§4.1)**
- Fields: name, type (customer/vendor/both), email, mobile, city, state, pincode, profile image, portal toggle, status
- `UNIQUE (organization_id, lower(email))` where email is not null
- Detail page tabs: Details / Invoices / Bills / Payments
- **[ASSUM]** pincode 6 digits — India, inferred from the §4.1 Pincode field

**Portal provisioning — [SPEC]** §2.1, §2.2
1. Require an email — there is nowhere to send the invite otherwise
2. In one transaction: create a `users` row with `role='user'`, `organization_id`, `contact_id`, `must_change_password=true`, and a random unusable password
3. Generate a single-use invite token
4. Commit, **then** email the set-password link
5. **Disabling access revokes the login**: increment `token_version` (invalidating live JWTs instantly **[EXISTS]**) and delete refresh tokens

**Products (§4.2)**
- Fields: name, SKU, type (goods/service/combo), category, sales price, cost price, sales/purchase tax, income/expense account, status
- `UNIQUE (organization_id, sku)` where sku is not null
- **[SPEC]** §3 — the Edit action is visible **only to Admin**, because only Admin may change prices
- **[TECH-REC]** archiving a product never alters historical document lines. Lines store the price at time of sale, so a later price change cannot rewrite history. **This is essential for accounting correctness.**
- **[AMBIG A4]** "combo" is a label only in v1; a true bundle needs a components table and line explosion. Confirm.

### Security
- Everything from P5, plus:
- Portal provisioning is **admin only**
- The random initial password is never returned in any response and never logged
- Profile image: MIME validated by **magic bytes**, not the declared header; ≤2 MB; jpeg/png/webp only
- Archiving a contact revokes the portal login but retains the `users` row for audit integrity (**[AMBIG A11]**)

### Tests
| Test | Type |
|---|---|
| Contact and product CRUD + archive | API |
| Portal enable creates exactly one linked user | Integration |
| Portal disable invalidates a live JWT immediately | Integration |
| Portal enable without an email is rejected | Validation |
| Duplicate email/SKU within an org rejected; permitted across orgs | Validation |
| `manager` cannot edit a product price | Permission |
| Archiving a referenced product returns `409` | API |
| Oversized or wrong-MIME image rejected | Security |
| Cross-tenant isolation on all endpoints | Permission |

### Exit Gate
- [ ] **[SPEC]** §7.1 use case passes end to end — create contacts (Azure Furniture, Nimesh Pathak), create products (Wooden Chair), CoA in place
- [ ] A portal-enabled contact can set a password and log in, landing on `/portal` (not `/dashboard`)
- [ ] Disabling portal access provably kills the session
- [ ] Full permission matrix green

---

# Phase 7 — ★ Ledger Engine ★ (Correctness Gate)

### Goal
**[SPEC]** §4.5 — double-entry, enforced. This is the phase everything financial depends on.

### Depends on
P5 (accounts, journals).

### Blocks
**P8 and P9 must not start until this phase's Exit Gate passes.** Building transaction flows on an unverified ledger produces bugs that surface as wrong financial reports weeks later — at which point every posted document is suspect and the data may be unrecoverable.

### Deliverables

**Migrations:** `016_create_journal_entries`, `017_create_journal_entry_lines`, `028_ledger_integrity_triggers`.

**Backend — `src/accounting/`** (services only; mounts no routes of its own)

| File | Contents |
|---|---|
| `accounting.service.js` | `postJournalEntry(client, payload)`, `reverseJournalEntry(client, entryId, reason, actor)` |
| `accounting.repository.js` | `getAccountBalances`, `getPeriodMovements`, `getAnalyticActuals`, `getContactOpenItems` |
| `accounting.rules.js` | The posting templates of §5.3 |

**`journals/` module gains:** `GET /api/journal-entries`, `GET /:id`, `POST /` (manual), `POST /:id/reverse`.

### `postJournalEntry` — the exact algorithm

1. Assert at least two lines
2. Per line: exactly one of debit/credit non-zero and positive
3. **`SUM(debit)` equals `SUM(credit)`**, compared via `money.js` — **[SPEC]** §4.5
4. Assert the journal is `active` and same-org — **[SPEC]** §9.6
5. Assert every account is `active` and same-org
6. Consume the `JE` sequence on the shared `client`
7. Insert `journal_entries` (`status='posted'`, `posted_at=NOW()`)
8. Bulk-insert `journal_entry_lines`
9. Write the audit row
10. Return the entry with lines

Any failure throws, so the caller's transaction rolls back.

### Database-level guarantees — [TECH-REQ]

| Guarantee | Mechanism |
|---|---|
| A line is debit **or** credit, never both, never empty | `CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0) AND (debit + credit) > 0)` |
| Every entry balances | **Deferrable constraint trigger** checking `SUM(debit) = SUM(credit)` at COMMIT |
| A posted entry is immutable | `BEFORE UPDATE OR DELETE` trigger on `journal_entry_lines` raising unless the parent is still `draft` |

Application validation alone can be defeated by a bug. These cannot.

### Immutability & correction — [TECH-REQ] §3.8
There is **no** `PATCH` or `DELETE` on a posted entry at the API surface. Correction is by **reversing entry** only: a mirror with debits and credits swapped, the original marked `reversed` with `reversed_by_entry_id` set.

### Frontend
- Journal Entries list — Entry #, Date, Journal, Reference, Debit, Credit, Source, Status; filters for journal, date range, status, auto-generated vs manual (**[SPEC]** §4.5's flag); default sort `entry_date DESC`
- Entry detail — header + lines with a **running totals footer that stays red until the two sides match**
- Manual entry form — dynamic line rows, account/analytic pickers, typing in debit clears credit, live balance indicator, **Save disabled while unbalanced**

The client mirrors the server rule purely for fast feedback. **The server remains the authority.**

### Opening balances
Post the P5-captured opening balances as one balancing entry against Opening Balance Equity.

### Tests — Priority 1. If only one thing in this project is tested, it is this.

| Test | Type |
|---|---|
| Balanced entry posts | Unit |
| Unbalanced entry rejected | Unit |
| Line with both debit and credit non-zero rejected | Unit + DB |
| Line with both zero rejected | DB constraint |
| Posting to an archived account or journal rejected (**[SPEC]** §9.6) | Unit |
| Posted entry cannot be updated | DB trigger |
| Posted entry cannot be deleted | DB trigger |
| Reversal is an exact mirror; original flagged `reversed` | Integration |
| 100 lines at ₹33.333 sum to the total exactly | Unit |
| Concurrent posting produces no duplicate entry numbers | Integration (parallel) |
| A rolled-back post consumes no sequence number | Integration |
| Cross-tenant account in a line is rejected | Security |

### Exit Gate — **the hardest gate in the project**
- [ ] **Every Priority-1 test green.** No exceptions, no "we'll fix it in P8".
- [ ] The deferrable balance trigger provably rejects an unbalanced entry inserted via **raw SQL**, bypassing the application entirely
- [ ] The immutability trigger provably rejects a raw `UPDATE` on a posted line
- [ ] Manual entry UI cannot submit an unbalanced entry
- [ ] Reversal round-trip leaves account balances exactly unchanged

### Risks
| Risk | Mitigation |
|---|---|
| Pressure to start P8 early | **Refuse.** This is the correctness gate; the cost of a late ledger bug is unbounded. |
| Rounding drift across lines | Round once per line after tax, never on running totals |

---

# Phase 8 — Purchase Flow

### Goal
**[SPEC]** §5.1, §7.2 — Purchase Order → Vendor Bill on receipt → posted journal entry.

### Depends on
P6 (contacts, products) and **P7 passed**.

### Blocks
P9 (which reuses the components built here).

### Deliverables

**Migrations:** `019_create_purchase_orders`, `020_create_vendor_bills` (+ their line tables).

**Backend — `src/purchases/`:** `purchaseOrders.*` and `vendorBills.*`.

| Method | Endpoint |
|---|---|
| GET / POST | `/api/purchase-orders` |
| GET / PATCH | `/api/purchase-orders/:id` (edit draft only) |
| POST | `/api/purchase-orders/:id/confirm` |
| POST | `/api/purchase-orders/:id/create-bill` — **[SPEC]** §5.1.3 |
| POST | `/api/purchase-orders/:id/cancel` |
| GET / POST | `/api/vendor-bills` |
| GET / PATCH | `/api/vendor-bills/:id` (edit draft only) |
| POST | `/api/vendor-bills/:id/post` — **generates the journal entry** |
| POST | `/api/vendor-bills/:id/cancel` — reverses if posted (admin) |

**Frontend:** `/dashboard/purchase-orders`, `/dashboard/vendor-bills` (+ `/[id]`, `/new`).

### `DocumentLineGrid` — build it once, here

**[TECH-REC]** This is where the project either stays maintainable or does not. Four document types share identical line behaviour: product picker → auto-fill price and tax → quantity → per-line subtotal/tax/total → add/remove rows.

Build it **once** with a config object for the differences:

```js
{ priceField: 'costPrice' | 'salesPrice', taxField: 'purchaseTaxId' | 'salesTaxId', contactType: 'vendor' | 'customer' }
```

**Four near-identical copies is the single most likely failure mode of this build.**

### Posting a bill — one transaction (§3.4)
1. Authenticate → resolveTenant → `authorize('admin','manager')`
2. Load with lines; assert `status='draft'` else `409`
3. Assert ≥1 line and `total_amount > 0`
4. Assert vendor active; every account and journal active (**[SPEC]** §9.6)
5. **Recompute all totals server-side from the lines** — client-sent totals are never trusted **[TECH-REQ]**
6. Consume the `BILL` sequence
7. Build journal lines per §5.3 and call `postJournalEntry`
8. Update bill: status, number, `journal_entry_id`, `amount_due = total`, `posted_at`
9. If from a PO, set the PO to `billed` (**[SPEC]** §5.1.2)
10. Write audit; commit; **then** queue the notification

### Journal entry — [SPEC] §5.1.4
| Account | Dr | Cr |
|---|---|---|
| Purchase Expense (per line) | untaxed | |
| Input Tax Credit *(only if Decision 4 puts purchase tax in scope)* | tax | |
| Creditors (vendor payable) | | total |

### Analytic tagging — [SPEC] §8, [AMBIG A10]
PO and Bill **lines** carry `analytic_account_id`, and the ledger engine copies it onto the journal lines. Without this, P11's Budget Report has no actuals at all.

### Security
- `authorize('admin','manager')` on every route; cancel is admin-only
- **[TECH-REQ]** `:id` always resolved with `WHERE id = $1 AND organization_id = $2` — an id alone is never trusted, which closes the cross-tenant IDOR path
- Totals recomputed server-side, always
- **[TECH-REQ]** A PO already `billed` cannot be billed again → `409` (prevents double-billing)
- Edits allowed only in `draft`
- Submit disabled in flight — a double-posted bill double-hits the ledger

### Tests
| Test | Type |
|---|---|
| PO lifecycle: draft → confirmed → billed | API |
| PO → Bill conversion copies lines and totals | Integration |
| Bill posting produces Dr Expense / Cr Creditors exactly | Integration |
| Client-supplied totals are ignored; server recomputes | Security |
| Billing an already-billed PO returns `409` | API |
| Non-draft documents cannot be edited | API |
| A failed journal write rolls back the bill — no orphan document | Integration |
| Analytic tag propagates from bill line to journal line | Integration |
| Cross-tenant document id returns `404` | Security |
| Line grid usable at 375px | UI |

### Exit Gate
- [ ] **[SPEC]** §7.2 passes end to end: PO for Azure Furniture → convert to Bill → post
- [ ] The generated entry matches §5.3 exactly, verified line by line
- [ ] `DocumentLineGrid` built as **one** configurable component
- [ ] Rollback verified: a forced journal failure leaves zero bill rows

---

# Phase 9 — Sales Flow

### Goal
**[SPEC]** §5.2, §7.3 — Sales Order → Customer Invoice → posted journal entry.

### Depends on
P8 (reuses `DocumentLineGrid`, `DocumentTotals`, `DocumentStatusBar`).

### Deliverables

**Migrations:** `021_create_sales_orders`, `022_create_customer_invoices` (+ line tables).
**Backend — `src/sales/`:** mirrors P8 under `/api/sales-orders` and `/api/customer-invoices`, with `create-invoice` and `post`.
**Frontend:** `/dashboard/sales-orders`, `/dashboard/customer-invoices`.

### Differences from P8 — this is deliberately a small phase
- Contact filter is customers and "both"; price defaults from `sales_price`; tax from `sales_tax_id`
- **[SPEC]** §5.2.1 explicitly lists **Tax** on the Sales Order
- Statuses: `draft → confirmed → invoiced → cancelled` (**[SPEC]** §5.2.2)
- Invoice detail adds **Send to customer** and Print/PDF (Decision 6)
- **[SPEC]** §9.7 — posting an invoice queues an email to a portal-enabled contact, including the payment link

### Journal entry — [SPEC] §5.2.4
| Account | Dr | Cr |
|---|---|---|
| Debtors (customer receivable) | total | |
| Sale Income (per line) | | untaxed |
| Output Tax Payable | | tax |

**[SPEC]** §7 — tax posts to its own account, **never** folded into Sale Income.

### Security
Identical to P8. Every `:id` resolved with both id and `organization_id`.

### Tests
| Test | Type |
|---|---|
| SO lifecycle: draft → confirmed → invoiced | API |
| SO → Invoice conversion | Integration |
| Invoice posting produces Dr Debtors / Cr Income + Tax exactly | Integration |
| Tax lands on Output Tax Payable, not Sale Income | Integration |
| Double-post prevented | API |
| Cross-tenant isolation | Security |

### Exit Gate
- [ ] **[SPEC]** §7.3 passes: SO for Nimesh Pathak, 5 Office Chairs → Invoice → post
- [ ] Entry matches §5.3 exactly
- [ ] No duplicated line-grid code — P8's component reused as-is

---

# Phase 10 — Payments & Settlement

### Goal
**[SPEC]** §5.1.5, §5.2.5 — register payments against bills and invoices, post the entries, and roll document statuses forward correctly.

### Depends on
P9.

### Blocks
P11 (reports need settled data) and P12 (the portal reuses this posting path).

### Deliverables

**Migrations:** `023_create_payments`, `024_create_payment_allocations`.
**Backend — `src/payments/`.**

| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/payments` | admin, manager |
| POST | `/api/payments` | admin, manager |
| GET | `/api/payments/:id` | admin, manager |
| POST | `/api/payments/:id/cancel` | **admin** |

**Frontend:** `RegisterPaymentModal` (from invoice/bill detail), `/dashboard/payments` list.

### Why `payment_allocations` is required, not optional
**[SPEC]** §5.1.6 and §5.2.6 define a `partially_paid` status. That status is only reachable if a payment can be smaller than the balance — and a many-to-many resolution table is the only correct model, because one payment may settle several invoices and one invoice may receive several partial payments.

### Business logic — one transaction
1. Validate; **assert `SUM(allocations) == amount`** — otherwise money posts to the ledger without a home **[TECH-REQ]**
2. **Lock each target document `FOR UPDATE`** — **[TECH-REQ]** two concurrent payments on one invoice would otherwise both read the same `amount_due` and overpay it
3. Assert each document is same-org, belongs to this contact, and is `posted` or `partially_paid`
4. Assert `allocated_amount <= amount_due` per document — no overpayment
5. Consume the `PAY` sequence
6. Post the journal entry per §5.3
7. Update each document: `amount_paid += allocated`, recompute `amount_due`, set `paid` at zero else `partially_paid`
8. Insert allocation rows; write audit
9. Commit

### Journal entries — [SPEC] §5.1.5, §5.2.5
| Case | Dr | Cr |
|---|---|---|
| Invoice payment received | Cash / Bank | Debtors |
| Bill payment made | Creditors | Cash / Bank |

### Overdue — [TECH-REQ] §7.8
`overdue` is **derived**, never a manual transition:
`status IN ('posted','partially_paid') AND due_date < CURRENT_DATE AND amount_due > 0`

Exposed as a computed `isOverdue` field and a SQL-side filter. **[TECH-REC]** no cron job — a nightly job would only duplicate the predicate and introduce drift between runs.

### Security
- `authorize('admin','manager')` — **[SPEC]** §3, Contacts never record Cash/Bank payments
- Cancellation is admin-only and **reverses** rather than deletes (§3.8)
- **[TECH-REQ]** The journal type must match the payment method — a cash journal for cash, a bank journal for bank. Otherwise the ledger credits the wrong asset account.
- `payment_date` not in the future **[TECH-REC]**

### Tests
| Test | Type |
|---|---|
| Full payment sets `paid`; partial sets `partially_paid` | Integration |
| Two partials totalling the balance set `paid` | Integration |
| **Concurrent payments on one invoice cannot overpay it** | Integration (parallel) |
| Allocation exceeding `amount_due` rejected | API |
| Allocations not summing to the amount rejected | Unit |
| Cash method with a bank journal rejected | Validation |
| Payment entry matches §5.3 | Integration |
| Cancel reverses the entry and restores `amount_due` | Integration |
| Contact role gets `403` | Permission |
| `isOverdue` computes correctly across the due-date boundary | Unit |

### Exit Gate
- [ ] Both payment directions post correct entries
- [ ] **The parallel overpayment test passes — run it genuinely concurrently, not sequentially**
- [ ] Partial-payment status transitions correct in both directions
- [ ] Cancel/reverse leaves balances exactly as before the payment

---

# Phase 11 — Budgets & Financial Reports

### Goal
**[SPEC]** §6, §8, §7.4 — Balance Sheet, Profit & Loss, Budget Report, with the charts that make them readable.

### Depends on
P10 (reports need posted, settled data).

### Deliverables

**Migration:** `015_create_budgets`.
**Backend:** `src/budgets/`, `src/reports/` (`reports.balanceSheet.js`, `reports.profitLoss.js`, `reports.budget.js`).

| Method | Endpoint |
|---|---|
| GET | `/api/reports/balance-sheet?asOfDate=` |
| GET | `/api/reports/profit-loss?fromDate=&toDate=` |
| GET | `/api/reports/budget?budgetId=` or range |
| GET | `/api/reports/:type/export` (Decision 6) |
| GET/POST/PATCH | `/api/budgets` |

**Frontend:** `/dashboard/budgets`, `/dashboard/reports/{balance-sheet,profit-loss,budget}`.

### Budget actuals — [SPEC] §8
1. Read `analytic_account_id`, `period_start`, `period_end`
2. Sum `journal_entry_lines` where the analytic tag matches, the parent entry is `posted`, and `entry_date` is in the period
3. **Sign by analytic type** — expense budgets use `SUM(debit) - SUM(credit)`; income budgets the reverse. **[TECH-REQ]** without this, income budgets report negative actuals
4. `variance = planned - actual`; `variancePercent = variance / planned * 100`, **guarding `planned = 0`** **[TECH-REQ]**

**[TECH-REQ]** Actuals are computed **on read, never stored.** A stored `actual_amount` drifts the moment any entry is posted, reversed, or back-dated.

### Reports — [SPEC] §6
- Posted entries only
- Single grouped queries via `accounting.repository.js` (§5.4) — **never** loop accounts and query per account
- Signed correctly: assets/expenses debit-positive; liabilities/income/capital credit-positive
- **[TECH-REQ]** Net profit for the period folds into Capital on the Balance Sheet, or Assets will not balance
- **[TECH-REQ]** `isBalanced` asserts Assets = Liabilities + Capital + Net Profit. When false the UI shows a **warning**, not a silently wrong report

**[TECH-REC]** No caching. **[SPEC]** §6 calls the Balance Sheet a "real-time snapshot", so caching it would be wrong, not merely premature.

### Charts — existing SVG library only, no dependency
| Chart | Type | Source |
|---|---|---|
| Net profit trend | `AreaChart` | P&L |
| Expense breakdown | `DonutChart` (top 6 + Other) | P&L |
| Budget planned vs actual | `GroupedBarChart` | Budget report |
| Budget consumption | `ProgressBar` | Budgets list |
| Balance Sheet composition | `StackedBarChart` | Balance Sheet |

Series colors from `--graph-series-1..8` only (`strict.md` §1). Empty state: "No data for this period" via `--graph-empty-text` — **never a blank frame**, which reads as a broken component. Loading: `Skeleton` at the chart's exact height so the page does not reflow.

### Security
`authorize('admin','manager')` — **[SPEC]** §3, Contacts have no report access at all. Date parameters validated and bounded.

### Tests
| Test | Type |
|---|---|
| **Balance Sheet balances**: Assets = Liabilities + Capital + Net Profit | Integration |
| P&L equals income minus expenses for the period | Integration |
| Budget actuals equal the sum of analytic-tagged posted lines in the period | Integration |
| Income budgets report positive actuals | Unit |
| `planned_amount = 0` does not divide by zero | Unit |
| Reports with no data return zeros, not errors | Integration |
| Draft entries are excluded from every report | Integration |
| `period_end < period_start` rejected | Validation |
| Contact role gets `403` on all report endpoints | Permission |

### Exit Gate
- [ ] **[SPEC]** §7.4 passes: select a period, generate all three reports
- [ ] Balance Sheet balances on a full seeded dataset
- [ ] P&L cross-checks against manually summed journal entries
- [ ] Budget actuals cross-check against the contributing lines shown in the detail view
- [ ] All charts render, including their empty and loading states

---

# Phase 12 — Contact Portal & Payment Gateway

### Goal
**[SPEC]** §5.3 — a Contact logs in, sees **only** their own documents, and a Customer pays an invoice by card.

### Depends on
P10.

### Note
This is the **most security-sensitive phase in the project.** It is the only surface exposed to users outside the organization, and the only one that touches money movement.

### Prerequisite
**Decision 3** (gateway) must be answered before this phase starts.

### Deliverables

**Backend — `src/portal/`** (every endpoint derives `contact_id` from `req.user.contact_id`):

| Method | Endpoint | Role |
|---|---|---|
| GET | `/api/portal/summary` | user |
| GET | `/api/portal/invoices` | user (customer) |
| GET | `/api/portal/invoices/:id` | user (customer) |
| GET | `/api/portal/bills` | user (vendor) |
| POST | `/api/portal/invoices/:id/pay-intent` | user (customer) |
| POST | `/api/portal/payments/verify` | user (customer) |
| POST | `/api/webhooks/payments/:provider` | **public, signature-verified** |

**`payments/gateway.adapter.js`** — **[TECH-REC]** a thin adapter exposing `createOrder`, `verifySignature`, `fetchPayment`. Implement Razorpay first (INR context, matching the Pincode-based Indian addresses of §4.1), keeping Stripe swappable. **Do not spread gateway calls through the service layer.**

**Frontend — `/[locale]/portal/`**
- `/portal` — Total Outstanding, Overdue, Paid This Year + recent documents
- `/portal/invoices` — customers only, with **Pay Now** on unpaid invoices
- `/portal/bills` — vendors only, the full historical statement (**[SPEC]** §5.3.3)
- `/portal/invoices/:id` — read-only detail + payment panel

Navigation from a separate `PORTAL_NAV`. **Contacts must never see accounting navigation.**

### Card payment — [SPEC] §5.3.4–5.3.5
1. Authenticate; load the invoice with `WHERE id=$1 AND organization_id=$2 AND customer_contact_id=$3` — **all three, always** **[TECH-REQ]**
2. Assert `amount_due > 0` and the status is payable
3. **Create the gateway order for `amount_due` read from the database** — **[TECH-REQ]** never from the client, or a customer could pay ₹1 against a ₹26,550 invoice
4. The gateway's own SDK collects the card **on the client**. **[TECH-REQ]** Card details never touch this application's servers, DOM, or logs
5. Verify the gateway signature **server-side**
6. One transaction: insert payment (`method='card'`) → post the entry → allocate → update invoice status
7. **Idempotency:** `UNIQUE (organization_id, gateway_payment_id)` — **[TECH-REQ]** the webhook and the browser callback will both fire for the same payment, and without this the invoice is credited twice

### Journal entry — [SPEC] §5.3.5
| Account | Dr | Cr |
|---|---|---|
| Payment Gateway Clearing | amount | |
| Debtors | | amount |

**[TECH-REC]** A clearing account, not Bank: at that moment the money is with the gateway, not in the bank. Settlement is a later `Bank ← Clearing` entry.

### Security — the strictest bar in the project
- `authorize('user')` plus a `requirePortalContact` guard asserting `req.user.contact_id` exists
- Vendor-only and customer-only endpoints check `contact_type`. **[SPEC]** §5.3.7 — a **vendor calling pay-intent gets `403`.** The organization pays vendors, not the reverse
- Webhook: signature-verified, replay-protected, and it **never trusts an amount from the payload** — always re-fetch from the gateway
- Rate-limit pay-intent creation
- **[TECH-REQ]** Never log gateway signatures, card data, or full payloads. Audit the existing sanitising logger for these fields specifically
- Only the gateway's **publishable** key is `NEXT_PUBLIC_*`. A secret with that prefix is compiled into the bundle and shipped to every visitor

### Environment
```env
PAYMENT_GATEWAY_PROVIDER=razorpay
PAYMENT_GATEWAY_KEY_ID=
PAYMENT_GATEWAY_KEY_SECRET=
PAYMENT_GATEWAY_WEBHOOK_SECRET=
PAYMENT_CURRENCY=INR
```
**[TECH-REQ]** Extend `validateEnv()` **[EXISTS]** to fail fast on missing gateway secrets when the portal is enabled — a silent misconfiguration means payments appear to work and never post.

### Tests
| Test | Type |
|---|---|
| A contact sees only their own invoices (**[SPEC]** §5.3.2) | Permission |
| Another contact's invoice id returns `404` | Security |
| A vendor sees their bill history and **no Pay Now** (**[SPEC]** §5.3.7) | Permission |
| A vendor calling pay-intent gets `403` | Security |
| **Pay-intent uses the DB amount, ignoring a client-supplied amount** | Security |
| **A webhook delivered twice credits the invoice once** | Integration |
| A tampered signature is rejected and posts nothing | Security |
| A successful payment posts Dr Clearing / Cr Debtors and sets `paid` | Integration |
| A contact gets `403` on every `/api/*` accounting endpoint | Permission |
| No card data or signature appears in any log | Security |
| Gateway timeout leaves the invoice untouched | Integration |

### Exit Gate
- [ ] **[SPEC]** §5.3 passes end to end in the gateway's test mode
- [ ] Idempotency proven by replaying the same webhook
- [ ] Signature tampering proven to post nothing
- [ ] Amount tampering proven ineffective
- [ ] Log audit confirms no sensitive payment data is written
- [ ] A contact provably cannot reach any accounting endpoint or another contact's document

---

# Phase 13 — Dashboard, Notifications, Attachments & Audit

### Goal
The supporting modules that make the system usable day to day.

### Depends on
P11 and P12 (the dashboard aggregates their data).

### Deliverables

**Migrations:** `025_create_attachments`, `027_create_notifications`.
**Backend:** `src/dashboard/`, `src/notifications/`, `src/attachments/`, `src/audit/`.

**Dashboard — [TECH-REC]**, not in `project.md`
`project.md` has no dashboard section, but the codebase already ships a full dashboard shell and role routing. Populating it with existing data introduces **no new business requirements**.

`GET /api/dashboard/summary?period=` returns: KPI cards (Total Receivable, Total Payable, Income, Expenses, Net Profit, Overdue count), a monthly income-vs-expense series, top-5 customers, receivable aging, and recent activity — **all in one request**, because six parallel requests on every dashboard load is avoidable.

Charts: `GroupedBarChart` (income vs expense), `BarChart` (aging, top customers), `DonutChart` (expense breakdown), `Sparkline` (cash trend).

**Portal dashboard** (`user`): Total Outstanding, Overdue, Paid This Year, own recent documents — **no org-wide figures whatsoever.**

**Notifications — [SPEC]** §9.7
Insert a `pending` row **inside** the business transaction; dispatch **after commit** via the existing `nodemailer` setup **[EXISTS]**. Triggers: invoice posted (portal-enabled customer), bill posted, payment received, portal invite, password reset **[EXISTS]**.

**[TECH-REC]** No BullMQ, no Redis. A `setImmediate` dispatch plus a retry pass over `status='pending'` rows is sufficient at this scale and adds no infrastructure. Revisit only if volume demands it.

An email failure **never** fails the parent transaction.

**Attachments — [SPEC]** §9.5
`POST /api/attachments` (multipart via `multer`), `GET /api/attachments?entityType=&entityId=`, `GET /:id/download`, `DELETE /:id`.

**[TECH-REQ]** Validate MIME by **magic bytes**, not the declared header. Cap at 5 MB. Store **outside the web root** with generated names. Stream downloads through an **authorized** endpoint — never a public static path, or one org's scanned bills become readable by another.

**Audit — [SPEC]** §9.2
`GET /api/audit-logs?entityType=&entityId=&page=` — **admin only**. Rows were written by services throughout P3–P12.

### Tests
| Test | Type |
|---|---|
| Dashboard KPIs match report figures for the same period | Integration |
| Dashboard is org-scoped — no cross-tenant leakage | Security |
| Portal dashboard shows only the contact's own figures | Permission |
| Email failure does not roll back the invoice | Integration |
| A failed notification is retried and visible to an admin | Integration |
| A file with a spoofed MIME header is rejected | Security |
| Another org's attachment cannot be downloaded | Security |
| Oversized upload rejected | Security |
| `manager` gets `403` on audit logs | Permission |
| Audit rows exist for every posting action from P8–P12 | Integration |

### Exit Gate
- [ ] Dashboard figures reconcile with §6 reports for the same period
- [ ] An invoice email reaches a portal-enabled contact with a working payment link
- [ ] Attachment upload/download works and is provably org-isolated
- [ ] Audit log shows a complete trail for a full purchase-to-payment cycle

---

# Phase 14 — Hardening, Security, Performance & Release

### Goal
Make it correct, safe, translated, and fast enough — before anyone relies on the numbers.

### Depends on
All phases.

### Tasks

**14.1 — Internationalisation completion (`strict.md` §2)**
- [ ] Every string in all three locale files, key trees identical
- [ ] **Accounting terminology reviewed by someone who knows the domain in Hindi and Gujarati.** Machine translation of "Debit", "Credit", "Accounts Receivable", "Chart of Accounts", "Analytic Account" produces misleading text in a financial system
- [ ] Glossary committed to `src/messages/`
- [ ] Every page verified in all three locales

**14.2 — `strict.md` audit (§6 checklist)**
- [ ] No hardcoded hex/rgb/hsl anywhere in new CSS or inline styles
- [ ] No `:root` variable value modified
- [ ] New variables derived from the Frozen Lake palette
- [ ] Only Orbitron and Sora; weights from the defined scale
- [ ] Neumorphic dual shadows on cards; inset on hover/active
- [ ] Border radii consistent — 6px buttons, 12–14px cards, 20–28px containers
- [ ] `Link`/`useRouter`/`usePathname` imported from `@/i18n/navigation` everywhere
- [ ] No hardcoded strings in any JSX

**14.3 — Security review**
- [ ] **CSRF** — the privileged path is cookie-based (`sid`) and therefore CSRF-reachable. CORS restricts origin **[EXISTS]** but is not sufficient alone. **Verify `SameSite` on `sid` and the refresh cookie** (may already be correct), and add a double-submit token for state-changing requests on the session path. The JWT path used by Contacts is not CSRF-exposed — a browser will not attach an `Authorization` header on its own
- [ ] **Cross-tenant sweep** — every endpoint, every module, tested with a foreign org id
- [ ] **Permission sweep** — every endpoint against all three roles
- [ ] **SQL injection** — confirm every value is a bind parameter; confirm every dynamic `ORDER BY` goes through its allow-list
- [ ] **XSS** — no `dangerouslySetInnerHTML`; escape user values in generated PDFs and emails, which have no React protection
- [ ] **Log audit** — no passwords, tokens, OTPs, card data, or gateway signatures written anywhere
- [ ] Rate limits verified on auth, invites, pay-intent, and webhooks
- [ ] Secrets confirmed absent from the frontend bundle (grep the build output)
- [ ] Extend `tests/security-audit.test.js` **[EXISTS]** to cover the new surface

**14.4 — Performance (§15)**
- [ ] Seed a realistic dataset (10k journal entries, 1k invoices, 500 contacts)
- [ ] `EXPLAIN ANALYZE` the report aggregations; confirm the §4.3 composite indexes are used
- [ ] Confirm every list is server-paginated with `COUNT(*) OVER()` in the same query
- [ ] Confirm no N+1 in document lists
- [ ] Confirm no email, PDF, or gateway call sits inside a transaction — a held transaction blocks the sequence lock and serialises **all** posting
- [ ] Verify pool `max: 20` **[EXISTS]** against Postgres `max_connections`
- [ ] `next/dynamic` on chart-heavy report pages
- [ ] Remove any index not justified in §4.3 — over-indexing slows the posting path

**14.5 — Data integrity verification**
- [ ] Run a full lifecycle on seeded data: master data → PO → Bill → payment → SO → Invoice → payment → portal card payment → all three reports
- [ ] Balance Sheet balances
- [ ] Every posted document has exactly one journal entry
- [ ] Every journal entry balances (verify with a raw SQL sweep, not through the app)
- [ ] No gaps in any document sequence
- [ ] Audit log covers every state change

**14.6 — Release readiness**
- [ ] `.env.example` complete for both apps, with **placeholders only, never real secrets**
- [ ] Migrations run clean on a fresh production-shaped database
- [ ] Backup and restore procedure documented and **tested**
- [ ] README updated with setup, migration, and seeding steps
- [ ] `project.md` §10 decisions all marked resolved
- [ ] Known limitations documented — including everything in `technicalrequirement.md` §18.3

### Exit Gate
- [ ] Full §16 test suite green
- [ ] `strict.md` §6 checklist clean across every new file
- [ ] Security sweep complete with no open findings
- [ ] Full lifecycle verified end to end on realistic data
- [ ] Reports reconcile against manual calculation

---

## Cross-Phase Standing Rules

These apply in **every** phase and are checked at every merge.

### Never
1. Never create a new project or replace the existing architecture
2. Never introduce TypeScript, an ORM, a charting library, or a state-management library
3. Never modify a `:root` variable value in `globals.css`
4. Never write a hardcoded color or a hardcoded user-facing string
5. Never trust `organization_id`, `role`, or a monetary total from a request body
6. Never do money arithmetic outside `money.js`
7. Never place email, PDF, or gateway calls inside a database transaction
8. Never mutate a posted journal entry — reverse it
9. Never return `403` for a cross-tenant record — return `404`
10. Never interpolate a value into SQL, including `ORDER BY`

### Always
1. Always run `authenticate → resolveTenant → authorize` on domain routes
2. Always filter every query by `organization_id`
3. Always recompute document totals server-side
4. Always wrap multi-write operations in `withTransaction`
5. Always add i18n keys to all three locale files **before** writing the component
6. Always write the audit row inside the same transaction as the change
7. Always disable submit controls while a request is in flight
8. Always render explicit loading, empty, filtered-empty, and error states
9. Always follow the existing module template — routes / controller / service / repository / validation
10. Always pass `client` as the first argument to a repository function that can join a transaction

### Definition of Done — every phase
- [ ] Code follows the existing module and component conventions
- [ ] JSDoc matches the existing style
- [ ] Validation returns the existing `{ isValid, errors, data }` shape
- [ ] All responses use `utils/response.js`
- [ ] Permission tests green for all three roles
- [ ] Cross-tenant isolation tested on every new endpoint
- [ ] `strict.md` §6 checklist passes
- [ ] The phase Exit Gate passes in full

---

*Execution companion to `Doc/project.md`, `Doc/technicalrequirement.md`, and `Doc/strict.md`. `project.md` remains the sole authority on WHAT is built.*
