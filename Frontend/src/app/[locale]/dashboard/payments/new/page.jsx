'use client';

/**
 * @file Record Payment
 * @route /dashboard/payments/new
 * @spec Doc/project.md §5.1.5, §5.2.5, Doc/phase.md Phase 10, Doc/strict.md
 *
 * The standalone entry point. Most payments are recorded from an invoice or a
 * bill, where the document is already known — this page is for the case where
 * the money arrived first and has to be matched afterwards.
 *
 * It sends the operator to the document list to pick a target, because
 * allocation is the part that has to be right: a payment with no allocation
 * posts money to the ledger with nothing to explain it, and the server
 * refuses it.
 */

import React from 'react';
import { ArrowLeft, Wallet, Receipt, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NewPaymentPage() {
  const t = useTranslations('payments');
  const tc = useTranslations('common');

  return (
    <div className="doc-page doc-page-narrow">
      <div className="doc-page-head-left">
        <Link
          href="/dashboard/payments"
          className="doc-btn doc-btn-icon"
          aria-label={tc('actions.back')}
        >
          <ArrowLeft size={15} aria-hidden="true" />
        </Link>
        <div>
          <h1 className="doc-page-title">
            <Wallet size={19} className="doc-icon-accent" aria-hidden="true" />
            {t('new.title')}
          </h1>
          <p className="doc-page-sub">{t('new.subtitle')}</p>
        </div>
      </div>

      <div className="doc-panel">
        <p className="doc-panel-body">{t('new.body')}</p>

        <div className="doc-choice-grid">
          <Link href="/dashboard/customer-invoices?status=posted" className="doc-choice">
            <Receipt size={19} className="doc-icon-accent" aria-hidden="true" />
            <span>
              <p className="doc-choice-title">{t('new.inbound')}</p>
              <p className="doc-choice-hint">{t('new.inboundHint')}</p>
            </span>
          </Link>

          <Link href="/dashboard/vendor-bills?status=posted" className="doc-choice">
            <FileText size={19} className="doc-icon-accent" aria-hidden="true" />
            <span>
              <p className="doc-choice-title">{t('new.outbound')}</p>
              <p className="doc-choice-hint">{t('new.outboundHint')}</p>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
