'use client';

// ============================================================
// FILE: src/app/[locale]/portal/bills/page.jsx
//
// Vendor Bills (Statement of Account) Page (project.md §5.3 · phase.md Phase 12).
// Provides a read-only historical statement of bills for vendor contacts.
// Note: Per spec, vendors do NOT have a Pay Now button.
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Info, FileText } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DataTable from '@/reusablefiles/datatable/DataTable';
import Pill from '@/reusablefiles/pill';
import { MoneyText } from '@/components/masterdata/Cells';
import portalService from '@/services/portal.service';

export default function PortalBillsPage() {
  const t = useTranslations('portal.bills');
  const tPortal = useTranslations('portal');

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (statusFilter) params.status = statusFilter;

      const res = await portalService.listBills(params);
      const items = res?.data?.items || res?.items || [];
      setBills(items);
    } catch (err) {
      console.error('Failed to load portal bills', err);
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const columns = useMemo(
    () => [
      {
        key: 'bill_number',
        header: t('billNumber'),
        render: (row) => (
          <span className="font-mono text-xs font-semibold text-emerald-400">
            {row.bill_number}
          </span>
        ),
      },
      {
        key: 'bill_date',
        header: t('date'),
        render: (row) => row.bill_date?.split('T')[0] || '—',
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
          <span className={Number(row.amount_due) > 0 ? 'text-amber-400 font-semibold' : 'text-gray-400'}>
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
    ],
    [t],
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
              <option value="">All Bills</option>
              <option value="posted">Open (Posted)</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Settled (Paid)</option>
            </select>
          </div>
        </div>

        {/* Read-Only Notice */}
        <div style={{
          padding: '1rem 1.25rem',
          borderRadius: '12px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
        }}>
          <Info size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          <span>{t('notice')}</span>
        </div>

        {/* Bills Statement Table Card */}
        <div className="portal-table-card">
          <DataTable
            columns={columns}
            rows={bills}
            loading={loading}
            loadingLabel="Loading account statement…"
            emptyLabel={
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <FileText size={28} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                {t('empty')}
              </div>
            }
          />
        </div>
      </main>
    </ProtectedRoute>
  );
}
