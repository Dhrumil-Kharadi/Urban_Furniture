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
      <div className="tx-loading-center">
        <RefreshCw className="tx-loading-spinner" />
        Loading vendor bill details…
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="tx-not-found">
        Vendor bill not found.
      </div>
    );
  }

  return (
    <div className="tx-page tx-page--narrow">
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
      <div className="tx-xref-bar">
        {bill.journal_entry_id && (
          <Link
            href={`/dashboard/journal-entries/${bill.journal_entry_id}`}
            className="tx-xref-link tx-xref-link--journal"
          >
            <BookOpen className="tx-xref-icon" />
            View Linked Journal Entry
          </Link>
        )}

        {bill.purchase_order_id && (
          <Link
            href={`/dashboard/purchase-orders/${bill.purchase_order_id}`}
            className="tx-xref-link tx-xref-link--po"
          >
            <FileText className="tx-xref-icon" />
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
