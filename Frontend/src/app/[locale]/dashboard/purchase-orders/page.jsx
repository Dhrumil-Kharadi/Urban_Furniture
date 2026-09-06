'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  RefreshCw,
  FileText,
  ShoppingBag,
  DollarSign,
  CheckCircle2,
  Clock,
  Calendar,
  Eye,
  LayoutGrid,
  List,
  Copy,
  Check,
  ArrowRight,
  Truck,
  Building2,
  X
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { purchaseOrdersService } from '@/services/purchases.service';
import { formatMoney, formatDate } from '@/utils/format';
import { useLocale } from 'next-intl';
import { Pagination, StatusPill, EmptyState, ErrorState } from '@/components/shared';
import '@/styles/transactions.css';

export default function PurchaseOrdersPage() {
  const locale = useLocale();
  const router = useRouter();

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid');
  const [copiedId, setCopiedId] = useState(null);

  const fetchOrders = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await purchaseOrdersService.list({
        page,
        limit: 12,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      });
      setOrders(res.items || []);
      setPagination(res.pagination || { page: 1, limit: 12, total: res.items?.length || 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchOrders(1);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const copyPoNumber = (e, poNumber, id) => {
    e.stopPropagation();
    navigator.clipboard.writeText(poNumber);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const getStatusTone = (status) => {
    switch (status) {
      case 'confirmed': return 'info';
      case 'billed': return 'success';
      case 'cancelled': return 'danger';
      default: return 'neutral';
    }
  };

  // Process and sort orders for display
  const sortedOrders = useMemo(() => {
    const list = [...orders];
    if (sortBy === 'newest') {
      return list.sort((a, b) => new Date(b.order_date || b.created_at) - new Date(a.order_date || a.created_at));
    }
    if (sortBy === 'oldest') {
      return list.sort((a, b) => new Date(a.order_date || a.created_at) - new Date(b.order_date || b.created_at));
    }
    if (sortBy === 'amount_desc') {
      return list.sort((a, b) => parseFloat(b.total_amount || 0) - parseFloat(a.total_amount || 0));
    }
    if (sortBy === 'amount_asc') {
      return list.sort((a, b) => parseFloat(a.total_amount || 0) - parseFloat(b.total_amount || 0));
    }
    return list;
  }, [orders, sortBy]);

  // Executive KPI summary calculations
  const stats = useMemo(() => {
    const totalCount = pagination.total || orders.length;
    const totalSpend = orders.reduce((sum, po) => sum + (parseFloat(po.total_amount) || 0), 0);
    const confirmedCount = orders.filter(po => po.status === 'confirmed').length;
    const billedCount = orders.filter(po => po.status === 'billed').length;

    return {
      total: totalCount,
      spend: totalSpend,
      confirmed: confirmedCount,
      billed: billedCount,
    };
  }, [orders, pagination.total]);

  // Status counts for filter chips
  const statusCounts = useMemo(() => ({
    all: orders.length,
    draft: orders.filter(o => o.status === 'draft').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    billed: orders.filter(o => o.status === 'billed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  }), [orders]);

  return (
    <div className="tx-page">
      {/* Top Header */}
      <div className="tx-page-header">
        <div>
          <h1 className="tx-page-title">
            <ShoppingBag className="tx-page-title-icon" />
            Purchase Orders
          </h1>
          <p className="tx-page-subtitle">
            Manage vendor procurements, track deliveries, and convert orders to vendor bills
          </p>
        </div>

        <Link
          href="/dashboard/purchase-orders/new"
          className="tx-primary-btn"
        >
          <Plus className="tx-primary-btn-icon" />
          Create Purchase Order
        </Link>
      </div>

      {/* KPI Metrics Summary Grid */}
      <div className="po-kpi-grid">
        <div className="po-kpi-card" style={{ '--kpi-accent': 'var(--accent-primary)', '--kpi-icon-bg': 'rgba(0, 0, 128, 0.08)', '--kpi-icon-color': 'var(--accent-primary)' }}>
          <div className="po-kpi-icon-wrap">
            <FileText className="po-kpi-icon" />
          </div>
          <div className="po-kpi-body">
            <span className="po-kpi-label">Total Orders</span>
            <span className="po-kpi-value">{stats.total}</span>
          </div>
        </div>

        <div className="po-kpi-card" style={{ '--kpi-accent': '#10B981', '--kpi-icon-bg': 'rgba(16, 185, 129, 0.1)', '--kpi-icon-color': '#10B981' }}>
          <div className="po-kpi-icon-wrap">
            <DollarSign className="po-kpi-icon" />
          </div>
          <div className="po-kpi-body">
            <span className="po-kpi-label">Active Spend Value</span>
            <span className="po-kpi-value">{formatMoney(stats.spend, locale)}</span>
          </div>
        </div>

        <div className="po-kpi-card" style={{ '--kpi-accent': '#3B82F6', '--kpi-icon-bg': 'rgba(59, 130, 246, 0.1)', '--kpi-icon-color': '#3B82F6' }}>
          <div className="po-kpi-icon-wrap">
            <Clock className="po-kpi-icon" />
          </div>
          <div className="po-kpi-body">
            <span className="po-kpi-label">Confirmed / In Flight</span>
            <span className="po-kpi-value">{stats.confirmed}</span>
          </div>
        </div>

        <div className="po-kpi-card" style={{ '--kpi-accent': '#8B5CF6', '--kpi-icon-bg': 'rgba(139, 92, 246, 0.1)', '--kpi-icon-color': '#8B5CF6' }}>
          <div className="po-kpi-icon-wrap">
            <CheckCircle2 className="po-kpi-icon" />
          </div>
          <div className="po-kpi-body">
            <span className="po-kpi-label">Billed & Completed</span>
            <span className="po-kpi-value">{stats.billed}</span>
          </div>
        </div>
      </div>

      {/* Advanced Filter, Search & Layout Bar */}
      <div className="po-toolbar">
        <div className="po-toolbar-top">
          <form onSubmit={handleSearchSubmit} className="po-search-container">
            <Search className="po-search-icon-left" />
            <input
              type="text"
              placeholder="Search by PO number or vendor name…"
              className="po-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="po-search-clear"
                title="Clear search"
              >
                <X style={{ width: 12, height: 12 }} />
              </button>
            )}
          </form>

          <div className="po-toolbar-actions">
            <select
              className="po-select-control"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="amount_desc">Amount: High to Low</option>
              <option value="amount_asc">Amount: Low to High</option>
            </select>

            <div className="po-view-toggle">
              <button
                type="button"
                className={`po-toggle-btn${viewMode === 'grid' ? ' active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid Card View"
              >
                <LayoutGrid style={{ width: 16, height: 16 }} />
              </button>
              <button
                type="button"
                className={`po-toggle-btn${viewMode === 'table' ? ' active' : ''}`}
                onClick={() => setViewMode('table')}
                title="Table View"
              >
                <List style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => fetchOrders(pagination.page)}
              className="tx-refresh-btn"
              title="Refresh orders"
            >
              <RefreshCw className={`tx-refresh-icon${loading ? ' tx-loading-spinner' : ''}`} />
            </button>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="po-filter-chips">
          {[
            { id: '', label: 'All Orders', count: statusCounts.all },
            { id: 'draft', label: 'Draft', count: statusCounts.draft },
            { id: 'confirmed', label: 'Confirmed', count: statusCounts.confirmed },
            { id: 'billed', label: 'Billed', count: statusCounts.billed },
            { id: 'cancelled', label: 'Cancelled', count: statusCounts.cancelled },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`po-chip-btn${statusFilter === chip.id ? ' active' : ''}`}
              onClick={() => setStatusFilter(chip.id)}
            >
              <span>{chip.label}</span>
              {chip.count > 0 && <span className="po-chip-count">{chip.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {error ? (
        <ErrorState message={error} onRetry={() => fetchOrders(1)} />
      ) : loading && orders.length === 0 ? (
        <div className="po-cards-grid">
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <div key={k} className="po-skeleton-card" />
          ))}
        </div>
      ) : sortedOrders.length === 0 ? (
        <div className="tx-table-panel" style={{ padding: '2.5rem 1rem' }}>
          <EmptyState
            title="No purchase orders found"
            description={searchQuery || statusFilter ? 'Try adjusting your search query or filters.' : 'Create your first purchase order to start procuring goods from vendors.'}
            action={
              <Link
                href="/dashboard/purchase-orders/new"
                className="tx-inline-action"
              >
                <Plus className="tx-inline-action-icon" />
                Create New PO
              </Link>
            }
          />
        </div>
      ) : viewMode === 'grid' ? (
        /* ── GRID VIEW (HERO) ── */
        <>
          <div className="po-cards-grid">
            {sortedOrders.map((po) => {
              const vendorInitials = (po.vendor_name || 'V')
                .split(' ')
                .map((w) => w[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              const isDraft = po.status === 'draft';
              const isConfirmed = po.status === 'confirmed';
              const isBilled = po.status === 'billed';

              return (
                <div
                  key={po.id}
                  className="po-card"
                  onClick={() => router.push(`/dashboard/purchase-orders/${po.id}`)}
                >
                  {/* Card Header: PO Badge + Status */}
                  <div className="po-card-header">
                    <span className="po-number-badge">
                      <FileText style={{ width: 14, height: 14 }} />
                      {po.po_number}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={(e) => copyPoNumber(e, po.po_number, po.id)}
                        className="tx-table-action-link"
                        title="Copy PO Number"
                      >
                        {copiedId === po.id ? (
                          <Check style={{ width: 14, height: 14, color: '#10B981' }} />
                        ) : (
                          <Copy style={{ width: 14, height: 14 }} />
                        )}
                      </button>
                      <StatusPill status={po.status} tone={getStatusTone(po.status)} />
                    </div>
                  </div>

                  {/* Vendor Details */}
                  <div className="po-vendor-block">
                    <div className="po-vendor-avatar">
                      {vendorInitials}
                    </div>
                    <div className="po-vendor-info">
                      <span className="po-vendor-title">
                        {po.vendor_name || 'Vendor Contact'}
                      </span>
                      <span className="po-vendor-label">
                        <Building2 style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />
                        Supplier
                      </span>
                    </div>
                  </div>

                  {/* Metadata 2-Column Info Grid */}
                  <div className="po-meta-grid">
                    <div className="po-meta-item">
                      <span className="po-meta-label">
                        <Calendar style={{ width: 11, height: 11 }} />
                        Order Date
                      </span>
                      <span className="po-meta-val">
                        {formatDate(po.order_date, locale)}
                      </span>
                    </div>

                    <div className="po-meta-item">
                      <span className="po-meta-label">
                        <Truck style={{ width: 11, height: 11 }} />
                        Expected Date
                      </span>
                      <span className="po-meta-val">
                        {po.expected_date ? formatDate(po.expected_date, locale) : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Visual Status Progress Tracker */}
                  <div className="po-stage-track" title={`Current Stage: ${po.status}`}>
                    <div className={`po-stage-step ${isDraft ? 'active' : 'done'}`} />
                    <div className={`po-stage-step ${isConfirmed ? 'active' : isBilled ? 'done' : ''}`} />
                    <div className={`po-stage-step ${isBilled ? 'done' : ''}`} />
                  </div>

                  {/* Card Footer: Amount & Action Button */}
                  <div className="po-card-footer">
                    <div className="po-amount-block">
                      <span className="po-amount-label">Total Amount</span>
                      <span className="po-amount-value">
                        {formatMoney(po.total_amount, locale)}
                      </span>
                    </div>

                    <Link
                      href={`/dashboard/purchase-orders/${po.id}`}
                      className="po-card-btn"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>View PO</span>
                      <ArrowRight style={{ width: 14, height: 14 }} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {pagination.totalPages > 1 && (
            <div className="tx-table-pagination" style={{ marginTop: '1rem' }}>
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                onPageChange={(p) => fetchOrders(p)}
              />
            </div>
          )}
        </>
      ) : (
        /* ── TABLE VIEW ── */
        <div className="tx-table-panel">
          <div className="tx-table-scroll">
            <table className="tx-table">
              <thead>
                <tr>
                  <th className="tx-table-th">PO Number</th>
                  <th className="tx-table-th">Date</th>
                  <th className="tx-table-th">Vendor</th>
                  <th className="tx-table-th">Expected</th>
                  <th className="tx-table-th tx-table-th--right">Total Amount</th>
                  <th className="tx-table-th tx-table-th--center">Status</th>
                  <th className="tx-table-th tx-table-th--center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((po) => (
                  <tr
                    key={po.id}
                    onClick={() => router.push(`/dashboard/purchase-orders/${po.id}`)}
                    className="tx-row-clickable"
                  >
                    <td className="tx-table-td tx-table-td--mono">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <FileText style={{ width: 14, height: 14, color: 'var(--accent-primary)' }} />
                        {po.po_number}
                      </span>
                    </td>
                    <td className="tx-table-td tx-table-td--muted">
                      {formatDate(po.order_date, locale)}
                    </td>
                    <td className="tx-table-td tx-table-td--name">
                      {po.vendor_name || 'Vendor'}
                    </td>
                    <td className="tx-table-td tx-table-td--muted">
                      {po.expected_date ? formatDate(po.expected_date, locale) : '—'}
                    </td>
                    <td className="tx-table-td tx-table-td--money">
                      {formatMoney(po.total_amount, locale)}
                    </td>
                    <td className="tx-table-td tx-table-td--center">
                      <StatusPill status={po.status} tone={getStatusTone(po.status)} />
                    </td>
                    <td className="tx-table-td tx-table-td--center" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/dashboard/purchase-orders/${po.id}`}
                        className="tx-table-action-link"
                        title="View PO Details"
                      >
                        <Eye className="tx-table-action-icon" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="tx-table-pagination">
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                onPageChange={(p) => fetchOrders(p)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

