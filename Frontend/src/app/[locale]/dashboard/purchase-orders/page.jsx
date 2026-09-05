'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, Eye, RefreshCw, FileText } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { purchaseOrdersService } from '@/services/purchases.service';
import { formatMoney, formatDate } from '@/utils/format';
import { useLocale } from 'next-intl';
import { Pagination, StatusPill, EmptyState, ErrorState } from '@/components/shared';

export default function PurchaseOrdersPage() {
  const locale = useLocale();
  const router = useRouter();

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOrders = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await purchaseOrdersService.list({
        page,
        limit: 10,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      });
      setOrders(res.items || []);
      setPagination(res.pagination || { page: 1, limit: 10, total: res.items?.length || 0, totalPages: 1 });
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

  const getStatusTone = (status) => {
    switch (status) {
      case 'confirmed': return 'info';
      case 'billed': return 'success';
      case 'cancelled': return 'danger';
      default: return 'neutral';
    }
  };

  return (
    <div className="tx-page">
      {/* Top Header */}
      <div className="tx-page-header">
        <div>
          <h1 className="tx-page-title">
            <FileText className="tx-page-title-icon" />
            Purchase Orders
          </h1>
          <p className="tx-page-subtitle">
            Procure inventory and assets from vendors with automated billing conversion
          </p>
        </div>

        <Link
          href="/dashboard/purchase-orders/new"
          className="tx-primary-btn"
        >
          <Plus className="tx-primary-btn-icon" />
          New Purchase Order
        </Link>
      </div>

      {/* Filter & Search Bar */}
      <div className="tx-filter-bar">
        <form onSubmit={handleSearchSubmit} className="tx-search-form">
          <div className="tx-search-wrap">
            <Search className="tx-search-icon" />
            <input
              type="text"
              placeholder="Search PO number or vendor…"
              className="tx-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button type="submit" className="tx-search-btn">
            Search
          </button>
        </form>

        <div className="tx-filter-group">
          <div className="tx-filter-label">
            <Filter className="tx-filter-label-icon" />
            <span>Status:</span>
            <select
              className="tx-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="confirmed">Confirmed</option>
              <option value="billed">Billed</option>
              <option value="cancelled">Cancelled</option>
            </select>
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

      {/* Orders Table */}
      {error ? (
        <ErrorState message={error} onRetry={() => fetchOrders(1)} />
      ) : (
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
                {loading && orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="tx-table-loading">
                      Loading purchase orders…
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="tx-table-empty">
                      <EmptyState
                        title="No purchase orders found"
                        description="Create your first purchase order to start procuring goods from vendors."
                        action={
                          <Link
                            href="/dashboard/purchase-orders/new"
                            className="tx-inline-action"
                          >
                            <Plus className="tx-inline-action-icon" />
                            New PO
                          </Link>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  orders.map((po) => (
                    <tr
                      key={po.id}
                      onClick={() => router.push(`/dashboard/purchase-orders/${po.id}`)}
                      className="tx-row-clickable"
                    >
                      <td className="tx-table-td tx-table-td--mono">
                        {po.po_number}
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
                  ))
                )}
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
