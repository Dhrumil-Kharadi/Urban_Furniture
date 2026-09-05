'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, Eye, RefreshCw, Receipt } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { vendorBillsService } from '@/services/purchases.service';
import { formatMoney, formatDate } from '@/utils/format';
import { useLocale } from 'next-intl';
import { Pagination, StatusPill, EmptyState, ErrorState } from '@/components/shared';

export default function VendorBillsPage() {
  const locale = useLocale();
  const router = useRouter();

  const [bills, setBills] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchBills = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await vendorBillsService.list({
        page,
        limit: 10,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      });
      setBills(res.items || []);
      setPagination(res.pagination || { page: 1, limit: 10, total: res.items?.length || 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to load vendor bills');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchBills(1);
  }, [fetchBills]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchBills(1);
  };

  const getStatusTone = (status) => {
    switch (status) {
      case 'posted': return 'info';
      case 'paid': return 'success';
      case 'partially_paid': return 'warning';
      case 'overdue': return 'danger';
      case 'cancelled': return 'danger';
      default: return 'neutral';
    }
  };

  return (
    <div className="tx-page">
      {/* Header */}
      <div className="tx-page-header">
        <div>
          <h1 className="tx-page-title">
            <Receipt className="tx-page-title-icon" />
            Vendor Bills
          </h1>
          <p className="tx-page-subtitle">
            Manage vendor invoices, post to accounts payable, and track amounts due
          </p>
        </div>

        <Link
          href="/dashboard/vendor-bills/new"
          className="tx-primary-btn"
        >
          <Plus className="tx-primary-btn-icon" />
          New Vendor Bill
        </Link>
      </div>

      {/* Filter & Search Bar */}
      <div className="tx-filter-bar">
        <form onSubmit={handleSearchSubmit} className="tx-search-form">
          <div className="tx-search-wrap">
            <Search className="tx-search-icon" />
            <input
              type="text"
              placeholder="Search bill number or vendor…"
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
              <option value="posted">Posted</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => fetchBills(pagination.page)}
            className="tx-refresh-btn"
            title="Refresh bills"
          >
            <RefreshCw className={`tx-refresh-icon${loading ? ' tx-loading-spinner' : ''}`} />
          </button>
        </div>
      </div>

      {/* Bills Table */}
      {error ? (
        <ErrorState message={error} onRetry={() => fetchBills(1)} />
      ) : (
        <div className="tx-table-panel">
          <div className="tx-table-scroll">
            <table className="tx-table">
              <thead>
                <tr>
                  <th className="tx-table-th">Bill #</th>
                  <th className="tx-table-th">Bill Date</th>
                  <th className="tx-table-th">Vendor</th>
                  <th className="tx-table-th">Due Date</th>
                  <th className="tx-table-th tx-table-th--right">Total</th>
                  <th className="tx-table-th tx-table-th--right">Due</th>
                  <th className="tx-table-th tx-table-th--center">Status</th>
                  <th className="tx-table-th tx-table-th--center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && bills.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="tx-table-loading">
                      Loading vendor bills…
                    </td>
                  </tr>
                ) : bills.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="tx-table-empty">
                      <EmptyState
                        title="No vendor bills found"
                        description="Record vendor bills directly or convert confirmed purchase orders into bills."
                        action={
                          <Link
                            href="/dashboard/vendor-bills/new"
                            className="tx-inline-action"
                          >
                            <Plus className="tx-inline-action-icon" />
                            New Bill
                          </Link>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  bills.map((bill) => (
                    <tr
                      key={bill.id}
                      onClick={() => router.push(`/dashboard/vendor-bills/${bill.id}`)}
                      className="tx-row-clickable"
                    >
                      <td className="tx-table-td tx-table-td--mono">
                        {bill.bill_number}
                      </td>
                      <td className="tx-table-td tx-table-td--muted">
                        {formatDate(bill.bill_date, locale)}
                      </td>
                      <td className="tx-table-td tx-table-td--name">
                        {bill.vendor_name || 'Vendor'}
                      </td>
                      <td className="tx-table-td tx-table-td--muted">
                        {bill.due_date ? formatDate(bill.due_date, locale) : '—'}
                      </td>
                      <td className="tx-table-td tx-table-td--money">
                        {formatMoney(bill.total_amount, locale)}
                      </td>
                      <td className="tx-table-td tx-table-td--due">
                        {formatMoney(bill.amount_due, locale)}
                      </td>
                      <td className="tx-table-td tx-table-td--center">
                        <StatusPill status={bill.status} tone={getStatusTone(bill.status)} />
                      </td>
                      <td className="tx-table-td tx-table-td--center" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/dashboard/vendor-bills/${bill.id}`}
                          className="tx-table-action-link"
                          title="View Bill Details"
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
                onPageChange={(p) => fetchBills(p)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
