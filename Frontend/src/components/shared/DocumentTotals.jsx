'use client';

import React from 'react';
import { formatMoney } from '@/utils/format';
import { useLocale } from 'next-intl';

/**
 * DocumentTotals Component
 *
 * Summary calculations card displaying:
 * - Untaxed Amount (Subtotal)
 * - Tax Amount
 * - Total Amount (Grand Total)
 * - Optional: Amount Paid, Amount Due (for Bills / Invoices)
 */
export default function DocumentTotals({
  untaxedAmount = 0,
  taxAmount = 0,
  totalAmount = 0,
  amountPaid,
  amountDue,
}) {
  const locale = useLocale();

  return (
    <div className="w-full max-w-sm ml-auto rounded-xl border border-gray-700/60 bg-gray-900/60 p-4 space-y-2.5 shadow-md">
      <div className="flex justify-between items-center text-xs text-gray-400">
        <span>Untaxed Subtotal:</span>
        <span className="font-mono font-medium text-gray-200">
          {formatMoney(untaxedAmount, locale)}
        </span>
      </div>

      <div className="flex justify-between items-center text-xs text-gray-400">
        <span>Taxes & GST:</span>
        <span className="font-mono font-medium text-gray-200">
          {formatMoney(taxAmount, locale)}
        </span>
      </div>

      <div className="border-t border-gray-700/80 pt-2 flex justify-between items-center">
        <span className="text-sm font-semibold text-gray-100">Total:</span>
        <span className="text-base font-mono font-bold text-indigo-400">
          {formatMoney(totalAmount, locale)}
        </span>
      </div>

      {amountPaid !== undefined && (
        <div className="flex justify-between items-center text-xs text-gray-400 pt-1 border-t border-gray-800">
          <span>Amount Paid:</span>
          <span className="font-mono text-emerald-400">
            {formatMoney(amountPaid, locale)}
          </span>
        </div>
      )}

      {amountDue !== undefined && (
        <div className="flex justify-between items-center text-xs font-medium pt-0.5">
          <span className="text-amber-400">Amount Due:</span>
          <span className="font-mono text-amber-300 font-bold">
            {formatMoney(amountDue, locale)}
          </span>
        </div>
      )}
    </div>
  );
}
