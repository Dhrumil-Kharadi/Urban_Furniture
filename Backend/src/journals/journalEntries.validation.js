/**
 * Journal Entries Validation
 *
 * Pure functions returning { isValid, errors, data? }.
 *
 * This is the FIRST of three checks a manual entry passes. The service checks
 * the arithmetic again through money.js, and the database checks it a third
 * time in the deferrable trigger. That is not redundancy for its own sake —
 * this layer can be bypassed by any caller that is not an HTTP request, and
 * the trigger is the only one of the three that cannot.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** ISO calendar date. Anything else is ambiguous across locales. */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** An amount the NUMERIC(15,2) column can hold. */
const AMOUNT_REGEX = /^\d{1,13}(\.\d{1,2})?$/;

const STATUSES = ['draft', 'posted', 'reversed'];

/** @private */
function optionalText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

/**
 * A date string that is both well-formed and a real calendar date —
 * '2026-02-31' passes the regex and is not a date.
 * @private
 */
function isRealDate(value) {
  if (!DATE_REGEX.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const journalEntriesValidation = {
  /**
   * Validate a manual journal entry.
   *
   * @param {object} body
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateCreate(body) {
    if (!body || typeof body !== 'object') {
      return { isValid: false, errors: ['Request body must be a JSON object'] };
    }

    const errors = [];

    // ── journal ──
    if (!body.journal_id || !UUID_REGEX.test(String(body.journal_id))) {
      errors.push('A valid journal is required');
    }

    // ── entry date ──
    if (!body.entry_date || !isRealDate(String(body.entry_date))) {
      errors.push('A valid entry date (YYYY-MM-DD) is required');
    }

    // ── lines ──
    const lines = Array.isArray(body.lines) ? body.lines : null;

    if (!lines || lines.length < 2) {
      errors.push('A journal entry needs at least two lines');
    } else if (lines.length > 500) {
      // A bound so one request cannot build an entry large enough to hold a
      // connection open long past its welcome.
      errors.push('A journal entry cannot exceed 500 lines');
    } else {
      lines.forEach((line, index) => {
        const lineNo = index + 1;

        if (!line || typeof line !== 'object') {
          errors.push(`Line ${lineNo} is malformed`);
          return;
        }

        if (!line.account_id || !UUID_REGEX.test(String(line.account_id))) {
          errors.push(`Line ${lineNo} needs a valid account`);
        }

        for (const [field, label] of [['debit', 'debit'], ['credit', 'credit']]) {
          const raw = line[field];
          if (raw === undefined || raw === null || raw === '') continue;
          if (!AMOUNT_REGEX.test(String(raw).trim())) {
            errors.push(`Line ${lineNo} has an invalid ${label} amount`);
          }
        }

        for (const [field, label] of [
          ['partner_contact_id', 'contact'],
          ['analytic_account_id', 'analytic account'],
        ]) {
          const raw = line[field];
          if (raw === undefined || raw === null || raw === '') continue;
          if (!UUID_REGEX.test(String(raw))) {
            errors.push(`Line ${lineNo} has an invalid ${label}`);
          }
        }
      });
    }

    if (errors.length > 0) return { isValid: false, errors };

    return {
      isValid: true,
      errors: [],
      data: {
        journal_id: body.journal_id,
        entry_date: body.entry_date,
        reference: optionalText(body.reference),
        narration: optionalText(body.narration),
        lines: lines.map((line) => ({
          account_id: line.account_id,
          partner_contact_id: line.partner_contact_id || null,
          analytic_account_id: line.analytic_account_id || null,
          // Carried as strings all the way to money.js. Parsing to a Number
          // here would be the one float in the whole path.
          debit: line.debit === undefined || line.debit === null || line.debit === ''
            ? '0'
            : String(line.debit).trim(),
          credit: line.credit === undefined || line.credit === null || line.credit === ''
            ? '0'
            : String(line.credit).trim(),
          description: optionalText(line.description),
        })),
      },
    };
  },

  /**
   * Validate a reversal request.
   *
   * @param {object} body
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateReverse(body) {
    const source = body && typeof body === 'object' ? body : {};
    const errors = [];

    const reason = optionalText(source.reason);
    if (reason && reason.length > 500) {
      errors.push('Reason must not exceed 500 characters');
    }

    const reversalDate = optionalText(source.reversal_date);
    if (reversalDate && !isRealDate(reversalDate)) {
      errors.push('Reversal date must be a valid date (YYYY-MM-DD)');
    }

    if (errors.length > 0) return { isValid: false, errors };

    return { isValid: true, errors: [], data: { reason, reversalDate } };
  },

  /**
   * Validate the list filters.
   *
   * @param {object} query
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateListQuery(query = {}) {
    const errors = [];

    if (query.status !== undefined && query.status !== '' && !STATUSES.includes(query.status)) {
      errors.push(`Status filter must be one of: ${STATUSES.join(', ')}`);
    }

    if (query.source !== undefined && query.source !== '' && !['manual', 'auto'].includes(query.source)) {
      errors.push('Source filter must be manual or auto');
    }

    if (query.journalId !== undefined && query.journalId !== '' && !UUID_REGEX.test(query.journalId)) {
      errors.push('Journal filter must be a valid id');
    }

    for (const [field, label] of [['dateFrom', 'From date'], ['dateTo', 'To date']]) {
      const value = query[field];
      if (value === undefined || value === '') continue;
      if (!isRealDate(String(value))) errors.push(`${label} must be a valid date (YYYY-MM-DD)`);
    }

    if (errors.length > 0) return { isValid: false, errors };

    return {
      isValid: true,
      errors: [],
      data: {
        status: query.status || null,
        source: query.source || null,
        journalId: query.journalId || null,
        dateFrom: query.dateFrom || null,
        dateTo: query.dateTo || null,
      },
    };
  },
};

module.exports = journalEntriesValidation;
module.exports.isRealDate = isRealDate;
