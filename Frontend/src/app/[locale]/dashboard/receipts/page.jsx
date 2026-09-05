'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/receipts/page.jsx
//
// Customer Payment Receipts List (project.md §5.2 · phase.md Phase 10).
// Lists incoming customer payments (Dr Cash/Bank, Cr Debtors).
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, RefreshCw, Receipt, DollarSign, Wallet, ArrowDownLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { paymentsService } from '@/services/payments.service';
import StatCard from '@/reusablefiles/statcard/StatCard';
import DataTable from '@/reusablefiles/datatable/DataTable';
import Pill from '@/reusablefiles/pill';
import Button from '@/reusablefiles/button';
import { MoneyText } from '@/components/masterdata/Cells';

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [methodFilter, setMethodFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await paymentsService.list({
        direction: 'inbound',
        method: methodFilter || undefined,
        limit: 50,
      });
      setReceipts(res.items || []);
    } catch (err) {
      console.error('Failed to load receipts', err);
      setError(err?.message || 'Could not load customer receipts.');
    } finally {
      setLoading(false);
    }
  }, [methodFilter]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const filteredReceipts = useMemo(() => {
    if (!searchQuery.trim()) return receipts;
    const q = searchQuery.toLowerCase();
    return receipts.filter((r) =>
      [r.payment_number, r.contact_name, r.reference, r.memo].some((val) =>
        String(val || '').toLowerCase().includes(q)
      )
    );
  }, [receipts, searchQuery]);

  const columns = [
    {
      key: 'payment_number',
      header: 'Receipt #',
      render: (row) => (
        <Link
          href={`/dashboard/payments/${row.id}`}
          style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)', textDecoration: 'none' }}
        >
          {row.payment_number}
        </Link>
      ),
    },
    {
      key: 'payment_date',
      header: 'Date',
      render: (row) => row.payment_date?.split('T')[0] || '—',
    },
    {
      key: 'contact_name',
      header: 'Customer',
      render: (row) => (
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
          {row.contact_name || '—'}
        </span>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      render: (row) => (
        <Pill tone="soft" size="sm">
          {row.method?.toUpperCase()}
        </Pill>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (row) => (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {row.reference || row.memo || '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount Received',
      align: 'right',
      render: (row) => (
        <span style={{ fontWeight: 600, color: '#10b981' }}>
          <MoneyText value={row.amount} />
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const tone = row.status === 'posted' ? 'strong' : row.status === 'cancelled' ? 'danger' : 'soft';
        return (
          <Pill tone={tone} size="sm" dot>
            {row.status}
          </Pill>
        );
      },
    },
  ];

  const totalCollected = useMemo(() => {
    return receipts
      .filter((r) => r.status === 'posted')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }, [receipts]);

  const cashTotal = useMemo(() => {
    return receipts
      .filter((r) => r.status === 'posted' && r.method === 'cash')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }, [receipts]);

  const bankCardTotal = useMemo(() => {
    return receipts
      .filter((r) => r.status === 'posted' && ['bank', 'card'].includes(r.method))
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }, [receipts]);

  return (
    <div className="doc-page">
      {/* Header */}
      <div className="doc-page-head">
        <div>
          <h1 className="doc-page-title">
            <Receipt size={19} className="doc-icon-accent" aria-hidden="true" />
            Customer Receipts
          </h1>
          <p className="doc-page-sub">
            Inbound customer settlements, offline receipts, and online portal card payments.
          </p>
        </div>

        <Link href="/dashboard/payments/new" className="doc-btn doc-btn-primary">
          <Plus size={15} aria-hidden="true" />
          Record Receipt
        </Link>
      </div>

      {/* KPI Stats in clean horizontal multi-card row */}
      <div className="portal-stat-grid">
        <StatCard
          title="Total Receipts"
          value={`₹${totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          icon={<DollarSign size={18} />}
          tone="deep"
        />
        <StatCard
          title="Bank / Card Receipts"
          value={`₹${bankCardTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          icon={<Wallet size={18} />}
          tone="light"
        />
        <StatCard
          title="Cash Receipts"
          value={`₹${cashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          icon={<ArrowDownLeft size={18} />}
          tone="light"
        />
      </div>

      {/* Search & Filter Toolbar */}
      <div className="doc-filters" style={{ marginTop: '0.5rem' }}>
        <input
          type="text"
          placeholder="Search receipt #, customer, reference…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="portal-filter-select"
          style={{ minWidth: '260px', flex: 1 }}
        />

        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="portal-filter-select"
        >
          <option value="">All Payment Methods</option>
          <option value="bank">Bank Transfer / UPI</option>
          <option value="card">Card Payment (Gateway)</option>
          <option value="cash">Cash</option>
        </select>

        <Button
          variant="ghost"
          size="sm"
          onClick={fetchReceipts}
          loading={loading}
          icon={<RefreshCw size={14} />}
        >
          Refresh
        </Button>
      </div>

      {/* Receipts Table Card */}
      <div className="portal-table-card">
        {error ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--status-error)' }}>
            {error}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={filteredReceipts}
            loading={loading}
            loadingLabel="Loading customer receipts…"
            emptyLabel="No customer receipts found matching your criteria."
          />
        )}
      </div>
    </div>
  );
}
