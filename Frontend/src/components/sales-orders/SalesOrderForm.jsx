'use client';

import React, { useState, useEffect } from 'react';
import ContactPicker from '../pickers/ContactPicker';
import { DocumentLineGrid, DocumentTotals, FormActions, FormField } from '../shared';

/**
 * SalesOrderForm Component
 *
 * Form for creating & editing Sales Orders.
 * - Header: Customer picker (customer/both), Order Date, Expected Delivery Date, Notes.
 * - Lines: Reuses DocumentLineGrid (salesPrice, sales tax, analytic tag).
 * - Totals: Reuses DocumentTotals with untaxed subtotal, tax amount, and grand total.
 */
export default function SalesOrderForm({
  initialData = null,
  onSubmit,
  onCancel,
  loading = false,
  isReadOnly = false,
}) {
  const [formData, setFormData] = useState({
    customer_contact_id: '',
    order_date: new Date().toISOString().slice(0, 10),
    expected_date: '',
    notes: '',
    lines: [
      {
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
      },
    ],
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        customer_contact_id: initialData.customer_contact_id || '',
        order_date: initialData.order_date ? initialData.order_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        expected_date: initialData.expected_date ? initialData.expected_date.slice(0, 10) : '',
        notes: initialData.notes || '',
        lines: initialData.lines?.length
          ? initialData.lines.map((l) => ({
              ...l,
              quantity: parseFloat(l.quantity) || 1,
              unit_price: parseFloat(l.unit_price) || 0,
              tax_rate: parseFloat(l.tax_rate) || 0,
            }))
          : [],
      });
    }
  }, [initialData]);

  // Compute overall summary totals
  const untaxedTotal = formData.lines.reduce(
    (acc, line) => acc + (parseFloat(line.untaxed_amount) || 0),
    0
  );
  const taxTotal = formData.lines.reduce(
    (acc, line) => acc + (parseFloat(line.tax_amount) || 0),
    0
  );
  const grandTotal = untaxedTotal + taxTotal;

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.customer_contact_id) {
      newErrors.customer_contact_id = 'Please select a customer';
    }
    if (!formData.order_date) {
      newErrors.order_date = 'Order date is required';
    }
    if (!formData.lines.length) {
      newErrors.lines = 'At least one line item is required';
    } else {
      const invalidLines = formData.lines.some(
        (l) => !l.description?.trim() || !(parseFloat(l.quantity) > 0)
      );
      if (invalidLines) {
        newErrors.lines = 'All lines must have a description and quantity > 0';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onSubmit({
      ...formData,
      expected_date: formData.expected_date || null,
      lines: formData.lines.map((l, idx) => ({
        line_no: idx + 1,
        product_id: l.product_id || null,
        description: l.description.trim(),
        quantity: parseFloat(l.quantity),
        unit_price: parseFloat(l.unit_price),
        tax_id: l.tax_id || null,
        tax_rate: parseFloat(l.tax_rate || 0),
        analytic_account_id: l.analytic_account_id || null,
      })),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Card */}
      <div className="rounded-xl border border-gray-700/60 bg-gray-900/60 p-6 shadow-md space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-800 pb-2">
          General Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FormField
            label="Customer"
            required
            error={errors.customer_contact_id}
          >
            <ContactPicker
              value={formData.customer_contact_id}
              onChange={(c) =>
                setFormData((prev) => ({
                  ...prev,
                  customer_contact_id: c ? c.id : '',
                }))
              }
              type="customer"
              disabled={isReadOnly}
            />
          </FormField>

          <FormField label="Order Date" required error={errors.order_date}>
            <input
              type="date"
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              value={formData.order_date}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, order_date: e.target.value }))
              }
              disabled={isReadOnly}
            />
          </FormField>

          <FormField label="Expected Delivery Date" error={errors.expected_date}>
            <input
              type="date"
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              value={formData.expected_date}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  expected_date: e.target.value,
                }))
              }
              disabled={isReadOnly}
            />
          </FormField>
        </div>

        <div className="pt-2">
          <FormField label="Terms & Notes">
            <textarea
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              placeholder="Add payment terms, delivery instructions, or notes…"
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              disabled={isReadOnly}
            />
          </FormField>
        </div>
      </div>

      {/* Line Items Card */}
      <div className="rounded-xl border border-gray-700/60 bg-gray-900/60 p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Order Line Items
          </h2>
          {errors.lines && (
            <span className="text-xs text-red-400 font-medium">{errors.lines}</span>
          )}
        </div>

        <DocumentLineGrid
          lines={formData.lines}
          onChange={(newLines) =>
            setFormData((prev) => ({ ...prev, lines: newLines }))
          }
          config={{
            priceField: 'salesPrice',
            taxScope: 'sales',
            showAccount: false,
            readOnly: isReadOnly,
          }}
        />

        <div className="pt-4 flex justify-end">
          <DocumentTotals
            untaxedAmount={untaxedTotal}
            taxAmount={taxTotal}
            totalAmount={grandTotal}
          />
        </div>
      </div>

      {/* Action Buttons */}
      {!isReadOnly && (
        <FormActions
          onCancel={onCancel}
          loading={loading}
          submitText={initialData ? 'Update Sales Order' : 'Create Sales Order'}
        />
      )}
    </form>
  );
}
