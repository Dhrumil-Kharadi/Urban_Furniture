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
      <main className="p-6 space-y-6 max-w-6xl mx-auto text-[var(--foreground,#f3f4f6)]">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/portal"
              className="p-2 rounded-xl bg-[var(--card-bg,#181d28)] border border-[var(--border,#2b3245)] text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--primary,#4f46e5)]">
                {tPortal('badge')}
              </span>
              <h1 className="text-2xl font-bold mt-0.5">
                {t('title')}
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                {t('subtitle')}
              </p>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-[var(--surface,#1f2637)] border border-[var(--border,#2b3245)] text-xs text-gray-200 focus:outline-none"
            >
              <option value="">All Bills</option>
              <option value="posted">Open (Posted)</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Settled (Paid)</option>
            </select>
          </div>
        </div>

        {/* Read-Only Notice */}
        <div className="p-4 rounded-xl bg-[var(--surface,#1f2637)] border border-[var(--border,#2b3245)] flex items-center gap-3 text-xs text-gray-300">
          <Info size={18} className="text-indigo-400 shrink-0" />
          <span>{t('notice')}</span>
        </div>

        {/* Bills Statement Table */}
        <div className="bg-[var(--card-bg,#181d28)] border border-[var(--border,#2b3245)] rounded-2xl overflow-hidden shadow-sm">
          <DataTable
            columns={columns}
            rows={bills}
            loading={loading}
            loadingLabel="Loading account statement…"
            emptyLabel={
              <div className="py-12 text-center text-sm text-gray-400">
                <FileText size={28} className="mx-auto text-gray-500 mb-2 opacity-60" />
                {t('empty')}
              </div>
            }
          />
        </div>
      </main>
    </ProtectedRoute>
  );
}
