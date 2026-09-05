'use client';

import React, { useState, useEffect } from 'react';
import ContactPicker from '../pickers/ContactPicker';
import { DocumentLineGrid, DocumentTotals, FormActions, FormField } from '../shared';

/**
 * PurchaseOrderForm Component
 *
 * Form for creating & editing Purchase Orders.
 * - Header: Vendor picker (vendor/both), Order Date, Expected Delivery Date, Notes.
 * - Lines: Configurable DocumentLineGrid (costPrice, purchase tax, cost-centre analytic tag).
 * - Totals: DocumentTotals with untaxed subtotal, tax amount, and grand total.
 */
export default function PurchaseOrderForm({
  initialData = null,
  onSubmit,
  onCancel,
  loading = false,
  isReadOnly = false,
}) {
  const [formData, setFormData] = useState({
    vendor_contact_id: '',
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
        vendor_contact_id: initialData.vendor_contact_id || '',
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

    if (!formData.vendor_contact_id) {
      newErrors.vendor_contact_id = 'Please select a vendor';
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
    <form onSubmit={handleSubmit} className="app-form">
      {/* Header Card */}
      <div className="tx-form-card">
        <h2 className="tx-form-card-title">
          General Details
        </h2>

        <div className="tx-form-card-grid--3col">
          <FormField
            label="Vendor / Supplier"
            required
            error={errors.vendor_contact_id}
          >
            <ContactPicker
              value={formData.vendor_contact_id}
              onChange={(c) =>
                setFormData((prev) => ({
                  ...prev,
                  vendor_contact_id: c ? c.id : '',
                }))
              }
              type="vendor"
              disabled={isReadOnly}
            />
          </FormField>

          <FormField label="Order Date" required error={errors.order_date}>
            <input
              type="date"
              className="tx-form-input"
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
              className="tx-form-input"
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

        <div className="tx-form-card-notes">
          <FormField label="Terms & Notes">
            <textarea
              rows={2}
              className="tx-form-textarea"
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
      <div className="tx-form-card">
        <div className="tx-form-card-header">
          <h2 className="tx-form-card-title" style={{ border: 'none', paddingBottom: 0 }}>
            Order Line Items
          </h2>
          {errors.lines && (
            <span className="tx-line-error">{errors.lines}</span>
          )}
        </div>

        <DocumentLineGrid
          lines={formData.lines}
          onChange={(newLines) =>
            setFormData((prev) => ({ ...prev, lines: newLines }))
          }
          config={{
            priceField: 'costPrice',
            taxScope: 'purchase',
            showAccount: false,
            readOnly: isReadOnly,
          }}
        />

        <div className="tx-form-card-totals">
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
          submitText={initialData ? 'Update Purchase Order' : 'Create Purchase Order'}
        />
      )}
    </form>
  );
}
