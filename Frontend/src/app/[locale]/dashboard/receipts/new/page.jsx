'use client';

/**
 * @file Record Customer Receipt Page
 * @route /dashboard/receipts/new
 * @spec Doc/project.md §5.2, Doc/phase.md Phase 10
 * 
 * Flow for recording incoming customer receipts and allocating them against
 * outstanding posted invoices.
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Receipt, CheckCircle, ArrowRight } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { customerInvoicesService } from '@/services/sales.service';
import { formatMoney, formatDate } from '@/utils/format';
import { useLocale } from 'next-intl';
import RegisterPaymentModal from '@/components/payments/RegisterPaymentModal';
import Button from '@/reusablefiles/button';

export default function NewReceiptPage() {
  const locale = useLocale();
  const router = useRouter();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const fetchOpenInvoices = async () => {
    setLoading(true);
    try {
      const res = await customerInvoicesService.list({
        status: 'posted',
        limit: 50,
      });
      setInvoices(res.items || []);
    } catch (err) {
      console.error('Failed to load open invoices', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpenInvoices();
  }, []);

  return (
    <div className="doc-page">
      <div className="doc-page-head">
        <div className="doc-page-head-left">
          <Link
            href="/dashboard/receipts"
            className="doc-btn doc-btn-icon"
            aria-label="Back"
          >
            <ArrowLeft size={15} aria-hidden="true" />
          </Link>
          <div>
            <h1 className="doc-page-title">
              <Receipt size={19} className="doc-icon-accent" aria-hidden="true" />
              Record Customer Receipt
            </h1>
            <p className="doc-page-sub">
              Select an outstanding customer invoice to receive payment and post to Accounts Receivable
            </p>
          </div>
        </div>
      </div>

      <div className="doc-panel">
        <p className="doc-panel-body">
          Accounting rule: Every customer receipt must allocate against a verified posted invoice to reconcile the Debtor balance and credit the ledger. Pick an invoice below to record receipt.
        </p>

        <div className="doc-table-wrap" style={{ marginTop: '0.5rem' }}>
          <table className="doc-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Customer</th>
                <th className="doc-th-right">Total</th>
                <th className="doc-th-right">Balance Due</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    Loading outstanding invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                    <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>No outstanding invoices found.</p>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      All customer invoices are currently settled or in draft.
                    </p>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="doc-cell-code">{inv.invoice_number}</td>
                    <td className="doc-cell-muted">{formatDate(inv.invoice_date, locale)}</td>
                    <td style={{ fontWeight: 500 }}>{inv.customer_name || '—'}</td>
                    <td className="doc-cell-money">{formatMoney(inv.total_amount, locale)}</td>
                    <td className="doc-cell-money" style={{ color: '#f59e0b', fontWeight: 700 }}>
                      {formatMoney(inv.amount_due, locale)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button
                        variant="solid"
                        size="sm"
                        onClick={() => setSelectedInvoice(inv)}
                        icon={<CheckCircle size={13} />}
                      >
                        Receive
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedInvoice && (
        <RegisterPaymentModal
          isOpen={Boolean(selectedInvoice)}
          onClose={() => setSelectedInvoice(null)}
          document={selectedInvoice}
          direction="inbound"
          onRecorded={() => {
            setSelectedInvoice(null);
            router.push('/dashboard/receipts');
          }}
        />
      )}
    </div>
  );
}
