'use strict';

/** Canonical development seed for the current PostgreSQL schema. */

const bcrypt = require('bcrypt');
const { pool } = require('../../config/db');
const { env } = require('../../config/env');
const purchaseOrdersService = require('../../purchases/purchaseOrders.service');
const vendorBillsService = require('../../purchases/vendorBills.service');
const salesOrdersService = require('../../sales/salesOrders.service');
const customerInvoicesService = require('../../sales/customerInvoices.service');
const paymentsService = require('../../payments/payments.service');

const PASSWORD = 'Password@123';
const ORG_SLUG = 'urban-furniture';
const FY_START = '2026-04-01';
const FY_END = '2027-03-31';
const accountDefinitions = [
  ['1010', 'Cash', 'asset'], ['1020', 'Bank', 'asset'], ['1030', 'Debtors', 'asset'],
  ['1040', 'Input Tax Credit', 'asset'], ['1050', 'Payment Gateway Clearing', 'asset'],
  ['2010', 'Creditors', 'liability'], ['2020', 'Output Tax Payable', 'liability'],
  ['3010', 'Opening Balance Equity', 'capital'], ['4010', 'Sale Income', 'income'],
  ['5010', 'Purchase Expense', 'expense'], ['5020', 'Operating Expenses', 'expense'],
  ['5030', 'Rent Expense', 'expense'], ['5040', 'Utilities Expense', 'expense'],
];
const userDefinitions = [
  ['Urban Furniture Admin', 'admin@urbanfurniture.demo', 'business_owner'],
  ['Amit Patel', 'accountant@urbanfurniture.demo', 'accountant'],
  ['Nimesh Pathak', 'customer@urbanfurniture.demo', 'customer'],
  ['Azure Furniture', 'vendor@azurefurniture.demo', 'vendor'],
];
const contactDefinitions = [
  ['Azure Furniture', 'vendor', 'vendor@azurefurniture.demo', '9876543210', 'Ahmedabad', 'Gujarat', '380001'],
  ['Nimesh Pathak', 'customer', 'customer@urbanfurniture.demo', '9876543211', 'Ahmedabad', 'Gujarat', '380002'],
  ['Royal Interiors', 'both', 'royal@urbanfurniture.demo', '9876543212', 'Gandhinagar', 'Gujarat', '382010'],
];
const productDefinitions = [
  ['Office Chair', 'CHR-001', 2000, 3000, 'Office Furniture'],
  ['Wooden Table', 'TBL-001', 5000, 7500, 'Tables'], ['Sofa', 'SOF-001', 12000, 18000, 'Seating'],
  ['Dining Table', 'DTB-001', 8000, 12000, 'Tables'], ['Office Desk', 'DSK-001', 6000, 9000, 'Office Furniture'],
  ['Bookshelf', 'BKS-001', 4000, 6000, 'Storage'], ['Conference Table', 'CTB-001', 15000, 22000, 'Office Furniture'],
  ['Reception Chair', 'RCH-001', 2500, 3500, 'Seating'],
];
const journalDefinitions = [
  ['Sales Journal', 'sales', 'INV'], ['Purchase Journal', 'purchase', 'BILL'],
  ['Bank Journal', 'bank', 'BNK'], ['Cash Journal', 'cash', 'CSH'],
];
const analyticDefinitions = [
  ['RET', 'Retail Sales', 'income', 'Sales'], ['ONL', 'Online Sales', 'income', 'Sales'],
  ['AMD', 'Ahmedabad Store', 'expense', 'Retail'], ['OPS', 'Office Operations', 'expense', 'Administration'],
];

function money(value) { return Number(value).toFixed(2); }

async function findNamed(client, table, organizationId, name) {
  const result = await client.query(`SELECT * FROM ${table} WHERE organization_id = $1 AND name = $2 LIMIT 1`, [organizationId, name]);
  return result.rows[0] || null;
}

async function ensureNamed(client, table, organizationId, columns, values, name) {
  const existing = await findNamed(client, table, organizationId, name);
  if (existing) return existing;
  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
  const result = await client.query(
    `INSERT INTO ${table} (organization_id, ${columns.join(', ')}) VALUES ($${values.length + 1}, ${placeholders}) RETURNING *`,
    [...values, organizationId]
  );
  return result.rows[0];
}

async function findDocument(table, organizationId, marker) {
  const result = await pool.query(`SELECT * FROM ${table} WHERE organization_id = $1 AND notes = $2 LIMIT 1`, [organizationId, marker]);
  return result.rows[0] || null;
}

async function seedMasterData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orgResult = await client.query(
      `INSERT INTO organizations (name, slug, currency_code, fiscal_year_start_month, status)
       VALUES ('Urban Furniture', $1, 'INR', 4, 'active')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, currency_code = 'INR', fiscal_year_start_month = 4,
         status = 'active', updated_at = NOW() RETURNING *`, [ORG_SLUG]
    );
    const organization = orgResult.rows[0];
    const passwordHash = await bcrypt.hash(PASSWORD + (env.passwordPepper || ''), env.bcryptRounds || 12);
    const users = {};
    for (const [name, email, role] of userDefinitions) {
      const result = await client.query(
        `INSERT INTO users (name, email, password_hash, role, organization_id, email_verified, status, must_change_password)
         VALUES ($1, $2, $3, $4, $5, true, 'active', false)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role, organization_id = EXCLUDED.organization_id, email_verified = true, status = 'active',
           must_change_password = false, updated_at = NOW() RETURNING *`,
        [name, email, passwordHash, role, organization.id]
      );
      users[email] = result.rows[0];
    }
    await client.query('UPDATE organizations SET created_by = $1, updated_by = $1 WHERE id = $2', [users['admin@urbanfurniture.demo'].id, organization.id]);

    const accounts = {};
    for (const [code, name, type] of accountDefinitions) {
      const result = await client.query(
        `INSERT INTO accounts (organization_id, code, name, account_type, opening_balance, is_system, status, created_by, updated_by)
         VALUES ($1, $2, $3, $4, 0, true, 'active', $5, $5)
         ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name, account_type = EXCLUDED.account_type,
           status = 'active', updated_by = EXCLUDED.updated_by RETURNING *`,
        [organization.id, code, name, type, users['admin@urbanfurniture.demo'].id]
      );
      accounts[code] = result.rows[0];
    }
    await client.query(`UPDATE accounts SET opening_balance = CASE code WHEN '1010' THEN 50000 WHEN '1020' THEN 200000 ELSE 0 END WHERE organization_id = $1 AND code IN ('1010', '1020')`, [organization.id]);

    const contacts = {};
    for (const [name, type, email, mobile, city, state, pincode] of contactDefinitions) {
      const result = await client.query(
        `INSERT INTO contacts (organization_id, name, contact_type, email, mobile, city, state, pincode, portal_access_enabled, status, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, 'active', $9, $9)
         ON CONFLICT (organization_id, lower(email)) WHERE email IS NOT NULL DO UPDATE SET name = EXCLUDED.name, contact_type = EXCLUDED.contact_type,
           mobile = EXCLUDED.mobile, city = EXCLUDED.city, state = EXCLUDED.state, pincode = EXCLUDED.pincode,
           portal_access_enabled = true, status = 'active', updated_by = EXCLUDED.updated_by RETURNING *`,
        [organization.id, name, type, email, mobile, city, state, pincode, users['admin@urbanfurniture.demo'].id]
      );
      contacts[email] = result.rows[0];
    }
    await client.query('UPDATE users SET contact_id = $1 WHERE email = $2', [contacts['customer@urbanfurniture.demo'].id, 'customer@urbanfurniture.demo']);
    await client.query('UPDATE users SET contact_id = $1 WHERE email = $2', [contacts['vendor@azurefurniture.demo'].id, 'vendor@azurefurniture.demo']);

    const categories = {};
    for (const name of [...new Set(productDefinitions.map((product) => product[4]))]) {
      categories[name] = await ensureNamed(client, 'product_categories', organization.id,
        ['name', 'description', 'status', 'created_by', 'updated_by'],
        [name, `${name} furniture`, 'active', users['admin@urbanfurniture.demo'].id, users['admin@urbanfurniture.demo'].id], name);
    }
    const taxes = {};
    for (const rate of [5, 12, 18, 28]) {
      const name = `GST ${rate}%`;
      taxes[rate] = await ensureNamed(client, 'taxes', organization.id,
        ['name', 'rate', 'tax_scope', 'collected_account_id', 'paid_account_id', 'status', 'created_by', 'updated_by'],
        [name, rate, 'both', accounts['2020'].id, accounts['1040'].id, 'active', users['admin@urbanfurniture.demo'].id, users['admin@urbanfurniture.demo'].id], name);
    }
    const products = {};
    for (const [name, sku, cost, sales, category] of productDefinitions) {
      const result = await client.query(
        `INSERT INTO products (organization_id, name, sku, product_type, category_id, sales_price, cost_price, sales_tax_id, purchase_tax_id, income_account_id, expense_account_id, status, created_by, updated_by)
         VALUES ($1, $2, $3, 'goods', $4, $5, $6, $7, $7, $8, $9, 'active', $10, $10)
         ON CONFLICT (organization_id, sku) WHERE sku IS NOT NULL DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id,
           sales_price = EXCLUDED.sales_price, cost_price = EXCLUDED.cost_price, sales_tax_id = EXCLUDED.sales_tax_id,
           purchase_tax_id = EXCLUDED.purchase_tax_id, status = 'active', updated_by = EXCLUDED.updated_by RETURNING *`,
        [organization.id, name, sku, categories[category].id, sales, cost, taxes[18].id, accounts['4010'].id, accounts['5010'].id, users['admin@urbanfurniture.demo'].id]
      );
      products[name] = result.rows[0];
    }
    const journals = {};
    for (const [name, type, prefix] of journalDefinitions) {
      let journal = await findNamed(client, 'journals', organization.id, name);
      if (!journal) {
        const result = await client.query(
          `INSERT INTO journals (organization_id, name, journal_type, sequence_prefix, default_debit_account_id, default_credit_account_id, status, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $7) RETURNING *`,
          [organization.id, name, type, prefix, type === 'purchase' ? accounts['5010'].id : type === 'sales' ? accounts['1030'].id : accounts[type === 'cash' ? '1010' : '1020'].id, type === 'purchase' ? accounts['2010'].id : type === 'sales' ? accounts['4010'].id : null, users['admin@urbanfurniture.demo'].id]
        );
        journal = result.rows[0];
      }
      journals[type] = journal;
    }
    const analytics = {};
    for (const [code, name, type, department] of analyticDefinitions) {
      analytics[name] = await ensureNamed(client, 'analytic_accounts', organization.id,
        ['code', 'name', 'analytic_type', 'department', 'status', 'created_by', 'updated_by'],
        [code, name, type, department, 'active', users['admin@urbanfurniture.demo'].id, users['admin@urbanfurniture.demo'].id], name);
    }
    for (const [name, analytic, amount] of [['Retail Sales FY 2026-27', analytics['Retail Sales'], 500000], ['Office Operations FY 2026-27', analytics['Office Operations'], 200000]]) {
      const existing = await client.query('SELECT id FROM budgets WHERE organization_id = $1 AND name = $2 LIMIT 1', [organization.id, name]);
      if (existing.rows.length === 0) await client.query(
        `INSERT INTO budgets (organization_id, name, period_start, period_end, responsible_user_id, analytic_account_id, planned_amount, status, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $5, $5)`,
        [organization.id, name, FY_START, FY_END, users['accountant@urbanfurniture.demo'].id, analytic.id, amount]
      );
    }
    for (const [docType, prefix] of [['PO', 'PO'], ['SO', 'SO'], ['BILL', 'BILL'], ['INV', 'INV'], ['PAY', 'PAY'], ['JE', 'JE']]) {
      await client.query(`INSERT INTO document_sequences (organization_id, doc_type, fiscal_year, prefix, next_number, padding) VALUES ($1, $2, '2026', $3, 1, 5) ON CONFLICT (organization_id, doc_type, fiscal_year) DO NOTHING`, [organization.id, docType, prefix]);
    }
    await client.query('COMMIT');
    return { organization, users, contacts, accounts, products, taxes, journals, analytics };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

function line(product, quantity, unitPrice, tax, analytic) {
  return { product_id: product.id, quantity, unit_price: money(unitPrice), tax_id: tax.id, tax_rate: 18, analytic_account_id: analytic.id, description: product.name };
}

async function seedTransactions(master) {
  const organizationId = master.organization.id;
  const actor = master.users['accountant@urbanfurniture.demo'].id;
  const azure = master.contacts['vendor@azurefurniture.demo'];
  const nimesh = master.contacts['customer@urbanfurniture.demo'];
  const royal = master.contacts['royal@urbanfurniture.demo'];
  const chair = master.products['Office Chair'];
  const table = master.products['Wooden Table'];
  const desk = master.products['Office Desk'];
  const dining = master.products['Dining Table'];
  const tax = master.taxes[18];
  const store = master.analytics['Ahmedabad Store'];
  const retail = master.analytics['Retail Sales'];
  const operations = master.analytics['Office Operations'];
  const poData = [
    [azure, '2026-04-08', '2026-04-20', 'confirmed', 'DEMO-PO-1', line(chair, 10, 2000, tax, operations)],
    [azure, '2026-05-14', '2026-05-28', 'confirmed', 'DEMO-PO-2', line(table, 5, 5000, tax, operations)],
    [royal, '2026-06-12', '2026-06-25', 'draft', 'DEMO-PO-3', line(desk, 3, 6000, tax, operations)],
  ];
  const pos = {};
  for (const [vendor, date, expected, status, marker, orderLine] of poData) {
    let po = await findDocument('purchase_orders', organizationId, marker);
    if (!po) {
      po = await purchaseOrdersService.createPurchaseOrder(organizationId, actor, { vendor_contact_id: vendor.id, order_date: date, expected_date: expected, notes: marker, lines: [orderLine] });
      if (status === 'confirmed') po = await purchaseOrdersService.confirmPurchaseOrder(organizationId, actor, po.id);
    }
    pos[marker] = po;
  }
  let bill1 = await findDocument('vendor_bills', organizationId, 'DEMO-BILL-1');
  if (!bill1) {
    const draft = await purchaseOrdersService.createBillFromPO(organizationId, actor, pos['DEMO-PO-2'].id, master.journals.purchase.id);
    await pool.query('UPDATE vendor_bills SET bill_date = $1, due_date = $2, notes = $3 WHERE id = $4', ['2026-05-28', '2026-06-28', 'DEMO-BILL-1', draft.id]);
    bill1 = await vendorBillsService.postVendorBill(organizationId, actor, draft.id);
  }
  const bill2 = await createBill(master, { vendor_contact_id: azure.id, bill_date: '2026-06-18', due_date: '2026-07-18', journal_id: master.journals.purchase.id, notes: 'DEMO-BILL-2', lines: [line(chair, 5, 2000, tax, store)] });
  const bill3 = await createBill(master, { vendor_contact_id: royal.id, bill_date: '2026-07-09', due_date: '2026-08-09', journal_id: master.journals.purchase.id, notes: 'DEMO-BILL-3', lines: [line(desk, 3, 6000, tax, operations)] });
  const soData = [
    [nimesh, '2026-04-22', '2026-05-05', 'confirmed', 'DEMO-SO-1', line(chair, 5, 3000, tax, retail)],
    [royal, '2026-05-19', '2026-06-01', 'confirmed', 'DEMO-SO-2', line(dining, 2, 12000, tax, retail)],
    [nimesh, '2026-07-11', '2026-07-25', 'draft', 'DEMO-SO-3', line(desk, 2, 9000, tax, retail)],
  ];
  const sos = {};
  for (const [customer, date, expected, status, marker, orderLine] of soData) {
    let so = await findDocument('sales_orders', organizationId, marker);
    if (!so) {
      so = await salesOrdersService.createSalesOrder(organizationId, actor, { customer_contact_id: customer.id, order_date: date, expected_date: expected, notes: marker, lines: [orderLine] });
      if (status === 'confirmed') so = await salesOrdersService.confirmSalesOrder(organizationId, actor, so.id);
    }
    sos[marker] = so;
  }
  const invoice1 = await createInvoice(master, sos['DEMO-SO-1'], { invoice_date: '2026-05-05', due_date: '2026-06-05', marker: 'DEMO-INV-1' });
  const invoice2 = await createInvoice(master, sos['DEMO-SO-2'], { invoice_date: '2026-06-01', due_date: '2026-07-01', marker: 'DEMO-INV-2' });
  const invoice3 = await createDirectInvoice(master, { customer_contact_id: nimesh.id, invoice_date: '2026-08-14', due_date: '2026-09-14', journal_id: master.journals.sales.id, notes: 'DEMO-INV-3', lines: [line(desk, 2, 9000, tax, retail)] });
  await createPayment(master, { contact_id: azure.id, direction: 'outbound', method: 'bank', payment_date: '2026-06-02', amount: bill1.total_amount, reference: 'PAY/2026/00001', journal_id: master.journals.bank.id, cash_account_id: master.accounts['1020'].id, allocations: [{ vendor_bill_id: bill1.id, allocated_amount: bill1.total_amount }] });
  await createPayment(master, { contact_id: nimesh.id, direction: 'inbound', method: 'cash', payment_date: '2026-06-06', amount: invoice1.total_amount, reference: 'PAY/2026/00002', journal_id: master.journals.cash.id, cash_account_id: master.accounts['1010'].id, allocations: [{ customer_invoice_id: invoice1.id, allocated_amount: invoice1.total_amount }] });
  await createPayment(master, { contact_id: azure.id, direction: 'outbound', method: 'bank', payment_date: '2026-07-10', amount: '3000.00', reference: 'PAY/2026/00003', journal_id: master.journals.bank.id, cash_account_id: master.accounts['1020'].id, allocations: [{ vendor_bill_id: bill2.id, allocated_amount: '3000.00' }] });
  await createPayment(master, { contact_id: nimesh.id, direction: 'inbound', method: 'bank', payment_date: '2026-08-20', amount: '10000.00', reference: 'PAY/2026/00004', journal_id: master.journals.bank.id, cash_account_id: master.accounts['1020'].id, allocations: [{ customer_invoice_id: invoice3.id, allocated_amount: '10000.00' }] });
  const validation = await pool.query(`SELECT COUNT(*) FILTER (WHERE status = 'posted')::int AS posted_entries, COUNT(*) FILTER (WHERE status = 'posted' AND debit_total = credit_total)::int AS balanced_entries FROM (SELECT je.status, je.id, COALESCE(SUM(jel.debit), 0) AS debit_total, COALESCE(SUM(jel.credit), 0) AS credit_total FROM journal_entries je JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id WHERE je.organization_id = $1 GROUP BY je.id, je.status) entries`, [organizationId]);
  if (validation.rows[0].posted_entries !== validation.rows[0].balanced_entries) throw new Error('Seed validation failed: an entry is unbalanced');
  return { bill1, bill2, bill3, invoice1, invoice2, invoice3, postedEntries: validation.rows[0].posted_entries };
}

async function createBill(master, data) {
  const existing = await findDocument('vendor_bills', master.organization.id, data.notes);
  if (existing) return existing;
  const draft = await vendorBillsService.createVendorBill(master.organization.id, master.users['accountant@urbanfurniture.demo'].id, data);
  return vendorBillsService.postVendorBill(master.organization.id, master.users['accountant@urbanfurniture.demo'].id, draft.id);
}

async function createInvoice(master, so, data) {
  const existing = await findDocument('customer_invoices', master.organization.id, data.marker);
  if (existing) return existing;
  let invoice = await salesOrdersService.createInvoiceFromSO(master.organization.id, master.users['accountant@urbanfurniture.demo'].id, so.id, { invoice_date: data.invoice_date, due_date: data.due_date, journal_id: master.journals.sales.id });
  await pool.query('UPDATE customer_invoices SET notes = $1 WHERE id = $2', [data.marker, invoice.id]);
  invoice = await customerInvoicesService.postCustomerInvoice(master.organization.id, master.users['accountant@urbanfurniture.demo'].id, invoice.id);
  return invoice;
}

async function createDirectInvoice(master, data) {
  const existing = await findDocument('customer_invoices', master.organization.id, data.notes);
  if (existing) return existing;
  const draft = await customerInvoicesService.createCustomerInvoice(master.organization.id, master.users['accountant@urbanfurniture.demo'].id, data);
  return customerInvoicesService.postCustomerInvoice(master.organization.id, master.users['accountant@urbanfurniture.demo'].id, draft.id);
}

async function createPayment(master, data) {
  const existing = await pool.query('SELECT * FROM payments WHERE organization_id = $1 AND reference = $2 LIMIT 1', [master.organization.id, data.reference]);
  if (existing.rows[0]) return existing.rows[0];
  return paymentsService.createPayment(master.organization.id, master.users['accountant@urbanfurniture.demo'].id, data);
}

async function seedUrbanFurniture() {
  console.log('========================================\nUrban Furniture Demo Seed\n========================================');
  const master = await seedMasterData();
  const transactions = await seedTransactions(master);
  const counts = {};
  for (const table of ['users', 'contacts', 'products', 'accounts', 'journals', 'taxes', 'analytic_accounts', 'budgets', 'purchase_orders', 'vendor_bills', 'sales_orders', 'customer_invoices', 'payments', 'journal_entries']) {
    const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE organization_id = $1`, [master.organization.id]);
    counts[table] = result.rows[0].count;
  }
  console.log('Organization: Urban Furniture');
  console.log('Counts:', counts);
  console.log(`Journal entries: ${transactions.postedEntries} posted and balanced`);
  console.log('Demo password for all users: Password@123');
  console.log('Seed completed successfully.');
  return { organizationId: master.organization.id, counts };
}

if (require.main === module) {
  seedUrbanFurniture().then(() => pool.end()).catch((error) => {
    console.error('Seed failed:', error);
    pool.end().finally(() => process.exit(1));
  });
}

module.exports = { seedUrbanFurniture };