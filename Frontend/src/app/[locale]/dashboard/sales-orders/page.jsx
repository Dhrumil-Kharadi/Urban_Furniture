'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, Eye, RefreshCw, ShoppingCart } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { salesOrdersService } from '@/services/sales.service';
import { formatMoney, formatDate } from '@/utils/format';
import { useLocale } from 'next-intl';
import { Pagination, StatusPill, EmptyState, ErrorState } from '@/components/shared';

export default function SalesOrdersPage() {
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
      const res = await salesOrdersService.list({
        page,
        limit: 10,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      });
      setOrders(res.items || []);
      setPagination(res.meta || { page: 1, limit: 10, total: res.items?.length || 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to load sales orders');
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
      case 'invoiced': return 'success';
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
            <ShoppingCart className="w-6 h-6 text-indigo-400" />
            Sales Orders
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage customer sales orders and convert confirmed orders to customer invoices
          </p>
        </div>

        <Link
          href="/dashboard/sales-orders/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          New Sales Order
        </Link>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-xl border border-gray-700/60 bg-gray-900/60 shadow-md flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search SO number or customer…"
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
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-xs font-medium text-gray-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="confirmed">Confirmed</option>
              <option value="invoiced">Invoiced</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => fetchOrders(pagination.page)}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Table */}
      {error ? (
        <ErrorState message={error} onRetry={() => fetchOrders(1)} />
      ) : loading && !orders.length ? (
        <div className="p-12 text-center text-gray-400 bg-gray-900/40 border border-gray-800 rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
          Loading sales orders…
        </div>
      ) : !orders.length ? (
        <EmptyState
          title="No sales orders found"
          description="Create your first customer sales order to initiate the sales flow."
          actionText="Create Sales Order"
          onAction={() => router.push('/dashboard/sales-orders/new')}
        />
      ) : (
        <div className="rounded-2xl border border-gray-700/60 bg-gray-900/60 shadow-xl overflow-hidden backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-800/80 text-xs uppercase tracking-wider text-gray-400 border-b border-gray-700/80">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">SO Number</th>
                  <th className="py-3.5 px-4 font-semibold">Customer</th>
                  <th className="py-3.5 px-4 font-semibold">Order Date</th>
                  <th className="py-3.5 px-4 font-semibold">Expected Date</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Untaxed</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Tax</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Total</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {orders.map((so) => (
                  <tr
                    key={so.id}
                    className="hover:bg-gray-800/40 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/dashboard/sales-orders/${so.id}`)}
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-indigo-300">
                      {so.so_number}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-200">
                      {so.customer_name || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-gray-400">
                      {formatDate(so.order_date, locale)}
                    </td>
                    <td className="py-3.5 px-4 text-gray-400">
                      {so.expected_date ? formatDate(so.expected_date, locale) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-gray-300">
                      {formatMoney(so.untaxed_amount, locale)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-gray-400">
                      {formatMoney(so.tax_amount, locale)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-400">
                      {formatMoney(so.total_amount, locale)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <StatusPill status={so.status} tone={getStatusTone(so.status)} />
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/dashboard/sales-orders/${so.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 hover:text-white transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-gray-800 flex justify-end">
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={(p) => fetchOrders(p)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
