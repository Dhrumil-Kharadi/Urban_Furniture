'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import { useRouter, Link } from '@/i18n/navigation';
import { useToast, DocumentStatusBar } from '@/components/shared';
import VendorBillForm from '@/components/vendor-bills/VendorBillForm';
import { vendorBillsService } from '@/services/purchases.service';
import { RefreshCw, BookOpen, FileText } from 'lucide-react';

export default function VendorBillDetailPage({ params }) {
  const resolvedParams = use(params);
  const billId = resolvedParams.id;

  const router = useRouter();
  const { addToast } = useToast();

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchBill = useCallback(async () => {
    setLoading(true);
    try {
      const data = await vendorBillsService.get(billId);
      setBill(data);
    } catch (err) {
      addToast({
        title: 'Error',
        description: err.message || 'Failed to load vendor bill',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [billId, addToast]);

  useEffect(() => {
    fetchBill();
  }, [fetchBill]);

  const handleUpdate = async (formData) => {
    setActionLoading(true);
    try {
      const updated = await vendorBillsService.update(billId, formData);
      setBill(updated);
      addToast({
        title: 'Updated',
        description: 'Vendor bill updated successfully',
        type: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Update Failed',
        description: err.message || 'Could not update vendor bill',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePost = async () => {
    if (!confirm('Posting this bill will generate an immutable balanced double-entry journal record in the ledger. Proceed?')) {
      return;
    }

    setActionLoading(true);
    try {
      const posted = await vendorBillsService.post(billId);
      setBill(posted);
      addToast({
        title: 'Bill Posted to Ledger',
        description: `Bill ${posted.bill_number} posted successfully. Journal Entry created.`,
        type: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Posting Failed',
        description: err.message || 'Could not post vendor bill to ledger',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this vendor bill? If posted, a reversing journal entry will be created.')) {
      return;
    }

    setActionLoading(true);
    try {
      const cancelled = await vendorBillsService.cancel(billId);
      setBill(cancelled);
      addToast({
        title: 'Bill Cancelled',
        description: `Bill ${cancelled.bill_number} cancelled`,
        type: 'info',
      });
    } catch (err) {
      addToast({
        title: 'Cancellation Failed',
        description: err.message || 'Could not cancel vendor bill',
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
        Loading vendor bill details…
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="p-12 text-center text-gray-400">
        Vendor bill not found.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Workflow Action & Status Bar */}
      <DocumentStatusBar
        title="Vendor Bill"
        docNumber={bill.bill_number}
        status={bill.status}
        stages={['draft', 'posted', 'paid']}
        isCancelled={bill.status === 'cancelled'}
        backUrl="/dashboard/vendor-bills"
        loading={actionLoading}
        onPost={bill.status === 'draft' ? handlePost : null}
        onCancel={bill.status !== 'cancelled' ? handleCancel : null}
      />

      {/* Linked Cross-References */}
      <div className="flex flex-wrap items-center gap-3">
        {bill.journal_entry_id && (
          <Link
            href={`/dashboard/journal-entries/${bill.journal_entry_id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-300 bg-indigo-950/60 border border-indigo-800 hover:bg-indigo-900/80 transition-colors shadow-sm"
          >
            <BookOpen className="w-3.5 h-3.5" />
            View Linked Journal Entry
          </Link>
        )}

        {bill.purchase_order_id && (
          <Link
            href={`/dashboard/purchase-orders/${bill.purchase_order_id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800 hover:bg-emerald-900/80 transition-colors shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" />
            View Originating Purchase Order
          </Link>
        )}
      </div>

      {/* Main Form */}
      <VendorBillForm
        initialData={bill}
        onSubmit={handleUpdate}
        onCancel={() => router.push('/dashboard/vendor-bills')}
        loading={actionLoading}
        isReadOnly={bill.status !== 'draft'}
      />
    </div>
  );
}
