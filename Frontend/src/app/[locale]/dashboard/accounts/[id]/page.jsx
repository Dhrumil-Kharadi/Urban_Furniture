'use strict';
'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { ArrowLeft, Save, ShieldAlert } from 'lucide-react';

import DashboardFrame from '@/components/dashboard/DashboardFrame';
import { useAuth } from '@/context/AuthContext';
import { PageHead } from '@/reusablefiles/dashboardshell';
import Card, { CardBody } from '@/reusablefiles/card';
import Button from '@/reusablefiles/button';
import InputBox from '@/reusablefiles/inputbox';
import Pill from '@/reusablefiles/pill';
import { Skeleton } from '@/reusablefiles/skeleton';

import FormField from '@/components/shared/FormField';
import FormActions from '@/components/shared/FormActions';
import AccountPicker from '@/components/pickers/AccountPicker';
import ErrorState from '@/components/shared/ErrorState';
import { useToast } from '@/components/shared/ToastProvider';
import api from '@/lib/api';

export default function EditAccountPage() {
  const t = useTranslations('accounts');
  const tCommon = useTranslations('common');
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    account_type: 'asset',
    parent_account_id: null,
    opening_balance: '0.00',
  });

  const [isSystem, setIsSystem] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadAccount() {
      if (!id) return;
      setLoading(true);
      setLoadError(null);
      try {
        const res = await api.get(`/accounts/${id}`);
        if (res.success && res.data) {
          setFormData({
            code: res.data.code || '',
            name: res.data.name || '',
            account_type: res.data.account_type || 'asset',
            parent_account_id: res.data.parent_account_id || null,
            opening_balance: res.data.opening_balance || '0.00',
          });
          setIsSystem(Boolean(res.data.is_system));
        } else {
          setLoadError(res.message || 'Account not found');
        }
      } catch (err) {
        setLoadError(err.message || 'Failed to load account');
      } finally {
        setLoading(false);
      }
    }
    loadAccount();
  }, [id]);

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
      const res = await api.patch(`/accounts/${id}`, formData);
      if (res.success) {
        toast({
          type: 'success',
          title: tCommon('toast.saved'),
          message: `Account ${formData.code} updated successfully.`,
        });
        router.push('/dashboard/accounts');
      } else {
        toast({
          type: 'error',
          title: tCommon('toast.error'),
          message: res.message || 'Failed to update account.',
        });
        if (res.errors) {
          const fieldErrors = {};
          res.errors.forEach((err) => {
            if (err.toLowerCase().includes('code')) fieldErrors.code = err;
            if (err.toLowerCase().includes('name')) fieldErrors.name = err;
            if (err.toLowerCase().includes('parent') || err.toLowerCase().includes('circular')) fieldErrors.parent_account_id = err;
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

  if (loading) {
    return (
      <DashboardFrame role={user?.role} activeKey="accounts" allowedRoles={['admin']}>
        <div className="master-layout">
          <Card>
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
                <Skeleton height="32px" width="200px" />
                <Skeleton height="50px" />
                <Skeleton height="50px" />
                <Skeleton height="50px" />
              </div>
            </CardBody>
          </Card>
        </div>
      </DashboardFrame>
    );
  }

  if (loadError) {
    return (
      <DashboardFrame role={user?.role} activeKey="accounts" allowedRoles={['admin']}>
        <div className="master-layout">
          <ErrorState message={loadError} onRetry={() => router.push('/dashboard/accounts')} />
        </div>
      </DashboardFrame>
    );
  }

  return (
    <DashboardFrame role={user?.role} activeKey="accounts" allowedRoles={['admin']}>
      <div className="master-layout">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/accounts')}>
            <ArrowLeft size={16} />
            <span>{tCommon('actions.back')}</span>
          </Button>
          <PageHead
            title={t('editAccount')}
            subtitle={`${formData.code} — ${formData.name}`}
            badge={isSystem ? 'System Account' : undefined}
          />
        </div>

        {isSystem && (
          <div
            style={{
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              backgroundColor: 'var(--dash-badge-bg)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontSize: '0.85rem',
            }}
          >
            <ShieldAlert size={18} style={{ color: 'var(--accent-primary)' }} />
            <span>
              This is a core system account essential for double-entry ledger balance. Its classification cannot be changed.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="app-form">
          <div className="app-form-section">
            <h3 className="app-form-section-title">Account Details</h3>
            <p className="app-form-section-desc">
              Modify account parameters and hierarchical parentage.
            </p>

            <div className="app-form-grid">
              <FormField label={t('fields.code')} required error={errors.code}>
                <InputBox
                  name="code"
                  value={formData.code}
                  onChange={(val) => setFormData((prev) => ({ ...prev, code: val }))}
                  disabled={submitting}
                />
              </FormField>

              <FormField label={t('fields.name')} required error={errors.name}>
                <InputBox
                  name="name"
                  value={formData.name}
                  onChange={(val) => setFormData((prev) => ({ ...prev, name: val }))}
                  disabled={submitting}
                />
              </FormField>

              <FormField
                label={t('fields.type')}
                required
                hint={isSystem ? 'Protected system classification' : undefined}
              >
                <select
                  className="form-select"
                  value={formData.account_type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      account_type: newType,
                      parent_account_id: null,
                    }));
                  }}
                  disabled={submitting || isSystem}
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
                hint="Cannot set self or cause an ancestor cycle"
              >
                <AccountPicker
                  value={formData.parent_account_id}
                  onChange={(parentId) => setFormData((prev) => ({ ...prev, parent_account_id: parentId }))}
                  type={formData.account_type}
                  disabled={submitting}
                />
              </FormField>

              <FormField label={t('fields.openingBalance')}>
                <InputBox
                  name="opening_balance"
                  type="number"
                  step="0.01"
                  value={formData.opening_balance}
                  onChange={(val) => setFormData((prev) => ({ ...prev, opening_balance: val }))}
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
