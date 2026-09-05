'use client';

/**
 * @file BudgetForm Component
 * @spec Doc/project.md §4.7, §8, Doc/phase.md Phase 12
 * 
 * Reusable budget creation and editing form.
 * Pure Vanilla CSS adhering to strict.md with Frozen Lake design tokens.
 */

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import InputBox from '@/reusablefiles/inputbox';
import Button from '@/reusablefiles/button';
import api from '@/lib/api';

export default function BudgetForm({
  initialData = null,
  onSubmit,
  onCancel,
  isSubmitting = false,
  isReadOnly = false,
}) {
  const t = useTranslations('budgets');

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    analytic_account_id: initialData?.analytic_account_id || '',
    period_start: initialData?.period_start ? initialData.period_start.split('T')[0] : '',
    period_end: initialData?.period_end ? initialData.period_end.split('T')[0] : '',
    planned_amount: initialData?.planned_amount || '',
    status: initialData?.status || 'active',
  });

  const [analyticAccounts, setAnalyticAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setLoadingAccounts(true);
    api.get('/analytic-accounts?status=active&limit=100')
      .then((res) => {
        if (res?.data?.items) {
          setAnalyticAccounts(res.data.items);
        } else if (res?.items) {
          setAnalyticAccounts(res.items);
        }
      })
      .catch((err) => console.error('Failed to load analytic accounts', err))
      .finally(() => setLoadingAccounts(false));
  }, []);

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Budget name is required';
    if (!formData.analytic_account_id) errs.analytic_account_id = 'Analytic account is required';
    if (!formData.period_start) errs.period_start = 'Start date is required';
    if (!formData.period_end) errs.period_end = 'End date is required';
    if (formData.period_start && formData.period_end && formData.period_end < formData.period_start) {
      errs.period_end = 'End date cannot be before start date';
    }
    if (!formData.planned_amount || Number(formData.planned_amount) <= 0) {
      errs.planned_amount = 'A positive planned amount is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;
    onSubmit?.({
      ...formData,
      planned_amount: String(formData.planned_amount),
    });
  };

  const accountOptions = [
    { value: '', label: loadingAccounts ? 'Loading cost centers...' : 'Select an analytic account...' },
    ...analyticAccounts.map((acc) => ({
      value: acc.id,
      label: `${acc.code ? acc.code + ' — ' : ''}${acc.name}`,
    })),
  ];

  return (
    <form onSubmit={handleSubmit} className="app-form" noValidate>
      <div className="app-form-section">
        <h2 className="app-form-section-title">Budget Details</h2>
        <p className="app-form-section-desc">
          Set spending caps and targets against cost centers for variance tracking.
        </p>

        <div className="app-form-grid">
          <div className="is-full">
            <InputBox
              label="Budget Name"
              value={formData.name}
              onChange={(val) => setFormData((prev) => ({ ...prev, name: val }))}
              placeholder="e.g., FY2026 Marketing & Growth"
              required
              disabled={isReadOnly}
              error={errors.name}
            />
          </div>

          <div className="is-full">
            <InputBox
              as="select"
              label="Analytic Account / Cost Center"
              value={formData.analytic_account_id}
              onChange={(val) => setFormData((prev) => ({ ...prev, analytic_account_id: val }))}
              options={accountOptions}
              required
              disabled={isReadOnly || loadingAccounts}
              error={errors.analytic_account_id}
            />
          </div>

          <InputBox
            type="date"
            label="Period Start"
            value={formData.period_start}
            onChange={(val) => setFormData((prev) => ({ ...prev, period_start: val }))}
            required
            disabled={isReadOnly}
            error={errors.period_start}
          />

          <InputBox
            type="date"
            label="Period End"
            value={formData.period_end}
            onChange={(val) => setFormData((prev) => ({ ...prev, period_end: val }))}
            required
            disabled={isReadOnly}
            error={errors.period_end}
          />

          <InputBox
            type="number"
            step="0.01"
            label="Planned Budget Amount (₹)"
            value={formData.planned_amount}
            onChange={(val) => setFormData((prev) => ({ ...prev, planned_amount: val }))}
            placeholder="0.00"
            required
            disabled={isReadOnly}
            error={errors.planned_amount}
          />

          <InputBox
            as="select"
            label="Budget Status"
            value={formData.status}
            onChange={(val) => setFormData((prev) => ({ ...prev, status: val }))}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'draft', label: 'Draft' },
              { value: 'closed', label: 'Closed' },
            ]}
            disabled={isReadOnly}
          />
        </div>
      </div>

      {!isReadOnly && (
        <div className="md-form-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          {onCancel && (
            <Button variant="ghost" type="button" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          <Button variant="solid" type="submit" loading={isSubmitting} disabled={isSubmitting}>
            {initialData ? 'Save Changes' : 'Create Budget'}
          </Button>
        </div>
      )}
    </form>
  );
}
