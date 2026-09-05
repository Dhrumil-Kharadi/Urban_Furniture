'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useToast, DocumentStatusBar, Modal } from '@/components/shared';
import SalesOrderForm from '@/components/sales-orders/SalesOrderForm';
import JournalPicker from '@/components/pickers/JournalPicker';
import { salesOrdersService } from '@/services/sales.service';
import { RefreshCw, ShoppingCart } from 'lucide-react';

export default function SalesOrderDetailPage({ params }) {
  const resolvedParams = use(params);
  const soId = resolvedParams.id;

  const router = useRouter();
  const { addToast } = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Journal selection modal for SO -> Invoice conversion
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedJournalId, setSelectedJournalId] = useState('');

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const data = await salesOrdersService.get(soId);
      setOrder(data);
    } catch (err) {
      addToast({
        title: 'Error',
        description: err.message || 'Failed to load sales order',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [soId, addToast]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleUpdate = async (formData) => {
    setActionLoading(true);
    try {
      const updated = await salesOrdersService.update(soId, formData);
      setOrder(updated);
      addToast({
        title: 'Updated',
        description: 'Sales order updated successfully',
        type: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Update Failed',
        description: err.message || 'Could not update sales order',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirm = async () => {
    setActionLoading(true);
    try {
      const confirmed = await salesOrdersService.confirm(soId);
      setOrder(confirmed);
      addToast({
        title: 'Order Confirmed',
        description: `SO ${confirmed.so_number} is now confirmed`,
        type: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Confirmation Failed',
        description: err.message || 'Could not confirm sales order',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateInvoice = async () => {
    setActionLoading(true);
    try {
      const invoice = await salesOrdersService.createInvoice(soId, selectedJournalId || null);
      setInvoiceModalOpen(false);
      addToast({
        title: 'Invoice Created',
        description: `Customer Invoice generated from ${order.so_number}`,
        type: 'success',
      });
      router.push(`/dashboard/customer-invoices/${invoice.id}`);
    } catch (err) {
      addToast({
        title: 'Invoice Creation Failed',
        description: err.message || 'Could not generate customer invoice',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this sales order?')) {
      return;
    }

    setActionLoading(true);
    try {
      const cancelled = await salesOrdersService.cancel(soId);
      setOrder(cancelled);
      addToast({
        title: 'Order Cancelled',
        description: `Sales order ${cancelled.so_number} has been cancelled`,
        type: 'info',
      });
    } catch (err) {
      addToast({
        title: 'Cancellation Failed',
        description: err.message || 'Could not cancel sales order',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
        Loading sales order details…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-12 text-center text-gray-400">
        Sales order not found.
      </div>
    );
  }

  const stages = [
    { key: 'draft', label: 'Draft' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'invoiced', label: 'Invoiced' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Document Status Bar */}
      <DocumentStatusBar
        documentNumber={order.so_number}
        currentStatus={order.status}
        stages={stages}
        onConfirm={order.status === 'draft' ? handleConfirm : null}
        onCreateBill={order.status === 'confirmed' ? () => setInvoiceModalOpen(true) : null}
        createBillText="Create Invoice"
        onCancel={order.status !== 'invoiced' && order.status !== 'cancelled' ? handleCancel : null}
        loading={actionLoading}
      />

      {/* Form */}
      <SalesOrderForm
        initialData={order}
        onSubmit={handleUpdate}
        onCancel={() => router.push('/dashboard/sales-orders')}
        loading={actionLoading}
        isReadOnly={order.status !== 'draft'}
      />

      {/* Modal for Invoice Journal Selection */}
      <Modal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        title="Generate Customer Invoice"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-300">
            Select the Sales Journal to issue this Customer Invoice against:
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Sales Journal
            </label>
            <JournalPicker
              type="sales"
              value={selectedJournalId}
              onChange={(j) => setSelectedJournalId(j ? j.id : '')}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
            <button
              type="button"
              onClick={() => setInvoiceModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateInvoice}
              disabled={actionLoading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md disabled:opacity-50"
            >
              {actionLoading ? 'Generating…' : 'Generate Customer Invoice'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
