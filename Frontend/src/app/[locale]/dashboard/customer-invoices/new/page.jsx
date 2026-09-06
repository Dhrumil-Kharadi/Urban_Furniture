'use client';

/**
 * @file Create Customer Invoice
 * @route /dashboard/customer-invoices/new
 * @spec Doc/project.md §5.2, Doc/phase.md Phase 9, Doc/strict.md
 *
 * Creates a DRAFT. Posting is separate and deliberate — it writes to the
 * ledger, and cannot be undone, only reversed.
 */

import React, { useState } from 'react';
import { ArrowLeft, Receipt } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/navigation';
import { useToast } from '@/components/shared';
import CustomerInvoiceForm from '@/components/customer-invoices/CustomerInvoiceForm';
import { customerInvoicesService } from '@/services/sales.service';

export default function NewCustomerInvoicePage() {
  const t = useTranslations('customerInvoices');
  const tc = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledCustomerId = searchParams?.get('customer_id') || searchParams?.get('customer_contact_id') || '';
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData) => {
    if (loading) return;
    setLoading(true);

    try {
      const { invoice } = await customerInvoicesService.create(formData);
      showSuccess(t('toast.created'));
      router.push(`/dashboard/customer-invoices/${invoice.id}`);
    } catch (err) {
      showError(err.message || tc('toast.error'));
      setLoading(false);
    }
  };

  return (
    <div className="doc-page">
      <div className="doc-page-head-left">
        <Link
          href="/dashboard/customer-invoices"
          className="doc-btn doc-btn-icon"
          aria-label={tc('actions.back')}
        >
          <ArrowLeft size={15} aria-hidden="true" />
        </Link>
        <div>
          <h1 className="doc-page-title">
            <Receipt size={19} className="doc-icon-accent" aria-hidden="true" />
            {t('new.title')}
          </h1>
          <p className="doc-page-sub">{t('new.subtitle')}</p>
        </div>
      </div>

      <CustomerInvoiceForm
        initialData={prefilledCustomerId ? { customer_contact_id: prefilledCustomerId } : null}
        onSubmit={handleSubmit}
        onCancel={() => router.push('/dashboard/customer-invoices')}
        isSubmitting={loading}
      />
    </div>
  );
}
