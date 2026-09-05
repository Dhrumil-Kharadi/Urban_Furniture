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
          return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('invoices.paidInFull')}</span>;
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
    <ProtectedRoute allowedRoles={['customer', 'vendor']}>
      <main className="portal-route">
        {/* Portal Header Card */}
        <div className="portal-header-card">
          <div>
            <span className="portal-header-badge">
              {t('badge')}
            </span>
            <h1 className="portal-header-title">
              {user?.name ? t('welcome', { name: user.name }) : t('title')}
            </h1>
            <p className="portal-header-subtitle">
              {t('subtitle')}
            </p>
          </div>

          <div>
            <Button variant="ghost" size="sm" onClick={logout} icon={<LogOut size={16} />}>
              {t('signOut')}
            </Button>
          </div>
        </div>

        {/* Quick Navigation Cards (Horizontal 2-Card Row) */}
        <div className="portal-nav-grid">
          <Link href="/portal/invoices" className="portal-nav-card">
            <div className="portal-nav-card-left">
              <div className="portal-nav-card-icon">
                <Receipt size={22} />
              </div>
              <div>
                <h2 className="portal-nav-card-title">
                  {t('tabs.invoices')}
                </h2>
                <p className="portal-nav-card-desc">
                  View all customer invoices and pay balances online
                </p>
              </div>
            </div>
            <ArrowRight size={18} className="portal-nav-arrow" />
          </Link>

          <Link href="/portal/bills" className="portal-nav-card">
            <div className="portal-nav-card-left">
              <div className="portal-nav-card-icon emerald">
                <FileText size={22} />
              </div>
              <div>
                <h2 className="portal-nav-card-title">
                  {t('tabs.bills')}
                </h2>
                <p className="portal-nav-card-desc">
                  View vendor bills and statement of account
                </p>
              </div>
            </div>
            <ArrowRight size={18} className="portal-nav-arrow" />
          </Link>
        </div>

        {/* KPI Stats (Horizontal 3-Card Row) */}
        <div className="portal-stat-grid">
          <StatCard
            title={t('kpi.outstanding')}
            value={`₹${Number(summary?.total_outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
            icon={<DollarSign size={18} />}
            tone="deep"
          />
          <StatCard
            title={t('kpi.overdue')}
            value={`₹${Number(summary?.total_overdue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
            icon={<Clock size={18} />}
            tone="light"
          />
          <StatCard
            title={t('kpi.paidThisYear')}
            value={`₹${Number(summary?.paid_this_year || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
            icon={<ShieldCheck size={18} />}
            tone="light"
          />
        </div>

        {/* Recent Invoices Table Card */}
        <div className="portal-table-card">
          <div className="portal-table-card-head">
            <div>
              <h2 className="portal-table-title">
                Recent Invoices
              </h2>
              <p className="portal-table-subtitle">
                Outstanding and recently settled invoices
              </p>
            </div>
            <Link
              href="/portal/invoices"
              style={{
                fontSize: '0.82rem',
                color: 'var(--accent-primary)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 600,
              }}
            >
              <span>View all</span>
              <ArrowRight size={13} />
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
