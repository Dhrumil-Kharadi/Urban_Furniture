'use strict';
'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';

import DashboardFrame from '@/components/dashboard/DashboardFrame';
import { useAuth } from '@/context/AuthContext';
import { PageHead } from '@/reusablefiles/dashboardshell';
import Button from '@/reusablefiles/button';
import InputBox from '@/reusablefiles/inputbox';

import FormField from '@/components/shared/FormField';
import FormActions from '@/components/shared/FormActions';
import AccountPicker from '@/components/pickers/AccountPicker';
import { useToast } from '@/components/shared/ToastProvider';
import api from '@/lib/api';

export default function NewJournalPage() {
  const t = useTranslations('journals');
  const tCommon = useTranslations('common');
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    journal_type: 'general',
    sequence_prefix: '',
    default_debit_account_id: null,
    default_credit_account_id: null,
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = tCommon('validation.required');

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const res = await api.post('/journals', formData);
      if (res.success) {
        toast({
          type: 'success',
          title: tCommon('toast.created'),
          message: `Journal "${formData.name}" created successfully.`,
        });
        router.push('/dashboard/journals');
      } else {
        toast({
          type: 'error',
          title: tCommon('toast.error'),
          message: res.message || 'Failed to create journal.',
        });
      }
    } catch (err) {
      toast({
        type: 'error',
        title: tCommon('toast.error'),
        message: err.message || 'An error occurred.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardFrame role={user?.role} activeKey="journals" allowedRoles={['admin', 'manager']}>
      <div className="master-layout">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/journals')}>
            <ArrowLeft size={16} />
            <span>{tCommon('actions.back')}</span>
          </Button>
          <PageHead title={t('createJournal')} subtitle={t('subtitle')} />
        </div>

        <form onSubmit={handleSubmit} className="app-form">
          <div className="app-form-section">
            <h3 className="app-form-section-title">Journal Configuration</h3>
            <p className="app-form-section-desc">
              Define the journal type, sequence prefix, and default offsetting ledger accounts.
            </p>

            <div className="app-form-grid">
              <FormField label={t('fields.name')} required error={errors.name}>
                <InputBox
                  name="name"
                  value={formData.name}
                  onChange={(val) => setFormData((prev) => ({ ...prev, name: val }))}
                  placeholder="e.g. Sales Journal - Retail"
                  disabled={submitting}
                />
              </FormField>

              <FormField label={t('fields.type')} required>
                <select
                  className="form-select"
                  value={formData.journal_type}
                  onChange={(e) => setFormData((prev) => ({ ...prev, journal_type: e.target.value }))}
                  disabled={submitting}
                >
                  <option value="sales">{t('types.sales')}</option>
                  <option value="purchase">{t('types.purchase')}</option>
                  <option value="bank">{t('types.bank')}</option>
                  <option value="cash">{t('types.cash')}</option>
                  <option value="general">{t('types.general')}</option>
                </select>
              </FormField>

              <FormField label={t('fields.sequencePrefix')} hint="Up to 10 characters (e.g. INV, BILL, GEN)">
                <InputBox
                  name="sequence_prefix"
                  value={formData.sequence_prefix}
                  onChange={(val) => setFormData((prev) => ({ ...prev, sequence_prefix: val }))}
                  placeholder="e.g. INV"
                  disabled={submitting}
                />
              </FormField>

              <FormField label={t('fields.defaultDebitAccount')} hint="Preset debit account on line generation">
                <AccountPicker
                  value={formData.default_debit_account_id}
                  onChange={(id) => setFormData((prev) => ({ ...prev, default_debit_account_id: id }))}
                  disabled={submitting}
                />
              </FormField>

              <FormField label={t('fields.defaultCreditAccount')} hint="Preset credit account on line generation">
                <AccountPicker
                  value={formData.default_credit_account_id}
                  onChange={(id) => setFormData((prev) => ({ ...prev, default_credit_account_id: id }))}
                  disabled={submitting}
                />
              </FormField>
            </div>
          </div>

          <FormActions
            onCancel={() => router.push('/dashboard/journals')}
            isSubmitting={submitting}
            submitLabel={tCommon('actions.save')}
          />
        </form>
      </div>
    </DashboardFrame>
  );
}
