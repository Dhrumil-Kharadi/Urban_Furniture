'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/reports/aged-receivables/page.jsx
//
// Aged Receivables Report Page (project.md §6 · phase.md Phase 11).
// Outstanding customer invoice balances grouped by aging buckets:
//   - Current (0-30 days)
//   - 31-60 days
//   - 61-90 days
//   - 90+ days overdue
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, Clock, AlertTriangle, Users } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import reportsService from '@/services/reports.service';
import Button from '@/reusablefiles/button';
import StatCard from '@/reusablefiles/statcard/StatCard';
import DataTable from '@/reusablefiles/datatable/DataTable';
import Pill from '@/reusablefiles/pill';
import { MoneyText } from '@/components/masterdata/Cells';

export default function AgedReceivablesReportPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAging = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportsService.getAgedReceivables();
      const payload = res?.data || res;
      setData(payload);
    } catch (err) {
      console.error('Failed to load aged receivables', err);
      setError(err?.message || 'Could not load aged receivables.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAging();
  }, [fetchAging]);

  const columns = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      render: (row) => (
        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
          {row.invoice_number}
        </span>
      ),
    },
    {
      key: 'customer_name',
      header: 'Customer',
      render: (row) => (
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
          {row.customer_name}
        </span>
      ),
    },
    {
      key: 'invoice_date',
      header: 'Date',
      render: (row) => row.invoice_date?.split('T')[0] || '—',
    },
    {
      key: 'due_date',
      header: 'Due Date',
      render: (row) => row.due_date?.split('T')[0] || '—',
    },
    {
      key: 'aging_bucket',
      header: 'Aging Bucket',
      render: (row) => {
        const tone = row.aging_bucket === '90+ days' ? 'danger' : row.aging_bucket === '61-90 days' ? 'warning' : 'soft';
        return (
          <Pill tone={tone} size="sm" dot>
            {row.aging_bucket}
          </Pill>
        );
      },
    },
    {
      key: 'total_amount',
      header: 'Total',
      align: 'right',
      render: (row) => <MoneyText value={row.total_amount} />,
    },
    {
      key: 'amount_due',
      header: 'Balance Due',
      align: 'right',
      render: (row) => (
        <span style={{ fontWeight: 600, color: '#f59e0b' }}>
          <MoneyText value={row.amount_due} />
        </span>
      ),
    },
  ];

  const buckets = data?.buckets || [];
  const b0_30 = buckets.find((b) => b.bucket === '0-30 days')?.amount || '0.00';
  const b31_60 = buckets.find((b) => b.bucket === '31-60 days')?.amount || '0.00';
  const b61_90 = buckets.find((b) => b.bucket === '61-90 days')?.amount || '0.00';
  const b90_plus = buckets.find((b) => b.bucket === '90+ days')?.amount || '0.00';

  return (
    <div className="report-container">
      {/* Header */}
      <div className="report-header">
        <div className="report-header-content">
          <Link
            href="/dashboard/reports"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              marginBottom: '0.5rem',
            }}
          >
            <ArrowLeft size={14} />
            <span>Back to reports</span>
          </Link>
          <span className="report-badge">Aged Debtors</span>
          <h1 className="report-title">Aged Receivables</h1>
          <p className="report-subtitle">
            Outstanding customer balances categorized into 30-day overdue intervals.
          </p>
        </div>

        <div className="report-toolbar">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAging}
            loading={loading}
            icon={<RefreshCw size={14} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Aging KPI Stats in clean horizontal multi-card row */}
      <div className="portal-grid-4">
        <StatCard
          title="0–30 Days"
          value={`₹${Number(b0_30).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          icon={<Clock size={18} />}
          tone="deep"
        />
        <StatCard
          title="31–60 Days"
          value={`₹${Number(b31_60).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          icon={<Clock size={18} />}
          tone="light"
        />
        <StatCard
          title="61–90 Days"
          value={`₹${Number(b61_90).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          icon={<AlertTriangle size={18} style={{ color: '#f59e0b' }} />}
          tone="light"
        />
        <StatCard
          title="90+ Days Overdue"
          value={`₹${Number(b90_plus).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          icon={<AlertTriangle size={18} style={{ color: '#ef4444' }} />}
          tone="light"
        />
      </div>

      {/* Aging Invoices Table */}
      <div className="portal-table-card">
        <div className="portal-table-card-head">
          <div>
            <h2 className="portal-table-title">Open Receivables Schedule</h2>
            <p className="portal-table-subtitle">Unpaid customer invoices grouped by due date</p>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {data?.items?.length || 0} open document(s)
          </span>
        </div>

        {error ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--status-error)' }}>
            {error}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.items || []}
            loading={loading}
            loadingLabel="Loading aged receivables…"
            emptyLabel="No outstanding receivables currently overdue."
          />
        )}
      </div>
    </div>
  );
}
