/**
 * Sales Validation
 *
 * Pure functions returning { isValid, errors, data? }.
 *
 * Note what is NOT validated here: totals. A client may send them and they are
 * simply dropped — the server recomputes from the lines. Validating a
 * client-sent total would imply it is worth something.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const QUANTITY_REGEX = /^\d{1,8}(\.\d{1,4})?$/;
const AMOUNT_REGEX = /^\d{1,13}(\.\d{1,2})?$/;
const RATE_REGEX = /^\d{1,3}(\.\d{1,4})?$/;

const SO_STATUSES = ['draft', 'confirmed', 'invoiced', 'cancelled'];
const INVOICE_STATUSES = ['draft', 'posted', 'partially_paid', 'paid', 'overdue', 'cancelled'];

/** @private */
function optionalText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

/** A real calendar date — '2026-02-31' passes the regex and is not one. @private */
function isRealDate(value) {
  if (!DATE_REGEX.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Validate the document line array shared by every sales document.
 * @private
 */
function checkLines(lines, errors) {
  if (!Array.isArray(lines) || lines.length === 0) {
    errors.push('At least one line is required');
    return null;
  }
  if (lines.length > 200) {
    errors.push('A document cannot exceed 200 lines');
    return null;
  }

  const clean = [];

  lines.forEach((line, index) => {
    const lineNo = index + 1;

    if (!line || typeof line !== 'object') {
      errors.push(`Line ${lineNo} is malformed`);
      return;
    }

    // quantity — required and strictly positive; a zero-quantity line is
    // either a mistake or a comment, and neither belongs on a total.
    if (!QUANTITY_REGEX.test(String(line.quantity ?? '').trim())) {
      errors.push(`Line ${lineNo} needs a valid quantity`);
    } else if (Number(line.quantity) <= 0) {
      errors.push(`Line ${lineNo} quantity must be greater than zero`);
    }

    // unit_price — optional; falls back to the product's sales price.
    if (line.unit_price !== undefined && line.unit_price !== null && line.unit_price !== '') {
      if (!AMOUNT_REGEX.test(String(line.unit_price).trim())) {
        errors.push(`Line ${lineNo} has an invalid unit price`);
      }
    }

    if (line.tax_rate !== undefined && line.tax_rate !== null && line.tax_rate !== '') {
      if (!RATE_REGEX.test(String(line.tax_rate).trim()) || Number(line.tax_rate) > 100) {
        errors.push(`Line ${lineNo} has an invalid tax rate`);
      }
    }

    for (const [field, label] of [
      ['product_id', 'product'],
      ['tax_id', 'tax'],
      ['analytic_account_id', 'analytic account'],
      ['income_account_id', 'income account'],
    ]) {
      const value = line[field];
      if (value === undefined || value === null || value === '') continue;
      if (!UUID_REGEX.test(String(value))) {
        errors.push(`Line ${lineNo} has an invalid ${label}`);
      }
    }

    // A line needs something to call itself — either a product to take a name
    // from, or a description.
    if (!line.product_id && !optionalText(line.description)) {
      errors.push(`Line ${lineNo} needs a product or a description`);
    }

    clean.push({
      product_id: line.product_id || null,
      description: optionalText(line.description) || '',
      quantity: String(line.quantity).trim(),
      unit_price:
        line.unit_price === undefined || line.unit_price === null || line.unit_price === ''
          ? undefined
          : String(line.unit_price).trim(),
      tax_id: line.tax_id || null,
      tax_rate:
        line.tax_rate === undefined || line.tax_rate === null || line.tax_rate === ''
          ? undefined
          : String(line.tax_rate).trim(),
      analytic_account_id: line.analytic_account_id || null,
      income_account_id: line.income_account_id || null,
    });
  });

  return clean;
}

const salesValidation = {
  /**
   * @param {object} body
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateCreateSalesOrder(body) {
    if (!body || typeof body !== 'object') {
      return { isValid: false, errors: ['Request body must be a JSON object'] };
    }

    const errors = [];

    if (!body.customer_contact_id || !UUID_REGEX.test(String(body.customer_contact_id))) {
      errors.push('A valid customer is required');
    }
    if (!body.order_date || !isRealDate(String(body.order_date))) {
      errors.push('A valid order date (YYYY-MM-DD) is required');
    }
    if (body.expected_date && !isRealDate(String(body.expected_date))) {
      errors.push('Expected date must be a valid date (YYYY-MM-DD)');
    }

    const lines = checkLines(body.lines, errors);

    if (errors.length > 0) return { isValid: false, errors };

    return {
      isValid: true,
      errors: [],
      data: {
        customer_contact_id: body.customer_contact_id,
        order_date: body.order_date,
        expected_date: optionalText(body.expected_date),
        notes: optionalText(body.notes),
        lines,
      },
    };
  },

  /**
   * @param {object} body
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateUpdateSalesOrder(body) {
    if (!body || typeof body !== 'object') {
      return { isValid: false, errors: ['Request body must be a JSON object'] };
    }

    const errors = [];
    const data = {};

    if (body.customer_contact_id !== undefined) {
      if (!UUID_REGEX.test(String(body.customer_contact_id))) {
        errors.push('Customer must be a valid id');
      } else {
        data.customer_contact_id = body.customer_contact_id;
      }
    }
    if (body.order_date !== undefined) {
      if (!isRealDate(String(body.order_date))) errors.push('Order date must be valid');
      else data.order_date = body.order_date;
    }
    if (body.expected_date !== undefined) {
      const value = optionalText(body.expected_date);
      if (value && !isRealDate(value)) errors.push('Expected date must be valid');
      else data.expected_date = value;
    }
    if (body.notes !== undefined) data.notes = optionalText(body.notes);

    if (body.lines !== undefined) {
      const lines = checkLines(body.lines, errors);
      if (lines) data.lines = lines;
    }

    if (errors.length === 0 && Object.keys(data).length === 0) {
      errors.push('No updatable fields were provided');
    }
    if (errors.length > 0) return { isValid: false, errors };

    return { isValid: true, errors: [], data };
  },

  /**
   * SO → Invoice conversion payload.
   *
   * @param {object} body
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateCreateInvoiceFromSO(body) {
    const source = body && typeof body === 'object' ? body : {};
    const errors = [];

    if (!source.journal_id || !UUID_REGEX.test(String(source.journal_id))) {
      errors.push('A valid sales journal is required');
    }

    const invoiceDate = optionalText(source.invoice_date) || new Date().toISOString().slice(0, 10);
    if (!isRealDate(invoiceDate)) errors.push('Invoice date must be a valid date (YYYY-MM-DD)');

    const dueDate = optionalText(source.due_date);
    if (dueDate && !isRealDate(dueDate)) {
      errors.push('Due date must be a valid date (YYYY-MM-DD)');
    }
    if (dueDate && dueDate < invoiceDate) {
      errors.push('Due date cannot be before the invoice date');
    }

    if (errors.length > 0) return { isValid: false, errors };

    return {
      isValid: true,
      errors: [],
      data: { journal_id: source.journal_id, invoice_date: invoiceDate, due_date: dueDate },
    };
  },

  /**
   * @param {object} body
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateCreateInvoice(body) {
    if (!body || typeof body !== 'object') {
      return { isValid: false, errors: ['Request body must be a JSON object'] };
    }

    const errors = [];

    if (!body.customer_contact_id || !UUID_REGEX.test(String(body.customer_contact_id))) {
      errors.push('A valid customer is required');
    }
    if (!body.journal_id || !UUID_REGEX.test(String(body.journal_id))) {
      errors.push('A valid sales journal is required');
    }
    if (!body.invoice_date || !isRealDate(String(body.invoice_date))) {
      errors.push('A valid invoice date (YYYY-MM-DD) is required');
    }

    const dueDate = optionalText(body.due_date);
    if (dueDate && !isRealDate(dueDate)) {
      errors.push('Due date must be a valid date (YYYY-MM-DD)');
    }
    if (dueDate && body.invoice_date && dueDate < String(body.invoice_date)) {
      errors.push('Due date cannot be before the invoice date');
    }

    const lines = checkLines(body.lines, errors);

    if (errors.length > 0) return { isValid: false, errors };

    return {
      isValid: true,
      errors: [],
      data: {
        customer_contact_id: body.customer_contact_id,
        journal_id: body.journal_id,
        invoice_date: body.invoice_date,
        due_date: dueDate,
        notes: optionalText(body.notes),
        lines,
      },
    };
  },

  /**
   * @param {object} body
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateUpdateInvoice(body) {
    if (!body || typeof body !== 'object') {
      return { isValid: false, errors: ['Request body must be a JSON object'] };
    }

    const errors = [];
    const data = {};

    if (body.customer_contact_id !== undefined) {
      if (!UUID_REGEX.test(String(body.customer_contact_id))) {
        errors.push('Customer must be a valid id');
      } else {
        data.customer_contact_id = body.customer_contact_id;
      }
    }
    if (body.journal_id !== undefined) {
      if (!UUID_REGEX.test(String(body.journal_id))) errors.push('Journal must be a valid id');
      else data.journal_id = body.journal_id;
    }
    if (body.invoice_date !== undefined) {
      if (!isRealDate(String(body.invoice_date))) errors.push('Invoice date must be valid');
      else data.invoice_date = body.invoice_date;
    }
    if (body.due_date !== undefined) {
      const value = optionalText(body.due_date);
      if (value && !isRealDate(value)) errors.push('Due date must be valid');
      else data.due_date = value;
    }
    if (body.notes !== undefined) data.notes = optionalText(body.notes);

    if (body.lines !== undefined) {
      const lines = checkLines(body.lines, errors);
      if (lines) data.lines = lines;
    }

    if (errors.length === 0 && Object.keys(data).length === 0) {
      errors.push('No updatable fields were provided');
    }
    if (errors.length > 0) return { isValid: false, errors };

    return { isValid: true, errors: [], data };
  },

  /**
   * @param {object} query
   * @param {'so'|'invoice'} kind
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateListQuery(query = {}, kind = 'so') {
    const errors = [];
    const allowed = kind === 'invoice' ? INVOICE_STATUSES : SO_STATUSES;

    if (query.status !== undefined && query.status !== '' && !allowed.includes(query.status)) {
      errors.push(`Status filter must be one of: ${allowed.join(', ')}`);
    }

    const contactKey = kind === 'invoice' ? 'customer_contact_id' : 'customer_contact_id';
    if (query[contactKey] && !UUID_REGEX.test(String(query[contactKey]))) {
      errors.push('Customer filter must be a valid id');
    }

    if (errors.length > 0) return { isValid: false, errors };

    return {
      isValid: true,
      errors: [],
      data: {
        status: query.status || null,
        customer_contact_id: query[contactKey] || null,
        overdue: query.overdue === 'true' || query.overdue === true,
        page: query.page,
        limit: query.limit,
      },
    };
  },
};

module.exports = salesValidation;
module.exports.isRealDate = isRealDate;
