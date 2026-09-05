'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/debit-notes/page.jsx
//
// Vendor Debit Notes List (project.md §3 · technicalrequirement.md §3.5).
// Manages vendor debit notes for purchase returns, material defects,
// and supplier price concessions.
// ============================================================

import React, { useState, useMemo } from 'react';
import { Plus, Search, RefreshCw, FileText, ArrowUpRight, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import StatCard from '@/reusablefiles/statcard/StatCard';
import DataTable from '@/reusablefiles/datatable/DataTable';
import Pill from '@/reusablefiles/pill';
import Button from '@/reusablefiles/button';
import { MoneyText } from '@/components/masterdata/Cells';
import { useToast } from '@/context/ToastContext';

const INITIAL_DEBIT_NOTES = [
  {
    id: 'dn-1',
    note_number: 'DN/2026/00001',
    note_date: '2026-02-18',
    vendor_name: 'Azure Timber & Woodcraft',
    bill_ref: 'BILL/2026/00001',
    reason: 'Damaged teak timber planks received',
    amount: '6200.00',
    status: 'posted',
  },
  {
    id: 'dn-2',
    note_number: 'DN/2026/00002',
    note_date: '2026-03-01',
    vendor_name: 'Apex Foam & Springs Co',
    bill_ref: 'BILL/2026/00002',
    reason: 'Supplier invoice pricing discrepancy correction',
    amount: '3150.00',
    status: 'applied',
  },
];

export default function DebitNotesPage() {
  const toast = useToast();
  const [notes, setNotes] = useState(INITIAL_DEBIT_NOTES);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Form state for creating a new debit note
  const [form, setForm] = useState({
    vendor_name: '',
    bill_ref: '',
    reason: 'Defective raw materials returned',
    amount: '',
  });

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const matchesSearch = !searchQuery.trim() ||
        [n.note_number, n.vendor_name, n.bill_ref, n.reason].some((val) =>
          String(val || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
      const matchesStatus = !statusFilter || n.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [notes, searchQuery, statusFilter]);

  const totalIssued = useMemo(() => {
    return notes.reduce((sum, n) => sum + Number(n.amount || 0), 0);
  }, [notes]);

  const appliedAmount = useMemo(() => {
    return notes
      .filter((n) => n.status === 'applied')
      .reduce((sum, n) => sum + Number(n.amount || 0), 0);
  }, [notes]);

  const openDebits = useMemo(() => {
    return notes
      .filter((n) => n.status === 'posted')
      .reduce((sum, n) => sum + Number(n.amount || 0), 0);
  }, [notes]);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.vendor_name || !form.amount || Number(form.amount) <= 0) {
      toast?.error?.('Please enter a valid vendor name and debit amount.');
      return;
    }

    const nextNumber = `DN/2026/0000${notes.length + 1}`;
    const newNote = {
      id: `dn-${Date.now()}`,
      note_number: nextNumber,
      note_date: new Date().toISOString().slice(0, 10),
      vendor_name: form.vendor_name,
      bill_ref: form.bill_ref || 'Direct Debit',
      reason: form.reason,
      amount: Number(form.amount).toFixed(2),
      status: 'posted',
    };

    setNotes([newNote, ...notes]);
    toast?.success?.(`Debit Note ${nextNumber} recorded successfully.`);
    setModalOpen(false);
    setForm({ vendor_name: '', bill_ref: '', reason: 'Defective raw materials returned', amount: '' });
  };

  const columns = [
    {
      key: 'note_number',
      header: 'Debit Note #',
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
      key: 'vendor_name',
      header: 'Vendor',
      render: (row) => <span style={{ fontWeight: 500 }}>{row.vendor_name}</span>,
    },
    {
      key: 'bill_ref',
      header: 'Vendor Bill Ref',
      render: (row) => (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {row.bill_ref}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason / Return',
      render: (row) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {row.reason}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Debit Amount',
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
      render: (row) => (
        <Pill tone={row.status === 'applied' ? 'strong' : 'soft'} size="sm" dot>
          {row.status === 'applied' ? 'Applied to Bill' : 'Pending (Posted)'}
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
            Debit Notes
          </h1>
          <p className="doc-page-sub">
            Vendor purchase returns, material defect claims, and supplier credit claims.
          </p>
        </div>

        <Button
          variant="primary"
          icon={<Plus size={15} />}
          onClick={() => setModalOpen(true)}
        >
          Issue Debit Note
        </Button>
      </div>

      {/* KPI Stats in clean horizontal multi-card row */}
      <div className="portal-stat-grid">
        <StatCard
          title="Total Debit Claims"
          value={`₹${totalIssued.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          icon={<FileText size={18} />}
          tone="deep"
        />
        <StatCard
          title="Pending Recovery"
          value={`₹${openDebits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          icon={<AlertCircle size={18} style={{ color: '#f59e0b' }} />}
          tone="light"
        />
        <StatCard
          title="Applied to Bills"
          value={`₹${appliedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          icon={<CheckCircle2 size={18} style={{ color: '#10b981' }} />}
          tone="light"
        />
      </div>

      {/* Search & Filter Toolbar */}
      <div className="doc-filters" style={{ marginTop: '0.5rem' }}>
        <input
          type="text"
          placeholder="Search debit note #, vendor, reason…"
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
          <option value="posted">Pending (Posted)</option>
          <option value="applied">Applied to Bill</option>
        </select>
      </div>

      {/* Table Card */}
      <div className="portal-table-card">
        <DataTable
          columns={columns}
          rows={filteredNotes}
          emptyLabel="No debit notes found matching your criteria."
        />
      </div>

      {/* Issue Debit Note Modal */}
      {modalOpen && (
        <div className="app-modal-backdrop">
          <div className="app-modal-dialog">
            <div className="app-modal-head">
              <h2 className="app-modal-title">Issue Vendor Debit Note</h2>
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
                  Vendor Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Azure Timber & Woodcraft"
                  value={form.vendor_name}
                  onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
                  className="portal-filter-select"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Original Bill Ref (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. BILL/2026/00001"
                  value={form.bill_ref}
                  onChange={(e) => setForm({ ...form, bill_ref: e.target.value })}
                  className="portal-filter-select"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Reason for Claim
                </label>
                <select
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="portal-filter-select"
                  style={{ width: '100%' }}
                >
                  <option value="Defective raw materials returned">Defective raw materials returned</option>
                  <option value="Supplier billing error / overcharge">Supplier billing error / overcharge</option>
                  <option value="Short delivery quantity allowance">Short delivery quantity allowance</option>
                  <option value="Damaged in transit return">Damaged in transit return</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Debit Amount (₹) *
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
