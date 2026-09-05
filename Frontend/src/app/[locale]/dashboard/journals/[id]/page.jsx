'use strict';
'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import DashboardFrame from '@/components/dashboard/DashboardFrame';
import { useAuth } from '@/context/AuthContext';
import { PageHead } from '@/reusablefiles/dashboardshell';
import Card, { CardBody } from '@/reusablefiles/card';
import Button from '@/reusablefiles/button';
import InputBox from '@/reusablefiles/inputbox';
import { Skeleton } from '@/reusablefiles/skeleton';

import FormField from '@/components/shared/FormField';
import FormActions from '@/components/shared/FormActions';
import AccountPicker from '@/components/pickers/AccountPicker';
import ErrorState from '@/components/shared/ErrorState';
import { useToast } from '@/components/shared/ToastProvider';
import api from '@/lib/api';

export default function EditJournalPage() {
  const t = useTranslations('journals');
  const tCommon = useTranslations('common');
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  const [formData, setFormData] = useState({
    name: '',
    journal_type: 'general',
    sequence_prefix: '',
    default_debit_account_id: null,
    default_credit_account_id: null,
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadJournal() {
      if (!id) return;
      setLoading(true);
      setLoadError(null);
      try {
        const res = await api.get(`/journals/${id}`);
        if (res.success && res.data) {
          setFormData({
            name: res.data.name || '',
            journal_type: res.data.journal_type || 'general',
            sequence_prefix: res.data.sequence_prefix || '',
            default_debit_account_id: res.data.default_debit_account_id || null,
            default_credit_account_id: res.data.default_credit_account_id || null,
          });
        } else {
          setLoadError(res.message || 'Journal not found');
        }
      } catch (err) {
        setLoadError(err.message || 'Failed to load journal');
      } finally {
        setLoading(false);
      }
    }
    loadJournal();
  }, [id]);

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
      const res = await api.patch(`/journals/${id}`, formData);
      if (res.success) {
        toast({
          type: 'success',
          title: tCommon('toast.saved'),
          message: `Journal "${formData.name}" updated successfully.`,
        });
        router.push('/dashboard/journals');
      } else {
        toast({
          type: 'error',
          title: tCommon('toast.error'),
          message: res.message || 'Failed to update journal.',
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

  if (loading) {
    return (
      <DashboardFrame role={user?.role} activeKey="journals" allowedRoles={['admin']}>
        <div className="master-layout">
          <Card>
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
                <Skeleton height="32px" width="200px" />
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
      <DashboardFrame role={user?.role} activeKey="journals" allowedRoles={['admin']}>
        <div className="master-layout">
          <ErrorState message={loadError} onRetry={() => router.push('/dashboard/journals')} />
        </div>
      </DashboardFrame>
    );
  }

  return (
    <DashboardFrame role={user?.role} activeKey="journals" allowedRoles={['admin']}>
      <div className="master-layout">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/journals')}>
            <ArrowLeft size={16} />
            <span>{tCommon('actions.back')}</span>
          </Button>
          <PageHead title={t('editJournal')} subtitle={formData.name} />
        </div>

        <form onSubmit={handleSubmit} className="app-form">
          <div className="app-form-section">
            <h3 className="app-form-section-title">Journal Configuration</h3>
            <p className="app-form-section-desc">
              Update journal title, operational classification, and default GL accounts.
            </p>

            <div className="app-form-grid">
              <FormField label={t('fields.name')} required error={errors.name}>
                <InputBox
                  name="name"
                  value={formData.name}
                  onChange={(val) => setFormData((prev) => ({ ...prev, name: val }))}
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

              <FormField label={t('fields.sequencePrefix')}>
                <InputBox
                  name="sequence_prefix"
                  value={formData.sequence_prefix}
                  onChange={(val) => setFormData((prev) => ({ ...prev, sequence_prefix: val }))}
                  disabled={submitting}
                />
              </FormField>

              <FormField label={t('fields.defaultDebitAccount')}>
                <AccountPicker
                  value={formData.default_debit_account_id}
                  onChange={(accId) => setFormData((prev) => ({ ...prev, default_debit_account_id: accId }))}
                  disabled={submitting}
                />
              </FormField>

              <FormField label={t('fields.defaultCreditAccount')}>
                <AccountPicker
                  value={formData.default_credit_account_id}
                  onChange={(accId) => setFormData((prev) => ({ ...prev, default_credit_account_id: accId }))}
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
