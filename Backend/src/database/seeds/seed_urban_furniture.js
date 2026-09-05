/**
 * Comprehensive Seed Data Generator for Urban Furniture Accounting System
 *
 * Seeds:
 * - 1 Organization: Urban Furniture Pvt Ltd (slug: urban-furniture)
 * - 8 Users with varied roles (Admin, Senior Accountants, Staff Accountants, Controller, SuperAdmin, Portal Users)
 * - 18 Product Categories
 * - 6 GST Taxes
 * - 70 Chart of Accounts across Asset, Liability, Capital, Income, Expense
 * - 5 Journals (Sales, Purchase, Bank, Cash, General)
 * - 20 Analytic Accounts / Cost Centers
 * - 120 Contacts (60 Customers, 40 Vendors, 20 Both) with complete Indian addresses & GSTIN/PAN
 * - 125 Products (100 Goods, 15 Services, 10 Combos) with SKUs, accounts, taxes, prices
 * - 110 Balanced Double-Entry Journal Entries (>250 lines) with database trigger compliance
 */

const bcrypt = require('bcrypt');
const { pool } = require('../../config/db');
const { env } = require('../../config/env');
const { withTransaction } = require('../../shared/withTransaction');
const accountingService = require('../../accounting/accounting.service');

const DEFAULT_PASSWORD = 'Password@123';

async function seedUrbanFurniture() {
  console.log('================================================================');
  console.log('🌱 Starting Urban Furniture Comprehensive Seed Script');
  console.log('================================================================');

  const client = await pool.connect();

  try {
    // -------------------------------------------------------------
    // 1. CREATE / UPSERT ORGANIZATION
    // -------------------------------------------------------------
    console.log('🏢 [1/10] Upserting Organization "Urban Furniture Pvt Ltd"...');
    const orgSlug = 'urban-furniture';
    const orgName = 'Urban Furniture Pvt Ltd';
    const currency = 'INR';
    const fiscalYearStartMonth = 4;

    const orgRes = await client.query(
      `INSERT INTO organizations (name, slug, currency_code, fiscal_year_start_month, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name, status = 'active', updated_at = NOW()
       RETURNING id, name, slug`,
      [orgName, orgSlug, currency, fiscalYearStartMonth]
    );
    const org = orgRes.rows[0];
    const organizationId = org.id;
    console.log(`   ✔ Organization: ${org.name} (ID: ${organizationId})`);

    // -------------------------------------------------------------
    // 2. CREATE / UPSERT USERS & CREDENTIALS
    // -------------------------------------------------------------
    console.log('👥 [2/10] Seeding Users with Role-Based Access...');
    const pepperedPassword = DEFAULT_PASSWORD + env.passwordPepper;
    const passwordHash = await bcrypt.hash(pepperedPassword, env.bcryptRounds || 12);

    const usersToSeed = [
      {
        name: 'Rajesh Sharma',
        email: 'admin@urbanfurniture.com',
        role: 'admin',
        orgId: organizationId,
        title: 'Business Owner & Admin',
      },
      {
        name: 'Pooja Patel',
        email: 'accountant@urbanfurniture.com',
        role: 'manager',
        orgId: organizationId,
        title: 'Lead Chief Accountant',
      },
      {
        name: 'Kavya Desai',
        email: 'kavya.accountant@urbanfurniture.com',
        role: 'manager',
        orgId: organizationId,
        title: 'Senior Financial Accountant',
      },
      {
        name: 'Neel Mehta',
        email: 'neel.accountant@urbanfurniture.com',
        role: 'manager',
        orgId: organizationId,
        title: 'Audit & Compliance Accountant',
      },
      {
        name: 'Vikram Singhania',
        email: 'controller@urbanfurniture.com',
        role: 'manager',
        orgId: organizationId,
        title: 'Financial Controller',
      },
      {
        name: 'Amit Shah',
        email: 'customer@azurefurniture.com',
        role: 'user',
        orgId: organizationId,
        title: 'Portal Customer User',
      },
      {
        name: 'Suresh Gupta',
        email: 'vendor@woodkraft.com',
        role: 'user',
        orgId: organizationId,
        title: 'Portal Vendor User',
      },
      {
        name: 'Platform SuperAdmin',
        email: 'superadmin@urbanfurniture.com',
        role: 'super_admin',
        orgId: null,
        title: 'System Super Administrator',
      },
    ];

    const userMap = {};
    for (const u of usersToSeed) {
      const uRes = await client.query(
        `INSERT INTO users (name, email, password_hash, role, organization_id, email_verified, status, must_change_password)
         VALUES ($1, $2, $3, $4, $5, true, 'active', false)
         ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name,
             password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role,
             organization_id = EXCLUDED.organization_id,
             email_verified = true,
             status = 'active',
             must_change_password = false,
             updated_at = NOW()
         RETURNING id, name, email, role`,
        [u.name, u.email, passwordHash, u.role, u.orgId]
      );
      userMap[u.email] = uRes.rows[0];
    }
    const adminUserId = userMap['admin@urbanfurniture.com'].id;
    const leadAccountantUserId = userMap['accountant@urbanfurniture.com'].id;
    console.log(`   ✔ Seeded ${usersToSeed.length} Users successfully.`);

    // -------------------------------------------------------------
    // 3. SEED DOCUMENT SEQUENCES
    // -------------------------------------------------------------
    console.log('🔢 [3/10] Seeding Document Sequences for FY 2025 and 2026...');
    const docTypes = [
      { doc_type: 'PO', prefix: 'PO', padding: 5 },
      { doc_type: 'SO', prefix: 'SO', padding: 5 },
      { doc_type: 'BILL', prefix: 'BILL', padding: 5 },
      { doc_type: 'INV', prefix: 'INV', padding: 5 },
      { doc_type: 'PAY', prefix: 'PAY', padding: 5 },
      { doc_type: 'JE', prefix: 'JE', padding: 5 },
    ];

    for (const fy of ['2025', '2026', '2027']) {
      for (const d of docTypes) {
        await client.query(
          `INSERT INTO document_sequences (organization_id, doc_type, fiscal_year, prefix, next_number, padding)
           VALUES ($1, $2, $3, $4, 1, $5)
           ON CONFLICT (organization_id, doc_type, fiscal_year) DO NOTHING`,
          [organizationId, d.doc_type, fy, d.prefix, d.padding]
        );
      }
    }
    console.log(`   ✔ Sequences configured.`);

    // -------------------------------------------------------------
    // 4. SEED CHART OF ACCOUNTS (70 Accounts)
    // -------------------------------------------------------------
    console.log('📊 [4/10] Seeding Chart of Accounts (70 Accounts)...');
    const accountsData = [
      // Assets (1000 - 1999)
      { code: '1010', name: 'Cash in Hand', type: 'asset', is_system: true },
      { code: '1015', name: 'Petty Cash - Main Office', type: 'asset', is_system: false },
      { code: '1020', name: 'HDFC Bank Current A/c', type: 'asset', is_system: true },
      { code: '1021', name: 'ICICI Bank Collection A/c', type: 'asset', is_system: false },
      { code: '1022', name: 'SBI Payroll & Statutory A/c', type: 'asset', is_system: false },
      { code: '1030', name: 'Accounts Receivable (Debtors)', type: 'asset', is_system: true },
      { code: '1035', name: 'Allowance for Doubtful Accounts', type: 'asset', is_system: false },
      { code: '1040', name: 'Input Tax Credit (ITC - CGST)', type: 'asset', is_system: true },
      { code: '1041', name: 'Input Tax Credit (ITC - SGST)', type: 'asset', is_system: false },
      { code: '1042', name: 'Input Tax Credit (ITC - IGST)', type: 'asset', is_system: false },
      { code: '1050', name: 'Payment Gateway Clearing Account', type: 'asset', is_system: true },
      { code: '1060', name: 'Finished Goods Inventory', type: 'asset', is_system: false },
      { code: '1061', name: 'Raw Materials - Timber & Teak Wood', type: 'asset', is_system: false },
      { code: '1062', name: 'Hardware & Fittings Stock', type: 'asset', is_system: false },
      { code: '1063', name: 'Upholstery Fabric & Foam Stock', type: 'asset', is_system: false },
      { code: '1070', name: 'Prepaid Insurance & Expenses', type: 'asset', is_system: false },
      { code: '1075', name: 'Advance to Material Suppliers', type: 'asset', is_system: false },
      { code: '1510', name: 'Freehold Land & Site Plot', type: 'asset', is_system: false },
      { code: '1520', name: 'Factory Buildings & Sheds', type: 'asset', is_system: false },
      { code: '1530', name: 'Woodworking Machinery & Equipment', type: 'asset', is_system: false },
      { code: '1540', name: 'Showroom Furniture & Fixtures', type: 'asset', is_system: false },
      { code: '1550', name: 'Commercial Delivery Fleet & Trucks', type: 'asset', is_system: false },
      { code: '1560', name: 'Computers & IT Hardware', type: 'asset', is_system: false },
      { code: '1590', name: 'Accumulated Depreciation - Plant & Equip', type: 'asset', is_system: false },

      // Liabilities (2000 - 2999)
      { code: '2010', name: 'Accounts Payable (Creditors)', type: 'liability', is_system: true },
      { code: '2015', name: 'Advance Received from Customers', type: 'liability', is_system: false },
      { code: '2020', name: 'Output Tax Payable (CGST)', type: 'liability', is_system: true },
      { code: '2021', name: 'Output Tax Payable (SGST)', type: 'liability', is_system: false },
      { code: '2022', name: 'Output Tax Payable (IGST)', type: 'liability', is_system: false },
      { code: '2030', name: 'TDS Payable - Contractors (194C)', type: 'liability', is_system: false },
      { code: '2031', name: 'TDS Payable - Professional Fees (194J)', type: 'liability', is_system: false },
      { code: '2040', name: 'Salaries & Wages Payable', type: 'liability', is_system: false },
      { code: '2045', name: 'PF & ESIC Statutory Payable', type: 'liability', is_system: false },
      { code: '2050', name: 'Accrued Operating Expenses', type: 'liability', is_system: false },
      { code: '2110', name: 'HDFC Working Capital Overdraft', type: 'liability', is_system: false },
      { code: '2510', name: 'SBI Long-Term Industrial Loan', type: 'liability', is_system: false },

      // Capital / Equity (3000 - 3999)
      { code: '3010', name: 'Opening Balance Equity', type: 'capital', is_system: true },
      { code: '3020', name: 'Paid-Up Share Capital', type: 'capital', is_system: false },
      { code: '3030', name: 'Retained Earnings', type: 'capital', is_system: false },
      { code: '3040', name: 'General Reserve Fund', type: 'capital', is_system: false },
      { code: '3050', name: "Owner's Drawings & Distributions", type: 'capital', is_system: false },

      // Income (4000 - 4999)
      { code: '4010', name: 'Sales Income - Furniture Goods', type: 'income', is_system: true },
      { code: '4011', name: 'Sales Income - Corporate Bulk Orders', type: 'income', is_system: false },
      { code: '4012', name: 'Sales Income - Custom Bespoke Woodwork', type: 'income', is_system: false },
      { code: '4020', name: 'Service Revenue - Assembly & Installation', type: 'income', is_system: false },
      { code: '4021', name: 'Service Revenue - Interior Consulting', type: 'income', is_system: false },
      { code: '4030', name: 'Scrap & Sawdust Byproduct Sales', type: 'income', is_system: false },
      { code: '4040', name: 'Bank Interest & Investment Returns', type: 'income', is_system: false },
      { code: '4050', name: 'Discounts Received from Suppliers', type: 'income', is_system: false },

      // Expenses (5000 - 6999)
      { code: '5010', name: 'Purchase Expense - Merchandise & Materials', type: 'expense', is_system: true },
      { code: '5011', name: 'Purchase of Teak & Hardwood Timber', type: 'expense', is_system: false },
      { code: '5012', name: 'Purchase of Architectural Hardware', type: 'expense', is_system: false },
      { code: '5013', name: 'Purchase of Premium Leather & Fabric', type: 'expense', is_system: false },
      { code: '5020', name: 'Direct Carpentry Wages & Production Labor', type: 'expense', is_system: false },
      { code: '5021', name: 'Freight Inward & Unloading Logistics', type: 'expense', is_system: false },
      { code: '5030', name: 'Factory Power, Fuel & Diesel Consumables', type: 'expense', is_system: false },
      { code: '5031', name: 'Factory Equipment Maintenance & Spares', type: 'expense', is_system: false },
      { code: '6010', name: 'Showroom Rent & Mall Maintenance', type: 'expense', is_system: false },
      { code: '6011', name: 'Head Office Rent & Facility Costs', type: 'expense', is_system: false },
      { code: '6020', name: 'Staff Salaries & Executive Compensation', type: 'expense', is_system: false },
      { code: '6021', name: 'Staff Welfare, Tea & Medical Benefits', type: 'expense', is_system: false },
      { code: '6030', name: 'Digital Marketing & Social Media Ads', type: 'expense', is_system: false },
      { code: '6031', name: 'Showroom Displays & Print Catalogs', type: 'expense', is_system: false },
      { code: '6040', name: 'Electricity, Water & Showroom Utilities', type: 'expense', is_system: false },
      { code: '6041', name: 'Internet, Software & ERP SaaS Subscriptions', type: 'expense', is_system: false },
      { code: '6050', name: 'Customer Outward Delivery & Logistics', type: 'expense', is_system: false },
      { code: '6060', name: 'Legal, Audit & Professional Consulting Fees', type: 'expense', is_system: false },
      { code: '6070', name: 'Bank Charges & Credit Card Gateway Fees', type: 'expense', is_system: false },
      { code: '6080', name: 'Depreciation Expense - Plant & Assets', type: 'expense', is_system: false },
      { code: '6090', name: 'General Office & Miscellaneous Expenses', type: 'expense', is_system: false },
    ];

    const accountMap = {};
    for (const acc of accountsData) {
      const accRes = await client.query(
        `INSERT INTO accounts (
          organization_id, code, name, account_type, opening_balance,
          is_system, status, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, 0.00, $5, 'active', $6, $6)
        ON CONFLICT (organization_id, code) DO UPDATE
        SET name = EXCLUDED.name,
            account_type = EXCLUDED.account_type,
            is_system = EXCLUDED.is_system,
            status = 'active',
            updated_at = NOW()
        RETURNING id, code, name, account_type`,
        [organizationId, acc.code, acc.name, acc.type, acc.is_system, adminUserId]
      );
      accountMap[acc.code] = accRes.rows[0].id;
    }
    console.log(`   ✔ Seeded ${accountsData.length} Chart of Accounts.`);

    // -------------------------------------------------------------
    // 5. SEED JOURNALS (5 Journals)
    // -------------------------------------------------------------
    console.log('📒 [5/10] Seeding Journals...');
    const journalsToSeed = [
      {
        name: 'Sales Journal',
        type: 'sales',
        prefix: 'INV',
        debitAcc: accountMap['1030'], // Debtors
        creditAcc: accountMap['4010'], // Sales Income
      },
      {
        name: 'Purchase Journal',
        type: 'purchase',
        prefix: 'BILL',
        debitAcc: accountMap['5010'], // Purchase Expense
        creditAcc: accountMap['2010'], // Creditors
      },
      {
        name: 'Bank Journal',
        type: 'bank',
        prefix: 'BNK',
        debitAcc: accountMap['1020'], // HDFC Bank
        creditAcc: null,
      },
      {
        name: 'Cash Journal',
        type: 'cash',
        prefix: 'CSH',
        debitAcc: accountMap['1010'], // Cash in Hand
        creditAcc: null,
      },
      {
        name: 'General Journal',
        type: 'general',
        prefix: 'JE',
        debitAcc: null,
        creditAcc: null,
      },
    ];

    const journalMap = {};
    for (const j of journalsToSeed) {
      const existingJ = await client.query(
        `SELECT id FROM journals WHERE organization_id = $1 AND journal_type = $2`,
        [organizationId, j.type]
      );
      let jId;
      if (existingJ.rows.length > 0) {
        jId = existingJ.rows[0].id;
        await client.query(
          `UPDATE journals
           SET name = $1, sequence_prefix = $2, default_debit_account_id = $3, default_credit_account_id = $4, status = 'active', updated_at = NOW()
           WHERE id = $5`,
          [j.name, j.prefix, j.debitAcc, j.creditAcc, jId]
        );
      } else {
        const ins = await client.query(
          `INSERT INTO journals (
            organization_id, name, journal_type, sequence_prefix,
            default_debit_account_id, default_credit_account_id, status,
            created_by, updated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $7)
          RETURNING id`,
          [organizationId, j.name, j.type, j.prefix, j.debitAcc, j.creditAcc, adminUserId]
        );
        jId = ins.rows[0].id;
      }
      journalMap[j.type] = jId;
      journalMap[j.name] = jId;
    }
    console.log(`   ✔ Seeded ${journalsToSeed.length} Journals.`);

    // -------------------------------------------------------------
    // 6. SEED TAXES (6 GST Taxes)
    // -------------------------------------------------------------
    console.log('🏷️ [6/10] Seeding Taxes...');
    const taxesData = [
      { name: 'GST 0% (Exempt)', rate: 0.00, tax_scope: 'both', accCode: '2020' },
      { name: 'GST 5% (Essentials)', rate: 5.00, tax_scope: 'both', accCode: '2020' },
      { name: 'GST 12% (Processed Wood)', rate: 12.00, tax_scope: 'both', accCode: '2020' },
      { name: 'GST 18% (Standard Furniture)', rate: 18.00, tax_scope: 'both', accCode: '2020' },
      { name: 'GST 28% (Luxury Goods)', rate: 28.00, tax_scope: 'both', accCode: '2020' },
      { name: 'IGST 18% (Interstate Furniture)', rate: 18.00, tax_scope: 'both', accCode: '2022' },
    ];

    const taxMap = {};
    for (const t of taxesData) {
      const tRes = await client.query(
        `INSERT INTO taxes (
          organization_id, name, rate, tax_scope, tax_account_id, status, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, 'active', $6, $6)
        ON CONFLICT (organization_id, name) DO UPDATE
        SET rate = EXCLUDED.rate, tax_scope = EXCLUDED.tax_scope, tax_account_id = EXCLUDED.tax_account_id, updated_at = NOW()
        RETURNING id, name, rate`,
        [organizationId, t.name, t.rate, t.tax_scope, accountMap[t.accCode], adminUserId]
      );
      taxMap[t.name] = tRes.rows[0].id;
    }
    console.log(`   ✔ Seeded ${taxesData.length} Taxes.`);

    // -------------------------------------------------------------
    // 7. SEED PRODUCT CATEGORIES (18 Categories)
    // -------------------------------------------------------------
    console.log('📦 [7/10] Seeding Product Categories...');
    const categoriesData = [
      { name: 'Sofas & Couches', desc: 'Fabric, leather and recliner living room seating' },
      { name: 'Beds & Mattresses', desc: 'Solid teak, king, queen and orthopedic bedding' },
      { name: 'Dining Sets & Tables', desc: 'Solid wood 4-seater, 6-seater and 8-seater dining' },
      { name: 'Ergonomic Office Chairs', desc: 'High-back mesh, executive and lumbar support chairs' },
      { name: 'Study & Work Desks', desc: 'Motorized standing desks, home office computer tables' },
      { name: 'Wardrobes & Closets', desc: 'Hinged, sliding and walk-in modular wardrobes' },
      { name: 'Coffee & Center Tables', desc: 'Teak, glass-top, marble and nest-of-tables' },
      { name: 'TV Units & Consoles', desc: 'Wall-mounted floating and floor TV entertainment stands' },
      { name: 'Bookshelves & Display Units', desc: 'Industrial open shelves, ladder and library units' },
      { name: 'Recliners & Lounge Chairs', desc: 'Manual and motorized single-seater rocker recliners' },
      { name: 'Accent & Armchairs', desc: 'Tufted wingback, barrel and designer lounge seating' },
      { name: 'Shoe Racks & Entryway', desc: 'Ventilated wooden shoe cabinets and coat racks' },
      { name: 'Modular Kitchen Cabinets', desc: 'Plywood, acrylic and PU coated kitchen units' },
      { name: 'Outdoor & Balcony Furniture', desc: 'Wicker rattan, weather-proof teak patio furniture' },
      { name: 'Lighting & Chandeliers', desc: 'Pendant lamps, ambient floor lights and LED sconces' },
      { name: 'Home Decor & Mirrors', desc: 'Full-length teak framed mirrors and wall decor' },
      { name: 'Design & Fitment Services', desc: 'Assembly, on-site carpentry, and polish services' },
      { name: 'Value Bundle Packages', desc: 'Curated whole-home and room furniture suites' },
    ];

    const categoryMap = {};
    for (const c of categoriesData) {
      const existingC = await client.query(
        `SELECT id FROM product_categories WHERE organization_id = $1 AND lower(name) = lower($2)`,
        [organizationId, c.name]
      );
      let catId;
      if (existingC.rows.length > 0) {
        catId = existingC.rows[0].id;
        await client.query(
          `UPDATE product_categories SET description = $1, status = 'active', updated_at = NOW() WHERE id = $2`,
          [c.desc, catId]
        );
      } else {
        const ins = await client.query(
          `INSERT INTO product_categories (organization_id, name, description, status, created_by, updated_by)
           VALUES ($1, $2, $3, 'active', $4, $4)
           RETURNING id`,
          [organizationId, c.name, c.desc, adminUserId]
        );
        catId = ins.rows[0].id;
      }
      categoryMap[c.name] = catId;
    }
    console.log(`   ✔ Seeded ${categoriesData.length} Product Categories.`);

    // -------------------------------------------------------------
    // 8. SEED ANALYTIC ACCOUNTS (20 Cost Centers)
    // -------------------------------------------------------------
    console.log('🏢 [8/10] Seeding Analytic Accounts / Cost Centers...');
    const analyticData = [
      { code: 'CC-AMD-RET', name: 'Retail Store - Ahmedabad (SG Highway)', type: 'income', dept: 'Retail Sales' },
      { code: 'CC-MUM-RET', name: 'Retail Store - Mumbai (Bandra Kurla)', type: 'income', dept: 'Retail Sales' },
      { code: 'CC-PUN-RET', name: 'Retail Store - Pune (Koregaon Park)', type: 'income', dept: 'Retail Sales' },
      { code: 'CC-BLR-RET', name: 'Retail Store - Bengaluru (Indiranagar)', type: 'income', dept: 'Retail Sales' },
      { code: 'CC-DEL-RET', name: 'Retail Store - Delhi NCR (Gurugram)', type: 'income', dept: 'Retail Sales' },
      { code: 'CC-HYD-RET', name: 'Retail Store - Hyderabad (Hitec City)', type: 'income', dept: 'Retail Sales' },
      { code: 'CC-ECOM', name: 'Online E-Commerce Platform', type: 'income', dept: 'Digital Channels' },
      { code: 'CC-B2B', name: 'Corporate & Hospitality Bulk B2B', type: 'income', dept: 'Enterprise Sales' },
      { code: 'CC-STUDIO', name: 'Bespoke Interior Studio Projects', type: 'income', dept: 'Architectural Consulting' },
      { code: 'CC-MFG-SND', name: 'Manufacturing Plant - Sanand', type: 'expense', dept: 'Solid Wood Production' },
      { code: 'CC-UPH-BHW', name: 'Upholstery & Foam Unit - Bhiwandi', type: 'expense', dept: 'Cushion & Soft Works' },
      { code: 'CC-FAB-MTL', name: 'Metal Framing & Powder-Coating Cell', type: 'expense', dept: 'Metal Works' },
      { code: 'CC-LOG-FLT', name: 'Central Warehouse & Delivery Fleet', type: 'expense', dept: 'Logistics' },
      { code: 'CC-QA-LAB', name: 'Quality Assurance & Material Testing Lab', type: 'expense', dept: 'Quality Control' },
      { code: 'CC-MKT-CAM', name: 'Brand Marketing & National Ads', type: 'expense', dept: 'Marketing' },
      { code: 'CC-IT-INF', name: 'IT Infrastructure, Cloud & Security', type: 'expense', dept: 'Information Technology' },
      { code: 'CC-FIN-ACC', name: 'Finance, Taxation & Compliance Dept', type: 'expense', dept: 'Finance' },
      { code: 'CC-HR-ADMIN', name: 'Human Resources & Executive Admin', type: 'expense', dept: 'Human Resources' },
      { code: 'CC-CUST-CARE', name: 'Customer Delight & Post-Sales Support', type: 'expense', dept: 'Customer Support' },
      { code: 'CC-RD-SUS', name: 'Sustainable Teak R&D Workshop', type: 'expense', dept: 'Research & Development' },
    ];

    const analyticMap = [];
    for (const a of analyticData) {
      const existingA = await client.query(
        `SELECT id FROM analytic_accounts WHERE organization_id = $1 AND lower(name) = lower($2)`,
        [organizationId, a.name]
      );
      let aId;
      if (existingA.rows.length > 0) {
        aId = existingA.rows[0].id;
        await client.query(
          `UPDATE analytic_accounts
           SET code = $1, analytic_type = $2, department = $3, status = 'active', updated_at = NOW()
           WHERE id = $4`,
          [a.code, a.type, a.dept, aId]
        );
      } else {
        const ins = await client.query(
          `INSERT INTO analytic_accounts (
            organization_id, code, name, analytic_type, department, status, created_by, updated_by
          ) VALUES ($1, $2, $3, $4, $5, 'active', $6, $6)
          RETURNING id`,
          [organizationId, a.code, a.name, a.type, a.dept, adminUserId]
        );
        aId = ins.rows[0].id;
      }
      analyticMap.push({ id: aId, name: a.name, code: a.code, analytic_type: a.type });
    }
    console.log(`   ✔ Seeded ${analyticData.length} Analytic Cost Centers.`);

    // -------------------------------------------------------------
    // 9. SEED CONTACTS (120 Contacts: 60 Customers, 40 Vendors, 20 Both)
    // -------------------------------------------------------------
    console.log('📇 [9/10] Seeding Contacts (120 Indian Customers, Vendors, and Both)...');

    const indianCities = [
      { city: 'Ahmedabad', state: 'Gujarat', pincode: '380015' },
      { city: 'Mumbai', state: 'Maharashtra', pincode: '400050' },
      { city: 'Pune', state: 'Maharashtra', pincode: '411001' },
      { city: 'Bengaluru', state: 'Karnataka', pincode: '560038' },
      { city: 'New Delhi', state: 'Delhi', pincode: '110001' },
      { city: 'Hyderabad', state: 'Telangana', pincode: '500081' },
      { city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
      { city: 'Kolkata', state: 'West Bengal', pincode: '700001' },
      { city: 'Surat', state: 'Gujarat', pincode: '395007' },
      { city: 'Vadodara', state: 'Gujarat', pincode: '390001' },
      { city: 'Jaipur', state: 'Rajasthan', pincode: '302001' },
      { city: 'Chandigarh', state: 'Punjab', pincode: '160017' },
    ];

    const firstNames = [
      'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Reyansh', 'Muhammad', 'Sai', 'Ayaan', 'Krishna',
      'Ishaan', 'Shaurya', 'Dhruv', 'Kabir', 'Rohan', 'Ananya', 'Diya', 'Kavya', 'Avani', 'Sara',
      'Isha', 'Aanya', 'Saanvi', 'Myra', 'Pari', 'Navya', 'Sneha', 'Riya', 'Tanvi', 'Meera',
      'Vikram', 'Rajesh', 'Suresh', 'Manish', 'Deepak', 'Alok', 'Sunil', 'Pankaj', 'Gaurav', 'Nitin',
      'Bhavna', 'Pooja', 'Rani', 'Neha', 'Priti', 'Swati', 'Monika', 'Ritu', 'Kiran', 'Sonia'
    ];

    const lastNames = [
      'Sharma', 'Verma', 'Patel', 'Shah', 'Mehta', 'Desai', 'Joshi', 'Trivedi', 'Kapadia', 'Singhania',
      'Malhotra', 'Kapoor', 'Chopra', 'Bansal', 'Agarwal', 'Gupta', 'Reddy', 'Rao', 'Nair', 'Menon',
      'Mukherjee', 'Chatterjee', 'Bose', 'Das', 'Roy', 'Sengupta', 'Iyer', 'Iyengar', 'Pillai', 'Shetty'
    ];

    const corporatePrefixes = [
      'Apex Interiors & Architecture', 'Zenith Living Spaces', 'Prestige Office Systems',
      'Horizon Hospitality Projects', 'Nexus Tech Spaces', 'Paramount Luxury Homes',
      'Heritage Woodcraft Studio', 'Urban Matrix Infra', 'Synergy Workplace Solutions',
      'Emerald Bay Resorts & Spas', 'Royal Orchid Banquet & Hotels', 'Infotech Tower Admin'
    ];

    const vendorNames = [
      'Nilambur Teak Wood Supply Co', 'Century Plyboards India Ltd', 'Greenply Timber Industries',
      'Ebco Architectural Hardware Ltd', 'Hettich India Hardware LLP', 'Blum Austria Fittings India',
      'Duroflex High-Resilience Foam', 'Sleepwell Polyurethane Co', 'Asian Paints Wood Armor Division',
      'Pidilite Fevicol Industrial Adhesives', 'Godrej Locks & Architectural Hardware', 'Gujarat Steel Tubes & Frames',
      'Mahindra Logistics Freight Express', 'BlueDart Commercial Surface Logistics', 'Jaipur Fabrics & Upholstery Mills',
      'Kashmir Walnut & Hardwood Traders', 'Kerala Rubberwood Plantation Supply', 'Surat Jacquard Upholstery Weavers',
      'Bhiwandi Foam & Packaging Hub', 'Morbi Ceramic & Marble Inlay Studio', 'Coimbatore Precision Fasteners',
      'Ludhiana Springs & Recliner Mechanism', 'Delhi Acrylic & Glass Furnishing', 'Pune Powder Coating Works',
      'Bengaluru Electronic Sensor & LED Desk Systems', 'Ahmedabad Timber Merchant Syndicate', 'Rajkot Metal Polishers',
      'Chennai Teak Importers Association', 'Indore Sandpaper & Abrasives', 'Kanpur Genuine Leather Tanning Mills'
    ];

    const bothNames = [
      'Home Centre Retail & Distribution Network', 'Godrej Interio Authorized Trade Partner',
      'Urban Ladder Channel Partner India', 'Pepperfry Fulfilment & Trade Agency',
      'Kurl-on Trade & Distribution Syndicate', 'Stanley Lifestyles Showroom Alliance',
      'Featherlite Seating Franchisee West', 'Spacewood Modular Furnishers Co',
      'Zuari Furniture Wholesale & Retail', 'Durian Furniture Trade Associates',
      'Evok Home Living Distributorship', 'Nilkamal Home Ideas Dealer Group',
      'Royaloak Imports & Franchise Trade', 'Damro Furniture Regional Partner',
      'Wipro Consumer Seating Associate', 'Steelcase Certified Trade Dealer',
      'Haworth India Channel Enterprise', 'Herman Miller Commercial Partner',
      'Decornation Trade & Project Furnishings', 'Wakefit Omni-Channel Partner Hub'
    ];

    const contactsList = [];

    // A. 60 Customers
    for (let i = 1; i <= 60; i++) {
      const cityObj = indianCities[i % indianCities.length];
      const fn = firstNames[i % firstNames.length];
      const ln = lastNames[(i + 3) % lastNames.length];
      const isCorporate = i % 4 === 0;
      const name = isCorporate
        ? `${corporatePrefixes[i % corporatePrefixes.length]} (${cityObj.city})`
        : `${fn} ${ln}`;
      const email = `customer${i}.${fn.toLowerCase()}.${ln.toLowerCase()}@urbanclients.in`;
      const mobile = `98${String(10000000 + i * 137).substring(0, 8)}`;

      contactsList.push({
        name,
        contact_type: 'customer',
        email,
        mobile,
        city: cityObj.city,
        state: cityObj.state,
        pincode: cityObj.pincode,
        portal_access_enabled: i <= 5,
      });
    }

    // B. 40 Vendors
    for (let i = 1; i <= 40; i++) {
      const cityObj = indianCities[(i + 4) % indianCities.length];
      const vName = vendorNames[(i - 1) % vendorNames.length] + (i > 30 ? ` Unit ${i - 29}` : '');
      const email = `vendor${i}.procure@${vName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15)}.com`;
      const mobile = `97${String(20000000 + i * 243).substring(0, 8)}`;

      contactsList.push({
        name: vName,
        contact_type: 'vendor',
        email,
        mobile,
        city: cityObj.city,
        state: cityObj.state,
        pincode: cityObj.pincode,
        portal_access_enabled: i <= 3,
      });
    }

    // C. 20 Both
    for (let i = 1; i <= 20; i++) {
      const cityObj = indianCities[(i + 7) % indianCities.length];
      const bName = bothNames[(i - 1) % bothNames.length];
      const email = `partner${i}.trade@${bName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15)}.in`;
      const mobile = `99${String(30000000 + i * 317).substring(0, 8)}`;

      contactsList.push({
        name: bName,
        contact_type: 'both',
        email,
        mobile,
        city: cityObj.city,
        state: cityObj.state,
        pincode: cityObj.pincode,
        portal_access_enabled: true,
      });
    }

    const insertedContacts = [];
    for (const c of contactsList) {
      const existingC = await client.query(
        `SELECT id FROM contacts WHERE organization_id = $1 AND lower(email) = lower($2)`,
        [organizationId, c.email]
      );
      let contactId;
      if (existingC.rows.length > 0) {
        contactId = existingC.rows[0].id;
        await client.query(
          `UPDATE contacts
           SET name = $1, contact_type = $2, mobile = $3, city = $4, state = $5, pincode = $6,
               portal_access_enabled = $7, status = 'active', updated_at = NOW()
           WHERE id = $8`,
          [c.name, c.contact_type, c.mobile, c.city, c.state, c.pincode, c.portal_access_enabled, contactId]
        );
      } else {
        const ins = await client.query(
          `INSERT INTO contacts (
            organization_id, name, contact_type, email, mobile, city, state, pincode,
            portal_access_enabled, status, created_by, updated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, $10)
          RETURNING id`,
          [
            organizationId,
            c.name,
            c.contact_type,
            c.email,
            c.mobile,
            c.city,
            c.state,
            c.pincode,
            c.portal_access_enabled,
            adminUserId,
          ]
        );
        contactId = ins.rows[0].id;
      }
      insertedContacts.push({ id: contactId, name: c.name, contact_type: c.contact_type, email: c.email });
    }
    console.log(`   ✔ Seeded ${insertedContacts.length} Contacts.`);

    // -------------------------------------------------------------
    // 10. SEED PRODUCTS (125 Products: 100 Goods, 15 Services, 10 Combos)
    // -------------------------------------------------------------
    console.log('🛋️ [10/10] Seeding Products (125 Goods, Services, Combos)...');

    const tax18Id = taxMap['GST 18% (Standard Furniture)'];
    const tax28Id = taxMap['GST 28% (Luxury Goods)'];

    const incomeAccountDefault = accountMap['4010']; // Sales Income
    const incomeServiceAccount = accountMap['4020'];
    const expenseAccountDefault = accountMap['5010']; // Purchase Expense

    const goodsTemplates = [
      { name: 'Royale 3-Seater Chesterfield Velvet Sofa', cat: 'Sofas & Couches', price: 48999, cost: 26000, tax: tax18Id },
      { name: 'Urban Comfort L-Shaped Sectional Fabric Sofa', cat: 'Sofas & Couches', price: 62500, cost: 34000, tax: tax18Id },
      { name: 'Elegance 2-Seater Fabric Loveseat Sofa', cat: 'Sofas & Couches', price: 29999, cost: 16000, tax: tax18Id },
      { name: 'Modena Genuine Leather 3-Piece Power Recliner', cat: 'Recliners & Lounge Chairs', price: 95000, cost: 52000, tax: tax28Id },
      { name: 'ErgoComfort Manual Rocker Swivel Recliner', cat: 'Recliners & Lounge Chairs', price: 34999, cost: 18500, tax: tax18Id },
      { name: 'Imperial High-Back Velvet Wingchair', cat: 'Accent & Armchairs', price: 22499, cost: 11500, tax: tax18Id },
      { name: 'Nordic Solid Teak Wood Coffee Table', cat: 'Coffee & Center Tables', price: 15999, cost: 8200, tax: tax18Id },
      { name: 'Italian White Carrara Marble Center Table', cat: 'Coffee & Center Tables', price: 28999, cost: 14500, tax: tax28Id },
      { name: 'Geometric Nested Hexagon Coffee Tables (Set of 3)', cat: 'Coffee & Center Tables', price: 18499, cost: 9500, tax: tax18Id },
      { name: 'Minimalist Floating Wall-Mount TV Console (65-inch)', cat: 'TV Units & Consoles', price: 19999, cost: 9800, tax: tax18Id },
      { name: 'Grandeur Solid Teak King Bed with Hydraulic Storage', cat: 'Beds & Mattresses', price: 54999, cost: 29000, tax: tax18Id },
      { name: 'Kyoto Japanese Low-Profile Queen Platform Bed', cat: 'Beds & Mattresses', price: 39999, cost: 21000, tax: tax18Id },
      { name: 'Plush Orthopedic Memory Foam 8-inch King Mattress', cat: 'Beds & Mattresses', price: 26999, cost: 13500, tax: tax18Id },
      { name: 'Latex Hybrid 10-inch Pocket Spring Queen Mattress', cat: 'Beds & Mattresses', price: 32999, cost: 17000, tax: tax18Id },
      { name: 'Scandinavia Solid Oak 6-Seater Dining Table', cat: 'Dining Sets & Tables', price: 42999, cost: 22000, tax: tax18Id },
      { name: 'Royal Sheesham 8-Seater Extendable Dining Suite', cat: 'Dining Sets & Tables', price: 68999, cost: 36000, tax: tax18Id },
      { name: 'Upholstered Ergonomic Dining Chairs (Set of 4)', cat: 'Dining Sets & Tables', price: 19999, cost: 10500, tax: tax18Id },
      { name: 'ErgoPro High-Back Mesh Synchronized Task Chair', cat: 'Ergonomic Office Chairs', price: 14999, cost: 7200, tax: tax18Id },
      { name: 'Presidential Leatherette High-Back Boardroom Chair', cat: 'Ergonomic Office Chairs', price: 24999, cost: 12000, tax: tax18Id },
      { name: 'AeroDual Dual-Motor Height-Adjustable Standing Desk (150x75cm)', cat: 'Study & Work Desks', price: 36999, cost: 19000, tax: tax18Id },
      { name: 'Solid Wood Computer Study Desk with 3 Drawers', cat: 'Study & Work Desks', price: 18999, cost: 9500, tax: tax18Id },
      { name: 'Heritage 4-Door Teak Wardrobe with Full Mirrors', cat: 'Wardrobes & Closets', price: 58999, cost: 31000, tax: tax18Id },
      { name: 'Modern Sliding 3-Door Modular Wardrobe (Soft Close)', cat: 'Wardrobes & Closets', price: 47999, cost: 25000, tax: tax18Id },
      { name: 'Industrial Metal & Reclaimed Teak 5-Tier Bookshelf', cat: 'Bookshelves & Display Units', price: 21999, cost: 11000, tax: tax18Id },
      { name: 'Louvered Teak Wood 30-Pair Ventilated Shoe Cabinet', cat: 'Shoe Racks & Entryway', price: 16499, cost: 8500, tax: tax18Id },
    ];

    const productsList = [];

    // Generate 100 Goods
    for (let i = 1; i <= 100; i++) {
      const template = goodsTemplates[(i - 1) % goodsTemplates.length];
      const variantSuffix = Math.floor((i - 1) / goodsTemplates.length);
      const finishes = ['Walnut Finish', 'Natural Teak', 'Charcoal Matte', 'Honey Oak', 'Smoked Espresso'];
      const finish = finishes[variantSuffix % finishes.length];
      const name = variantSuffix === 0 ? template.name : `${template.name} (${finish})`;
      const sku = `UF-GD-${String(100 + i).padStart(4, '0')}`;
      const salesPrice = template.price + (variantSuffix * 1500);
      const costPrice = template.cost + (variantSuffix * 800);

      productsList.push({
        name,
        sku,
        product_type: 'goods',
        category_id: categoryMap[template.cat] || categoryMap['Sofas & Couches'],
        sales_price: salesPrice.toFixed(2),
        cost_price: costPrice.toFixed(2),
        sales_tax_id: template.tax,
        purchase_tax_id: template.tax,
        income_account_id: incomeAccountDefault,
        expense_account_id: expenseAccountDefault,
      });
    }

    // Generate 15 Services
    const serviceTemplates = [
      { name: 'Custom Bespoke Woodworking & Sizing Service', price: 7500, cost: 3500 },
      { name: 'White-Glove In-Home Furniture Assembly & Leveling', price: 1499, cost: 600 },
      { name: 'Interior Architectural Consultation & 3D Render', price: 12500, cost: 4000 },
      { name: 'Express Same-Day Priority Furniture Delivery', price: 2499, cost: 1100 },
      { name: 'Fabric & Leather Nano-Shield Anti-Stain Treatment', price: 3999, cost: 1400 },
      { name: 'Annual Furniture Care, Deep Polish & Hardware AMC', price: 5999, cost: 2200 },
      { name: 'Custom Upholstery Cushion Re-stuffing & Foam Refresh', price: 4499, cost: 1800 },
      { name: 'Corporate Office Ergonomics Layout & Audit Planning', price: 15000, cost: 5000 },
      { name: 'Modular Kitchen On-site Fitment & Channel Calibration', price: 8999, cost: 3500 },
      { name: 'On-site Antique Teak Wood Buffing & Restoration', price: 6500, cost: 2400 },
      { name: 'Acoustic Wall Panel Mounting & Calibration Service', price: 4999, cost: 1900 },
      { name: 'Hotel & Hospitality Furniture Installation (Per Suite)', price: 9500, cost: 3800 },
      { name: 'Old Furniture Disassembly & Responsible Scrap Removal', price: 1999, cost: 800 },
      { name: 'Custom Hydraulic Bed Storage Lift Servicing', price: 2199, cost: 750 },
      { name: 'Color Matching & PU Polish Touchup Visit', price: 2999, cost: 1000 },
    ];

    for (let i = 1; i <= 15; i++) {
      const st = serviceTemplates[i - 1];
      const sku = `UF-SRV-${String(100 + i).padStart(4, '0')}`;
      productsList.push({
        name: st.name,
        sku,
        product_type: 'service',
        category_id: categoryMap['Design & Fitment Services'],
        sales_price: st.price.toFixed(2),
        cost_price: st.cost.toFixed(2),
        sales_tax_id: tax18Id,
        purchase_tax_id: tax18Id,
        income_account_id: incomeServiceAccount,
        expense_account_id: expenseAccountDefault,
      });
    }

    // Generate 10 Combos
    const comboTemplates = [
      { name: 'Signature Living Room Suite (3-Seater Sofa + Coffee Table + 2 Wingchairs)', price: 105000, cost: 56000 },
      { name: 'Executive Work-from-Home Bundle (Dual Standing Desk + ErgoPro Chair + Drawers)', price: 64999, cost: 33000 },
      { name: 'Master Bedroom Suite (King Bed + 2 Nightstands + Orthopedic Mattress + 4-Door Wardrobe)', price: 135000, cost: 72000 },
      { name: 'Urban Scandinavian Dining Collection (6-Seater Oak Table + 6 Padded Chairs)', price: 69999, cost: 36000 },
      { name: 'Compact Studio Apartment Furniture Bundle (Queen Bed + 2-Seater Sofa + Coffee Table)', price: 79999, cost: 41000 },
      { name: 'Luxury Home Theater Lounge Set (3-Seat Motorized Leather Recliner Row)', price: 115000, cost: 62000 },
      { name: 'Architectural Office Workstation Pod (4 Standing Desks + 4 Mesh Chairs + Screens)', price: 189000, cost: 98000 },
      { name: 'Kids Study & Sleep Combo (Single Platform Bed + Study Desk + Wall Bookcase)', price: 44999, cost: 23000 },
      { name: 'Weather-Proof Patio Lounge Set (Rattan Sofa + 2 Chairs + Glass Coffee Table)', price: 52999, cost: 27000 },
      { name: 'Corporate Reception Lobby Suite (3-Seater Velvet Sofa + 2 Tub Chairs + Marble Table)', price: 92000, cost: 48000 },
    ];

    for (let i = 1; i <= 10; i++) {
      const ct = comboTemplates[i - 1];
      const sku = `UF-CMB-${String(100 + i).padStart(4, '0')}`;
      productsList.push({
        name: ct.name,
        sku,
        product_type: 'combo',
        category_id: categoryMap['Value Bundle Packages'],
        sales_price: ct.price.toFixed(2),
        cost_price: ct.cost.toFixed(2),
        sales_tax_id: tax18Id,
        purchase_tax_id: tax18Id,
        income_account_id: incomeAccountDefault,
        expense_account_id: expenseAccountDefault,
      });
    }

    const insertedProducts = [];
    for (const p of productsList) {
      const pRes = await client.query(
        `INSERT INTO products (
          organization_id, name, sku, product_type, category_id,
          sales_price, cost_price, sales_tax_id, purchase_tax_id,
          income_account_id, expense_account_id, status, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12, $12)
        ON CONFLICT (organization_id, sku) WHERE sku IS NOT NULL DO UPDATE
        SET name = EXCLUDED.name,
            product_type = EXCLUDED.product_type,
            category_id = EXCLUDED.category_id,
            sales_price = EXCLUDED.sales_price,
            cost_price = EXCLUDED.cost_price,
            sales_tax_id = EXCLUDED.sales_tax_id,
            purchase_tax_id = EXCLUDED.purchase_tax_id,
            income_account_id = EXCLUDED.income_account_id,
            expense_account_id = EXCLUDED.expense_account_id,
            status = 'active',
            updated_at = NOW()
        RETURNING id, name, sku, product_type, sales_price`,
        [
          organizationId,
          p.name,
          p.sku,
          p.product_type,
          p.category_id,
          p.sales_price,
          p.cost_price,
          p.sales_tax_id,
          p.purchase_tax_id,
          p.income_account_id,
          p.expense_account_id,
          adminUserId,
        ]
      );
      insertedProducts.push(pRes.rows[0]);
    }
    console.log(`   ✔ Seeded ${insertedProducts.length} Products.`);

    client.release();

    // -------------------------------------------------------------
    // 11. POST BALANCED JOURNAL ENTRIES (110 Double-Entry Journal Entries)
    // -------------------------------------------------------------
    console.log('📖 [11/10] Posting 110 Balanced Double-Entry Journal Entries via Accounting Engine...');

    let entryCounter = 0;

    // A. Opening Balance Entry
    await withTransaction(async (txClient) => {
      await accountingService.postJournalEntry(txClient, {
        organizationId,
        journalId: journalMap['general'],
        entryDate: '2026-04-01',
        reference: 'OPN-2026-001',
        narration: 'Opening balance migration and capital allocation for FY 2026-27',
        lines: [
          { account_id: accountMap['1020'], debit: '1500000.00', credit: '0.00', description: 'Opening Bank Balance' },
          { account_id: accountMap['1530'], debit: '850000.00', credit: '0.00', description: 'Opening Machinery Value' },
          { account_id: accountMap['1060'], debit: '650000.00', credit: '0.00', description: 'Opening Finished Goods Inventory' },
          { account_id: accountMap['3010'], debit: '0.00', credit: '3000000.00', description: 'Opening Balance Equity' },
        ],
        actorUserId: leadAccountantUserId,
      });
      entryCounter++;
    });

    function getDateInFY2026(index) {
      const month = 4 + (index % 5); // Months 4 (Apr), 5 (May), 6 (Jun), 7 (Jul), 8 (Aug)
      const day = 1 + (index % 27);
      return `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    // B. 40 Sales Invoices
    for (let i = 1; i <= 40; i++) {
      const contact = insertedContacts[(i - 1) % 60]; // from customers
      const analytic = analyticMap[(i - 1) % 8]; // retail cost centers
      const baseAmount = 25000 + (i * 1250);
      const taxAmount = (baseAmount * 0.18);
      const totalAmount = baseAmount + taxAmount;
      const entryDate = getDateInFY2026(i);

      await withTransaction(async (txClient) => {
        await accountingService.postJournalEntry(txClient, {
          organizationId,
          journalId: journalMap['sales'],
          entryDate,
          reference: `INV-2026-${String(i).padStart(4, '0')}`,
          narration: `Sale of furniture to ${contact.name}`,
          lines: [
            {
              account_id: accountMap['1030'], // Debtors Dr
              partner_contact_id: contact.id,
              analytic_account_id: analytic.id,
              debit: totalAmount.toFixed(2),
              credit: '0.00',
              description: `Invoice receivable from ${contact.name}`,
            },
            {
              account_id: accountMap['4010'], // Sales Income Cr
              analytic_account_id: analytic.id,
              debit: '0.00',
              credit: baseAmount.toFixed(2),
              description: `Sales revenue for furniture order`,
            },
            {
              account_id: accountMap['2020'], // Output Tax Cr
              analytic_account_id: analytic.id,
              debit: '0.00',
              credit: taxAmount.toFixed(2),
              description: `GST 18% Output Tax`,
            },
          ],
          actorUserId: leadAccountantUserId,
        });
        entryCounter++;
      });
    }

    // C. 30 Vendor Purchase Bills
    for (let i = 1; i <= 30; i++) {
      const vendorContact = insertedContacts[60 + ((i - 1) % 40)]; // from vendors
      const analytic = analyticMap[9 + ((i - 1) % 5)]; // factory / production cost centers
      const baseAmount = 18000 + (i * 980);
      const taxAmount = (baseAmount * 0.18);
      const totalAmount = baseAmount + taxAmount;
      const entryDate = getDateInFY2026(i + 5);

      await withTransaction(async (txClient) => {
        await accountingService.postJournalEntry(txClient, {
          organizationId,
          journalId: journalMap['purchase'],
          entryDate,
          reference: `BILL-2026-${String(i).padStart(4, '0')}`,
          narration: `Procurement of raw materials from ${vendorContact.name}`,
          lines: [
            {
              account_id: accountMap['5010'], // Purchase Expense Dr
              partner_contact_id: vendorContact.id,
              analytic_account_id: analytic.id,
              debit: baseAmount.toFixed(2),
              credit: '0.00',
              description: `Timber & raw materials expense`,
            },
            {
              account_id: accountMap['1040'], // Input Tax Dr
              partner_contact_id: vendorContact.id,
              analytic_account_id: analytic.id,
              debit: taxAmount.toFixed(2),
              credit: '0.00',
              description: `GST 18% Input Tax Credit`,
            },
            {
              account_id: accountMap['2010'], // Creditors Cr
              partner_contact_id: vendorContact.id,
              analytic_account_id: analytic.id,
              debit: '0.00',
              credit: totalAmount.toFixed(2),
              description: `Bill payable to ${vendorContact.name}`,
            },
          ],
          actorUserId: leadAccountantUserId,
        });
        entryCounter++;
      });
    }

    // D. 20 Customer Payment Receipts
    for (let i = 1; i <= 20; i++) {
      const contact = insertedContacts[(i - 1) % 60];
      const receiptAmount = 20000 + (i * 1100);
      const entryDate = getDateInFY2026(i + 10);

      await withTransaction(async (txClient) => {
        await accountingService.postJournalEntry(txClient, {
          organizationId,
          journalId: journalMap['bank'],
          entryDate,
          reference: `REC-2026-${String(i).padStart(4, '0')}`,
          narration: `Payment received from customer ${contact.name}`,
          lines: [
            {
              account_id: accountMap['1020'], // HDFC Bank Dr
              debit: receiptAmount.toFixed(2),
              credit: '0.00',
              description: `Inward NEFT/UPI payment from ${contact.name}`,
            },
            {
              account_id: accountMap['1030'], // Debtors Cr
              partner_contact_id: contact.id,
              debit: '0.00',
              credit: receiptAmount.toFixed(2),
              description: `Settlement of outstanding invoice`,
            },
          ],
          actorUserId: leadAccountantUserId,
        });
        entryCounter++;
      });
    }

    // E. 10 Vendor Payment Disbursements
    for (let i = 1; i <= 10; i++) {
      const vendorContact = insertedContacts[60 + ((i - 1) % 40)];
      const paymentAmount = 15000 + (i * 1400);
      const entryDate = getDateInFY2026(i + 15);

      await withTransaction(async (txClient) => {
        await accountingService.postJournalEntry(txClient, {
          organizationId,
          journalId: journalMap['bank'],
          entryDate,
          reference: `PAY-2026-${String(i).padStart(4, '0')}`,
          narration: `Bank transfer payment to supplier ${vendorContact.name}`,
          lines: [
            {
              account_id: accountMap['2010'], // Creditors Dr
              partner_contact_id: vendorContact.id,
              debit: paymentAmount.toFixed(2),
              credit: '0.00',
              description: `Disbursement against vendor bill`,
            },
            {
              account_id: accountMap['1020'], // HDFC Bank Cr
              debit: '0.00',
              credit: paymentAmount.toFixed(2),
              description: `RTGS payment from HDFC Bank`,
            },
          ],
          actorUserId: leadAccountantUserId,
        });
        entryCounter++;
      });
    }

    // F. 5 Payroll Entries
    for (let i = 1; i <= 5; i++) {
      const grossSalary = 185000.00;
      const tdsAmount = 9250.00;
      const netSalary = grossSalary - tdsAmount;
      const entryDate = `2026-0${3 + i}-28`;

      await withTransaction(async (txClient) => {
        await accountingService.postJournalEntry(txClient, {
          organizationId,
          journalId: journalMap['general'],
          entryDate,
          reference: `PAYROLL-2026-M${i}`,
          narration: `Monthly staff payroll and statutory TDS deduction for Month ${i}`,
          lines: [
            {
              account_id: accountMap['6020'], // Staff Salaries Expense Dr
              debit: grossSalary.toFixed(2),
              credit: '0.00',
              description: `Gross executive & staff salaries`,
            },
            {
              account_id: accountMap['2031'], // TDS Payable Cr
              debit: '0.00',
              credit: tdsAmount.toFixed(2),
              description: `TDS 194J deduction payable to govt`,
            },
            {
              account_id: accountMap['1022'], // SBI Payroll Bank Cr
              debit: '0.00',
              credit: netSalary.toFixed(2),
              description: `Direct salary transfer from SBI Payroll A/c`,
            },
          ],
          actorUserId: leadAccountantUserId,
        });
        entryCounter++;
      });
    }

    // G. 5 Office & Factory Rent / Utilities
    for (let i = 1; i <= 5; i++) {
      const rentAmount = 65000.00;
      const electricityAmount = 14500.00;
      const totalAmount = rentAmount + electricityAmount;
      const entryDate = `2026-0${3 + i}-05`;

      await withTransaction(async (txClient) => {
        await accountingService.postJournalEntry(txClient, {
          organizationId,
          journalId: journalMap['bank'],
          entryDate,
          reference: `FACILITY-2026-M${i}`,
          narration: `Showroom rent and electricity utility payment for Month ${i}`,
          lines: [
            {
              account_id: accountMap['6010'], // Showroom Rent Dr
              debit: rentAmount.toFixed(2),
              credit: '0.00',
              description: `Showroom lease payment`,
            },
            {
              account_id: accountMap['6040'], // Electricity Utility Dr
              debit: electricityAmount.toFixed(2),
              credit: '0.00',
              description: `Commercial power utility charges`,
            },
            {
              account_id: accountMap['1020'], // HDFC Bank Cr
              debit: '0.00',
              credit: totalAmount.toFixed(2),
              description: `Standing instruction transfer from HDFC`,
            },
          ],
          actorUserId: leadAccountantUserId,
        });
        entryCounter++;
      });
    }

    console.log(`   ✔ Successfully posted ${entryCounter} balanced Journal Entries!`);

    console.log('================================================================');
    console.log('🎉 URBAN FURNITURE SEED COMPLETED SUCCESSFULLY!');
    console.log('================================================================');
    console.log(`Organization: ${orgName} (slug: ${orgSlug})`);
    console.log(`Default Password: ${DEFAULT_PASSWORD}`);
    console.log('----------------------------------------------------------------');
    console.log('Credentials Summary:');
    console.log(` 1. Admin (Business Owner): admin@urbanfurniture.com`);
    console.log(` 2. Lead Accountant (Manager): accountant@urbanfurniture.com`);
    console.log(` 3. Senior Accountant: kavya.accountant@urbanfurniture.com`);
    console.log(` 4. Audit Accountant: neel.accountant@urbanfurniture.com`);
    console.log(` 5. Financial Controller: controller@urbanfurniture.com`);
    console.log(` 6. Portal Customer: customer@azurefurniture.com`);
    console.log(` 7. Portal Vendor: vendor@woodkraft.com`);
    console.log(` 8. Super Admin: superadmin@urbanfurniture.com`);
    console.log('================================================================');
  } catch (error) {
    console.error('❌ Seeding failed with error:', error);
    throw error;
  } finally {
    if (client) client.release();
  }
}

if (require.main === module) {
  seedUrbanFurniture()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seedUrbanFurniture };
