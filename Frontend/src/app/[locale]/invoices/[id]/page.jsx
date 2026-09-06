'use client';

// ============================================================
// FILE: src/app/[locale]/invoices/[id]/page.jsx
//
// Public Customer Invoice View & Online Payment Page.
// Allows customers / contacts to view and pay their specific invoice
// directly via the link provided in their email WITHOUT logging in.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  FileText,
  Printer,
  CreditCard,
  Building2,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';

import { customerInvoicesService } from '@/services/sales.service';
import RazorpayCheckoutButton from '@/components/payment/RazorpayCheckoutButton';
import Pill from '@/reusablefiles/pill';

function formatCurrency(amount, currency = 'INR') {
  const num = Number(amount) || 0;
  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function PublicInvoicePage() {
  const params = useParams();
  const invoiceId = params?.id;

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInvoice = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await customerInvoicesService.getPublic(invoiceId);
      const inv = res?.data?.invoice || res?.invoice || res?.data;
      if (!inv) {
        throw new Error('Invoice not found');
      }
      setInvoice(inv);
    } catch (err) {
      console.error('Failed to load public invoice', err);
      setError(err?.response?.data?.message || err?.message || 'Invoice not found or no longer available');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ width: '48px', height: '48px', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1.5rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>Loading Invoice…</h2>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Please wait while we retrieve your invoice details.</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2.5rem', maxWidth: '480px', textAlign: 'center', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
          <div style={{ width: '56px', height: '56px', background: '#fee2e2', color: '#dc2626', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <AlertCircle size={28} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Invoice Unavailable</h1>
          <p style={{ fontSize: '0.925rem', color: '#64748b', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {error || 'This invoice could not be found. It may be in draft state or the link might be incorrect.'}
          </p>
          <a
            href="/"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', background: '#3b82f6', color: '#ffffff', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem' }}
          >
            <ArrowLeft size={16} /> Return to Home
          </a>
        </div>
      </div>
    );
  }

  const isPaid = invoice.status === 'paid' || Number(invoice.amount_due) <= 0;
  const isPartiallyPaid = invoice.status === 'partially_paid' || (Number(invoice.amount_paid) > 0 && Number(invoice.amount_due) > 0);
  const isOverdue = invoice.is_overdue || invoice.status === 'overdue';
  const canPayOnline = !isPaid && ['posted', 'partially_paid', 'overdue'].includes(invoice.status);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', padding: '2rem 1rem 4rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Print & Action Bar (Hidden in Print) */}
      <div className="no-print" style={{ maxWidth: '850px', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', background: '#3b82f6', color: '#ffffff', borderRadius: '10px' }}>
            <Building2 size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              {invoice.organization_name || 'Urban Furniture'}
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Direct Customer Invoice</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              color: '#334155',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'background 0.15s ease',
            }}
          >
            <Printer size={16} /> Print / Save PDF
          </button>

          {canPayOnline && (
            <RazorpayCheckoutButton
              invoiceId={invoice.id}
              isPublic={true}
              customerName={invoice.customer_name}
              customerEmail={invoice.customer_email}
              label={`Pay Online (${formatCurrency(invoice.amount_due)})`}
              onPaid={fetchInvoice}
            />
          )}
        </div>
      </div>

      {/* Main Invoice Document Card */}
      <div
        className="invoice-card"
        style={{
          maxWidth: '850px',
          margin: '0 auto',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 10px 30px -5px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {/* Banner Top Accent */}
        <div style={{ height: '6px', background: isPaid ? '#10b981' : isOverdue ? '#ef4444' : '#3b82f6' }} />

        <div style={{ padding: '2.5rem 2.5rem 2rem' }}>
          {/* Header Row: Brand & Invoice Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: '2rem', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em' }}>
                  {invoice.organization_name || 'Urban Furniture'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b', lineHeight: 1.5 }}>
                Quality Craftsmanship & Modern Living
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                INVOICE
              </span>
              <div style={{ marginTop: '0.25rem', fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700, color: '#3b82f6' }}>
                #{invoice.invoice_number}
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <Pill
                  tone={isPaid ? 'strong' : isOverdue ? 'danger' : isPartiallyPaid ? 'warning' : 'soft'}
                  size="md"
                  dot
                >
                  {isPaid ? 'PAID IN FULL' : isOverdue ? 'OVERDUE' : isPartiallyPaid ? 'PARTIALLY PAID' : 'UNPAID'}
                </Pill>
              </div>
            </div>
          </div>

          {/* Details Grid: Billed To & Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
            {/* Customer Information */}
            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #edf2f7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <User size={14} /> Billed To
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
                {invoice.customer_name || 'Valued Customer'}
              </div>
              {invoice.customer_email && (
                <div style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '0.25rem' }}>
                  {invoice.customer_email}
                </div>
              )}
              {invoice.customer_mobile && (
                <div style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '0.25rem' }}>
                  {invoice.customer_mobile}
                </div>
              )}
              {(invoice.customer_city || invoice.customer_state) && (
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
                  {[invoice.customer_city, invoice.customer_state, invoice.customer_pincode].filter(Boolean).join(', ')}
                </div>
              )}
            </div>

            {/* Invoice Dates & Overview */}
            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #edf2f7', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Calendar size={14} /> Invoice Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', fontSize: '0.875rem' }}>
                  <span style={{ color: '#64748b' }}>Invoice Date:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{invoice.invoice_date?.split('T')[0] || '—'}</span>
                  
                  <span style={{ color: '#64748b' }}>Due Date:</span>
                  <span style={{ fontWeight: 600, color: isOverdue ? '#dc2626' : '#0f172a' }}>
                    {invoice.due_date?.split('T')[0] || 'Upon Receipt'}
                  </span>

                  {invoice.posted_at && (
                    <>
                      <span style={{ color: '#64748b' }}>Posted On:</span>
                      <span style={{ color: '#0f172a' }}>{new Date(invoice.posted_at).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>

              {canPayOnline && (
                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#059669', fontSize: '0.8rem', fontWeight: 600 }}>
                  <ShieldCheck size={16} /> Instant online settlement available
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              Line Items
            </h3>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '0.875rem 1rem', width: '50px' }}>#</th>
                    <th style={{ padding: '0.875rem 1rem' }}>Description</th>
                    <th style={{ padding: '0.875rem 1rem', textAlign: 'right', width: '80px' }}>Qty</th>
                    <th style={{ padding: '0.875rem 1rem', textAlign: 'right', width: '120px' }}>Unit Price</th>
                    <th style={{ padding: '0.875rem 1rem', textAlign: 'right', width: '80px' }}>Tax</th>
                    <th style={{ padding: '0.875rem 1rem', textAlign: 'right', width: '130px' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines && invoice.lines.length > 0 ? (
                    invoice.lines.map((line, idx) => (
                      <tr key={line.id || idx} style={{ borderBottom: idx < invoice.lines.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                        <td style={{ padding: '1rem', color: '#94a3b8', fontWeight: 600 }}>{line.line_no || idx + 1}</td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{line.product_name || line.description}</div>
                          {line.product_name && line.description && line.description !== line.product_name && (
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.125rem' }}>{line.description}</div>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', color: '#334155' }}>{Number(line.quantity)}</td>
                        <td style={{ padding: '1rem', textAlign: 'right', color: '#334155' }}>{formatCurrency(line.unit_price)}</td>
                        <td style={{ padding: '1rem', textAlign: 'right', color: '#64748b' }}>{Number(line.tax_rate || 0)}%</td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                          {formatCurrency(line.total_amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                        No line items recorded on this invoice.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Summary & Total Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', alignItems: 'flex-start' }}>
            {/* Notes / Terms */}
            <div>
              {invoice.notes && (
                <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Notes & Remarks
                  </div>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                    {invoice.notes}
                  </p>
                </div>
              )}

              {/* Payment Status Message */}
              {isPaid ? (
                <div style={{ marginTop: '1rem', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1rem 1.25rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#065f46' }}>
                  <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.925rem' }}>Paid in Full</div>
                    <div style={{ fontSize: '0.8rem', color: '#047857' }}>Thank you! This invoice is completely paid and settled.</div>
                  </div>
                </div>
              ) : (
                <div className="no-print" style={{ marginTop: '1rem', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1rem 1.25rem', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e40af', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                    <CreditCard size={18} /> Pay Online Securely
                  </div>
                  <p style={{ margin: '0 0 1rem', fontSize: '0.825rem', color: '#3b82f6', lineHeight: 1.5 }}>
                    Pay your outstanding balance instantly with credit/debit card, UPI, or netbanking.
                  </p>
                  <RazorpayCheckoutButton
                    invoiceId={invoice.id}
                    isPublic={true}
                    customerName={invoice.customer_name}
                    customerEmail={invoice.customer_email}
                    label={`Pay Now • ${formatCurrency(invoice.amount_due)}`}
                    onPaid={fetchInvoice}
                  />
                </div>
              )}
            </div>

            {/* Calculations Card */}
            <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.25rem 1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontSize: '0.875rem', color: '#64748b' }}>
                <span>Subtotal (Untaxed)</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(invoice.untaxed_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontSize: '0.875rem', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                <span>Taxes & GST</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(invoice.tax_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                <span>Total Amount</span>
                <span>{formatCurrency(invoice.total_amount)}</span>
              </div>

              {Number(invoice.amount_paid) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0', fontSize: '0.875rem', color: '#059669' }}>
                  <span>Amount Paid</span>
                  <span style={{ fontWeight: 600 }}>-{formatCurrency(invoice.amount_paid)}</span>
                </div>
              )}

              <div
                style={{
                  marginTop: '0.5rem',
                  paddingTop: '0.75rem',
                  borderTop: '2px solid #cbd5e1',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>Amount Due</span>
                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: Number(invoice.amount_due) > 0 ? '#e11d48' : '#059669' }}>
                  {formatCurrency(invoice.amount_due)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '1.25rem 2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>
          Thank you for your business with {invoice.organization_name || 'Urban Furniture'}. If you have any questions regarding this invoice, please contact support.
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media print {
          body {
            background-color: #ffffff !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .invoice-card {
            border: none !important;
            box-shadow: none !important;
            max-width: 100% !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
