'use client';

// ============================================================
// FILE: src/app/[locale]/portal/invoices/page.jsx
//
// Customer Invoices & Card Payments Page (project.md §5.3 · phase.md Phase 12).
// Allows customer contacts to review their invoices and pay outstanding balances online.
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Search, Filter, Receipt } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import InputBox from '@/reusablefiles/inputbox';
import DataTable from '@/reusablefiles/datatable/DataTable';
import Pill from '@/reusablefiles/pill';
import { MoneyText } from '@/components/masterdata/Cells';
import RazorpayCheckoutButton from '@/components/payment/RazorpayCheckoutButton';
import portalService from '@/services/portal.service';

export default function PortalInvoicesPage() {
  const t = useTranslations('portal.invoices');
  const tPortal = useTranslations('portal');

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (statusFilter) params.status = statusFilter;

      const res = await portalService.listInvoices(params);
      const items = res?.data?.items || res?.items || [];
      setInvoices(items);
    } catch (err) {
      console.error('Failed to load portal invoices', err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const columns = useMemo(
    () => [
      {
        key: 'invoice_number',
        header: t('invoiceNumber'),
        render: (row) => (
          <span className="font-mono text-xs font-semibold text-[var(--primary,#4f46e5)]">
            {row.invoice_number}
          </span>
        ),
      },
      {
        key: 'invoice_date',
        header: t('date'),
        render: (row) => row.invoice_date?.split('T')[0] || '—',
      },
      {
        key: 'due_date',
        header: t('dueDate'),
        render: (row) => row.due_date?.split('T')[0] || '—',
      },
      {
        key: 'total_amount',
        header: t('total'),
        align: 'right',
        render: (row) => <MoneyText value={row.total_amount} />,
      },
      {
        key: 'amount_paid',
        header: t('paid'),
        align: 'right',
        render: (row) => <MoneyText value={row.amount_paid || '0.00'} />,
      },
      {
        key: 'amount_due',
        header: t('due'),
        align: 'right',
        render: (row) => (
          <span className={Number(row.amount_due) > 0 ? 'text-emerald-400 font-semibold' : 'text-gray-400'}>
            <MoneyText value={row.amount_due} />
          </span>
        ),
      },
      {
        key: 'status',
        header: t('status'),
        render: (row) => (
          <Pill
            tone={row.status === 'paid' ? 'strong' : row.status === 'overdue' ? 'danger' : 'soft'}
            size="sm"
            dot
          >
            {row.status}
          </Pill>
        ),
      },
      {
        key: 'action',
        header: '',
        align: 'right',
        render: (row) => {
          const canPay = Number(row.amount_due) > 0 && ['posted', 'partially_paid', 'overdue'].includes(row.status);
          if (!canPay) {
            return <span className="text-xs text-gray-500">{t('paidInFull')}</span>;
          }
          return (
            <RazorpayCheckoutButton
              invoiceId={row.id}
              label={t('payNow')}
              onPaid={fetchInvoices}
            />
          );
        },
      },
    ],
    [fetchInvoices, t],
  );

  return (
    <ProtectedRoute allowedRoles={['customer', 'vendor']}>
      <main className="portal-route">
        {/* Top Header Bar */}
        <div className="portal-header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link
              href="/portal"
              className="portal-back-link"
              title="Back to portal"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <span className="portal-header-badge">
                {tPortal('badge')}
              </span>
              <h1 className="portal-header-title">
                {t('title')}
              </h1>
              <p className="portal-header-subtitle">
                {t('subtitle')}
              </p>
            </div>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="portal-filter-select"
            >
              <option value="">All Invoices</option>
              <option value="posted">Unpaid (Posted)</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="overdue">Overdue</option>
              <option value="paid">Paid in Full</option>
            </select>
          </div>
        </div>

        {/* Invoices Table Card */}
        <div className="portal-table-card">
          <DataTable
            columns={columns}
            rows={invoices}
            loading={loading}
            loadingLabel="Loading invoices…"
            emptyLabel={
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <Receipt size={28} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                {t('empty')}
              </div>
            }
          />
        </div>

      </main>
    </ProtectedRoute>
  );
}
