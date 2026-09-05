'use client';

import React, { useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import ProductPicker from '../pickers/ProductPicker';
import TaxPicker from '../pickers/TaxPicker';
import AccountPicker from '../pickers/AccountPicker';
import AnalyticAccountPicker from '../pickers/AnalyticAccountPicker';
import { formatMoney } from '@/utils/format';
import { useLocale, useTranslations } from 'next-intl';

/**
 * DocumentLineGrid Component
 *
 * SPECIFICATION (Doc/phase.md Phase 8, §5.1, §7.2):
 * Universal, configurable line-item grid shared across:
 *   1. Purchase Orders (costPrice, purchaseTaxId)
 *   2. Vendor Bills (costPrice, purchaseTaxId, expense_account_id)
 *   3. Sales Orders (salesPrice, salesTaxId)
 *   4. Customer Invoices (salesPrice, salesTaxId, income_account_id)
 *
 * Config options:
 * - priceField: 'costPrice' | 'salesPrice'
 * - taxScope: 'purchase' | 'sales'
 * - showAccount: boolean (requires GL account selection per line)
 * - accountField: 'expense_account_id' | 'income_account_id'
 * - readOnly: boolean
 *
 * accountField exists because the two sides post to different columns: a
 * purchase line debits an expense account, a sales line credits an income
 * account. Emitting expense_account_id on a sales line would send the server
 * a field it does not read, and the invoice would fail to post with no
 * income account on any line.
 */
export default function DocumentLineGrid({
  lines = [],
  onChange,
  config = {
    priceField: 'costPrice',
    taxScope: 'purchase',
    showAccount: false,
    readOnly: false,
  },
}) {
  const locale = useLocale();
  const t = useTranslations('documentLines');
  const {
    priceField = 'costPrice',
    taxScope = 'purchase',
    showAccount = false,
    readOnly = false,
    // Defaults to the purchase column so existing callers are unaffected.
    accountField = priceField === 'salesPrice' ? 'income_account_id' : 'expense_account_id',
  } = config;

  const handleAddRow = () => {
    if (readOnly) return;
    const newLine = {
      product_id: null,
      description: '',
      quantity: 1,
      unit_price: 0,
      tax_id: null,
      tax_rate: 0,
      untaxed_amount: '0.00',
      tax_amount: '0.00',
      total_amount: '0.00',
      analytic_account_id: null,
      [accountField]: null,
    };
    onChange([...lines, newLine]);
  };

  const handleRemoveRow = (index) => {
    if (readOnly) return;
    const updated = lines.filter((_, i) => i !== index);
    onChange(updated);
  };

  const recalculateLine = useCallback((line) => {
    const qty = parseFloat(line.quantity) || 0;
    const price = parseFloat(line.unit_price) || 0;
    const rate = parseFloat(line.tax_rate) || 0;

    const untaxed = (qty * price).toFixed(2);
    const taxAmt = ((parseFloat(untaxed) * rate) / 100).toFixed(2);
    const total = (parseFloat(untaxed) + parseFloat(taxAmt)).toFixed(2);

    return {
      ...line,
      untaxed_amount: untaxed,
      tax_amount: taxAmt,
      total_amount: total,
    };
  }, []);

  const handleFieldChange = (index, field, value) => {
    if (readOnly) return;
    const line = { ...lines[index], [field]: value };
    const updatedLine = recalculateLine(line);
    const updated = [...lines];
    updated[index] = updatedLine;
    onChange(updated);
  };

  const handleProductSelect = (index, product) => {
    if (readOnly) return;
    if (!product) {
      handleFieldChange(index, 'product_id', null);
      return;
    }

    const price = priceField === 'costPrice' ? (product.cost_price || 0) : (product.sales_price || 0);
    const defaultTaxId = priceField === 'costPrice' ? product.purchase_tax_id : product.sales_tax_id;
    const defaultAccount = priceField === 'costPrice' ? product.expense_account_id : product.income_account_id;

    const line = {
      ...lines[index],
      product_id: product.id,
      description: lines[index].description || product.name,
      unit_price: parseFloat(price) || 0,
      tax_id: defaultTaxId || lines[index].tax_id,
      [accountField]: defaultAccount || lines[index][accountField],
    };

    const updatedLine = recalculateLine(line);
    const updated = [...lines];
    updated[index] = updatedLine;
    onChange(updated);
  };

  const handleTaxSelect = (index, tax) => {
    if (readOnly) return;
    const line = {
      ...lines[index],
      tax_id: tax ? tax.id : null,
      tax_rate: tax ? parseFloat(tax.rate) || 0 : 0,
    };
    const updatedLine = recalculateLine(line);
    const updated = [...lines];
    updated[index] = updatedLine;
    onChange(updated);
  };

  return (
    <div className="line-grid-container">
      <div className="doc-table-wrap">
        <table className="line-grid-table">
          <thead>
            <tr>
              <th className="line-grid-th">#</th>
              <th className="line-grid-th">{t('product')}</th>
              <th className="line-grid-th">{t('description')}</th>
              {showAccount && <th className="line-grid-th">Account</th>}
              <th className="line-grid-th">{t('quantity')}</th>
              <th className="line-grid-th">{t('unitPrice')}</th>
              <th className="line-grid-th">{t('tax')}</th>
              <th className="line-grid-th">{t('analytic')}</th>
              <th className="line-grid-th">{t('subtotal')}</th>
              {!readOnly && <th className="line-grid-th"></th>}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td
                  colSpan={showAccount ? 10 : 9}
                  className="doc-cell-muted"
                >
                  No items added yet. Click &quot;Add Line Item&quot; below to add products.
                </td>
              </tr>
            ) : (
              lines.map((line, idx) => (
                <tr
                  key={idx}

                >
                  <td className="line-grid-td">
                    {idx + 1}
                  </td>
                  <td className="line-grid-td">
                    {readOnly ? (
                      <span >
                        {line.product_name || line.description || 'Custom Item'}
                      </span>
                    ) : (
                      <ProductPicker
                        value={line.product_id}
                        onChange={(item) => handleProductSelect(idx, item)}
                        priceType={priceField}
                        disabled={readOnly}
                      />
                    )}
                  </td>
                  <td className="line-grid-td">
                    {readOnly ? (
                      <span >{line.description}</span>
                    ) : (
                      <input
                        type="text"
                        
                        placeholder="Item description…"
                        value={line.description || ''}
                        onChange={(e) => handleFieldChange(idx, 'description', e.target.value)}
                        disabled={readOnly}
                      />
                    )}
                  </td>
                  {showAccount && (
                    <td className="line-grid-td">
                      {readOnly ? (
                        <span className="doc-cell-muted">{line.account_name || '—'}</span>
                      ) : (
                        <AccountPicker
                          value={line[accountField]}
                          onChange={(acc) =>
                            handleFieldChange(idx, accountField, acc ? acc.id : null)
                          }
                          type={priceField === 'costPrice' ? 'expense' : 'income'}
                          disabled={readOnly}
                        />
                      )}
                    </td>
                  )}
                  <td className="line-grid-td">
                    {readOnly ? (
                      <span className="doc-cell-code">{line.quantity}</span>
                    ) : (
                      <input
                        type="number"
                        min="0.0001"
                        step="any"
                        className="form-input line-grid-input"
                        value={line.quantity || ''}
                        onChange={(e) => handleFieldChange(idx, 'quantity', e.target.value)}
                        disabled={readOnly}
                      />
                    )}
                  </td>
                  <td className="line-grid-td">
                    {readOnly ? (
                      <span className="doc-cell-code">
                        {formatMoney(line.unit_price, locale)}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-input line-grid-input"
                        value={line.unit_price || ''}
                        onChange={(e) => handleFieldChange(idx, 'unit_price', e.target.value)}
                        disabled={readOnly}
                      />
                    )}
                  </td>
                  <td className="line-grid-td">
                    {readOnly ? (
                      <span className="doc-cell-muted">
                        {line.tax_rate ? `${line.tax_rate}%` : '0%'}
                      </span>
                    ) : (
                      <TaxPicker
                        value={line.tax_id}
                        scope={taxScope}
                        onChange={(tax) => handleTaxSelect(idx, tax)}
                        disabled={readOnly}
                      />
                    )}
                  </td>
                  <td className="line-grid-td">
                    {readOnly ? (
                      <span className="doc-cell-muted">
                        {line.analytic_account_name || '—'}
                      </span>
                    ) : (
                      <AnalyticAccountPicker
                        value={line.analytic_account_id}
                        onChange={(an) =>
                          handleFieldChange(idx, 'analytic_account_id', an ? an.id : null)
                        }
                        disabled={readOnly}
                      />
                    )}
                  </td>
                  <td className="line-grid-td">
                    {formatMoney(line.untaxed_amount || 0, locale)}
                  </td>
                  {!readOnly && (
                    <td className="line-grid-td">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        
                        title="Delete line"
                      >
                        <Trash2  />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="line-grid-actions">
          <button
            type="button"
            onClick={handleAddRow}
            className="line-grid-actions-btn"
          >
            <Plus  />
            Add Line Item
          </button>
          <span className="doc-cell-muted">
            {lines.length} {lines.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      )}
    </div>
  );
}
