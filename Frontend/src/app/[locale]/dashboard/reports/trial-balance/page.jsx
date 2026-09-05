'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/reports/trial-balance/page.jsx
//
// Real-time Trial Balance Report (project.md §6 · phase.md Phase 11).
// Computes debit and credit balances for all chart of accounts,
// asserting Total Debit === Total Credit.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import reportsService from '@/services/reports.service';
import Button from '@/reusablefiles/button';
import StatCard from '@/reusablefiles/statcard/StatCard';
import DataTable from '@/reusablefiles/datatable/DataTable';
import Pill from '@/reusablefiles/pill';
import { MoneyText } from '@/components/masterdata/Cells';

export default function TrialBalanceReportPage() {
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTrialBalance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportsService.getTrialBalance({ asOfDate });
      const payload = res?.data || res;
      setData(payload);
    } catch (err) {
      console.error('Failed to load trial balance', err);
      setError(err?.message || 'Could not load trial balance.');
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => {
    fetchTrialBalance();
  }, [fetchTrialBalance]);

  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => (
        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.8rem', fontWeight: 600 }}>
          {row.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Account Name',
      render: (row) => (
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
          {row.name}
        </span>
      ),
    },
    {
      key: 'accountType',
      header: 'Type',
      render: (row) => (
        <Pill tone="soft" size="sm">
          {row.accountType}
        </Pill>
      ),
    },
    {
      key: 'totalDebit',
      header: 'Total Debit',
      align: 'right',
      render: (row) => <MoneyText value={row.totalDebit} />,
    },
    {
      key: 'totalCredit',
      header: 'Total Credit',
      align: 'right',
      render: (row) => <MoneyText value={row.totalCredit} />,
    },
    {
      key: 'balance',
      header: 'Net Balance',
      align: 'right',
      render: (row) => (
        <span style={{ fontWeight: 600 }}>
          <MoneyText value={row.balance} />
        </span>
      ),
    },
  ];

  const totalDebit = Number(data?.totalDebit || 0);
  const totalCredit = Number(data?.totalCredit || 0);
  const diff = Math.abs(totalDebit - totalCredit);
  const isBalanced = data?.isBalanced !== undefined ? data.isBalanced : diff < 0.01;

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
          <span className="report-badge">Trial Balance</span>
          <h1 className="report-title">Trial Balance</h1>
          <p className="report-subtitle">
            Debit and credit totals for all accounts as of the chosen date, verifying ledger integrity.
          </p>
        </div>

        {/* Toolbar */}
        <div className="report-toolbar">
          <div className="report-date-input">
            <span>As of Date</span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
          </div>

          <div style={{ paddingTop: '18px' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchTrialBalance}
              loading={loading}
              icon={<RefreshCw size={14} />}
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Stats in clean horizontal multi-card row */}
      <div className="portal-stat-grid">
        <StatCard
          title="Total Debit"
          value={`₹${totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          icon={<FileSpreadsheet size={18} />}
          tone="deep"
        />
        <StatCard
          title="Total Credit"
          value={`₹${totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          icon={<FileSpreadsheet size={18} />}
          tone="light"
        />
        <StatCard
          title="Balance Status"
          value={isBalanced ? 'Balanced' : `Diff ₹${diff.toFixed(2)}`}
          icon={isBalanced ? <CheckCircle2 size={18} style={{ color: '#10b981' }} /> : <AlertTriangle size={18} style={{ color: '#f59e0b' }} />}
          tone="light"
        />
      </div>

      {/* Account Balance Table */}
      <div className="portal-table-card">
        <div className="portal-table-card-head">
          <div>
            <h2 className="portal-table-title">General Ledger Accounts</h2>
            <p className="portal-table-subtitle">All active accounts with posted activity</p>
          </div>
          {isBalanced && (
            <span style={{ fontSize: '0.78rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <CheckCircle2 size={14} /> Total Debit equals Total Credit
            </span>
          )}
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
            loadingLabel="Generating trial balance from live ledger…"
            emptyLabel="No accounts or activity found for the selected date."
          />
        )}
      </div>
    </div>
  );
}
