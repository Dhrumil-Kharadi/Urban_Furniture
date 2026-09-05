'use client';

// ============================================================
// FILE: src/components/budgets/BudgetDrawer.jsx
//
// Create & Edit modal for Budgets.
// Strict styling per strict.md: pure CSS classes from budgets.css,
// zero Tailwind utility classes, Orbitron/Sora typography.
// ============================================================

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X, Calendar, DollarSign, FileText } from 'lucide-react';
import Button from '@/reusablefiles/button';
import InputBox from '@/reusablefiles/inputbox';
import api from '@/lib/api';

export default function BudgetDrawer({
  isOpen,
  onClose,
  onSaved,
  budget = null,
}) {
  const t = useTranslations('budgets');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    analytic_account_id: '',
    period_start: '',
    period_end: '',
    planned_amount: '',
    status: 'active',
  });

  const [analyticAccounts, setAnalyticAccounts] = useState([]);
  const [fetchingAnalytics, setFetchingAnalytics] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (budget) {
        setFormData({
          name: budget.name || '',
          analytic_account_id: budget.analytic_account_id || '',
          period_start: budget.period_start ? budget.period_start.split('T')[0] : '',
          period_end: budget.period_end ? budget.period_end.split('T')[0] : '',
          planned_amount: budget.planned_amount || '',
          status: budget.status || 'active',
        });
      } else {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        setFormData({
          name: '',
          analytic_account_id: '',
          period_start: start,
          period_end: end,
          planned_amount: '',
          status: 'active',
        });
      }

      setFetchingAnalytics(true);
      api.get('/analytic-accounts?status=active&limit=100')
        .then((res) => {
          if (res?.data?.items) {
            setAnalyticAccounts(res.data.items);
          } else if (res?.items) {
            setAnalyticAccounts(res.items);
          }
        })
        .catch((err) => console.error('Failed to load analytic accounts', err))
        .finally(() => setFetchingAnalytics(false));
    }
  }, [isOpen, budget]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!formData.name.trim()) throw new Error('Budget name is required');
      if (!formData.analytic_account_id) throw new Error('Analytic account is required');
      if (!formData.period_start) throw new Error('Period start date is required');
      if (!formData.period_end) throw new Error('Period end date is required');
      if (new Date(formData.period_end) < new Date(formData.period_start)) {
        throw new Error('Period end date cannot be before start date');
      }
      if (!formData.planned_amount || Number(formData.planned_amount) < 0) {
        throw new Error('Valid planned amount is required');
      }

      if (budget?.id) {
        await api.patch(`/budgets/${budget.id}`, formData);
      } else {
        await api.post('/budgets', formData);
      }

      onSaved?.();
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to save budget');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="budget-modal-backdrop">
      <div className="budget-modal-dialog">
        {/* Header */}
        <div className="budget-modal-head">
          <div>
            <span className="budget-badge">
              {t('badge')}
            </span>
            <h2 className="budget-modal-title">
              {budget ? t('editBudget') : t('newBudget')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="budget-action-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="budget-modal-body">
            {error && (
              <div style={{
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.25)',
                color: '#dc2626',
                fontFamily: 'Sora, sans-serif',
                fontSize: '0.84rem'
              }}>
                {error}
              </div>
            )}

            <div>
              <label className="budget-form-label">
                {t('fields.name')} *
              </label>
              <InputBox
                value={formData.name}
                onChange={(val) => setFormData((prev) => ({ ...prev, name: val }))}
                placeholder={t('placeholders.name')}
                icon={<FileText size={16} />}
                required
              />
            </div>

            <div>
              <label className="budget-form-label">
                {t('fields.analyticAccount')} *
              </label>
              <select
                value={formData.analytic_account_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, analytic_account_id: e.target.value }))}
                className="budget-select"
                style={{ width: '100%' }}
                required
                disabled={fetchingAnalytics}
              >
                <option value="">
                  {fetchingAnalytics ? 'Loading accounts…' : t('placeholders.analyticAccount')}
                </option>
                {analyticAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code ? `[${acc.code}] ` : ''}{acc.name} ({acc.department || acc.analytic_type})
                  </option>
                ))}
              </select>
            </div>

            <div className="budget-form-row">
              <div>
                <label className="budget-form-label">
                  {t('fields.periodStart')} *
                </label>
                <InputBox
                  type="date"
                  value={formData.period_start}
                  onChange={(val) => setFormData((prev) => ({ ...prev, period_start: val }))}
                  icon={<Calendar size={16} />}
                  required
                />
              </div>
              <div>
                <label className="budget-form-label">
                  {t('fields.periodEnd')} *
                </label>
                <InputBox
                  type="date"
                  value={formData.period_end}
                  onChange={(val) => setFormData((prev) => ({ ...prev, period_end: val }))}
                  icon={<Calendar size={16} />}
                  required
                />
              </div>
            </div>

            <div>
              <label className="budget-form-label">
                {t('fields.plannedAmount')} (₹) *
              </label>
              <InputBox
                type="number"
                step="0.01"
                min="0"
                value={formData.planned_amount}
                onChange={(val) => setFormData((prev) => ({ ...prev, planned_amount: val }))}
                placeholder={t('placeholders.plannedAmount')}
                icon={<DollarSign size={16} />}
                required
              />
            </div>

            <div>
              <label className="budget-form-label">
                {t('fields.status')}
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                className="budget-select"
                style={{ width: '100%' }}
              >
                <option value="draft">{t('status.draft')}</option>
                <option value="active">{t('status.active')}</option>
                <option value="archived">{t('status.archived')}</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="budget-modal-foot">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              {t('cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={loading}>
              {t('save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
