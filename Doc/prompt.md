# Urban Furniture — Accounting System
## Implementation Prompts (`prompt.md`)

> **What this is:** one ready-to-use prompt per phase. Paste the **Global Preamble** (§A) first, then the prompt for the phase you are on. Each prompt is self-contained enough to hand to a developer or an AI agent without re-explaining the project.
> **Companions:** `Doc/project.md` (WHAT) · `Doc/technicalrequirement.md` (HOW) · `Doc/phase.md` (WHEN) · `Doc/strict.md` (RULES).
> **Order:** never run a phase prompt before its predecessor's Exit Gate has passed.

---

# §A. Global Preamble — prepend to EVERY phase prompt

```
You are working on the Urban Furniture Accounting System, an existing project at D:\ODOO_Pre.

═══════════════════════════════════════════════════════════════
READ FIRST — IN THIS ORDER
═══════════════════════════════════════════════════════════════
1. Doc/project.md              — business requirements. THE SOLE AUTHORITY on WHAT.
2. Doc/technicalrequirement.md — the technical blueprint. HOW to build it.
3. Doc/strict.md               — development rules. BINDING on all frontend work.
4. Doc/phase.md                — phase order, dependencies, exit gates.

If any instruction I give conflicts with project.md, project.md wins — tell me
about the conflict rather than silently choosing.

═══════════════════════════════════════════════════════════════
THE EXISTING STACK — DO NOT CHANGE IT
═══════════════════════════════════════════════════════════════
Backend  D:\ODOO_Pre\Backend   Node.js, Express 5, CommonJS, raw `pg` (no ORM)
Frontend D:\ODOO_Pre\Frontend  Next.js 16 App Router, React 19, JavaScript (.jsx)
Database PostgreSQL
i18n     next-intl, locales en / hi / gu, localePrefix 'always'

ABSOLUTE PROHIBITIONS
✗ Do NOT create a new project or scaffold over the existing one
✗ Do NOT convert JavaScript to TypeScript — every new file is .js or .jsx
✗ Do NOT add an ORM (Prisma/Sequelize/TypeORM) — the project uses parameterised raw pg
✗ Do NOT add a charting library — src/reusablefiles/graphs/ already has 17 SVG charts
✗ Do NOT add Redux / Zustand / React Query — Context + hooks + URL params cover it
✗ Do NOT add Tailwind — strict.md forbids Tailwind color utilities
✗ Do NOT add zod — validation uses the existing { isValid, errors, data } pattern
✗ Do NOT modify existing files beyond what the task requires
✗ Do NOT refactor working code you were not asked to touch

═══════════════════════════════════════════════════════════════
BACKEND CONVENTIONS — copy src/auth/ exactly
═══════════════════════════════════════════════════════════════
Every module is five files:
  <name>.routes.js       Express router, rate limiters, middleware chain. NO logic.
  <name>.controller.js   Reads req, calls validation, calls service, responds via
                         utils/response.js. NO SQL, NO business rules.
  <name>.service.js      Business logic, orchestration, transactions. NEVER touches req/res.
  <name>.repository.js   Parameterised SQL only. Returns rows. NO HTTP, NO business rules.
  <name>.validation.js   Pure functions returning { isValid, errors: string[], data? }

Responses ALWAYS go through src/utils/response.js:
  success(res, message, data, code) | created(res, message, data) | error(res, message, code, errors)
  Shape: { success: boolean, message: string, data?: any, errors?: string[] }

Repository functions that can join a transaction take `client` as the FIRST argument:
  async function insertX(client, payload) { const db = client || pool; ... }

Migrations: numbered files in src/database/migrations/ exporting { name, up, down }
where up/down are raw SQL strings, registered in the ordered array in run-migrations.js.

═══════════════════════════════════════════════════════════════
SECURITY — NON-NEGOTIABLE ON EVERY TASK
═══════════════════════════════════════════════════════════════
ROLE MAPPING (technicalrequirement.md §3.2) — confirmed in Phase 0:
  admin       = Admin / Business Owner   → server session (sid HttpOnly cookie)
  manager     = Invoicing User/Accountant→ server session (sid HttpOnly cookie)
  user        = Contact (customer/vendor)→ JWT Bearer, in-memory only
  super_admin = platform operator, NOT an accounting actor

MULTI-TENANCY — the highest-severity class of bug in this system:
  • Every domain table has organization_id UUID NOT NULL REFERENCES organizations(id)
  • Every index leads with organization_id
  • Every unique rule is UNIQUE (organization_id, <key>) — NEVER globally unique
  • EVERY repository query filters by organization_id. No exceptions.
  • organization_id comes from req.user ONLY — never from body, query, params, headers
  • Every :id is resolved with WHERE id = $1 AND organization_id = $2 — both, always
  • A record in another org returns 404, NOT 403 (a 403 confirms it exists → data leak)

MIDDLEWARE CHAIN on every domain route, in this order:
  authenticate → resolveTenant → authorize(...roles)

ALWAYS:
  • Parameterised SQL ($1, $2). Never string-concatenate a value.
  • Dynamic ORDER BY goes through a per-module allow-list — a column name cannot be
    a bind parameter, so this is the one place injection could enter.
  • Recompute all monetary totals server-side. Never trust client totals.
  • Money arithmetic ONLY through shared/money.js (decimal.js). Never JS floats.
  • Multi-write operations wrapped in withTransaction.
  • Write the audit row inside the same transaction as the change.
  • Never log passwords, tokens, OTPs, card data, or gateway signatures.
  • Never place email, PDF, or gateway calls INSIDE a transaction.

═══════════════════════════════════════════════════════════════
MONEY — an accounting system that uses floats is broken
═══════════════════════════════════════════════════════════════
  • Monetary columns NUMERIC(15,2); quantities NUMERIC(15,3); rates NUMERIC(7,4)
  • NEVER FLOAT/REAL/DOUBLE PRECISION, never JS Number arithmetic on money
  • node-postgres returns NUMERIC as a STRING. Do NOT install a global type parser
    to "fix" this — that reintroduces float error. Use shared/money.js.
  • Money is returned to the client as a string. The frontend formats it and never
    computes with it.
  • Round ROUND_HALF_UP at 2dp once per document line after tax — never on running totals.

═══════════════════════════════════════════════════════════════
FRONTEND — strict.md IS BINDING, NOT ADVISORY
═══════════════════════════════════════════════════════════════
COLORS   Every color via var(--*) from src/app/globals.css :root.
         NO hex, NO rgb()/rgba()/hsl(), NO Tailwind color classes.
         NEVER modify an existing :root value. New variables are added to :root
         in globals.css and must be derived from the Frozen Lake palette
         (#c2c8cd, #000080, #c0ccd6, #6D8196).

i18n     BEFORE writing a component: add keys to ALL THREE of
         src/messages/en.json, hi.json, gu.json — identical key trees.
         Use useTranslations('<namespace>'). NEVER hardcode a user-facing string.
         Import Link / useRouter / usePathname from '@/i18n/navigation'
         — NEVER from 'next/link' or 'next/navigation'.

DESIGN   Neumorphism. Cards use dual shadows (--nm-shadow-dark + --nm-shadow-light);
         hover/active use inset shadows. Radius: 6px buttons, 12–14px cards,
         20–28px large containers. Surface hierarchy --bg-base → --bg-surface →
         --bg-raised → --bg-card.

FONTS    Orbitron (headings, titles, numbers, badges) and Sora (body, labels,
         buttons, nav) ONLY. Always include the fallback (monospace / sans-serif).
         No other font, ever — including Inter.

FILES    Components in src/components/<page>/, every one a .jsx file.
         New feature → new CSS file in src/styles/, imported in src/app/layout.jsx.
         NEVER put a color definition outside globals.css.

REUSE THESE — do not rebuild them (src/reusablefiles/):
  Button · InputBox (onChange receives the VALUE, not the event) · Card/CardHead/CardBody
  StatCard · Pill/RolePill · ListCard · DataTable (presentational only — no built-in
  sort/filter/pagination) · Skeleton/DashboardSkeleton · Avatar · DashboardShell
  (Sidebar/Topbar/PageHead) · GenerativeTexture · PageTransition
  graphs/ — BarChart, GroupedBarChart, StackedBarChart, LineChart, AreaChart, BoxPlot,
  ScatterPlot, BubbleChart, HeatMap, SemiCircleGauge, RadialGauge, DonutChart, PieChart,
  RadarChart, ProgressBar, Sparkline + ChartFrame, ChartLegend, primitives and helpers.
  Series colors: --graph-series-1 … --graph-series-8 only.

═══════════════════════════════════════════════════════════════
UI STATES — every list and every form
═══════════════════════════════════════════════════════════════
  Loading  Skeleton rows on first load; dimmed table on refetch (no layout jump)
  Empty    Distinguish "nothing yet" (+ Create CTA) from "nothing matches your filters"
           (+ Clear filters)
  Error    Message + Retry; never a blank screen
  In-flight Submit disabled — a double-posted invoice double-hits the ledger
  Money    Right-aligned, tabular figures, Intl.NumberFormat bound to the active locale

═══════════════════════════════════════════════════════════════
HOW TO WORK
═══════════════════════════════════════════════════════════════
1. Read the existing code before writing new code. Match its style, naming,
   comment density, and JSDoc conventions.
2. Implement ONLY the phase's scope. If you notice something out of scope, tell me —
   do not fix it silently.
3. If project.md is ambiguous, STOP and ask. Do not invent a business requirement.
4. Label anything you add that project.md does not state as
   TECHNICAL RECOMMENDATION, and say why it is needed.
5. When done, report: files created, files modified, decisions made, assumptions made,
   and anything left incomplete.
```

---

# §B. Phase Prompts

---

## Prompt — Phase 0: Decisions & Preparation

```
[Global Preamble]

TASK — Phase 0. NO PRODUCTION CODE IS WRITTEN IN THIS PHASE.

1. AUDIT THE CURRENT STATE
   Read and summarise for me:
   - Backend/src/ — every module, the auth feature's exact file pattern,
     the migration convention, the response and error conventions
   - Frontend/src/ — routing, i18n setup, AuthContext, lib/api.js,
     the reusablefiles inventory, the globals.css :root token list
   - Existing migrations and the current users table schema
   Report anything that contradicts Doc/technicalrequirement.md §1, which was
   written from this codebase — if it has drifted since, I need to know.

2. PRESENT THE BLOCKING DECISIONS
   From technicalrequirement.md §18.1 and project.md §10, present each with a
   recommendation and the cost of getting it wrong:
     Decision 5  Multi-currency vs single INR   ← MOST EXPENSIVE TO DEFER
     Decision 1  Accountant Modify rights on master data
     §3.2        Role mapping confirmation (admin/manager/user)
     Decision 4  Tax scope — sales only, or sales + purchase
     Decision 2  Contact portal access — automatic vs per-contact toggle
     A3          Fiscal year start month
     A1          Is stock/inventory in scope?
     A8          Is GST compliance expected (GSTIN, HSN/SAC, place of supply)?
   Wait for my answers. Do not assume defaults.

3. ENVIRONMENT VERIFICATION
   - Confirm PostgreSQL is reachable and gen_random_uuid() is available
   - Confirm `npm run migrate` runs clean on an EMPTY database
   - Confirm `npm run dev` starts both apps and GET /api/health responds
   - Create a SEPARATE test database. Never run tests against dev data.

4. TOOLING
   Backend:  npm i decimal.js date-fns
             npm i -D jest supertest
   Explain what each is for before installing. Install nothing else.

DELIVERABLE
   A written audit report + my answers recorded into project.md §10.
   Do not write feature code.

DO NOT
   ✗ Write any migration or module
   ✗ Assume a default for any decision
   ✗ Install any package not listed above
```

---

## Prompt — Phase 1: Database Foundation & Multi-Tenancy

```
[Global Preamble]

TASK — Phase 1. Establish the tenant boundary BEFORE any domain table exists.
Reference: technicalrequirement.md §3.1, §4.1 · phase.md Phase 1

BUILD

1. MIGRATIONS — follow the existing numbered convention exactly
   006_create_organizations.js
     id UUID PK DEFAULT gen_random_uuid()
     name VARCHAR(150) NOT NULL
     slug VARCHAR(150) UNIQUE NOT NULL
     currency_code CHAR(3) NOT NULL DEFAULT 'INR'
     fiscal_year_start_month SMALLINT NOT NULL DEFAULT 4
     status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived'))
     created_by / updated_by UUID, created_at / updated_at TIMESTAMPTZ DEFAULT NOW()
     INDEX on slug

   007_add_organization_to_users.js
     ALTER users ADD organization_id UUID NULL REFERENCES organizations(id)
     ALTER users ADD contact_id UUID NULL          -- FK added in Phase 6
     ALTER users ADD must_change_password BOOLEAN NOT NULL DEFAULT false
     INDEX users(organization_id)

   Register both in run-migrations.js. Write working `down` SQL for each.
   organization_id is NULLABLE on users because super_admin has no org.

2. src/shared/tenant.middleware.js
   resolveTenant(req, res, next):
     - read req.user.organization_id
     - missing → error(res, 'No organization context for this account', 403)
     - set req.organizationId, call next()
   It MUST run after authenticate and before authorize.

3. src/organizations/ — the full five-file module
   GET   /api/organizations/current   (admin, manager)
   PATCH /api/organizations/current   (admin) — name, currency, fiscalYearStartMonth
   Include slug generation with collision suffixing (urban-furniture → -2, -3).

SECURITY REQUIREMENTS
   ✓ organization_id is NEVER read from a request body — strip it at validation
   ✓ A user with no organization_id gets 403 with no further detail
   ✓ Cross-tenant records return 404, never 403
   ✓ All SQL parameterised

TESTS TO WRITE
   - Migrations run clean on empty DB; re-running is a no-op
   - down migrations reverse cleanly
   - Slug collision produces a suffix rather than failing
   - resolveTenant reads only from req.user
   - An organization_id in the request body cannot override the tenant
   - A user without an org is refused with 403
   - Existing auth tests still pass — nothing regressed

DELIVERABLE
   Document the six tenancy conventions (technicalrequirement.md §3.1) in the
   Backend README so every later phase inherits them.

DO NOT
   ✗ Create any domain table (contacts, products, etc.) — later phases
   ✗ Build any UI
   ✗ Touch the auth module's logic — Phase 3
```

---

## Prompt — Phase 2: Shared Backend Infrastructure

```
[Global Preamble]

TASK — Phase 2. Build the primitives every later module depends on.
Reference: technicalrequirement.md §3.3, §3.4, §3.5, §3.6, §6.2, §14 · phase.md Phase 2

Written once here, these are NEVER re-implemented. Skipping this phase produces
four copies of a buggy rounding function.

BUILD — Backend/src/shared/

1. withTransaction.js
   async function withTransaction(fn) — connect, BEGIN, await fn(client),
   COMMIT; on throw ROLLBACK and rethrow; ALWAYS release in finally.

2. money.js — the ONLY place money arithmetic happens
   Wrap decimal.js: money(v), toDb(d) → string with 2dp, add, sub, mul, div,
   round2, eq, gt, lt, isZero, sum(array).
   ROUND_HALF_UP at 2dp. Document the pg-returns-strings rule at the top of the file.

3. sequence.service.js — technicalrequirement.md §3.5
   nextDocumentNumber(client, orgId, docType, fiscalYear):
     SELECT ... FOR UPDATE on document_sequences  ← the lock is the whole point
     UPDATE next_number = next_number + 1
     return `${prefix}/${fiscalYear}/${String(n).padStart(padding,'0')}`
   MUST use the caller's client so a rollback returns the number to the pool.
   Accounting documents must not have gaps.
   A PostgreSQL SEQUENCE cannot do this — it is global, not per-org-per-year,
   and it gaps on rollback. Do not substitute one.

4. audit.service.js — recordAudit(client, {organizationId, actorUserId, action,
   entityType, entityId, before, after, ipAddress}). Writes inside the caller's
   transaction. Actor comes from req.user, never from a payload.

5. pagination.js — parse/clamp page & limit (default 25, max 100), normalise
   sortOrder, and build the standard envelope:
     { items, pagination: { page, limit, total, totalPages, hasNext } }
   Include buildOrderBy(sortBy, allowMap, sortOrder) which returns a SAFE column.

6. validate.js — reusable validators returning the EXISTING
   { isValid, errors: string[], data? } shape. Match src/auth/auth.validation.js.
   Include: required, string(min,max), email, enum, uuid, money, quantity,
   percentage, date, dateRange, boolean, pincode, mobile.

7. constants.js — every status enum, document type, and role constant
   (technicalrequirement.md §3.9). One source of truth.

8. AppError.js — Error subclass with statusCode, code, errors[]
   so services throw meaningfully and the EXISTING error middleware translates.

9. dbErrors.js — map PG codes: 23505→409 duplicate, 23503→409 referenced,
   23514→422 constraint. A raw PG message must never reach the client.

MIGRATIONS
   018_create_document_sequences  — doc_type, fiscal_year, prefix, next_number,
       padding, UNIQUE (organization_id, doc_type, fiscal_year)
   026_create_audit_logs — actor_user_id, action, entity_type, entity_id,
       before JSONB, after JSONB, ip_address INET,
       INDEX (organization_id, entity_type, entity_id, created_at DESC)

TESTS TO WRITE
   - withTransaction commits, rolls back on throw, ALWAYS releases the client
   - Rollback leaves zero rows
   - money.add('0.1','0.2') === '0.30'
   - 100 lines of 33.333 sum to the document total exactly
   - TWO CONCURRENT nextDocumentNumber CALLS PRODUCE DIFFERENT NUMBERS
     ← run genuinely in parallel (Promise.all), not sequentially, or it proves nothing
   - A rolled-back transaction consumes no sequence number
   - PG error codes map to the right HTTP status
   - buildOrderBy rejects an input outside the allow-list

DO NOT
   ✗ Install a global pg NUMERIC type parser — it reintroduces float error
   ✗ Use parseFloat or Number() on money anywhere
   ✗ Build any feature module
```

---

## Prompt — Phase 3: Auth Extension & Organization Bootstrap

```
[Global Preamble]

TASK — Phase 3. Business-owner signup creates an Organization; everyone else is
invited from inside it.
Reference: project.md §2.1, §2.2, §3 · technicalrequirement.md §6.1 · phase.md Phase 3

EXTEND the existing auth module — do NOT rewrite it. It already handles OTP email
verification, CAPTCHA, JWT + session dual auth, refresh rotation with reuse
detection, password reset, and rate limiting. All of that stays.

BUILD

1. MIGRATIONS
   008_create_accounts  (Chart of Accounts — needed for seeding)
   013_create_journals  (needed for seeding)
   Full column sets per technicalrequirement.md §4.1.

2. EXTEND auth
   auth.validation.js  accept organizationName (2–150)
   auth.service.js     register inside withTransaction:
                         insert org (unique slug)
                         → insert user role='admin', organization_id
                         → SEED (below)
                         → issue verification OTP
                       COMMIT, THEN send the email.
                       A mail failure must NEVER roll back a created organization.
   auth.controller.js  return { user, organization }
   auth.repository.js  select organization_id, contact_id on user reads
   auth.routes.js      add POST /auth/set-password (public, rate-limited)
   GET /auth/me        include the organization object

3. SEEDING — runs inside the signup transaction. TECHNICAL REQUIREMENT:
   project.md §7.1 assumes a working CoA exists; without this a new org
   cannot record anything.
     Accounts (is_system=true): Cash, Bank, Debtors, Creditors, Sale Income,
       Purchase Expense, Output Tax Payable, Input Tax Credit,
       Opening Balance Equity, Payment Gateway Clearing
     Journals (project.md §4.4): Sales, Purchase, Bank, Cash
     Sequences: PO, SO, BILL, INV, PAY, JE

4. NEW MODULE src/users/  — ADMIN ONLY
   GET   /api/users                 list org users
   POST  /api/users/invite          create an Accountant (role='manager')
   PATCH /api/users/:id/status      activate / deactivate
   Invite: single-use token, HASHED at rest, 72h expiry, emailed set-password link.

5. FRONTEND
   - Register page: add Organization Name (extend the existing form)
   - Login page: add optional Organization slug
     NOTE AMBIGUITY A2 — project.md §2.1 wants org+email+password, but email is
     already globally unique, making the org field redundant. Implement it as
     OPTIONAL disambiguation and flag it to me.
   - NEW page /[locale]/auth/set-password — accept invite token, set password
   - i18n keys in en/hi/gu FIRST

SECURITY REQUIREMENTS — this phase is a privilege-escalation target
   ✓ role and organization_id are NEVER read from the register body — set server-side
   ✓ /users/invite is authorize('admin') only AND may only create role='manager'
     — an Admin must not be able to mint another Admin
   ✓ Invite tokens single-use, hashed, expiring
   ✓ Identical responses whether or not an email exists (enumeration resistance)
   ✓ Existing rate limiters applied to the new routes
   ✓ The random initial password is never returned in a response and never logged

TESTS TO WRITE
   - Register creates org + admin + full seed in ONE transaction
   - A seed failure rolls back the org AND the user — no orphans
   - A mail failure does NOT roll back the org
   - role:"super_admin" in the register body is ignored
   - organization_id in the register body is ignored
   - manager calling /users/invite gets 403
   - Invite token is single-use and expires
   - A seeded org has exactly 10 accounts, 4 journals, 6 sequences
   - THE ENTIRE EXISTING AUTH SUITE STILL PASSES

DO NOT
   ✗ Rewrite the auth module — extend it
   ✗ Change the dual JWT/session model
   ✗ Change the users.role CHECK constraint (we map, we do not rename — §3.2)
   ✗ Build master-data CRUD UI — Phases 5 and 6
```

---

## Prompt — Phase 4: Frontend Foundation

```
[Global Preamble]

TASK — Phase 4. Build the shell, conventions, and shared components ONCE, so the
seven master-data modules that follow are assembly rather than invention.
Reference: technicalrequirement.md §8, §9, §10 · strict.md (all) · phase.md Phase 4

BUILD

1. i18n FIRST — strict.md §2 is binding
   Create these namespaces in ALL THREE of en.json, hi.json, gu.json with
   IDENTICAL key trees, BEFORE writing any component:
     common, contacts, products, accounts, journals, journalEntries,
     analyticAccounts, budgets, taxes, purchases, sales, payments,
     reports, portal, users
   `common` holds shared strings (Save, Cancel, Delete, Archive, all statuses,
   table loading/empty/error) so they are translated once.

   WARNING: accounting terminology in Hindi and Gujarati is SPECIALIST vocabulary.
   Machine-translating Debit, Credit, Accounts Receivable, Chart of Accounts, or
   Analytic Account produces MISLEADING text in a financial system. Produce a
   glossary in src/messages/ and flag every term you are unsure about.

2. STYLES — strict.md §5.1
   New files in src/styles/, each imported in src/app/layout.jsx:
     masters.css, transactions.css, reports.css, portal.css, forms.css
   Every color via var(--*). If you need a color that does not exist, add it to
   :root in globals.css DERIVED from the Frozen Lake palette, and tell me.
   NEVER modify an existing :root value.

3. src/components/shared/
   FilterBar · Pagination · SortableHeader · StatusPill · ConfirmDialog · Drawer
   Modal · MoneyText · DateText · EmptyState · ErrorState · FormField
   FormActions · ToastProvider

4. src/components/pickers/
   ContactPicker · ProductPicker · AccountPicker · JournalPicker · TaxPicker
   AnalyticAccountPicker · DateRangePicker
   ALL server-side searched, limit=20, debounced 300ms.
   NEVER load every product into a <select>.

5. HOOKS & UTILS
   hooks/usePagination.js, hooks/useDebounce.js, and a generic list-hook factory.
   Standard contract EVERY list hook returns:
     const { data, pagination, loading, error, refetch } =
       useX({ page, limit, search, status, sortBy, sortOrder });
   TECHNICAL REQUIREMENT: every fetching hook aborts in-flight requests on unmount
   or param change (AbortController). Without it, fast filter typing lands responses
   out of order and the table shows results for a filter the user already changed.

   utils/format.js   locale-aware money/date/number via Intl.NumberFormat
   utils/status.js   status → label key + tone
   utils/permissions.js  mirrors the §3.2 role matrix
                         ← UX LAYER ONLY. Backend authorize() is the real boundary.

6. EXTEND EXISTING
   config/dashboard.config.js  accounting nav per role + a separate PORTAL_NAV
   context/AuthContext.jsx     expose organization; getDashboardPath('user') → '/portal'
   proxy.js                    guard /dashboard/* and /portal/* at the HTTP layer

7. RESPONSIVE CONTRACT
   ≥1280 full · 1024–1279 sidebar → icons · 768–1023 sidebar → overlay drawer,
   tables scroll in a container · <768 tables → stacked ListCards, forms single-column

STATE MANAGEMENT — add NO library
   Auth/user/role/org → AuthContext (exists)
   Server data        → per-feature hooks
   Filters/search/sort/page → URL query params (shareable, refresh-proof, back-button)
   Form state         → local useState + useFormDraft (exists)
   Modal/drawer       → local useState
   Toasts             → small ToastContext (~50 lines)

CI CHECKS TO ADD — both rules are easy to violate and tedious to catch by eye
   1. Locale-key parity across en/hi/gu
   2. No hardcoded hex/rgb/hsl in src/styles/

TESTS TO WRITE
   - Locale parity passes
   - No hardcoded colors in new CSS
   - Money formats correctly per locale
   - Pickers debounce and abort correctly
   - proxy.js redirects unauthenticated /dashboard and /portal
   - Shell renders at 375 / 768 / 1280

DO NOT
   ✗ Build any feature page — Phase 5 onward
   ✗ Add a state-management or charting library
   ✗ Rebuild anything in reusablefiles/ — compose with it
   ✗ Write a component before its i18n keys exist in all three files
```

---

## Prompt — Phase 5: Master Data A — Accounting Core

```
[Global Preamble]

TASK — Phase 5. Chart of Accounts, Journals, Taxes, Analytic Accounts —
full CRUD + archive, backend and UI.
Reference: project.md §4.3, §4.4, §4.6, §7, §3 · technicalrequirement.md §6.2, §6.5,
§6.6, §6.7, §6.8 · phase.md Phase 5

BUILD
  Migrations: 011_create_taxes, 014_create_analytic_accounts
              (008 accounts and 013 journals landed in Phase 3)
  Modules:    src/accounts/, src/journals/, src/taxes/, src/analytics/
  Routes:     /dashboard/accounts, /journals, /taxes, /analytic-accounts

STANDARD ENDPOINT SET per resource — project.md §3 permission matrix:
  GET    /api/<r>                 admin, manager
  GET    /api/<r>/:id             admin, manager
  POST   /api/<r>                 admin, manager   ← BOTH create
  PATCH  /api/<r>/:id             ADMIN ONLY       ← doc-strict, P0 Decision 1
  PATCH  /api/<r>/:id/archive     ADMIN ONLY
  PATCH  /api/<r>/:id/unarchive   ADMIN ONLY
  Plus GET /api/accounts/tree

STANDARD LIST CONTRACT — identical for every collection:
  ?page=1&limit=25&search=&status=&sortBy=&sortOrder=
  → { success, message, data: { items: [], pagination: {...} } }
  sortBy is NEVER interpolated into SQL — route it through a per-module allow-list.
  This is the one place injection could enter an otherwise fully parameterised
  codebase, because a column name cannot be a bind parameter.

FEATURE RULES

  CHART OF ACCOUNTS (project.md §4.3)
    Five types: asset, liability, expense, income, capital
    parent_account_id self-reference — WALK THE ANCESTOR CHAIN before saving.
      A cycle would hang the tree renderer. TECHNICAL REQUIREMENT.
    A parent must share the child's account_type
    is_system accounts CANNOT be archived or retyped — the ledger engine depends
      on them. TECHNICAL REQUIREMENT.
    UNIQUE (organization_id, code)
    Opening balance is captured here; it POSTS as a balancing entry against
      Opening Balance Equity in Phase 7 — not as a column reports special-case.
    UI: group by account_type, show computed balance, flat list now
        (tree view once nesting is actually used).

  JOURNALS (§4.4) — five types (sales/purchase/bank/cash/general) + default accounts

  TAXES (§7)
    rate NUMERIC(7,4) CHECK 0–100; tax_scope = sales | purchase | both
    RECOMMENDATION: build `both` regardless of P0 Decision 4 — the column costs
      nothing today and avoids a migration plus a rewrite of the bill-posting rules
      later, whichever way the decision goes.
    Validate the tax account is a liability (collected) or asset (paid) —
      a misconfiguration here SILENTLY CORRUPTS the Balance Sheet.
    project.md §7: tax posts to its OWN CoA account, never folded into Sale Income.

  ANALYTIC ACCOUNTS (§4.6) — name, type (income/expense), department/project

FRONTEND — the reusable list-page pattern all later modules copy
  PageHead (title, count, primary action)
  → FilterBar (search + selects) → DataTable → Pagination
  Short forms (Tax, Analytic Account) → Drawer; longer ones → full page
  Row actions: Edit / Archive / Unarchive, permission-gated
  All four UI states: loading, empty, filtered-empty, error
  <768px: tables become stacked ListCards

SECURITY REQUIREMENTS
   ✓ authenticate → resolveTenant → authorize on EVERY route
   ✓ Every query filtered by organization_id
   ✓ Modify/archive restricted to admin (project.md §3)
   ✓ Archive blocked when referenced by a posted document → 409 naming the blocker
   ✓ Cross-tenant id → 404, not 403
   ✓ sortBy allow-listed

TESTS TO WRITE
   - Full CRUD per resource
   - manager can create but NOT modify or archive
   - Org A cannot touch Org B's records — EVERY endpoint
   - Cross-tenant id returns 404
   - Account parent cycle rejected
   - Parent with a different account_type rejected
   - System account cannot be archived or retyped
   - Duplicate code within an org rejected; permitted ACROSS orgs
   - Tax rate outside 0–100 rejected
   - sortBy allow-list holds against injection

DO NOT
   ✗ Build contacts or products — Phase 6
   ✗ Build journal ENTRIES — Phase 7 (journals ≠ journal entries)
   ✗ Duplicate any Phase 4 shared component
```

---

## Prompt — Phase 6: Master Data B — Contacts, Products & Portal Provisioning

```
[Global Preamble]

TASK — Phase 6. Contacts, Products, Categories, and contact portal logins.
Reference: project.md §4.1, §4.2, §2.2, §3, §7.1 · technicalrequirement.md §6.3, §6.4
· phase.md Phase 6

BUILD
  Migrations: 009_create_contacts, 010_create_product_categories,
              012_create_products, + the deferred users.contact_id FK
  Modules:    src/contacts/ (+ contacts.portal.js), src/products/,
              src/product-categories/
  Routes:     /dashboard/contacts, /products, /product-categories (+ /[id], /new)

Use the SAME standard endpoint set, list contract, and list-page pattern as Phase 5.

FEATURE RULES

  CONTACTS (project.md §4.1)
    name, type (customer/vendor/both), email, mobile, city, state, pincode,
    profile_image_url, portal_access_enabled, status
    UNIQUE (organization_id, lower(email)) WHERE email IS NOT NULL
    Detail page tabs: Details / Invoices / Bills / Payments
    ASSUMPTION: pincode = 6 digits (India, inferred from the §4.1 Pincode field).
    Flag it to me.

  PORTAL PROVISIONING — project.md §2.1, §2.2
    POST /api/contacts/:id/portal-access  { enabled: true|false }   ADMIN ONLY
    Enable:
      1. Require an email — there is nowhere to send an invite otherwise
      2. ONE transaction: create users row with role='user', organization_id,
         contact_id, must_change_password=true, random unusable password
      3. Generate a single-use invite token
      4. COMMIT, THEN email the set-password link
    Disable — REVOKES THE LOGIN:
      increment token_version (invalidates live JWTs instantly — existing mechanism)
      and delete refresh tokens

  PRODUCTS (§4.2)
    name, sku, type (goods/service/combo), category, sales_price, cost_price,
    sales_tax_id, purchase_tax_id, income_account_id, expense_account_id, status
    UNIQUE (organization_id, sku) WHERE sku IS NOT NULL
    project.md §3: the Edit action is visible ONLY to Admin — only Admin may
      change prices
    CRITICAL: archiving or repricing a product NEVER alters historical document
      lines. Lines store the price at time of sale. This is essential for
      accounting correctness — a later price change must not rewrite history.
    AMBIGUITY A4: "combo" is a LABEL ONLY in v1. A true bundle needs a components
      table and line explosion on order. Flag this to me.

SECURITY REQUIREMENTS
   ✓ Everything from Phase 5, plus:
   ✓ Portal provisioning is ADMIN ONLY
   ✓ The random initial password is never returned in a response and never logged
   ✓ Profile image: validate MIME by MAGIC BYTES, not the declared header;
     ≤2MB; jpeg/png/webp only
   ✓ Archiving a contact revokes the portal login but RETAINS the users row
     for audit integrity (ambiguity A11)

TESTS TO WRITE
   - Contact and product CRUD + archive
   - Portal enable creates exactly ONE linked user
   - Portal disable invalidates a LIVE JWT immediately
   - Portal enable without an email is rejected
   - Duplicate email/SKU within an org rejected; permitted ACROSS orgs
   - manager cannot edit a product price
   - Archiving a referenced product returns 409
   - Oversized or spoofed-MIME image rejected
   - Cross-tenant isolation on all endpoints

EXIT CRITERIA — project.md §7.1 must pass end to end:
   create contacts (Azure Furniture, Nimesh Pathak), create products (Wooden Chair),
   CoA already in place. A portal-enabled contact can set a password, log in, and
   land on /portal — NOT /dashboard.

DO NOT
   ✗ Build any transaction document — Phases 8/9
   ✗ Build the portal UI — Phase 12 (this phase only provisions the login)
```

---

## Prompt — Phase 7: ★ LEDGER ENGINE ★ (Correctness Gate)

```
[Global Preamble]

TASK — Phase 7. Double-entry accounting, enforced at BOTH the application and the
database level. THIS IS THE MOST IMPORTANT PHASE IN THE PROJECT.
Reference: project.md §4.5, §9.6 · technicalrequirement.md §5, §3.8 · phase.md Phase 7

WHY THIS MATTERS: every financial number the system will ever produce comes from
this engine. Building the transaction flows on an unverified ledger produces bugs
that surface as WRONG FINANCIAL REPORTS weeks later — at which point every posted
document is suspect and the data may be unrecoverable.
Phases 8 and 9 MUST NOT start until this phase's exit gate passes.

BUILD

1. MIGRATIONS
   016_create_journal_entries
     journal_id, entry_number, entry_date DATE, reference, narration,
     status CHECK IN ('draft','posted','reversed'), is_auto_generated BOOLEAN,
     source_type, source_id, reversed_by_entry_id, posted_at
     UNIQUE (organization_id, entry_number)
     INDEX (organization_id, entry_date)
     INDEX (organization_id, source_type, source_id)

   017_create_journal_entry_lines
     journal_entry_id ON DELETE CASCADE, line_no, account_id, partner_contact_id,
     analytic_account_id, debit NUMERIC(15,2) DEFAULT 0,
     credit NUMERIC(15,2) DEFAULT 0, description
     CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0)
            AND (debit + credit) > 0)
     INDEX (journal_entry_id)
     INDEX (organization_id, account_id, journal_entry_id)   ← hottest report query
     INDEX (organization_id, analytic_account_id) WHERE analytic_account_id IS NOT NULL

   028_ledger_integrity_triggers
     a) DEFERRABLE CONSTRAINT TRIGGER enforcing SUM(debit) = SUM(credit)
        per entry at COMMIT
     b) BEFORE UPDATE OR DELETE trigger on journal_entry_lines raising unless
        the parent entry is still 'draft'
     Application validation alone can be defeated by a bug. These cannot.

2. src/accounting/ — services only, mounts NO routes of its own
   Keeping the engine out of any single transactional module prevents sales/ and
   purchases/ each growing their own copy of double-entry posting.

   accounting.service.js → postJournalEntry(client, payload), EXACT algorithm:
     1. assert lines.length >= 2
     2. per line: exactly one of debit/credit non-zero and positive
     3. SUM(debit) === SUM(credit) compared via money.js   ← project.md §4.5
     4. journal is active and same-org        ← project.md §9.6
     5. every account is active and same-org
     6. consume the JE sequence on the SHARED client
     7. insert journal_entries (status='posted', posted_at=NOW())
     8. bulk-insert journal_entry_lines
     9. write the audit row
    10. return the entry with lines
     Any failure THROWS so the caller's transaction rolls back.

   accounting.service.js → reverseJournalEntry(client, entryId, reason, actor)
     mirror entry (debits↔credits), original → status='reversed',
     set reversed_by_entry_id. NEVER mutate posted lines.

   accounting.repository.js — the reporting primitives (used from Phase 11):
     getAccountBalances(orgId, asOfDate)
     getPeriodMovements(orgId, from, to)
     getAnalyticActuals(orgId, analyticAccountId, from, to)
     getContactOpenItems(orgId, contactId, kind)
     Each is a SINGLE grouped query. NEVER loop accounts and query per account.

   accounting.rules.js — the posting templates of technicalrequirement.md §5.3

3. API — in the journals module
   GET  /api/journal-entries        filtered, paginated
   GET  /api/journal-entries/:id    entry with lines
   POST /api/journal-entries        manual entry, posts immediately
   POST /api/journal-entries/:id/reverse
   THERE IS DELIBERATELY NO PATCH AND NO DELETE ON A POSTED ENTRY.
   Correction is by reversing entry only.

4. FRONTEND
   List: Entry #, Date, Journal, Reference, Debit, Credit, Source, Status.
     Filters: journal, date range, status, auto-generated vs manual
     (project.md §4.5's flag). Default sort entry_date DESC.
   Detail: header + lines with a RUNNING TOTALS FOOTER that stays red until the
     two sides match.
   Manual entry form: dynamic line rows, account + analytic pickers, typing in
     debit clears credit, live balance indicator, SAVE DISABLED WHILE UNBALANCED.
     The client mirrors the server rule purely for fast feedback —
     THE SERVER REMAINS THE AUTHORITY.

5. Post the Phase 5 opening balances as one balancing entry against
   Opening Balance Equity.

TESTS — PRIORITY 1. If only one thing in this project is tested, it is this.
   - Balanced entry posts
   - Unbalanced entry rejected
   - Line with BOTH debit and credit non-zero rejected
   - Line with BOTH zero rejected (DB constraint)
   - Posting to an ARCHIVED account or journal rejected (project.md §9.6)
   - A posted entry cannot be UPDATED (DB trigger)
   - A posted entry cannot be DELETED (DB trigger)
   - Reversal is an exact mirror; original flagged 'reversed'
   - 100 lines at 33.333 sum to the total exactly
   - Concurrent posting produces no duplicate entry numbers (run in PARALLEL)
   - A rolled-back post consumes no sequence number
   - A cross-tenant account in a line is rejected

EXIT GATE — the hardest in the project. ALL of these, no exceptions:
   □ Every Priority-1 test green
   □ The deferrable balance trigger rejects an unbalanced entry inserted via
     RAW SQL, bypassing the application entirely
   □ The immutability trigger rejects a raw UPDATE on a posted line
   □ The manual entry UI cannot submit an unbalanced entry
   □ A reversal round-trip leaves account balances EXACTLY unchanged

DO NOT
   ✗ Allow ANY path that edits a posted entry
   ✗ Implement double-entry posting anywhere except accounting.service.js
   ✗ Skip the database triggers because "the app already validates it"
   ✗ Start Phase 8 before this gate passes
```

---

## Prompt — Phase 8: Purchase Flow

```
[Global Preamble]

TASK — Phase 8. Purchase Order → Vendor Bill → posted journal entry.
Reference: project.md §5.1, §7.2, §8 · technicalrequirement.md §6.9, §5.3 · phase.md Phase 8

PREREQUISITE: Phase 7's exit gate must have passed.

BUILD
  Migrations: 019_create_purchase_orders (+ lines), 020_create_vendor_bills (+ lines)
  Module:     src/purchases/ — purchaseOrders.* and vendorBills.*
  Routes:     /dashboard/purchase-orders, /dashboard/vendor-bills (+ /[id], /new)

ENDPOINTS
  GET/POST      /api/purchase-orders
  GET/PATCH     /api/purchase-orders/:id            (PATCH: draft only)
  POST          /api/purchase-orders/:id/confirm
  POST          /api/purchase-orders/:id/create-bill   ← project.md §5.1.3
  POST          /api/purchase-orders/:id/cancel
  GET/POST      /api/vendor-bills
  GET/PATCH     /api/vendor-bills/:id               (PATCH: draft only)
  POST          /api/vendor-bills/:id/post          ← generates the journal entry
  POST          /api/vendor-bills/:id/cancel        (admin — reverses if posted)

★ BUILD DocumentLineGrid ONCE — THIS IS THE MOST IMPORTANT DESIGN CALL HERE
  Four document types (PO, SO, Bill, Invoice) share IDENTICAL line behaviour:
  product picker → auto-fill price and tax → quantity → per-line subtotal/tax/total
  → add/remove rows.
  Build it ONCE in src/components/transactions/ with a config object:
    { priceField: 'costPrice'|'salesPrice',
      taxField:   'purchaseTaxId'|'salesTaxId',
      contactType:'vendor'|'customer' }
  FOUR NEAR-IDENTICAL COPIES IS THE SINGLE MOST LIKELY FAILURE MODE OF THIS BUILD.
  Also build: DocumentTotals, DocumentHeader, DocumentStatusBar, AttachmentPanel.

POSTING A BILL — ONE transaction, exact order:
   1. authenticate → resolveTenant → authorize('admin','manager')
   2. load with lines; assert status='draft' else 409
   3. assert >=1 line and total_amount > 0
   4. assert vendor active; every account and journal active (project.md §9.6)
   5. RECOMPUTE ALL TOTALS SERVER-SIDE FROM THE LINES
      ← client-sent totals are NEVER trusted
   6. consume the BILL sequence
   7. build journal lines and call accounting.service.postJournalEntry
   8. update bill: status, number, journal_entry_id, amount_due=total, posted_at
   9. if from a PO, set the PO to 'billed' (project.md §5.1.2)
  10. write audit
  11. COMMIT, THEN queue the notification (never inside the transaction)

JOURNAL ENTRY — project.md §5.1.4, must match EXACTLY:
   Dr  Purchase Expense (per line expense_account_id)   untaxed
   Dr  Input Tax Credit  (ONLY if P0 Decision 4 puts purchase tax in scope)  tax
   Cr  Creditors (vendor payable)                        total

ANALYTIC TAGGING — project.md §8, ambiguity A10:
   PO and Bill LINES carry analytic_account_id, and the ledger engine copies it
   onto the journal lines. WITHOUT THIS, Phase 11's Budget Report has no actuals
   at all and project.md §8 is unimplementable.

STATUS LIFECYCLES — project.md §5.1
   PO:   draft → confirmed → billed → cancelled
   Bill: draft → posted → partially_paid → paid → overdue → cancelled

SECURITY REQUIREMENTS
   ✓ authorize('admin','manager') on every route; cancel is admin-only
   ✓ EVERY :id resolved with WHERE id=$1 AND organization_id=$2 — both, always.
     An id alone is never trusted; this closes the cross-tenant IDOR path.
   ✓ Totals recomputed server-side, always
   ✓ A PO already 'billed' cannot be billed again → 409 (prevents double-billing)
   ✓ Edits allowed ONLY in draft
   ✓ Submit disabled in flight — a double-posted bill double-hits the ledger

TESTS TO WRITE
   - PO lifecycle draft → confirmed → billed
   - PO → Bill conversion copies lines and totals
   - Bill posting produces Dr Expense / Cr Creditors EXACTLY
   - Client-supplied totals are ignored; server recomputes
   - Billing an already-billed PO returns 409
   - Non-draft documents cannot be edited
   - A FORCED journal failure rolls back the bill — no orphan document
   - Analytic tag propagates from bill line to journal line
   - Cross-tenant document id returns 404
   - Line grid usable at 375px

EXIT CRITERIA — project.md §7.2 end to end:
   PO for Azure Furniture → convert to Vendor Bill → post → verify the entry
   line by line against §5.3.

DO NOT
   ✗ Re-implement double-entry posting — call accounting.service.js
   ✗ Build four copies of the line grid
   ✗ Trust any total from the client
   ✗ Put the notification email inside the transaction
```

---

## Prompt — Phase 9: Sales Flow

```
[Global Preamble]

TASK — Phase 9. Sales Order → Customer Invoice → posted journal entry.
Reference: project.md §5.2, §7.3 · technicalrequirement.md §6.10, §5.3 · phase.md Phase 9

This is DELIBERATELY A SMALL PHASE. It is the mirror of Phase 8 and must REUSE
Phase 8's components. If you find yourself writing a new line grid, stop.

BUILD
  Migrations: 021_create_sales_orders (+ lines), 022_create_customer_invoices (+ lines)
  Module:     src/sales/ — salesOrders.* and customerInvoices.*
  Routes:     /dashboard/sales-orders, /dashboard/customer-invoices

ENDPOINTS — mirror Phase 8 under /api/sales-orders and /api/customer-invoices,
with POST /api/sales-orders/:id/create-invoice and
     POST /api/customer-invoices/:id/post
Plus POST /api/customer-invoices/:id/send  (email to contact)

DIFFERENCES FROM PHASE 8 — these are the ONLY differences:
  • Contact filter is customers and "both"
  • Price defaults from sales_price; tax from sales_tax_id
  • project.md §5.2.1 explicitly lists TAX on the Sales Order
  • Statuses: draft → confirmed → invoiced → cancelled (project.md §5.2.2)
  • Invoice detail adds "Send to customer" and Print/PDF (P0 Decision 6)
  • project.md §9.7: posting an invoice queues an email to a portal-enabled
    contact, INCLUDING the payment link

JOURNAL ENTRY — project.md §5.2.4, must match EXACTLY:
   Dr  Debtors (customer receivable)              total
   Cr  Sale Income (per line income_account_id)   untaxed
   Cr  Output Tax Payable                         tax

   project.md §7: TAX POSTS TO ITS OWN ACCOUNT. Never fold it into Sale Income.

SECURITY REQUIREMENTS
   Identical to Phase 8. Every :id resolved with BOTH id and organization_id.

TESTS TO WRITE
   - SO lifecycle draft → confirmed → invoiced
   - SO → Invoice conversion
   - Invoice posting produces Dr Debtors / Cr Income + Tax EXACTLY
   - Tax lands on Output Tax Payable, NOT Sale Income
   - Double-post prevented
   - Cross-tenant isolation

EXIT CRITERIA — project.md §7.3 end to end:
   SO for Nimesh Pathak, 5 Office Chairs → generate Customer Invoice → post.
   AND: no duplicated line-grid code — Phase 8's component reused as-is.

DO NOT
   ✗ Copy-paste Phase 8's components — configure and reuse them
   ✗ Fold tax into the income account
```

---

## Prompt — Phase 10: Payments & Settlement

```
[Global Preamble]

TASK — Phase 10. Register payments against bills and invoices, post the entries,
roll document statuses forward.
Reference: project.md §5.1.5, §5.1.6, §5.2.5, §5.2.6 · technicalrequirement.md §6.11
· phase.md Phase 10

BUILD
  Migrations: 023_create_payments, 024_create_payment_allocations
  Module:     src/payments/
  Frontend:   RegisterPaymentModal (from invoice/bill detail), /dashboard/payments

ENDPOINTS
  GET  /api/payments          admin, manager
  POST /api/payments          admin, manager
  GET  /api/payments/:id      admin, manager
  POST /api/payments/:id/cancel   ADMIN — reverses, never deletes

WHY payment_allocations IS REQUIRED, NOT OPTIONAL
  project.md §5.1.6 and §5.2.6 define a 'partially_paid' status. That status is
  only reachable if a payment can be SMALLER than the balance — and a many-to-many
  resolution table is the only correct model, because one payment may settle several
  invoices and one invoice may receive several partial payments.
  CHECK: exactly one of invoice_id / bill_id is non-null.

BUSINESS LOGIC — ONE transaction, exact order:
   1. validate; ASSERT SUM(allocations) === amount
      ← otherwise money posts to the ledger without a home
   2. LOCK each target document FOR UPDATE
      ← TECHNICAL REQUIREMENT: two concurrent payments on one invoice would
        otherwise both read the same amount_due and OVERPAY it
   3. assert each document is same-org, belongs to this contact, and is
      'posted' or 'partially_paid'
   4. assert allocated_amount <= amount_due per document — no overpayment
   5. consume the PAY sequence
   6. post the journal entry via accounting.service.js
   7. update each document: amount_paid += allocated, recompute amount_due,
      set 'paid' at zero else 'partially_paid'
   8. insert allocation rows; write audit
   9. COMMIT

JOURNAL ENTRIES — project.md §5.1.5, §5.2.5:
   Invoice payment received:  Dr Cash/Bank    Cr Debtors
   Bill payment made:         Dr Creditors    Cr Cash/Bank

OVERDUE IS DERIVED, NEVER A MANUAL TRANSITION — technicalrequirement.md §7.8:
   status IN ('posted','partially_paid') AND due_date < CURRENT_DATE AND amount_due > 0
   Expose as a computed isOverdue field and a SQL-side filter.
   NO CRON JOB — a nightly job would only duplicate the predicate and introduce
   drift between runs.

SECURITY REQUIREMENTS
   ✓ authorize('admin','manager') — project.md §3: Contacts NEVER record
     Cash/Bank payments
   ✓ Cancellation is admin-only and REVERSES rather than deletes
   ✓ TECHNICAL REQUIREMENT: the journal type must match the payment method —
     a cash journal for cash, a bank journal for bank. Otherwise the ledger
     credits the WRONG ASSET ACCOUNT.
   ✓ payment_date not in the future
   ✓ amount > 0, max 2 decimals

TESTS TO WRITE
   - Full payment sets 'paid'; partial sets 'partially_paid'
   - Two partials totalling the balance set 'paid'
   - ★ CONCURRENT PAYMENTS ON ONE INVOICE CANNOT OVERPAY IT
     ← run genuinely in parallel (Promise.all), not sequentially
   - Allocation exceeding amount_due rejected
   - Allocations not summing to the payment amount rejected
   - Cash method with a bank journal rejected
   - Payment entry matches §5.3
   - Cancel reverses the entry and restores amount_due exactly
   - Contact role gets 403
   - isOverdue computes correctly across the due-date boundary

DO NOT
   ✗ Skip the FOR UPDATE lock — it is the entire defence against overpayment
   ✗ Delete a payment — cancel and reverse
   ✗ Add a cron job for overdue status
```

---

## Prompt — Phase 11: Budgets & Financial Reports

```
[Global Preamble]

TASK — Phase 11. Balance Sheet, Profit & Loss, Budget Report, plus budgets and charts.
Reference: project.md §6, §8, §4.7, §7.4 · technicalrequirement.md §6.7, §6.13, §5.4
· phase.md Phase 11

BUILD
  Migration: 015_create_budgets
  Modules:   src/budgets/, src/reports/ (reports.balanceSheet.js,
             reports.profitLoss.js, reports.budget.js)
  Routes:    /dashboard/budgets, /dashboard/reports/{balance-sheet,profit-loss,budget}

ENDPOINTS
  GET /api/reports/balance-sheet?asOfDate=          admin, manager
  GET /api/reports/profit-loss?fromDate=&toDate=    admin, manager
  GET /api/reports/budget?budgetId= | range         admin, manager
  GET /api/reports/:type/export                     (P0 Decision 6)
  GET/POST/PATCH /api/budgets

BUDGET ACTUALS — project.md §8, exact algorithm:
   1. read analytic_account_id, period_start, period_end
   2. sum journal_entry_lines WHERE analytic_account_id matches
      AND parent entry status='posted' AND entry_date in the period
   3. SIGN BY ANALYTIC TYPE — expense budgets use SUM(debit)-SUM(credit);
      income budgets the REVERSE.
      TECHNICAL REQUIREMENT: without this, income budgets report NEGATIVE actuals.
   4. variance = planned - actual
      variancePercent = variance / planned * 100, GUARDING planned = 0
      TECHNICAL REQUIREMENT: division by zero.

   ACTUALS ARE COMPUTED ON READ, NEVER STORED. A stored actual_amount drifts the
   moment any entry is posted, reversed, or back-dated.

REPORTS — project.md §6
   • Posted entries ONLY — draft entries never appear in a report
   • SINGLE grouped queries via accounting.repository.js.
     NEVER loop accounts and query per account.
   • Sign correctly: assets/expenses debit-positive;
     liabilities/income/capital credit-positive
   • TECHNICAL REQUIREMENT: net profit for the period FOLDS INTO CAPITAL on the
     Balance Sheet, or Assets will not balance
   • TECHNICAL REQUIREMENT: isBalanced asserts
     Assets = Liabilities + Capital + Net Profit.
     When false the UI shows a WARNING, not a silently wrong report.
   • NO CACHING. project.md §6 calls the Balance Sheet a "real-time snapshot",
     so caching it would be WRONG, not merely premature.

CHARTS — existing SVG library only, NO dependency:
   Net profit trend            AreaChart          from P&L
   Expense breakdown           DonutChart         top 6 + Other
   Budget planned vs actual    GroupedBarChart    from budget report
   Budget consumption          ProgressBar        from budgets list
   Balance Sheet composition   StackedBarChart    from balance sheet
   Series colors from --graph-series-1..8 ONLY (strict.md §1).
   Empty state: "No data for this period" via --graph-empty-text —
     NEVER a blank frame, which reads as a broken component.
   Loading: Skeleton at the chart's EXACT height so the page does not reflow.

BUDGET UI
   List: Name, Period, Analytic Account, Planned, Actual, Variance, Variance %,
         Responsible. Variance as a Pill (over/under) + ProgressBar.
   Form: name, date range, responsible select, ANALYTIC ACCOUNT (required —
         project.md §4.7), planned amount.
   Detail: KPI row (Planned/Actual/Variance) via StatCard, GroupedBarChart by
         month, and the CONTRIBUTING JOURNAL LINES in a DataTable so the number
         is auditable.

REPORT UI
   Date controls (as-of for BS; range for P&L and Budget), grouped table with
   subtotals and a grand total, print-friendly styling, export button.

SECURITY REQUIREMENTS
   ✓ authorize('admin','manager') — project.md §3: Contacts have NO report access
   ✓ Date parameters validated and bounded
   ✓ Every query org-scoped

TESTS TO WRITE
   - ★ BALANCE SHEET BALANCES: Assets = Liabilities + Capital + Net Profit
   - P&L equals income minus expenses for the period
   - Budget actuals equal the sum of analytic-tagged posted lines in the period
   - INCOME budgets report POSITIVE actuals
   - planned_amount = 0 does not divide by zero
   - Reports with no data return ZEROS, not errors
   - DRAFT entries are excluded from every report
   - period_end < period_start rejected
   - Contact role gets 403 on all report endpoints

EXIT CRITERIA — project.md §7.4:
   Select a period, generate all three reports. Balance Sheet balances on a full
   seeded dataset. P&L cross-checks against manually summed journal entries.
   Budget actuals cross-check against the contributing lines shown in the detail view.

DO NOT
   ✗ Store computed actuals
   ✗ Cache report output
   ✗ Include draft entries
   ✗ Add a charting library
```

---

## Prompt — Phase 12: Contact Portal & Payment Gateway

```
[Global Preamble]

TASK — Phase 12. The contact portal and card payment.
Reference: project.md §5.3, §2.2, §3 · technicalrequirement.md §6.12 · phase.md Phase 12

★ THIS IS THE MOST SECURITY-SENSITIVE PHASE IN THE PROJECT. It is the only surface
exposed to users OUTSIDE the organization, and the only one that touches money
movement. Treat every requirement below as mandatory.

PREREQUISITE: P0 Decision 3 (which gateway) must be answered before starting.

BUILD

1. src/portal/ — EVERY endpoint derives contact_id from req.user.contact_id
   GET  /api/portal/summary                    user
   GET  /api/portal/invoices                   user (customer)
   GET  /api/portal/invoices/:id               user (customer)
   GET  /api/portal/bills                      user (vendor)
   POST /api/portal/invoices/:id/pay-intent    user (customer)
   POST /api/portal/payments/verify            user (customer)
   POST /api/webhooks/payments/:provider       PUBLIC, signature-verified

2. src/payments/gateway.adapter.js — a THIN adapter:
   createOrder, verifySignature, fetchPayment.
   Implement Razorpay first (INR context, matching the Pincode-based Indian
   addresses in project.md §4.1), keeping Stripe swappable.
   DO NOT spread gateway calls through the service layer.

3. FRONTEND /[locale]/portal/
   /portal            Total Outstanding, Overdue, Paid This Year + recent documents
   /portal/invoices   customers only, PAY NOW on unpaid invoices
   /portal/bills      vendors only — the full historical statement (§5.3.3)
   /portal/invoices/:id  read-only detail + payment panel
   Navigation from a SEPARATE PORTAL_NAV.
   CONTACTS MUST NEVER SEE ACCOUNTING NAVIGATION.

CARD PAYMENT FLOW — project.md §5.3.4–5.3.5:
   1. authenticate; load the invoice with
      WHERE id=$1 AND organization_id=$2 AND customer_contact_id=$3
      ← ALL THREE CONDITIONS, ALWAYS
   2. assert amount_due > 0 and the status is payable
   3. CREATE THE GATEWAY ORDER FOR amount_due READ FROM THE DATABASE
      ← NEVER from the client. Otherwise a customer pays ₹1 against a ₹26,550 invoice.
   4. the gateway's OWN SDK collects the card ON THE CLIENT.
      CARD DETAILS NEVER TOUCH OUR SERVERS, DOM, OR LOGS.
   5. verify the gateway signature SERVER-SIDE
   6. ONE transaction: insert payment (method='card') → post the entry →
      allocate → update invoice status
   7. IDEMPOTENCY: UNIQUE (organization_id, gateway_payment_id)
      ← the webhook AND the browser callback will BOTH fire for the same payment.
        Without this the invoice is credited TWICE.

JOURNAL ENTRY — project.md §5.3.5:
   Dr  Payment Gateway Clearing    amount
   Cr  Debtors                     amount
   A CLEARING account, not Bank: the money is with the gateway, not in the bank.
   Settlement is a later Bank ← Clearing entry.

SECURITY REQUIREMENTS — the strictest bar in the project
   ✓ authorize('user') PLUS a requirePortalContact guard asserting
     req.user.contact_id exists
   ✓ Vendor-only and customer-only endpoints check contact_type.
     project.md §5.3.7: A VENDOR CALLING pay-intent GETS 403.
     The organization pays vendors, not the reverse.
   ✓ Webhook: signature-verified, replay-protected, and it NEVER trusts an amount
     from the payload — ALWAYS re-fetch from the gateway
   ✓ Rate-limit pay-intent creation
   ✓ NEVER log gateway signatures, card data, or full payloads.
     Audit the existing sanitising logger for these fields specifically.
   ✓ Only the gateway's PUBLISHABLE key is NEXT_PUBLIC_*.
     A secret with that prefix is compiled into the bundle and shipped to
     every visitor.
   ✓ Another contact's invoice id returns 404, never 403

ENVIRONMENT
   PAYMENT_GATEWAY_PROVIDER=razorpay
   PAYMENT_GATEWAY_KEY_ID=
   PAYMENT_GATEWAY_KEY_SECRET=          ← backend only
   PAYMENT_GATEWAY_WEBHOOK_SECRET=      ← backend only
   PAYMENT_CURRENCY=INR
   Extend validateEnv() to FAIL FAST on missing gateway secrets when the portal
   is enabled — a silent misconfiguration means payments APPEAR to work and
   never post.

TESTS TO WRITE
   - A contact sees ONLY their own invoices (project.md §5.3.2)
   - Another contact's invoice id returns 404
   - A vendor sees their bill history and NO Pay Now (project.md §5.3.7)
   - A vendor calling pay-intent gets 403
   - ★ PAY-INTENT USES THE DB AMOUNT, IGNORING A CLIENT-SUPPLIED AMOUNT
   - ★ A WEBHOOK DELIVERED TWICE CREDITS THE INVOICE ONCE
   - A tampered signature is rejected and posts NOTHING
   - A successful payment posts Dr Clearing / Cr Debtors and sets the status
   - A contact gets 403 on EVERY /api/* accounting endpoint
   - No card data or signature appears in ANY log
   - A gateway timeout leaves the invoice untouched

EXIT GATE
   □ project.md §5.3 passes end to end in the gateway's TEST mode
   □ Idempotency proven by REPLAYING the same webhook
   □ Signature tampering proven to post nothing
   □ Amount tampering proven ineffective
   □ Log audit confirms no sensitive payment data is written
   □ A contact provably cannot reach any accounting endpoint or another
     contact's document

DO NOT
   ✗ Accept an amount from the client, ever
   ✗ Handle raw card data anywhere in our code
   ✗ Put a gateway secret in a NEXT_PUBLIC_ variable
   ✗ Skip idempotency because "the callback usually works"
   ✗ Trust a webhook payload's amount
```

---

## Prompt — Phase 13: Dashboard, Notifications, Attachments & Audit

```
[Global Preamble]

TASK — Phase 13. The supporting modules that make the system usable day to day.
Reference: project.md §9.2, §9.5, §9.7 · technicalrequirement.md §6.13, §9.6
· phase.md Phase 13

BUILD
  Migrations: 025_create_attachments, 027_create_notifications
  Modules:    src/dashboard/, src/notifications/, src/attachments/, src/audit/

1. DASHBOARD — TECHNICAL RECOMMENDATION, not in project.md
   project.md has NO dashboard section, but the codebase already ships a full
   dashboard shell and role routing. Populating it with EXISTING data introduces
   NO NEW BUSINESS REQUIREMENTS. Flag it as a recommendation.

   GET /api/dashboard/summary?period=  returns EVERYTHING IN ONE REQUEST:
     KPIs: Total Receivable, Total Payable, Income, Expenses, Net Profit,
           Overdue count
     Series: monthly income vs expense, top-5 customers, receivable aging,
             recent activity
   Six parallel requests on every dashboard load is avoidable.

   Charts: GroupedBarChart (income vs expense), BarChart (aging, top customers),
           DonutChart (expense breakdown), Sparkline (cash trend).
   KPI cards via StatCard (tone="deep" on the primary).
   Period selector applies to EVERY KPI and chart together.

   PORTAL DASHBOARD (role 'user'): Total Outstanding, Overdue, Paid This Year,
   own recent documents — NO ORG-WIDE FIGURES WHATSOEVER.

2. NOTIFICATIONS — project.md §9.7
   Insert a 'pending' row INSIDE the business transaction; dispatch AFTER COMMIT
   via the existing nodemailer setup.
   Triggers: invoice posted (portal-enabled customer), bill posted,
             payment received, portal invite, password reset (exists).
   NO BullMQ, NO Redis. setImmediate dispatch + a retry pass over status='pending'
   is sufficient at this scale and adds no infrastructure.
   AN EMAIL FAILURE NEVER FAILS THE PARENT TRANSACTION.

3. ATTACHMENTS — project.md §9.5
   POST /api/attachments (multipart via multer)
   GET  /api/attachments?entityType=&entityId=
   GET  /api/attachments/:id/download
   DELETE /api/attachments/:id  (admin)

   SECURITY — all four are requirements, not suggestions:
   ✓ Validate MIME by MAGIC BYTES, not the declared header
   ✓ Cap at 5MB
   ✓ Store OUTSIDE the web root with generated names
   ✓ Stream downloads through an AUTHORIZED endpoint — never a public static
     path, or one org's scanned bills become readable by another

4. AUDIT — project.md §9.2
   GET /api/audit-logs?entityType=&entityId=&page=   ADMIN ONLY
   Rows were written by services throughout Phases 3–12.
   UI: filterable table with before/after diff view.

TESTS TO WRITE
   - Dashboard KPIs match report figures for the same period
   - Dashboard is org-scoped — no cross-tenant leakage
   - Portal dashboard shows ONLY the contact's own figures
   - An email failure does NOT roll back the invoice
   - A failed notification is retried and visible to an admin
   - A file with a SPOOFED MIME header is rejected
   - Another org's attachment CANNOT be downloaded
   - Oversized upload rejected
   - manager gets 403 on audit logs
   - Audit rows exist for every posting action from Phases 8–12

DO NOT
   ✗ Add Redis or a job queue
   ✗ Serve attachments from a public static path
   ✗ Let an email failure roll back a financial transaction
   ✗ Show org-wide figures on the portal dashboard
```

---

## Prompt — Phase 14: Hardening, Security, Performance & Release

```
[Global Preamble]

TASK — Phase 14. Make it correct, safe, translated, and fast enough — BEFORE
anyone relies on the numbers.
Reference: technicalrequirement.md §14, §15, §16 · strict.md §6 · phase.md Phase 14

1. INTERNATIONALISATION (strict.md §2)
   □ Every string in all three locale files; key trees IDENTICAL
   □ ★ ACCOUNTING TERMINOLOGY REVIEWED BY SOMEONE WHO KNOWS THE DOMAIN IN
     HINDI AND GUJARATI. Machine translation of Debit, Credit, Accounts
     Receivable, Chart of Accounts, or Analytic Account produces MISLEADING
     text in a financial system.
   □ Glossary committed to src/messages/
   □ Every page verified in all three locales

2. strict.md §6 AUDIT — go through the checklist file by file
   □ No hardcoded hex/rgb/hsl in any new CSS or inline style
   □ No :root variable value modified
   □ New variables derived from the Frozen Lake palette
   □ Only Orbitron and Sora; weights from the defined scale
   □ Neumorphic dual shadows on cards; inset on hover/active
   □ Radii consistent — 6px buttons, 12–14px cards, 20–28px containers
   □ Link/useRouter/usePathname from '@/i18n/navigation' EVERYWHERE
   □ No hardcoded strings in any JSX

3. SECURITY REVIEW
   □ ★ CSRF — the privileged path is cookie-based (sid) and therefore
     CSRF-reachable. CORS restricts origin but is NOT sufficient alone.
     VERIFY the current SameSite setting on sid and the refresh cookie
     (it may already be correct — check before changing), and add a
     double-submit token for state-changing requests on the session path.
     The JWT path used by Contacts is NOT CSRF-exposed, because a browser
     will not attach an Authorization header on its own.
   □ CROSS-TENANT SWEEP — every endpoint, every module, with a foreign org id
   □ PERMISSION SWEEP — every endpoint against all three roles
   □ SQL INJECTION — confirm every value is a bind parameter; confirm every
     dynamic ORDER BY goes through its allow-list
   □ XSS — no dangerouslySetInnerHTML; escape user values in generated PDFs
     and emails, which have NO React protection
   □ LOG AUDIT — no passwords, tokens, OTPs, card data, or gateway signatures
     written anywhere
   □ Rate limits verified on auth, invites, pay-intent, webhooks
   □ Secrets confirmed ABSENT from the frontend bundle — grep the build output
   □ Extend tests/security-audit.test.js to cover the new surface

4. PERFORMANCE
   □ Seed realistic data: 10k journal entries, 1k invoices, 500 contacts
   □ EXPLAIN ANALYZE the report aggregations; confirm the §4.3 composite
     indexes are actually used
   □ Confirm every list is server-paginated with COUNT(*) OVER() in the SAME query
   □ Confirm no N+1 in document lists
   □ ★ Confirm NO email, PDF, or gateway call sits inside a transaction —
     a held transaction blocks the sequence lock and SERIALISES ALL POSTING
   □ Verify pool max:20 against Postgres max_connections
   □ next/dynamic on chart-heavy report pages
   □ REMOVE any index not justified in §4.3 — over-indexing slows the
     posting path

5. DATA INTEGRITY VERIFICATION — run the full lifecycle on seeded data:
   master data → PO → Bill → payment → SO → Invoice → payment →
   portal card payment → all three reports
   □ Balance Sheet balances
   □ Every posted document has EXACTLY ONE journal entry
   □ ★ Every journal entry balances — verify with a RAW SQL SWEEP,
     not through the app
   □ NO GAPS in any document sequence
   □ Audit log covers every state change

6. RELEASE READINESS
   □ .env.example complete for both apps — PLACEHOLDERS ONLY, never real secrets
   □ Migrations run clean on a fresh production-shaped database
   □ Backup and restore procedure documented AND TESTED
   □ README updated with setup, migration, and seeding steps
   □ project.md §10 decisions all marked resolved
   □ Known limitations documented, including everything in
     technicalrequirement.md §18.3

DELIVERABLE
   A written report: what was found, what was fixed, what remains open,
   and an explicit go/no-go recommendation.

DO NOT
   ✗ Sign off with any Priority-1 or Priority-2 test failing
   ✗ Ship with machine-translated accounting terminology
   ✗ Add an index without measuring first
```

---

# §C. Reusable Sub-Prompts

Small prompts for recurring work inside any phase.

### C.1 — Add a new master-data module

```
[Global Preamble]

Add the <RESOURCE> master-data module, following EXACTLY the pattern established
in Phase 5 (src/accounts/ is the reference implementation).

Fields per project.md §<X>: <list>

Deliver:
  Backend  src/<resource>/ — the five-file module
           Standard endpoints: GET list, GET :id, POST (admin+manager),
           PATCH (admin), PATCH /archive (admin), PATCH /unarchive (admin)
           Standard list contract with search, filter, sort (ALLOW-LISTED),
           pagination
  DB       migration <NNN>_create_<resource>, org-scoped uniques,
           org-leading indexes, status CHECK, audit columns
  Frontend /dashboard/<resource> list page + form, i18n keys in all three
           locale files FIRST, new styles in the existing feature CSS file
  Tests    CRUD, permissions per role, cross-tenant isolation, duplicate checks,
           archive-when-referenced → 409

Reuse every Phase 4 shared component. Do not create a new list, filter,
or pagination component.
```

### C.2 — Add a document type (header + lines)

```
[Global Preamble]

Add <DOCUMENT>, following the pattern from Phase 8 (src/purchases/).

REUSE DocumentLineGrid with config — DO NOT write a new line grid.

Deliver:
  DB       header + lines migrations, ON DELETE CASCADE header→lines,
           status CHECK per project.md §<X>, org-scoped unique number
  Backend  CRUD (edit draft only), status transitions, POST /:id/post which
           recomputes totals SERVER-SIDE and calls accounting.service.postJournalEntry
           inside ONE withTransaction
  Journal  <exact Dr/Cr per project.md §<X>>
  Frontend list + detail + form, all four UI states, <768px line cards
  Tests    lifecycle, posting entry correctness, client-total rejection,
           double-post prevention, rollback leaves no orphan, cross-tenant 404
```

### C.3 — Debug a ledger imbalance

```
[Global Preamble]

The Balance Sheet is not balancing. Diagnose in this order and report findings
BEFORE changing anything:

1. RAW SQL, bypassing the app — find entries where SUM(debit) != SUM(credit):
     SELECT journal_entry_id, SUM(debit), SUM(credit)
     FROM journal_entry_lines GROUP BY 1 HAVING SUM(debit) != SUM(credit);
   If this returns rows, the deferrable trigger from Phase 7 is missing
   or disabled.
2. Are draft entries leaking into the report? Reports must filter status='posted'.
3. Is net profit folded into Capital? Without it, Assets never balance.
4. Are account signs correct? Assets/expenses debit-positive;
   liabilities/income/capital credit-positive.
5. Are opening balances posted as a balancing entry against Opening Balance
   Equity, or left as a loose column?
6. Is any money arithmetic bypassing money.js? Grep for parseFloat / Number( on
   monetary fields.
7. Is a rounding difference accumulating? Rounding is once per line after tax,
   NEVER on running totals.

Report the root cause and propose a fix. Do not "fix" it by adjusting a balancing
figure — that hides a real bug in the ledger.
```

### C.4 — Security review of one module

```
[Global Preamble]

Security-review src/<module>/ against technicalrequirement.md §14 and report
findings ranked by severity. Do not fix anything yet.

Check:
  □ authenticate → resolveTenant → authorize on EVERY route
  □ EVERY query filtered by organization_id
  □ EVERY :id resolved with WHERE id=$1 AND organization_id=$2
  □ Cross-tenant returns 404, not 403
  □ organization_id / role / totals never read from the request body
  □ Every value a bind parameter; dynamic ORDER BY allow-listed
  □ Money via money.js only
  □ Multi-write operations inside withTransaction
  □ Audit written in the same transaction
  □ No secret, token, OTP, or card data in any log
  □ Rate limits where appropriate
  □ Validation before business logic; errors[] returned, raw SQL never leaked
  □ Permission matrix matches project.md §3
```

### C.5 — strict.md compliance pass on a page

```
[Global Preamble]

Audit <page/component> against strict.md §6 and report violations with file:line.

  COLORS      No hex/rgb/rgba/hsl; all via var(--*); no :root value modified;
              new variables derived from the Frozen Lake palette
  MULTILINGUAL All strings via t(); keys in en.json, hi.json AND gu.json with
              matching trees; Link/useRouter/usePathname from '@/i18n/navigation';
              no inline strings in JSX
  DESIGN      Neumorphic dual shadows on cards; inset on hover/active;
              surface hierarchy respected; radii consistent
  TYPOGRAPHY  Orbitron and Sora only; correct assignment; weights from the scale;
              fallback families included; sizes on the scale

Report violations first. Fix only after I confirm.
```

---

# §D. How to Use These Prompts

1. **Always prepend §A.** Every phase prompt assumes it.
2. **One phase at a time.** Do not combine prompts — each phase's exit gate exists to catch problems before they compound.
3. **Do not skip Phase 0.** Decision 5 (multi-currency) is the most expensive thing in this project to retrofit.
4. **Do not skip Phase 7's gate.** It is the correctness gate for every financial number the system will ever produce.
5. **When the model asks a question, answer it** rather than telling it to assume. `project.md` is the authority; an invented business requirement is worse than a delay.
6. **Update `project.md` §10** as decisions get resolved. It is a living document; `technicalrequirement.md`, `phase.md`, and this file all defer to it.

---

*Execution prompts for `Doc/phase.md`. `project.md` remains the sole authority on WHAT is built; `strict.md` on HOW the frontend is written.*
