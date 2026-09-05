'use client';

import React, { useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import ProductPicker from '../pickers/ProductPicker';
import TaxPicker from '../pickers/TaxPicker';
import AccountPicker from '../pickers/AccountPicker';
import AnalyticAccountPicker from '../pickers/AnalyticAccountPicker';
import { formatMoney } from '@/utils/format';
import { useLocale } from 'next-intl';

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
 * - readOnly: boolean
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
  const { priceField = 'costPrice', taxScope = 'purchase', showAccount = false, readOnly = false } = config;

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
      expense_account_id: null,
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
      expense_account_id: defaultAccount || lines[index].expense_account_id,
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
    <div className="w-full space-y-3">
      <div className="overflow-x-auto rounded-xl border border-gray-700/60 bg-gray-900/50 shadow-inner">
        <table className="w-full text-left text-sm text-gray-300 border-collapse min-w-[750px]">
          <thead>
            <tr className="border-b border-gray-700/80 bg-gray-800/60 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <th className="py-3 px-3 w-10 text-center">#</th>
              <th className="py-3 px-3 min-w-[200px]">Product / Item</th>
              <th className="py-3 px-3 min-w-[180px]">Description</th>
              {showAccount && <th className="py-3 px-3 min-w-[170px]">Account</th>}
              <th className="py-3 px-3 w-24">Qty</th>
              <th className="py-3 px-3 w-32">Unit Price</th>
              <th className="py-3 px-3 min-w-[150px]">Tax</th>
              <th className="py-3 px-3 min-w-[150px]">Cost Center</th>
              <th className="py-3 px-3 w-28 text-right">Subtotal</th>
              {!readOnly && <th className="py-3 px-2 w-12 text-center"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/80">
            {lines.length === 0 ? (
              <tr>
                <td
                  colSpan={showAccount ? 10 : 9}
                  className="py-8 text-center text-gray-500 italic bg-gray-900/30"
                >
                  No items added yet. Click &quot;Add Line Item&quot; below to add products.
                </td>
              </tr>
            ) : (
              lines.map((line, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-gray-800/40 transition-colors duration-150"
                >
                  <td className="py-3 px-3 text-center text-xs font-mono text-gray-500">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-2">
                    {readOnly ? (
                      <span className="font-medium text-gray-200">
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
                  <td className="py-2 px-2">
                    {readOnly ? (
                      <span className="text-gray-300 text-xs">{line.description}</span>
                    ) : (
                      <input
                        type="text"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-gray-800/90 border border-gray-700 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="Item description…"
                        value={line.description || ''}
                        onChange={(e) => handleFieldChange(idx, 'description', e.target.value)}
                        disabled={readOnly}
                      />
                    )}
                  </td>
                  {showAccount && (
                    <td className="py-2 px-2">
                      {readOnly ? (
                        <span className="text-xs text-gray-300">{line.account_name || '—'}</span>
                      ) : (
                        <AccountPicker
                          value={line.expense_account_id}
                          onChange={(acc) =>
                            handleFieldChange(idx, 'expense_account_id', acc ? acc.id : null)
                          }
                          type={priceField === 'costPrice' ? 'expense' : 'income'}
                          disabled={readOnly}
                        />
                      )}
                    </td>
                  )}
                  <td className="py-2 px-2">
                    {readOnly ? (
                      <span className="font-mono text-xs">{line.quantity}</span>
                    ) : (
                      <input
                        type="number"
                        min="0.0001"
                        step="any"
                        className="w-full px-2 py-1.5 rounded-lg bg-gray-800/90 border border-gray-700 text-xs font-mono text-gray-200 focus:outline-none focus:border-indigo-500"
                        value={line.quantity || ''}
                        onChange={(e) => handleFieldChange(idx, 'quantity', e.target.value)}
                        disabled={readOnly}
                      />
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {readOnly ? (
                      <span className="font-mono text-xs text-gray-200">
                        {formatMoney(line.unit_price, locale)}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full px-2 py-1.5 rounded-lg bg-gray-800/90 border border-gray-700 text-xs font-mono text-gray-200 focus:outline-none focus:border-indigo-500"
                        value={line.unit_price || ''}
                        onChange={(e) => handleFieldChange(idx, 'unit_price', e.target.value)}
                        disabled={readOnly}
                      />
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {readOnly ? (
                      <span className="text-xs text-gray-300">
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
                  <td className="py-2 px-2">
                    {readOnly ? (
                      <span className="text-xs text-gray-400">
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
                  <td className="py-2 px-3 text-right font-mono text-xs font-medium text-emerald-400">
                    {formatMoney(line.untaxed_amount || 0, locale)}
                  </td>
                  {!readOnly && (
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete line"
                      >
                        <Trash2 className="w-4 h-4" />
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
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg text-indigo-300 bg-indigo-950/50 border border-indigo-700/50 hover:bg-indigo-900/60 hover:border-indigo-600 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Line Item
          </button>
          <span className="text-xs text-gray-500">
            {lines.length} {lines.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      )}
    </div>
  );
}
