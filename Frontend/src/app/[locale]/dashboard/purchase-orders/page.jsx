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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-indigo-400" />
            Purchase Orders
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Procure inventory and assets from vendors with automated billing conversion
          </p>
        </div>

        <Link
          href="/dashboard/purchase-orders/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          New Purchase Order
        </Link>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-xl border border-gray-700/60 bg-gray-900/60 shadow-md flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search PO number or vendor…"
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
            <select
              className="px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
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
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
            title="Refresh orders"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Orders Table */}
      {error ? (
        <ErrorState message={error} onRetry={() => fetchOrders(1)} />
      ) : (
        <div className="rounded-xl border border-gray-700/60 bg-gray-900/60 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead>
                <tr className="border-b border-gray-700/80 bg-gray-800/60 text-xs uppercase tracking-wider text-gray-400">
                  <th className="py-3 px-4 font-semibold">PO Number</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Vendor</th>
                  <th className="py-3 px-4 font-semibold">Expected</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Amount</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {loading && orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500 italic">
                      Loading purchase orders…
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12">
                      <EmptyState
                        title="No purchase orders found"
                        description="Create your first purchase order to start procuring goods from vendors."
                        action={
                          <Link
                            href="/dashboard/purchase-orders/new"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500"
                          >
                            <Plus className="w-3.5 h-3.5" />
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
                      className="hover:bg-gray-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-indigo-400">
                        {po.po_number}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-300">
                        {formatDate(po.order_date, locale)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-200">
                        {po.vendor_name || 'Vendor'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-400">
                        {po.expected_date ? formatDate(po.expected_date, locale) : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-gray-100">
                        {formatMoney(po.total_amount, locale)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusPill status={po.status} tone={getStatusTone(po.status)} />
                      </td>
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/dashboard/purchase-orders/${po.id}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-400 hover:bg-gray-800 transition-colors inline-block"
                          title="View PO Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-gray-800">
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
