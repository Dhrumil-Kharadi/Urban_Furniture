/**
 * Products Validation
 *
 * Pure functions returning { isValid, errors, data? }.
 *
 * MONEY: prices are validated and normalised through shared/money.js and are
 * carried as STRINGS from here on. Parsing a price into a JS Number, even
 * briefly, is how rounding error gets into a ledger.
 */

const { PRODUCT_TYPE, PRODUCT_STATUS } = require('../shared/constants');
const { money, toDb } = require('../shared/money');

const PRODUCT_TYPES = Object.values(PRODUCT_TYPE);
const PRODUCT_STATUSES = Object.values(PRODUCT_STATUS);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** SKUs are codes: letters, digits and the separators people actually type. */
const SKU_REGEX = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/;

/** Widest value NUMERIC(15,2) can hold. */
const MAX_PRICE = '9999999999999.99';

/** @private */
function optionalText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Validate an optional money field and normalise it to a fixed-2dp string.
 * @private
 */
function checkPrice(field, label, value, errors, data) {
  if (value === undefined) return;

  if (value === null || value === '') {
    data[field] = '0.00';
    return;
  }

  // Reject anything that is not a plain decimal before decimal.js sees it —
  // Decimal accepts forms (hex, exponent) that have no business being a price.
  if (!/^-?\d{1,13}(\.\d{1,4})?$/.test(String(value).trim())) {
    errors.push(`${label} must be a decimal amount`);
    return;
  }

  const amount = money(value);

  if (amount.isNegative()) {
    errors.push(`${label} cannot be negative`);
    return;
  }

  if (amount.greaterThan(money(MAX_PRICE))) {
    errors.push(`${label} is too large`);
    return;
  }

  data[field] = toDb(amount);
}

/**
 * Validate an optional foreign-key reference.
 * Existence and tenancy are the service's job; this only checks the shape.
 * @private
 */
function checkReference(field, label, value, errors, data) {
  if (value === undefined) return;

  if (value === null || value === '') {
    data[field] = null;
    return;
  }

  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    errors.push(`${label} must be a valid id`);
    return;
  }

  data[field] = value;
}

/** @private */
function checkFields(body, errors, partial) {
  const data = {};

  // ── name ──
  if (body.name !== undefined || !partial) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      errors.push('Name is required');
    } else if (name.length < 2 || name.length > 150) {
      errors.push('Name must be between 2 and 150 characters');
    } else {
      data.name = name;
    }
  }

  // ── product_type ──
  if (body.product_type !== undefined || !partial) {
    if (!PRODUCT_TYPES.includes(body.product_type)) {
      errors.push(`Type is required and must be one of: ${PRODUCT_TYPES.join(', ')}`);
    } else {
      data.product_type = body.product_type;
    }
  }

  // ── sku ── optional, but unique per organization when present.
  if (body.sku !== undefined) {
    const sku = optionalText(body.sku);
    if (sku === null) {
      data.sku = null;
    } else if (!SKU_REGEX.test(sku)) {
      errors.push('SKU may contain only letters, digits, dot, dash, slash and underscore');
    } else {
      data.sku = sku.toUpperCase();
    }
  }

  checkPrice('sales_price', 'Sales price', body.sales_price, errors, data);
  checkPrice('cost_price', 'Cost price', body.cost_price, errors, data);

  checkReference('category_id', 'Category', body.category_id, errors, data);
  checkReference('sales_tax_id', 'Sales tax', body.sales_tax_id, errors, data);
  checkReference('purchase_tax_id', 'Purchase tax', body.purchase_tax_id, errors, data);
  checkReference('income_account_id', 'Income account', body.income_account_id, errors, data);
  checkReference('expense_account_id', 'Expense account', body.expense_account_id, errors, data);

  return data;
}

const productsValidation = {
  /**
   * @param {object} body
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateCreate(body) {
    if (!body || typeof body !== 'object') {
      return { isValid: false, errors: ['Request body must be a JSON object'] };
    }

    const errors = [];
    const data = checkFields(body, errors, false);

    if (errors.length > 0) return { isValid: false, errors };

    return {
      isValid: true,
      errors: [],
      data: {
        name: data.name,
        product_type: data.product_type,
        sku: data.sku ?? null,
        category_id: data.category_id ?? null,
        sales_price: data.sales_price ?? '0.00',
        cost_price: data.cost_price ?? '0.00',
        sales_tax_id: data.sales_tax_id ?? null,
        purchase_tax_id: data.purchase_tax_id ?? null,
        income_account_id: data.income_account_id ?? null,
        expense_account_id: data.expense_account_id ?? null,
      },
    };
  },

  /**
   * @param {object} body
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateUpdate(body) {
    if (!body || typeof body !== 'object') {
      return { isValid: false, errors: ['Request body must be a JSON object'] };
    }

    const errors = [];
    const data = checkFields(body, errors, true);

    if (errors.length === 0 && Object.keys(data).length === 0) {
      errors.push('No updatable fields were provided');
    }

    if (errors.length > 0) return { isValid: false, errors };

    return { isValid: true, errors: [], data };
  },

  /**
   * @param {object} query
   * @returns {{ isValid: boolean, errors: string[], data?: object }}
   */
  validateListQuery(query = {}) {
    const errors = [];

    if (query.status !== undefined && query.status !== '' && !PRODUCT_STATUSES.includes(query.status)) {
      errors.push(`Status filter must be one of: ${PRODUCT_STATUSES.join(', ')}`);
    }

    if (query.type !== undefined && query.type !== '' && !PRODUCT_TYPES.includes(query.type)) {
      errors.push(`Type filter must be one of: ${PRODUCT_TYPES.join(', ')}`);
    }

    if (query.categoryId !== undefined && query.categoryId !== '' && !UUID_REGEX.test(query.categoryId)) {
      errors.push('Category filter must be a valid id');
    }

    if (errors.length > 0) return { isValid: false, errors };

    return {
      isValid: true,
      errors: [],
      data: {
        status: query.status || null,
        type: query.type || null,
        categoryId: query.categoryId || null,
      },
    };
  },
};

module.exports = productsValidation;
