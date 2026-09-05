'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import { useRouter, Link } from '@/i18n/navigation';
import { useToast, DocumentStatusBar } from '@/components/shared';
import CustomerInvoiceForm from '@/components/customer-invoices/CustomerInvoiceForm';
import { customerInvoicesService } from '@/services/sales.service';
import { RefreshCw, BookOpen, Send, Printer, Receipt } from 'lucide-react';

export default function CustomerInvoiceDetailPage({ params }) {
  const resolvedParams = use(params);
  const invoiceId = resolvedParams.id;

  const router = useRouter();
  const { addToast } = useToast();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchInvoice = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customerInvoicesService.get(invoiceId);
      setInvoice(data);
    } catch (err) {
      addToast({
        title: 'Error',
        description: err.message || 'Failed to load customer invoice',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [invoiceId, addToast]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handleUpdate = async (formData) => {
    setActionLoading(true);
    try {
      const updated = await customerInvoicesService.update(invoiceId, formData);
      setInvoice(updated);
      addToast({
        title: 'Updated',
        description: 'Customer invoice updated successfully',
        type: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Update Failed',
        description: err.message || 'Could not update customer invoice',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePost = async () => {
    if (!confirm('Posting this invoice will generate an immutable balanced double-entry journal record in the ledger (Dr Debtors / Cr Sale Income + Output Tax). Proceed?')) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await customerInvoicesService.post(invoiceId);
      await fetchInvoice();
      addToast({
        title: 'Invoice Posted to Ledger',
        description: `Invoice ${res.invoice?.invoiceNumber || ''} posted successfully. Journal entry created.`,
        type: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Posting Failed',
        description: err.message || 'Could not post customer invoice to ledger',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSend = async () => {
    setActionLoading(true);
    try {
      const res = await customerInvoicesService.send(invoiceId);
      addToast({
        title: 'Invoice Sent',
        description: res.message || 'Invoice sent to customer email successfully',
        type: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Send Failed',
        description: err.message || 'Could not send invoice to customer',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this customer invoice? If posted, a reversing journal entry will be created.')) {
      return;
    }

    setActionLoading(true);
    try {
      const cancelled = await customerInvoicesService.cancel(invoiceId);
      setInvoice(cancelled);
      addToast({
        title: 'Invoice Cancelled',
        description: `Customer invoice ${cancelled.invoice_number} cancelled`,
        type: 'info',
      });
    } catch (err) {
      addToast({
        title: 'Cancellation Failed',
        description: err.message || 'Could not cancel customer invoice',
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
        Loading customer invoice details…
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-12 text-center text-gray-400">
        Customer invoice not found.
      </div>
    );
  }

  const stages = [
    { key: 'draft', label: 'Draft' },
    { key: 'posted', label: 'Posted' },
    { key: 'partially_paid', label: 'Partially Paid' },
    { key: 'paid', label: 'Paid' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 print:p-0 print:max-w-none">
      {/* Document Status Bar (Hidden during Print) */}
      <div className="print:hidden">
        <DocumentStatusBar
          documentNumber={invoice.invoice_number}
          currentStatus={invoice.status}
          stages={stages}
          onConfirm={invoice.status === 'draft' ? handlePost : null}
          confirmText="Post to Ledger"
          onCancel={
            invoice.status !== 'cancelled' &&
            invoice.status !== 'paid' &&
            invoice.status !== 'partially_paid'
              ? handleCancel
              : null
          }
          loading={actionLoading}
        />
      </div>

      {/* Linked Journal Entry & Quick Actions Banner */}
      {invoice.journal_entry_id && (
        <div className="p-4 rounded-xl border border-indigo-900/60 bg-indigo-950/30 flex flex-wrap items-center justify-between gap-3 text-xs text-indigo-200 shadow-sm print:hidden">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>
              Posted to General Ledger. Balanced double-entry recorded.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-indigo-200 bg-indigo-900/50 hover:bg-indigo-800/60 border border-indigo-700/50 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Send to Customer
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / PDF
            </button>

            <Link
              href={`/dashboard/journal-entries/${invoice.journal_entry_id}`}
              className="px-3 py-1.5 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
            >
              View Journal Entry
            </Link>
          </div>
        </div>
      )}

      {/* Form Card */}
      <CustomerInvoiceForm
        initialData={invoice}
        onSubmit={handleUpdate}
        onCancel={() => router.push('/dashboard/customer-invoices')}
        loading={actionLoading}
        isReadOnly={invoice.status !== 'draft'}
      />
    </div>
  );
}
