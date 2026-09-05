'use client';

/**
 * @file Create Sales Order
 * @route /dashboard/sales-orders/new
 * @spec Doc/project.md §5.2.1, Doc/phase.md Phase 9, Doc/strict.md
 */

import React, { useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/navigation';
import { useToast } from '@/components/shared';
import SalesOrderForm from '@/components/sales-orders/SalesOrderForm';
import { salesOrdersService } from '@/services/sales.service';

export default function NewSalesOrderPage() {
  const t = useTranslations('salesOrders');
  const tc = useTranslations('common');
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData) => {
    // Guarded as well as disabled: a double-submitted order is a duplicate
    // document that will take its own number.
    if (loading) return;
    setLoading(true);

    try {
      const { salesOrder } = await salesOrdersService.create(formData);
      showSuccess(t('toast.created'));
      router.push(`/dashboard/sales-orders/${salesOrder.id}`);
    } catch (err) {
      showError(err.message || tc('toast.error'));
      setLoading(false);
    }
  };

  return (
    <div className="doc-page">
      <div className="doc-page-head-left">
        <Link
          href="/dashboard/sales-orders"
          className="doc-btn doc-btn-icon"
          aria-label={tc('actions.back')}
        >
          <ArrowLeft size={15} aria-hidden="true" />
        </Link>
        <div>
          <h1 className="doc-page-title">
            <FileText size={19} className="doc-icon-accent" aria-hidden="true" />
            {t('new.title')}
          </h1>
          <p className="doc-page-sub">{t('new.subtitle')}</p>
        </div>
      </div>

      <SalesOrderForm
        onSubmit={handleSubmit}
        onCancel={() => router.push('/dashboard/sales-orders')}
        isSubmitting={loading}
      />
    </div>
  );
}
