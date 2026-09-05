'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/credit-notes/page.jsx
//
// Customer Credit Notes List (project.md §3 · technicalrequirement.md §3.5).
// Manages customer credit notes for sales returns, price allowances,
// and damaged merchandise adjustments.
// ============================================================

import React, { useState, useMemo } from 'react';
import { Plus, Search, RefreshCw, FileText, ArrowDownLeft, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import StatCard from '@/reusablefiles/statcard/StatCard';
import DataTable from '@/reusablefiles/datatable/DataTable';
import Pill from '@/reusablefiles/pill';
import Button from '@/reusablefiles/button';
import { MoneyText } from '@/components/masterdata/Cells';
import { useToast } from '@/context/ToastContext';

const INITIAL_CREDIT_NOTES = [
  {
    id: 'cn-1',
    note_number: 'CN/2026/00001',
    note_date: '2026-02-15',
    customer_name: 'Decora Interiors Ltd',
    invoice_ref: 'INV/2026/00001',
    reason: 'Defective fabric on modular sofa unit',
    amount: '4500.00',
    status: 'posted',
  },
  {
    id: 'cn-2',
    note_number: 'CN/2026/00002',
    note_date: '2026-02-28',
    customer_name: 'Urban Living Retailers',
    invoice_ref: 'INV/2026/00002',
    reason: 'Bulk promotional discount allowance',
    amount: '8200.00',
    status: 'allocated',
  },
];

export default function CreditNotesPage() {
  const toast = useToast();
  const [notes, setNotes] = useState(INITIAL_CREDIT_NOTES);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Form state for creating a new credit note
  const [form, setForm] = useState({
    customer_name: '',
    invoice_ref: '',
    reason: 'Damaged item return',
    amount: '',
  });

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const matchesSearch = !searchQuery.trim() ||
        [n.note_number, n.customer_name, n.invoice_ref, n.reason].some((val) =>
          String(val || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
      const matchesStatus = !statusFilter || n.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [notes, searchQuery, statusFilter]);

  const totalIssued = useMemo(() => {
    return notes.reduce((sum, n) => sum + Number(n.amount || 0), 0);
  }, [notes]);

  const allocatedAmount = useMemo(() => {
    return notes
      .filter((n) => n.status === 'allocated')
      .reduce((sum, n) => sum + Number(n.amount || 0), 0);
  }, [notes]);

  const openCredits = useMemo(() => {
    return notes
      .filter((n) => n.status === 'posted')
      .reduce((sum, n) => sum + Number(n.amount || 0), 0);
  }, [notes]);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.customer_name || !form.amount || Number(form.amount) <= 0) {
      toast?.error?.('Please enter a valid customer name and credit amount.');
      return;
    }

    const nextNumber = `CN/2026/0000${notes.length + 1}`;
    const newNote = {
      id: `cn-${Date.now()}`,
      note_number: nextNumber,
      note_date: new Date().toISOString().slice(0, 10),
      customer_name: form.customer_name,
      invoice_ref: form.invoice_ref || 'Direct Credit',
      reason: form.reason,
      amount: Number(form.amount).toFixed(2),
      status: 'posted',
    };

    setNotes([newNote, ...notes]);
    toast?.success?.(`Credit Note ${nextNumber} created successfully.`);
    setModalOpen(false);
    setForm({ customer_name: '', invoice_ref: '', reason: 'Damaged item return', amount: '' });
  };

  const columns = [
    {
      key: 'note_number',
      header: 'Credit Note #',
      render: (row) => (
        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
          {row.note_number}
        </span>
      ),
    },
    {
      key: 'note_date',
      header: 'Date',
      render: (row) => row.note_date,
    },
    {
      key: 'customer_name',
      header: 'Customer',
      render: (row) => <span style={{ fontWeight: 500 }}>{row.customer_name}</span>,
    },
    {
      key: 'invoice_ref',
      header: 'Invoice Ref',
      render: (row) => (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {row.invoice_ref}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason / Allowance',
      render: (row) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {row.reason}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Credit Amount',
      align: 'right',
      render: (row) => (
        <span style={{ fontWeight: 600, color: '#f59e0b' }}>
          <MoneyText value={row.amount} />
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Pill tone={row.status === 'allocated' ? 'strong' : 'soft'} size="sm" dot>
          {row.status === 'allocated' ? 'Allocated' : 'Available (Posted)'}
        </Pill>
      ),
    },
  ];

  return (
    <div className="doc-page">
      {/* Header */}
      <div className="doc-page-head">
        <div>
          <h1 className="doc-page-title">
            <FileText size={19} className="doc-icon-accent" aria-hidden="true" />
            Credit Notes
          </h1>
          <p className="doc-page-sub">
            Customer sales returns, price adjustments, and account credits.
          </p>
        </div>

        <Button
          variant="primary"
          icon={<Plus size={15} />}
          onClick={() => setModalOpen(true)}
        >
          Issue Credit Note
        </Button>
      </div>

      {/* KPI Stats in clean horizontal multi-card row */}
      <div className="portal-stat-grid">
        <StatCard
          title="Total Credit Issued"
          value={`₹${totalIssued.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          icon={<FileText size={18} />}
          tone="deep"
        />
        <StatCard
          title="Open Available Credit"
          value={`₹${openCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          icon={<AlertCircle size={18} style={{ color: '#f59e0b' }} />}
          tone="light"
        />
        <StatCard
          title="Allocated / Reconciled"
          value={`₹${allocatedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          icon={<CheckCircle2 size={18} style={{ color: '#10b981' }} />}
          tone="light"
        />
      </div>

      {/* Search & Filter Toolbar */}
      <div className="doc-filters" style={{ marginTop: '0.5rem' }}>
        <input
          type="text"
          placeholder="Search credit note #, customer, reason…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="portal-filter-select"
          style={{ minWidth: '260px', flex: 1 }}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="portal-filter-select"
        >
          <option value="">All Statuses</option>
          <option value="posted">Available (Posted)</option>
          <option value="allocated">Allocated to Invoice</option>
        </select>
      </div>

      {/* Table Card */}
      <div className="portal-table-card">
        <DataTable
          columns={columns}
          rows={filteredNotes}
          emptyLabel="No credit notes found matching your criteria."
        />
      </div>

      {/* Issue Credit Note Modal */}
      {modalOpen && (
        <div className="app-modal-backdrop">
          <div className="app-modal-dialog">
            <div className="app-modal-head">
              <h2 className="app-modal-title">Issue Customer Credit Note</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Decora Interiors Ltd"
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  className="portal-filter-select"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Original Invoice Ref (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV/2026/00001"
                  value={form.invoice_ref}
                  onChange={(e) => setForm({ ...form, invoice_ref: e.target.value })}
                  className="portal-filter-select"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Reason for Credit
                </label>
                <select
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="portal-filter-select"
                  style={{ width: '100%' }}
                >
                  <option value="Damaged item return">Damaged item return</option>
                  <option value="Defective workmanship">Defective workmanship</option>
                  <option value="Pricing adjustment / allowance">Pricing adjustment / allowance</option>
                  <option value="Customer goodwill concession">Customer goodwill concession</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Credit Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="portal-filter-select"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Confirm & Post
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
