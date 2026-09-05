/**
 * Payments Validation
 *
 * Pure functions returning { isValid, errors, data? }.
 *
 * The allocation-sum check is NOT here: it needs decimal arithmetic and lives
 * in the service, where money.js is already in hand. This layer checks shapes.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const AMOUNT_REGEX = /^\d{1,13}(\.\d{1,2})?$/;

const DIRECTIONS = ['inbound', 'outbound'];
const METHODS = ['cash', 'bank', 'card'];
const STATUSES = ['posted', 'cancelled'];

/** @private */
function optionalText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

/** @private */
function isRealDate(value) {
  if (!DATE_REGEX.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Today in UTC, for the not-in-the-future check. @private */
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const paymentsValidation = {
  /**
   * @param {object} body
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateCreate(body) {
    if (!body || typeof body !== 'object') {
      return { isValid: false, errors: ['Request body must be a JSON object'] };
    }

    const errors = [];

    if (!body.contact_id || !UUID_REGEX.test(String(body.contact_id))) {
      errors.push('A valid contact is required');
    }

    if (!DIRECTIONS.includes(body.direction)) {
      errors.push(`Direction must be one of: ${DIRECTIONS.join(', ')}`);
    }

    if (!METHODS.includes(body.method)) {
      errors.push(`Method must be one of: ${METHODS.join(', ')}`);
    }

    // ── payment_date ── not in the future.
    // A payment dated next month lands in a period that has not happened,
    // which quietly misstates every report drawn between now and then.
    if (!body.payment_date || !isRealDate(String(body.payment_date))) {
      errors.push('A valid payment date (YYYY-MM-DD) is required');
    } else if (String(body.payment_date) > todayIso()) {
      errors.push('Payment date cannot be in the future');
    }

    // ── amount ── positive, at most 2 decimals.
    const amount = body.amount === undefined || body.amount === null ? '' : String(body.amount).trim();
    if (!AMOUNT_REGEX.test(amount)) {
      errors.push('Amount must be a positive number with at most 2 decimal places');
    } else if (Number(amount) <= 0) {
      errors.push('Amount must be greater than zero');
    }

    if (!body.journal_id || !UUID_REGEX.test(String(body.journal_id))) {
      errors.push('A valid journal is required');
    }

    if (!body.cash_account_id || !UUID_REGEX.test(String(body.cash_account_id))) {
      errors.push('A valid Cash/Bank account is required');
    }

    // ── allocations ──
    const allocations = Array.isArray(body.allocations) ? body.allocations : null;

    if (!allocations || allocations.length === 0) {
      errors.push('At least one allocation is required');
    } else if (allocations.length > 100) {
      errors.push('A payment cannot be allocated to more than 100 documents');
    } else {
      const seen = new Set();

      allocations.forEach((allocation, index) => {
        const position = index + 1;

        if (!allocation || typeof allocation !== 'object') {
          errors.push(`Allocation ${position} is malformed`);
          return;
        }

        const invoiceId = allocation.customer_invoice_id || null;
        const billId = allocation.vendor_bill_id || null;

        // Exactly one target — the same rule the CHECK constraint enforces.
        if (Boolean(invoiceId) === Boolean(billId)) {
          errors.push(
            `Allocation ${position} must name exactly one of customer_invoice_id or vendor_bill_id`
          );
        }
        if (invoiceId && !UUID_REGEX.test(String(invoiceId))) {
          errors.push(`Allocation ${position} has an invalid invoice id`);
        }
        if (billId && !UUID_REGEX.test(String(billId))) {
          errors.push(`Allocation ${position} has an invalid bill id`);
        }

        // The unique index would reject this too; catching it here gives a
        // sentence rather than a constraint name.
        const key = invoiceId || billId;
        if (key) {
          if (seen.has(key)) {
            errors.push(`Allocation ${position} targets a document already allocated`);
          }
          seen.add(key);
        }

        const allocated = allocation.allocated_amount === undefined || allocation.allocated_amount === null
          ? ''
          : String(allocation.allocated_amount).trim();

        if (!AMOUNT_REGEX.test(allocated)) {
          errors.push(`Allocation ${position} needs a valid amount`);
        } else if (Number(allocated) <= 0) {
          errors.push(`Allocation ${position} must be greater than zero`);
        }
      });

      // Direction and target must agree: money in settles invoices, money out
      // settles bills.
      if (DIRECTIONS.includes(body.direction)) {
        const wantsInvoices = body.direction === 'inbound';
        for (const [index, allocation] of allocations.entries()) {
          if (!allocation || typeof allocation !== 'object') continue;
          const hasInvoice = Boolean(allocation.customer_invoice_id);
          const hasBill = Boolean(allocation.vendor_bill_id);
          if (wantsInvoices && hasBill) {
            errors.push(`Allocation ${index + 1}: an inbound payment settles customer invoices, not vendor bills`);
          }
          if (!wantsInvoices && hasInvoice) {
            errors.push(`Allocation ${index + 1}: an outbound payment settles vendor bills, not customer invoices`);
          }
        }
      }
    }

    if (errors.length > 0) return { isValid: false, errors };

    return {
      isValid: true,
      errors: [],
      data: {
        contact_id: body.contact_id,
        direction: body.direction,
        method: body.method,
        payment_date: body.payment_date,
        // Carried as a STRING to money.js. Parsing to a Number here would be
        // the one float in the path.
        amount,
        reference: optionalText(body.reference),
        notes: optionalText(body.notes),
        journal_id: body.journal_id,
        cash_account_id: body.cash_account_id,
        gateway_payment_id: optionalText(body.gateway_payment_id),
        allocations: allocations.map((allocation) => ({
          customer_invoice_id: allocation.customer_invoice_id || null,
          vendor_bill_id: allocation.vendor_bill_id || null,
          allocated_amount: String(allocation.allocated_amount).trim(),
        })),
      },
    };
  },

  /**
   * @param {object} query
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateListQuery(query = {}) {
    const errors = [];

    if (query.direction && !DIRECTIONS.includes(query.direction)) {
      errors.push(`Direction filter must be one of: ${DIRECTIONS.join(', ')}`);
    }
    if (query.method && !METHODS.includes(query.method)) {
      errors.push(`Method filter must be one of: ${METHODS.join(', ')}`);
    }
    if (query.status && !STATUSES.includes(query.status)) {
      errors.push(`Status filter must be one of: ${STATUSES.join(', ')}`);
    }
    if (query.contact_id && !UUID_REGEX.test(String(query.contact_id))) {
      errors.push('Contact filter must be a valid id');
    }

    if (errors.length > 0) return { isValid: false, errors };

    return {
      isValid: true,
      errors: [],
      data: {
        direction: query.direction || null,
        method: query.method || null,
        status: query.status || null,
        contact_id: query.contact_id || null,
        page: query.page,
        limit: query.limit,
      },
    };
  },
};

module.exports = paymentsValidation;
module.exports.isRealDate = isRealDate;
