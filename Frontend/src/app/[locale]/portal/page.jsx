'use client';

// ============================================================
// FILE: src/app/[locale]/portal/page.jsx
//
// Contact Portal Dashboard (project.md §5.3 · phase.md Phase 12).
// Landing surface for authenticated contacts (role 'user').
// Displays overview of outstanding balances, recent invoices, and statement shortcuts.
// Strictly isolated: contacts never see organization-wide accounting data.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Receipt, ArrowRight, DollarSign, Clock, ShieldCheck, LogOut } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Button from '@/reusablefiles/button';
import StatCard from '@/reusablefiles/statcard/StatCard';
import DataTable from '@/reusablefiles/datatable/DataTable';
import Pill from '@/reusablefiles/pill';
import { MoneyText, StatusPill } from '@/components/masterdata/Cells';
import RazorpayCheckoutButton from '@/components/payment/RazorpayCheckoutButton';
import { useAuth } from '@/context/AuthContext';
import portalService from '@/services/portal.service';

export default function PortalPage() {
  const t = useTranslations('portal');
  const { user, logout } = useAuth();

  const [summary, setSummary] = useState(null);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPortalData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, invRes] = await Promise.all([
        portalService.getSummary().catch(() => null),
        portalService.listInvoices({ limit: 5 }).catch(() => null),
      ]);

      if (sumRes?.data) setSummary(sumRes.data);
      else if (sumRes) setSummary(sumRes);

      if (invRes?.data?.items) setRecentInvoices(invRes.data.items);
      else if (invRes?.items) setRecentInvoices(invRes.items);
    } catch (err) {
      console.error('Failed to load portal data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortalData();
  }, [fetchPortalData]);

  const invoiceColumns = [
    {
      key: 'invoice_number',
      header: t('invoices.invoiceNumber'),
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-[var(--primary,#4f46e5)]">
          {row.invoice_number}
        </span>
      ),
    },
    {
      key: 'invoice_date',
      header: t('invoices.date'),
      render: (row) => row.invoice_date?.split('T')[0] || '—',
    },
    {
      key: 'due_date',
      header: t('invoices.dueDate'),
      render: (row) => row.due_date?.split('T')[0] || '—',
    },
    {
      key: 'total_amount',
      header: t('invoices.total'),
      align: 'right',
      render: (row) => <MoneyText value={row.total_amount} />,
    },
    {
      key: 'amount_due',
      header: t('invoices.due'),
      align: 'right',
      render: (row) => (
        <span className={Number(row.amount_due) > 0 ? 'text-emerald-400 font-semibold' : 'text-gray-400'}>
          <MoneyText value={row.amount_due} />
        </span>
      ),
    },
    {
      key: 'status',
      header: t('invoices.status'),
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
          return <span className="text-xs text-gray-500">{t('invoices.paidInFull')}</span>;
        }
        return (
          <RazorpayCheckoutButton
            invoiceId={row.id}
            onPaid={fetchPortalData}
            label={t('invoices.payNow')}
          />
        );
      },
    },
  ];

  return (
    <ProtectedRoute allowedRoles={['customer']}>
      <main className="portal-route">
        {/* Portal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[var(--card-bg,#181d28)] p-6 rounded-2xl border border-[var(--border,#2b3245)] shadow-sm">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--primary,#4f46e5)]">
              {t('badge')}
            </span>
            <h1 className="text-2xl font-bold mt-1">
              {user?.name ? t('welcome', { name: user.name }) : t('title')}
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              {t('subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={logout} icon={<LogOut size={16} />}>
              {t('signOut')}
            </Button>
          </div>
        </div>

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/portal/invoices" className="group block">
            <div className="p-5 bg-[var(--card-bg,#181d28)] border border-[var(--border,#2b3245)] rounded-2xl hover:border-[var(--primary,#4f46e5)] transition-all flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                  <Receipt size={24} />
                </div>
                <div>
                  <h3 className="text-base font-bold group-hover:text-[var(--primary,#4f46e5)] transition-colors">
                    {t('tabs.invoices')}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    View all invoices and pay balances online
                  </p>
                </div>
              </div>
              <ArrowRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link href="/portal/bills" className="group block">
            <div className="p-5 bg-[var(--card-bg,#181d28)] border border-[var(--border,#2b3245)] rounded-2xl hover:border-[var(--primary,#4f46e5)] transition-all flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="text-base font-bold group-hover:text-emerald-400 transition-colors">
                    {t('tabs.bills')}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    View vendor bills statement of account
                  </p>
                </div>
              </div>
              <ArrowRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* KPI Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title={t('kpi.outstanding')}
            value={`₹${Number(summary?.total_outstanding || 0).toLocaleString()}`}
            icon={<DollarSign size={18} />}
            tone="deep"
          />
          <StatCard
            title={t('kpi.overdue')}
            value={`₹${Number(summary?.total_overdue || 0).toLocaleString()}`}
            icon={<Clock size={18} className="text-amber-400" />}
            tone="light"
          />
          <StatCard
            title={t('kpi.paidThisYear')}
            value={`₹${Number(summary?.paid_this_year || 0).toLocaleString()}`}
            icon={<ShieldCheck size={18} className="text-emerald-400" />}
            tone="light"
          />
        </div>

        {/* Recent Invoices Table */}
        <div className="bg-[var(--card-bg,#181d28)] border border-[var(--border,#2b3245)] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-[var(--border,#2b3245)] flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-100">
                Recent Invoices
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Outstanding and recently settled invoices
              </p>
            </div>
            <Link
              href="/portal/invoices"
              className="text-xs text-[var(--primary,#4f46e5)] hover:underline flex items-center gap-1 font-medium"
            >
              <span>View all</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          <DataTable
            columns={invoiceColumns}
            rows={recentInvoices}
            loading={loading}
            loadingLabel="Loading your documents…"
            emptyLabel={t('invoices.empty')}
          />
        </div>

      </main>
    </ProtectedRoute>
  );
}
