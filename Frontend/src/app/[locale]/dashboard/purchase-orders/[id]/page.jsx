'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useToast, DocumentStatusBar, Modal } from '@/components/shared';
import PurchaseOrderForm from '@/components/purchase-orders/PurchaseOrderForm';
import JournalPicker from '@/components/pickers/JournalPicker';
import { purchaseOrdersService } from '@/services/purchases.service';
import { RefreshCw, FileText } from 'lucide-react';

export default function PurchaseOrderDetailPage({ params }) {
  const resolvedParams = use(params);
  const poId = resolvedParams.id;

  const router = useRouter();
  const { addToast } = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Journal selection modal for PO -> Bill conversion
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [selectedJournalId, setSelectedJournalId] = useState('');

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const data = await purchaseOrdersService.get(poId);
      setOrder(data);
    } catch (err) {
      addToast({
        title: 'Error',
        description: err.message || 'Failed to load purchase order',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [poId, addToast]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleUpdate = async (formData) => {
    setActionLoading(true);
    try {
      const updated = await purchaseOrdersService.update(poId, formData);
      setOrder(updated);
      addToast({
        title: 'Updated',
        description: 'Purchase order updated successfully',
        type: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Update Failed',
        description: err.message || 'Could not update purchase order',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirm = async () => {
    setActionLoading(true);
    try {
      const confirmed = await purchaseOrdersService.confirm(poId);
      setOrder(confirmed);
      addToast({
        title: 'Order Confirmed',
        description: `PO ${confirmed.po_number} is now confirmed`,
        type: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Confirmation Failed',
        description: err.message || 'Could not confirm purchase order',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBill = async () => {
    if (!selectedJournalId) {
      addToast({
        title: 'Journal Required',
        description: 'Please select a purchase journal to create the bill',
        type: 'error',
      });
      return;
    }

    setActionLoading(true);
    try {
      const bill = await purchaseOrdersService.createBill(poId, selectedJournalId);
      setBillModalOpen(false);
      addToast({
        title: 'Vendor Bill Created',
        description: `Draft bill created from PO ${order.po_number}`,
        type: 'success',
      });
      router.push(`/dashboard/vendor-bills/${bill.id}`);
    } catch (err) {
      addToast({
        title: 'Bill Creation Failed',
        description: err.message || 'Could not create vendor bill from PO',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this purchase order?')) return;
    setActionLoading(true);
    try {
      const cancelled = await purchaseOrdersService.cancel(poId);
      setOrder(cancelled);
      addToast({
        title: 'Cancelled',
        description: `Purchase order ${cancelled.po_number} has been cancelled`,
        type: 'info',
      });
    } catch (err) {
      addToast({
        title: 'Cancellation Failed',
        description: err.message || 'Could not cancel purchase order',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 italic flex items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
        Loading purchase order details…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-12 text-center text-gray-400">
        Purchase order not found.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Workflow Action & Status Bar */}
      <DocumentStatusBar
        title="Purchase Order"
        docNumber={order.po_number}
        status={order.status}
        stages={['draft', 'confirmed', 'billed']}
        isCancelled={order.status === 'cancelled'}
        backUrl="/dashboard/purchase-orders"
        loading={actionLoading}
        onConfirm={order.status === 'draft' ? handleConfirm : null}
        onCreateBill={order.status === 'confirmed' ? () => setBillModalOpen(true) : null}
        onCancel={order.status !== 'cancelled' && order.status !== 'billed' ? handleCancel : null}
      />

      {/* Main Form */}
      <PurchaseOrderForm
        initialData={order}
        onSubmit={handleUpdate}
        onCancel={() => router.push('/dashboard/purchase-orders')}
        loading={actionLoading}
        isReadOnly={order.status !== 'draft'}
      />

      {/* Journal Selection Modal for Bill Creation */}
      {billModalOpen && (
        <Modal
          title="Create Vendor Bill"
          onClose={() => setBillModalOpen(false)}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              Select the purchase journal to record this vendor bill. All items from PO{' '}
              <strong className="text-indigo-400">{order.po_number}</strong> will be copied into the bill.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">
                Purchase Journal <span className="text-red-400">*</span>
              </label>
              <JournalPicker
                value={selectedJournalId}
                onChange={(j) => setSelectedJournalId(j ? j.id : '')}
                type="purchase"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setBillModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateBill}
                disabled={!selectedJournalId || actionLoading}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                {actionLoading ? 'Creating Bill…' : 'Proceed & Create Bill'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
