const { pool } = require('../config/db');
const { parse: parsePagination, buildSort, searchTerm, listResult } = require('../shared/listQuery');

/**
 * Accounting Repository
 *
 * Parameterised SQL only. Every statement filters by organization_id.
 *
 * THE REPORTING PRIMITIVES (getAccountBalances, getPeriodMovements,
 * getAnalyticActuals, getContactOpenItems) are each ONE grouped query. Never
 * loop accounts and query per account: a chart with 200 accounts would become
 * 200 round trips, and the Balance Sheet is the page an accountant refreshes
 * all day.
 *
 * MONEY: every amount is NUMERIC(15,2) and comes back as a STRING. Summing is
 * done by PostgreSQL, which is exact; nothing here converts to a JS number.
 */

const ALLOWED_SORT_COLUMNS = ['entry_date', 'entry_number', 'status', 'created_at'];

const ENTRY_COLUMNS = `
  e.id, e.organization_id, e.journal_id, e.entry_number, e.entry_date,
  e.reference, e.narration, e.status, e.is_auto_generated,
  e.source_type, e.source_id, e.reversed_by_entry_id, e.posted_at,
  e.created_by, e.updated_by, e.created_at, e.updated_at
`;

const LINE_COLUMNS = `
  l.id, l.journal_entry_id, l.line_no, l.account_id, l.partner_contact_id,
  l.analytic_account_id, l.debit, l.credit, l.description
`;

const accountingRepository = {
  // ─── Posting support ─────────────────────────────────────────────────────

  /**
   * The journal, only if it is active and belongs to this organization.
   * project.md §9.6 — you cannot post to an archived journal.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} journalId
   * @returns {Promise<object|null>}
   */
  async findPostableJournal(client, organizationId, journalId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, name, journal_type
         FROM journals
        WHERE id = $1 AND organization_id = $2 AND status = 'active'`,
      [journalId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * Every active account in this organization from the given ids, in ONE
   * query. The caller compares the returned set against what it asked for.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string[]} accountIds
   * @returns {Promise<Array>}
   */
  async findPostableAccounts(client, organizationId, accountIds) {
    const db = client || pool;
    if (!accountIds.length) return [];

    const res = await db.query(
      `SELECT id, code, name, account_type
         FROM accounts
        WHERE organization_id = $1 AND status = 'active' AND id = ANY($2::uuid[])`,
      [organizationId, accountIds]
    );
    return res.rows;
  },

  /**
   * Confirm any partner contacts and analytic accounts named on the lines
   * belong to this organization.
   *
   * A line pointing at another tenant's contact would leak that contact's name
   * into this tenant's ledger, so it is refused rather than nulled out.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {Array} lines
   * @returns {Promise<void>}
   */
  async assertLineReferencesAreTenants(client, organizationId, lines) {
    const db = client || pool;

    const contactIds = [...new Set(lines.map((l) => l.partner_contact_id).filter(Boolean))];
    const analyticIds = [...new Set(lines.map((l) => l.analytic_account_id).filter(Boolean))];

    if (contactIds.length) {
      const res = await db.query(
        `SELECT COUNT(*)::integer AS total
           FROM contacts
          WHERE organization_id = $1 AND id = ANY($2::uuid[])`,
        [organizationId, contactIds]
      );
      if (res.rows[0].total !== contactIds.length) {
        const error = new Error('A contact on this entry was not found');
        error.statusCode = 400;
        throw error;
      }
    }

    if (analyticIds.length) {
      const res = await db.query(
        `SELECT COUNT(*)::integer AS total
           FROM analytic_accounts
          WHERE organization_id = $1 AND status = 'active' AND id = ANY($2::uuid[])`,
        [organizationId, analyticIds]
      );
      if (res.rows[0].total !== analyticIds.length) {
        const error = new Error('An analytic account on this entry was not found or is archived');
        error.statusCode = 400;
        throw error;
      }
    }
  },

  /**
   * @param {object} client
   * @param {object} payload
   * @returns {Promise<object>}
   */
  async insertEntry(client, payload) {
    const res = await client.query(
      `INSERT INTO journal_entries (
         organization_id, journal_id, entry_number, entry_date, reference, narration,
         status, is_auto_generated, source_type, source_id, posted_at, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
       RETURNING id, entry_number, entry_date, status, posted_at`,
      [
        payload.organization_id,
        payload.journal_id,
        payload.entry_number,
        payload.entry_date,
        payload.reference,
        payload.narration,
        payload.status,
        payload.is_auto_generated,
        payload.source_type,
        payload.source_id,
        payload.status === 'posted' ? new Date() : null,
        payload.actor_user_id,
      ]
    );
    return res.rows[0];
  },

  /**
   * Bulk-insert the lines in ONE statement.
   *
   * The placeholder list is generated from the line COUNT, never from line
   * content, so every value is still a bind parameter.
   *
   * @param {object} client
   * @param {string} organizationId
   * @param {string} entryId
   * @param {Array} lines
   * @returns {Promise<number>} Rows inserted.
   */
  async insertLines(client, organizationId, entryId, lines) {
    if (!lines.length) return 0;

    const COLUMNS_PER_LINE = 9;
    const values = [];
    const tuples = [];

    lines.forEach((line, index) => {
      const base = index * COLUMNS_PER_LINE;
      tuples.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, ` +
        `$${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`
      );
      values.push(
        organizationId,
        entryId,
        line.line_no,
        line.account_id,
        line.partner_contact_id,
        line.analytic_account_id,
        line.debit,
        line.credit,
        line.description
      );
    });

    const res = await client.query(
      `INSERT INTO journal_entry_lines (
         organization_id, journal_entry_id, line_no, account_id,
         partner_contact_id, analytic_account_id, debit, credit, description
       )
       VALUES ${tuples.join(', ')}`,
      values
    );

    return res.rowCount;
  },

  /**
   * Flag an entry reversed and point it at its mirror.
   *
   * The database's header-immutability trigger permits exactly this one
   * transition and nothing else.
   *
   * @param {object} client
   * @param {string} organizationId
   * @param {string} entryId
   * @param {string} reversalEntryId
   * @param {string|null} actorUserId
   * @returns {Promise<object|null>}
   */
  async markReversed(client, organizationId, entryId, reversalEntryId, actorUserId) {
    const res = await client.query(
      `UPDATE journal_entries
          SET status = 'reversed',
              reversed_by_entry_id = $1,
              updated_by = $2,
              updated_at = NOW()
        WHERE id = $3 AND organization_id = $4 AND status = 'posted'
        RETURNING ${ENTRY_COLUMNS.replace(/e\./g, '')}`,
      [reversalEntryId, actorUserId, entryId, organizationId]
    );
    return res.rows[0] || null;
  },

  // ─── Reading ─────────────────────────────────────────────────────────────

  /**
   * One entry with its lines, in two queries rather than a row-multiplying
   * join the caller would have to de-duplicate.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} entryId
   * @returns {Promise<object|null>}
   */
  async findEntryWithLines(client, organizationId, entryId) {
    const db = client || pool;

    const entryRes = await db.query(
      `SELECT ${ENTRY_COLUMNS},
              j.name AS journal_name, j.journal_type,
              r.entry_number AS reversed_by_entry_number
         FROM journal_entries e
         JOIN journals j
           ON j.id = e.journal_id AND j.organization_id = e.organization_id
         LEFT JOIN journal_entries r
           ON r.id = e.reversed_by_entry_id AND r.organization_id = e.organization_id
        WHERE e.id = $1 AND e.organization_id = $2`,
      [entryId, organizationId]
    );

    const entry = entryRes.rows[0];
    if (!entry) return null;

    const linesRes = await db.query(
      `SELECT ${LINE_COLUMNS},
              a.code AS account_code, a.name AS account_name, a.account_type,
              c.name AS partner_contact_name,
              an.name AS analytic_account_name
         FROM journal_entry_lines l
         JOIN accounts a
           ON a.id = l.account_id AND a.organization_id = l.organization_id
         LEFT JOIN contacts c
           ON c.id = l.partner_contact_id AND c.organization_id = l.organization_id
         LEFT JOIN analytic_accounts an
           ON an.id = l.analytic_account_id AND an.organization_id = l.organization_id
        WHERE l.journal_entry_id = $1 AND l.organization_id = $2
        ORDER BY l.line_no`,
      [entryId, organizationId]
    );

    entry.lines = linesRes.rows;
    return entry;
  },

  /**
   * List entries with the standard collection contract, each carrying its own
   * debit and credit totals.
   *
   * The totals come from a LATERAL aggregate rather than a second pass per
   * row, so a page of 25 entries is still one query.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {object} [query] - page, limit, search, status, journalId, dateFrom,
   *                           dateTo, source ('manual' | 'auto'), sortBy, sortOrder
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async listEntries(client, organizationId, query = {}) {
    const db = client || pool;
    const { page, limit, offset } = parsePagination(query);

    const conditions = ['e.organization_id = $1'];
    const params = [organizationId];

    if (query.status) {
      params.push(query.status);
      conditions.push(`e.status = $${params.length}`);
    }

    if (query.journalId) {
      params.push(query.journalId);
      conditions.push(`e.journal_id = $${params.length}`);
    }

    if (query.dateFrom) {
      params.push(query.dateFrom);
      conditions.push(`e.entry_date >= $${params.length}`);
    }

    if (query.dateTo) {
      params.push(query.dateTo);
      conditions.push(`e.entry_date <= $${params.length}`);
    }

    // project.md §4.5's auto-generated flag, exposed as a filter.
    if (query.source === 'auto') conditions.push('e.is_auto_generated = true');
    if (query.source === 'manual') conditions.push('e.is_auto_generated = false');

    const search = searchTerm(query);
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(e.entry_number ILIKE $${idx} OR e.reference ILIKE $${idx} OR e.narration ILIKE $${idx})`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await db.query(
      `SELECT COUNT(*)::integer AS total FROM journal_entries e ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    // Default to newest first, as the phase brief specifies.
    const sortParams = query.sortBy ? query : { ...query, sortBy: 'entry_date', sortOrder: 'desc' };
    const orderBy = buildSort(sortParams, ALLOWED_SORT_COLUMNS, 'entry_date').replace(/^"/, 'e."');

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataRes = await db.query(
      `SELECT ${ENTRY_COLUMNS},
              j.name AS journal_name, j.journal_type,
              totals.total_debit, totals.total_credit, totals.line_count
         FROM journal_entries e
         JOIN journals j
           ON j.id = e.journal_id AND j.organization_id = e.organization_id
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(l.debit), 0)  AS total_debit,
                  COALESCE(SUM(l.credit), 0) AS total_credit,
                  COUNT(*)::integer          AS line_count
             FROM journal_entry_lines l
            WHERE l.journal_entry_id = e.id
         ) totals ON true
        ${whereClause}
        ORDER BY ${orderBy}, e.entry_number DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return listResult(dataRes.rows, page, limit, total);
  },

  // ─── Reporting primitives (Phase 11 consumes these) ──────────────────────

  /**
   * Closing balance per account as of a date.
   *
   * ONE grouped query over every account, including those with no movement,
   * so the Balance Sheet can render the whole chart without a second pass.
   * Opening balance is folded in here, which is why it is a column on accounts
   * rather than a special case in the report.
   *
   * The signed balance follows normal-side convention: assets and expenses are
   * debit-positive, liabilities, income and capital are credit-positive.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} asOfDate - ISO date.
   * @returns {Promise<Array>}
   */
  async getAccountBalances(client, organizationId, asOfDate) {
    const db = client || pool;
    const res = await db.query(
      `SELECT a.id AS account_id,
              a.code,
              a.name,
              a.account_type,
              a.parent_account_id,
              a.opening_balance,
              COALESCE(m.total_debit, 0)  AS total_debit,
              COALESCE(m.total_credit, 0) AS total_credit,
              CASE
                WHEN a.account_type IN ('asset', 'expense')
                  THEN a.opening_balance + COALESCE(m.total_debit, 0) - COALESCE(m.total_credit, 0)
                ELSE a.opening_balance + COALESCE(m.total_credit, 0) - COALESCE(m.total_debit, 0)
              END AS balance
         FROM accounts a
         LEFT JOIN LATERAL (
           SELECT SUM(l.debit) AS total_debit, SUM(l.credit) AS total_credit
             FROM journal_entry_lines l
             JOIN journal_entries e
               ON e.id = l.journal_entry_id AND e.organization_id = l.organization_id
            WHERE l.organization_id = a.organization_id
              AND l.account_id = a.id
              AND e.status IN ('posted', 'reversed')
              AND e.entry_date <= $2
         ) m ON true
        WHERE a.organization_id = $1
        ORDER BY a.account_type, a.code`,
      [organizationId, asOfDate]
    );
    return res.rows;
  },

  /**
   * Debit and credit movement per account within a period.
   *
   * This is what the P&L is built from: income and expense accounts do not
   * carry a balance forward across periods, they carry movement within one.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} from - ISO date, inclusive.
   * @param {string} to   - ISO date, inclusive.
   * @returns {Promise<Array>}
   */
  async getPeriodMovements(client, organizationId, from, to) {
    const db = client || pool;
    const res = await db.query(
      `SELECT a.id AS account_id,
              a.code,
              a.name,
              a.account_type,
              COALESCE(SUM(l.debit), 0)  AS total_debit,
              COALESCE(SUM(l.credit), 0) AS total_credit,
              CASE
                WHEN a.account_type IN ('asset', 'expense')
                  THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
                ELSE COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
              END AS movement
         FROM accounts a
         LEFT JOIN journal_entry_lines l
                ON l.account_id = a.id
               AND l.organization_id = a.organization_id
         LEFT JOIN journal_entries e
                ON e.id = l.journal_entry_id
               AND e.organization_id = l.organization_id
               AND e.status IN ('posted', 'reversed')
               AND e.entry_date BETWEEN $2 AND $3
        WHERE a.organization_id = $1
          AND (l.id IS NULL OR e.id IS NOT NULL)
        GROUP BY a.id, a.code, a.name, a.account_type
        ORDER BY a.account_type, a.code`,
      [organizationId, from, to]
    );
    return res.rows;
  },

  /**
   * Actual amounts booked against an analytic account within a period —
   * the "actual" half of project.md §8's Budget Report.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} analyticAccountId
   * @param {string} from
   * @param {string} to
   * @returns {Promise<object>}
   */
  async getAnalyticActuals(client, organizationId, analyticAccountId, from, to) {
    const db = client || pool;
    const res = await db.query(
      `SELECT an.id AS analytic_account_id,
              an.name,
              an.analytic_type,
              COALESCE(SUM(l.debit), 0)  AS total_debit,
              COALESCE(SUM(l.credit), 0) AS total_credit,
              CASE
                WHEN an.analytic_type = 'expense'
                  THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
                ELSE COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
              END AS actual_amount,
              COUNT(l.id)::integer AS line_count
         FROM analytic_accounts an
         LEFT JOIN journal_entry_lines l
                ON l.analytic_account_id = an.id
               AND l.organization_id = an.organization_id
         LEFT JOIN journal_entries e
                ON e.id = l.journal_entry_id
               AND e.organization_id = l.organization_id
               AND e.status IN ('posted', 'reversed')
               AND e.entry_date BETWEEN $3 AND $4
        WHERE an.organization_id = $1
          AND an.id = $2
          AND (l.id IS NULL OR e.id IS NOT NULL)
        GROUP BY an.id, an.name, an.analytic_type`,
      [organizationId, analyticAccountId, from, to]
    );
    return res.rows[0] || null;
  },

  /**
   * What a contact still owes, or is still owed, per document.
   *
   * `kind` selects the side: 'receivable' looks at asset accounts (a customer's
   * debt to the organization), 'payable' at liabilities (what the organization
   * owes a vendor).
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} contactId
   * @param {'receivable'|'payable'} kind
   * @returns {Promise<Array>}
   */
  async getContactOpenItems(client, organizationId, contactId, kind = 'receivable') {
    const db = client || pool;
    const accountType = kind === 'payable' ? 'liability' : 'asset';

    const res = await db.query(
      `SELECT e.id AS journal_entry_id,
              e.entry_number,
              e.entry_date,
              e.reference,
              e.source_type,
              e.source_id,
              COALESCE(SUM(l.debit), 0)  AS total_debit,
              COALESCE(SUM(l.credit), 0) AS total_credit,
              CASE
                WHEN $4 = 'payable'
                  THEN COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
                ELSE COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
              END AS outstanding
         FROM journal_entry_lines l
         JOIN journal_entries e
           ON e.id = l.journal_entry_id AND e.organization_id = l.organization_id
         JOIN accounts a
           ON a.id = l.account_id AND a.organization_id = l.organization_id
        WHERE l.organization_id = $1
          AND l.partner_contact_id = $2
          AND a.account_type = $3
          AND e.status IN ('posted', 'reversed')
        GROUP BY e.id, e.entry_number, e.entry_date, e.reference, e.source_type, e.source_id
        ORDER BY e.entry_date, e.entry_number`,
      [organizationId, contactId, accountType, kind]
    );
    return res.rows;
  },
};

module.exports = accountingRepository;
