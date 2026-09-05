'use client';

import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/shared';
import DashboardFrame from '@/components/dashboard/DashboardFrame';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import organizationsService from '@/services/organizations.service';

export default function OrganizationSettingsPage() {
  const t = useTranslations('organizationSettings');
  const { showSuccess, showError } = useToast();
  const [form, setForm] = useState({ name: '', currency_code: 'INR', fiscal_year_start_month: 4 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    organizationsService.getCurrent()
      .then((res) => {
        const organization = res.data?.organization || res.data;
        if (active && organization) {
          setForm({
            name: organization.name || '',
            currency_code: organization.currency_code || organization.currency || 'INR',
            fiscal_year_start_month: organization.fiscal_year_start_month || 4,
          });
        }
      })
      .catch((error) => showError(error.message || t('loadError')))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showError, t]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await organizationsService.updateCurrent(form);
      showSuccess(t('saved'));
    } catch (error) {
      showError(error.message || t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['business_owner']}>
      <DashboardFrame role="business_owner" activeKey="settings" allowedRoles={['business_owner']}>
        <main className="dash-page">
          <h1 className="dash-page-title">{t('title')}</h1>
          <p className="dash-page-subtitle">{t('subtitle')}</p>
          <form className="dash-form" onSubmit={handleSubmit}>
            <label className="dash-field">
              <span>{t('name')}</span>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} disabled={loading || saving} required />
            </label>
            <label className="dash-field">
              <span>{t('currency')}</span>
              <input value={form.currency_code} onChange={(event) => setForm({ ...form, currency_code: event.target.value.toUpperCase() })} disabled={loading || saving} maxLength={3} required />
            </label>
            <label className="dash-field">
              <span>{t('fiscalYearStartMonth')}</span>
              <select value={form.fiscal_year_start_month} onChange={(event) => setForm({ ...form, fiscal_year_start_month: Number(event.target.value) })} disabled={loading || saving}>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{t(`months.${month}`)}</option>)}
              </select>
            </label>
            <button type="submit" className="dash-btn dash-btn-primary" disabled={loading || saving}>
              <Save size={15} aria-hidden="true" />
              {saving ? t('saving') : t('save')}
            </button>
          </form>
        </main>
      </DashboardFrame>
    </ProtectedRoute>
  );
}
