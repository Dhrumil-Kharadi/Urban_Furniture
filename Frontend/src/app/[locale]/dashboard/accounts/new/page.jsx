'use strict';
'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { ArrowLeft, Save } from 'lucide-react';

import DashboardFrame from '@/components/dashboard/DashboardFrame';
import { useAuth } from '@/context/AuthContext';
import { PageHead } from '@/reusablefiles/dashboardshell';
import Card, { CardBody } from '@/reusablefiles/card';
import Button from '@/reusablefiles/button';
import InputBox from '@/reusablefiles/inputbox';

import FormField from '@/components/shared/FormField';
import FormActions from '@/components/shared/FormActions';
import AccountPicker from '@/components/pickers/AccountPicker';
import { useToast } from '@/components/shared/ToastProvider';
import api from '@/lib/api';

export default function NewAccountPage() {
  const t = useTranslations('accounts');
  const tCommon = useTranslations('common');
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    account_type: 'asset',
    parent_account_id: null,
    opening_balance: '0.00',
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.code.trim()) newErrors.code = tCommon('validation.required');
    if (!formData.name.trim()) newErrors.name = tCommon('validation.required');

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const res = await api.post('/accounts', formData);
      if (res.success) {
        toast({
          type: 'success',
          title: tCommon('toast.created'),
          message: `Account ${formData.code} created successfully.`,
        });
        router.push('/dashboard/accounts');
      } else {
        toast({
          type: 'error',
          title: tCommon('toast.error'),
          message: res.message || 'Failed to create account.',
        });
        if (res.errors) {
          const fieldErrors = {};
          res.errors.forEach((err) => {
            if (err.toLowerCase().includes('code')) fieldErrors.code = err;
            if (err.toLowerCase().includes('name')) fieldErrors.name = err;
            if (err.toLowerCase().includes('parent')) fieldErrors.parent_account_id = err;
          });
          setErrors(fieldErrors);
        }
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
    <DashboardFrame role={user?.role} activeKey="accounts" allowedRoles={['admin', 'manager']}>
      <div className="master-layout">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/accounts')}>
            <ArrowLeft size={16} />
            <span>{tCommon('actions.back')}</span>
          </Button>
          <PageHead title={t('createAccount')} subtitle={t('subtitle')} />
        </div>

        <form onSubmit={handleSubmit} className="app-form">
          <div className="app-form-section">
            <h3 className="app-form-section-title">Account Details</h3>
            <p className="app-form-section-desc">
              Specify General Ledger account classification, code, and parent relationship.
            </p>

            <div className="app-form-grid">
              <FormField label={t('fields.code')} required error={errors.code} hint="Unique per organization (e.g. 1010)">
                <InputBox
                  name="code"
                  value={formData.code}
                  onChange={(val) => setFormData((prev) => ({ ...prev, code: val }))}
                  placeholder="1010"
                  disabled={submitting}
                />
              </FormField>

              <FormField label={t('fields.name')} required error={errors.name} hint="Descriptive title of the ledger account">
                <InputBox
                  name="name"
                  value={formData.name}
                  onChange={(val) => setFormData((prev) => ({ ...prev, name: val }))}
                  placeholder="Cash on Hand"
                  disabled={submitting}
                />
              </FormField>

              <FormField label={t('fields.type')} required hint="Double-entry financial classification">
                <select
                  className="form-select"
                  value={formData.account_type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      account_type: newType,
                      parent_account_id: null, // Reset parent if classification changes
                    }));
                  }}
                  disabled={submitting}
                >
                  <option value="asset">{t('types.asset')}</option>
                  <option value="liability">{t('types.liability')}</option>
                  <option value="capital">{t('types.capital')}</option>
                  <option value="income">{t('types.income')}</option>
                  <option value="expense">{t('types.expense')}</option>
                </select>
              </FormField>

              <FormField
                label={t('fields.parent')}
                error={errors.parent_account_id}
                hint="Parent must share the same classification"
              >
                <AccountPicker
                  value={formData.parent_account_id}
                  onChange={(id) => setFormData((prev) => ({ ...prev, parent_account_id: id }))}
                  type={formData.account_type}
                  disabled={submitting}
                />
              </FormField>

              <FormField
                label={t('fields.openingBalance')}
                hint="Initial balance posted against Opening Balance Equity"
              >
                <InputBox
                  name="opening_balance"
                  type="number"
                  step="0.01"
                  value={formData.opening_balance}
                  onChange={(val) => setFormData((prev) => ({ ...prev, opening_balance: val }))}
                  placeholder="0.00"
                  disabled={submitting}
                />
              </FormField>
            </div>
          </div>

          <FormActions
            onCancel={() => router.push('/dashboard/accounts')}
            isSubmitting={submitting}
            submitLabel={tCommon('actions.save')}
          />
        </form>
      </div>
    </DashboardFrame>
  );
}
