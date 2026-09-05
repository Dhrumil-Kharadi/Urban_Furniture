# Urban Furniture — Accounting System
## Project Specification (project.md)

> This document is the single source of truth before coding starts. It merges the original problem statement, your interpretation, and the gaps identified. Every place where this spec **deviates** from the original doc is explicitly flagged as `⚠️ DEVIATION`. Every place that was **missing** from your original interpretation is flagged as `🆕 ADDED`.

---

## 1. Project Overview

Urban Furniture needs an accounting system that lets a furniture business:
- Maintain core master data (Contacts, Products, Chart of Accounts, Budgets, Journals, Analytic Accounts).
- Record Purchases, Sales, and Payments using that master data.
- Auto-generate double-entry journal entries behind every transaction.
- Auto-generate financial reports: Balance Sheet, Profit & Loss, Budget Report.
- Allow external parties (customers/vendors) limited, self-service portal access to their own invoices/bills and let them pay online.

The system is **multi-tenant**: each Business Owner who signs up gets their own isolated Organization. Nobody else can self-register — everyone else is invited/created by someone inside that Organization.

---

## 2. Actors / Roles

| Role | Who | How they get an account |
|---|---|---|
| **Admin (Business Owner)** | Owns the org | **Only role that can self-signup** 🆕(your addition, not in doc, but adopted as the design decision) |
| **Invoicing User (Accountant)** | Employee handling books | Created by Admin from inside the org |
| **Contact (Customer / Vendor / Both)** | External party | Auto-created as a **login-enabled** user when Admin/Accountant creates their Contact master record 🆕 (clarified below) |
| **System** | Not a human | Background logic: validation, tax computation, ledger updates, report generation |

### 2.1 Signup & Login Flow 🆕 ADDED (was missing detail)
- **Signup screen** exists only for Business Owner. On signup, a new **Organization** is created with this user as Admin.
- **Login screen** for everyone else requires: **Organization ID/slug + Username/Email + Password**. There is no public "Sign Up" path for Accountant or Contact roles.
- Admin creates Accountant accounts from an internal "Users" screen (name, email, temp password/invite link).
- Contact login credentials are generated **automatically** the moment a Contact master record is created with an email address — the system emails them a "set your password" / invite link. ⚠️ **DEVIATION-CLARIFICATION**: the doc never explicitly states Contacts get auto-created logins; it only says "Contact users can be created when creating Contact Master data." This spec treats that as: Contact record creation = user account creation (toggleable per contact, in case some vendors/customers never need portal access — see 2.2).
- **Password reset** flow needed for all three roles (🆕 not mentioned in doc, standard requirement).

### 2.2 Contact Portal Access Toggle 🆕 ADDED
- When creating a Contact, Admin/Accountant should have a checkbox: **"Enable portal access for this contact"**. If unchecked, no login is created — the contact stays a pure master-data record (needed for one-off vendors/customers who'll never log in).

---

## 3. Role-Permission Matrix (Corrected & Complete)

This is the core deliverable you asked for. Columns = capability, Rows = role. **⚠️ = deviates from your original interpretation, corrected to match the doc's explicit wording** unless stated otherwise.

| Module / Action | Admin | Accountant (Invoicing User) | Contact (Customer/Vendor) |
|---|---|---|---|
| **Contacts** – Create | ✅ | ✅ | ❌ |
| **Contacts** – Modify | ✅ | ✅ (implied, since Accountant manages day-to-day master data entry — 🆕 clarify explicitly in build) | ❌ |
| **Contacts** – Archive/Delete | ✅ | ❌ | ❌ |
| **Products** – Create | ✅ | ✅ | ❌ |
| **Products** – Modify (incl. price changes) | ✅ | ❌ ⚠️ **This corrects your original interpretation.** Doc states Admin = "Creates/Modify/Archived Master Data" while Accountant = "Creates Master Data" only — Modify is **not** listed under Accountant. So per the doc, **only Admin can change product prices**, not the Accountant. | ❌ |
| **Products** – Archive/Delete | ✅ | ❌ | ❌ |
| **Chart of Accounts** – Create/Modify/Archive | ✅ | ✅ Create only (same pattern as above) | ❌ |
| **Journals** – Create/Modify/Archive | ✅ | ✅ Create only | ❌ |
| **Journal Entries** – Create (via transactions) | ✅ | ✅ | ❌ |
| **Analytic Accounts** – Create/Modify | ✅ | ✅ Create only | ❌ |
| **Budgets** – Create/Modify | ✅ | ✅ Create only | ❌ |
| **Purchase Order** – Create/Edit | ✅ | ✅ | ❌ |
| **Vendor Bill** – Create (convert from PO), Register Payment | ✅ | ✅ | ❌ |
| **Sales Order** – Create/Edit | ✅ | ✅ | ❌ |
| **Customer Invoice** – Generate, Receive Payment | ✅ | ✅ | ❌ |
| **Payments** – Record (Cash/Bank) on behalf of org | ✅ | ✅ | ❌ |
| **Reports** – Balance Sheet, P&L, Budget Report | ✅ View | ✅ View | ❌ |
| **User Management** – Create Accountant accounts | ✅ | ❌ | ❌ |
| **Own Invoices/Bills** – View | N/A (sees all, via reports/transactions) | N/A | ✅ Only their own |
| **Own Purchase History (Vendor)** – View all bills raised against them over time | N/A | N/A | ✅ (Vendor only) |
| **Payment** – Pay an invoice/bill via portal (Card) | ❌ | ❌ | ✅ |
| **Payment methods** – Cash/Bank recording | ✅ | ✅ | ❌ (Contacts only use Card via portal — Cash/Bank entries are recorded internally by Admin/Accountant when payment is received offline) |

📌 **Action item for you:** Decide and confirm explicitly whether you want to follow the doc strictly (Accountant = Create only, no Modify/Delete on any master data) or intentionally deviate (e.g., "Accountant can modify products but not delete"). This spec defaults to **following the doc strictly**, but flag it if you want to keep your original rule — it just needs to be a conscious decision recorded here, not an implicit one in code.

---

## 4. Master Data Modules (Full Field List)

### 4.1 Contact Master
- Name
- Type: Customer / Vendor / Both
- Email
- Mobile
- Address: City, State, Pincode
- Profile Image
- 🆕 Portal Access: Enabled / Disabled (toggle, see 2.2)
- 🆕 Status: Active / Archived
- 🆕 Login credentials (auto-generated if portal access enabled)

### 4.2 Product Master
- Product Name
- Type: Goods / Service / Combo
- Sales Price
- Cost (Purchase Price)
- Category
- 🆕 SKU/Product Code (recommended for real-world use, not in doc but practically needed)
- 🆕 Status: Active / Archived
- 🆕 Tax Rate applicable to this product (needed — see Section 7, Tax was missing)

### 4.3 Chart of Accounts (CoA) Master
- Account Name
- Type: Asset / Liability / Expense / Income / Capital
- 🆕 Parent Account (optional, for hierarchical CoA — recommended, not mandatory for v1)
- 🆕 Opening Balance (needed to seed the Balance Sheet correctly)

### 4.4 Journal Master
- Journal Name
- Type (Sales / Purchase / Bank / Cash)
- Default Accounts (which CoA accounts this journal posts to by default)

### 4.5 Journal Entry (system + manual)
- Journal
- Date
- Reference (e.g., Invoice/Bill number)
- Journal Items: each item = Account, Debit, Credit
- 🆕 Auto-generated flag (True if created by system from a transaction, False if manually entered)
- Rule: **Total Debit must equal Total Credit** for every entry (double-entry validation — 🆕 explicitly called out, since doc mentions "double-entry accounting principle" but doesn't state the validation rule outright)

### 4.6 Analytic Account
- Analytic Account Name
- Type: Income / Expense
- 🆕 Linked Department/Project name (optional descriptive field)

### 4.7 Budget
- Budget Name
- Period (start date – end date)
- Responsible Person
- 🆕 Linked Analytic Account (mandatory — doc states budgets are "created by defining the budget period, planned amount, and the relevant analytic account," so **Planned Amount** and **Analytic Account link** were missing fields in the earlier list and are added here)
- 🆕 Planned Amount
- 🆕 Actual Amount (system-computed, by aggregating actual journal entries tagged to the linked Analytic Account, for Budget Report comparison)

---

## 5. Transaction Flow (Detailed, Step by Step)

### 5.1 Purchase Flow
1. Accountant/Admin selects **Vendor** (from Contact master) + **Products** + Quantity + Unit Price → creates **Purchase Order (PO)**.
2. 🆕 PO Status lifecycle: `Draft → Confirmed → Billed → Cancelled`
3. On goods receipt, PO is converted into a **Vendor Bill**.
   - Vendor Bill fields: Invoice Date, Due Date, Amount, Tax, Reference to PO.
4. System auto-generates Journal Entry on Bill confirmation:
   - Debit: Purchase Expense (or Inventory/Asset if tracking stock)
   - Credit: Creditor (Vendor's Accounts Payable)
5. Payment registered against the Bill (Cash or Bank):
   - Debit: Creditor
   - Credit: Cash/Bank
6. 🆕 Bill Status lifecycle: `Draft → Posted → Partially Paid → Paid → Overdue`

### 5.2 Sales Flow
1. Accountant/Admin selects **Customer** + Products + Quantity + Unit Price + **Tax** → creates **Sales Order (SO)**.
2. 🆕 SO Status lifecycle: `Draft → Confirmed → Invoiced → Cancelled`
3. SO is converted into a **Customer Invoice**.
4. System auto-generates Journal Entry on Invoice confirmation:
   - Debit: Debtor (Customer's Accounts Receivable)
   - Credit: Sales Income (+ Tax Payable if applicable)
5. Payment received (Cash/Bank, **or Card via Contact Portal** — your addition):
   - Debit: Cash/Bank
   - Credit: Debtor
6. 🆕 Invoice Status lifecycle: `Draft → Posted → Partially Paid → Paid → Overdue`

### 5.3 Contact Portal Payment Flow (Your Addition — Detailed) 🆕
1. Customer/Vendor logs into portal using their Contact credentials.
2. Customer sees list of their own **unpaid/paid Invoices**.
3. Vendor sees list of all **Bills** the org has raised against them historically (their "statement of account").
4. Customer selects an unpaid invoice → clicks "Pay Now" → enters card details → payment gateway processes it.
5. On successful payment:
   - System auto-creates the Payment record (method = Card) and the matching Journal Entry (Debit: Bank/Payment Gateway Clearing Account, Credit: Debtor).
   - Invoice status updates to Paid/Partially Paid.
6. 🆕 Needs a **Payment Gateway integration decision** (e.g., Stripe/Razorpay) — not specified yet, flag as an open decision.
7. 🆕 Vendors are **not** shown a "Pay Now" button — vendors only view; only customers pay (org pays vendors, not the reverse). Confirm this assumption.

---

## 6. Reporting Requirements (Was Missing — Now Detailed)

| Report | Who Can View | What It Shows | Trigger |
|---|---|---|---|
| **Balance Sheet** | Admin, Accountant | Real-time Assets, Liabilities, Capital as of selected date | User selects "as-of date" |
| **Profit & Loss (P&L)** | Admin, Accountant | Sales Income − (Purchases + Expenses) = Net Profit, for a selected period | User selects date range |
| **Budget Report** | Admin, Accountant | Planned Amount vs Actual Amount per Budget/Analytic Account, variance % | User selects Budget or period |

🆕 All reports should support **date-range filters** and ideally **export (PDF/Excel)** — not stated in doc but standard expectation; flag as v1/v2 decision.

---

## 7. Tax Handling (Missing — Now Added) 🆕

- Doc only mentions Sales Order has a "Tax" field and "System... computes taxes" — no detail was given, and none was in your interpretation either.
- **Needed decisions before coding:**
  - Tax master: Tax Name, Rate %, Type (GST/VAT/etc., since this is India-context per your Contact address fields using Pincode).
  - Where tax is set: per-Product (default) with ability to override per-Sales Order line.
  - Is tax applicable only on Sales, or also on Purchases (input tax credit)? Doc only mentions it on Sales Order — confirm if Purchase side needs tax too for correct P&L.
  - Tax must post to its own CoA account (e.g., "Output Tax Payable") in the journal entry, not lumped into Sales Income.

---

## 8. Budget ↔ Analytic Account Linkage (Missing — Now Added) 🆕

- Every transaction (Purchase/Sale/Expense) should optionally allow tagging an **Analytic Account** (e.g., "Retail Store - Ahmedabad" or "Online Sales").
- Budget Report compares the **Planned Amount** on a Budget against the **sum of actual journal entries** tagged with that Budget's linked Analytic Account, within the Budget's Period.
- This is what makes the Budget Report meaningful — without transaction-level Analytic tagging, there's no "actual" figure to compare against "planned."

---

## 9. Non-Functional / Missing Practical Requirements 🆕 ADDED

These weren't in the doc or your interpretation but are needed for a working system:

1. **Multi-tenancy / Data isolation**: every table needs an `organization_id` — no Org should ever see another Org's data.
2. **Audit Trail**: who created/modified/archived what and when (important for accounting integrity).
3. **Numbering sequences**: PO numbers, Invoice numbers, Bill numbers should auto-increment per Organization (e.g., INV/2026/00001).
4. **Currency**: assume single currency (INR) unless multi-currency is required — confirm.
5. **Attachments**: ability to attach a scanned bill/receipt to a Vendor Bill (common real-world need).
6. **Validation rules**:
   - Can't delete a Product/Contact that has existing transactions — only Archive.
   - Debit = Credit enforced on every Journal Entry.
   - Can't post to an Archived account/journal.
7. **Notifications**: email Contact when a new Invoice/Bill is generated and portal-payable (needed to make the portal flow useful).

---

## 10. Open Decisions You Should Confirm Before Coding (FINALIZED — Phase 0)

| # | Decision Needed | Options | Confirmed Decision | Notes / Impact |
|---|---|---|---|---|
| 1 | Accountant permission on Modify (Products/CoA/etc.) | Follow doc strictly (Create only) vs. allow price edits | **Create Only** (Doc Strict) | Manager (`accountant`) has create-only permissions on master data. Modify/Archive/Delete is strictly reserved for Admin (`admin`). |
| 2 | Contact portal access | Auto-create login for every Contact vs. toggle per Contact | **Automatic for all contacts (No toggle)** | When any Contact record with an email is created, an account is auto-provisioned and an invite/login email is dispatched immediately. |
| 3 | Payment gateway for Card payments | Stripe / Razorpay / other | Deferred to Phase 12 | Gateway adapter will be built in Phase 12 (Razorpay/Stripe). |
| 4 | Tax applicability | Sales only vs. Sales + Purchase | **Sales + Purchase (Both)** | Built with `tax_scope` covering both. Tax accounts (Output Tax Payable / Input Tax Credit) both post to GL. |
| 5 | Multi-currency support | Single currency (INR) vs. multi-currency | **Single Currency (INR)** | Default `currency_code = 'INR'` across the organization and all monetary columns. |
| 6 | Report export | In-app view only vs. PDF/Excel in v1 | Deferred to Phase 11 | Decided at Phase 11 boundary. |
| 7 / A1 | Inventory/stock tracking depth | Simple cost tracking vs. full stock ledger | **Out of scope for v1** | No physical stock ledger or stock movement entries. Bill posting debits Purchase Expense. |
| §3.2 | Role Mapping | Admin/Accountant/Contact → DB roles | **Admin = `admin`, Accountant = `manager`, Contact = `user`** | Preserves existing DB check constraint and auth model. `super_admin` reserved for platform operations. |
| A3 | Fiscal Year Start Month | Configurable month | **April (Month 4)** | Standard Indian FY (April 1 to March 31). Stored as `fiscal_year_start_month = 4` in `organizations`. |
| A8 | Tax / GST Compliance Scope | Full Indian GST rules vs. basic rates | **Basic tax rate percentages** | Basic tax percentages (e.g. 5%, 12%, 18%, 28%) applied per line item; no statutory state-wise POS split engines. |

---

## 11. Summary of Your Original Interpretation vs. Final Spec

| Your Original Point | Verdict | Correction Applied |
|---|---|---|
| Only Business Owner can signup, others added into org | ✅ Kept | Detailed the login/invite flow |
| Invoicing User adds vendors/customers as Contacts | ✅ Correct | — |
| Accountant can modify prices, not add/delete | ⚠️ Corrected | Per doc: Accountant can only **Create**; Modify/Archive is Admin-only. Flagged as open decision #1 if you want to keep your rule instead |
| Contact (Customer) sees own invoices/purchases | ✅ Correct | — |
| Contact (Vendor) sees all bills raised against them | ✅ Correct | — |
| Card payment via contact login | ✅ Correct, kept as-is | Detailed the full flow, flagged gateway choice as open decision |
| Tax handling | ❌ Missing | Added Section 7 |
| Reporting detail | ❌ Missing | Added Section 6 |
| Budget–Analytic linkage | ❌ Missing | Added Section 8 |
| Transaction status lifecycles | ❌ Missing | Added throughout Section 5 |
| Multi-tenancy, audit trail, numbering | ❌ Missing | Added Section 9 |

---

*This document should be treated as living — update it as decisions in Section 10 get finalized, before starting implementation.*
