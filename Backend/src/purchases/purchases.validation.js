/**
 * Purchase Validation Schemas
 *
 * Input validation for Purchase Order and Vendor Bill endpoints.
 * All monetary totals are IGNORED from client; server recomputes.
 */

const purchasesValidation = {
  /**
   * Validate create Purchase Order payload.
   */
  validateCreatePO(body) {
    const errors = [];

    if (!body.vendor_contact_id || typeof body.vendor_contact_id !== 'string') {
      errors.push('vendor_contact_id is required');
    }
    if (!body.order_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.order_date)) {
      errors.push('order_date is required (YYYY-MM-DD)');
    }
    if (body.expected_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.expected_date)) {
      errors.push('expected_date must be YYYY-MM-DD if provided');
    }
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      errors.push('At least one line item is required');
    }

    if (body.lines && Array.isArray(body.lines)) {
      body.lines.forEach((line, i) => {
        const num = i + 1;
        if (!line.description || typeof line.description !== 'string' || !line.description.trim()) {
          errors.push(`Line ${num}: description is required`);
        }
        const qty = Number(line.quantity);
        if (!qty || qty <= 0) {
          errors.push(`Line ${num}: quantity must be a positive number`);
        }
        const price = Number(line.unit_price);
        if (price === undefined || price === null || isNaN(price) || price < 0) {
          errors.push(`Line ${num}: unit_price must be a non-negative number`);
        }
      });
    }

    return errors.length > 0 ? errors : null;
  },

  /**
   * Validate update Purchase Order payload (draft only).
   */
  validateUpdatePO(body) {
    const errors = [];

    if (body.order_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.order_date)) {
      errors.push('order_date must be YYYY-MM-DD');
    }
    if (body.expected_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.expected_date)) {
      errors.push('expected_date must be YYYY-MM-DD');
    }
    if (body.lines !== undefined) {
      if (!Array.isArray(body.lines) || body.lines.length === 0) {
        errors.push('At least one line item is required when updating lines');
      }
      if (Array.isArray(body.lines)) {
        body.lines.forEach((line, i) => {
          const num = i + 1;
          if (!line.description || typeof line.description !== 'string' || !line.description.trim()) {
            errors.push(`Line ${num}: description is required`);
          }
          const qty = Number(line.quantity);
          if (!qty || qty <= 0) {
            errors.push(`Line ${num}: quantity must be a positive number`);
          }
          const price = Number(line.unit_price);
          if (price === undefined || price === null || isNaN(price) || price < 0) {
            errors.push(`Line ${num}: unit_price must be a non-negative number`);
          }
        });
      }
    }

    return errors.length > 0 ? errors : null;
  },

  /**
   * Validate create Vendor Bill payload.
   */
  validateCreateBill(body) {
    const errors = [];

    if (!body.vendor_contact_id || typeof body.vendor_contact_id !== 'string') {
      errors.push('vendor_contact_id is required');
    }
    if (!body.bill_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.bill_date)) {
      errors.push('bill_date is required (YYYY-MM-DD)');
    }
    if (body.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.due_date)) {
      errors.push('due_date must be YYYY-MM-DD if provided');
    }
    if (!body.journal_id || typeof body.journal_id !== 'string') {
      errors.push('journal_id is required');
    }
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      errors.push('At least one line item is required');
    }

    if (body.lines && Array.isArray(body.lines)) {
      body.lines.forEach((line, i) => {
        const num = i + 1;
        if (!line.description || typeof line.description !== 'string' || !line.description.trim()) {
          errors.push(`Line ${num}: description is required`);
        }
        const qty = Number(line.quantity);
        if (!qty || qty <= 0) {
          errors.push(`Line ${num}: quantity must be a positive number`);
        }
        const price = Number(line.unit_price);
        if (price === undefined || price === null || isNaN(price) || price < 0) {
          errors.push(`Line ${num}: unit_price must be a non-negative number`);
        }
        if (!line.expense_account_id || typeof line.expense_account_id !== 'string') {
          errors.push(`Line ${num}: expense_account_id is required`);
        }
      });
    }

    return errors.length > 0 ? errors : null;
  },

  /**
   * Validate update Vendor Bill payload (draft only).
   */
  validateUpdateBill(body) {
    const errors = [];

    if (body.bill_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.bill_date)) {
      errors.push('bill_date must be YYYY-MM-DD');
    }
    if (body.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.due_date)) {
      errors.push('due_date must be YYYY-MM-DD');
    }
    if (body.lines !== undefined) {
      if (!Array.isArray(body.lines) || body.lines.length === 0) {
        errors.push('At least one line item is required when updating lines');
      }
      if (Array.isArray(body.lines)) {
        body.lines.forEach((line, i) => {
          const num = i + 1;
          if (!line.description || typeof line.description !== 'string' || !line.description.trim()) {
            errors.push(`Line ${num}: description is required`);
          }
          const qty = Number(line.quantity);
          if (!qty || qty <= 0) {
            errors.push(`Line ${num}: quantity must be a positive number`);
          }
          const price = Number(line.unit_price);
          if (price === undefined || price === null || isNaN(price) || price < 0) {
            errors.push(`Line ${num}: unit_price must be a non-negative number`);
          }
          if (!line.expense_account_id || typeof line.expense_account_id !== 'string') {
            errors.push(`Line ${num}: expense_account_id is required`);
          }
        });
      }
    }

    return errors.length > 0 ? errors : null;
  },
};

module.exports = purchasesValidation;
