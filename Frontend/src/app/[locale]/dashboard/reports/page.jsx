'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/reports/page.jsx
//
// Financial Reports Hub (project.md §6, §8 · phase.md Phase 11).
// Strictly follows strict.md: pure CSS classes from reports.css,
// zero Tailwind utility classes, Orbitron/Sora typography.
// ============================================================

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  Scale,
  TrendingUp,
  BarChart2,
  BookOpen,
  FileSpreadsheet,
  Clock,
  Receipt,
  ArrowRight,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';

export default function ReportsHubPage() {
  const t = useTranslations('reports');

  const reportCards = [
    {
      title: t('hub.balanceSheetTitle') || 'Balance Sheet',
      desc: t('hub.balanceSheetDesc') || 'Assets, liabilities and capital as of any date you choose.',
      href: '/dashboard/reports/balance-sheet',
      icon: <Scale size={24} />,
    },
    {
      title: t('hub.profitLossTitle') || 'Profit & Loss',
      desc: t('hub.profitLossDesc') || 'Income less purchases and operating expenses over a date range.',
      href: '/dashboard/reports/profit-loss',
      icon: <TrendingUp size={24} />,
    },
    {
      title: t('generalLedger.title') || 'General Ledger',
      desc: t('generalLedger.subtitle') || 'Every posted journal line with a running account balance.',
      href: '/dashboard/reports/general-ledger',
      icon: <BookOpen size={24} />,
    },
    {
      title: 'Trial Balance',
      desc: 'Debit and credit balances for all chart of accounts verifying ledger equality.',
      href: '/dashboard/reports/trial-balance',
      icon: <FileSpreadsheet size={24} />,
    },
    {
      title: t('hub.budgetReportTitle') || 'Budget Report',
      desc: t('hub.budgetReportDesc') || 'Planned against actual spending per analytic account with variance.',
      href: '/dashboard/reports/budget-report',
      icon: <BarChart2 size={24} />,
    },
    {
      title: 'Aged Receivables',
      desc: 'Customer overdue balances grouped into 30, 60, 90, and 90+ day aging buckets.',
      href: '/dashboard/reports/aged-receivables',
      icon: <Clock size={24} />,
    },
    {
      title: 'Aged Payables',
      desc: 'Vendor payable obligations categorized by payment aging schedule.',
      href: '/dashboard/reports/aged-payables',
      icon: <Receipt size={24} />,
    },
  ];

  return (
    <div className="report-container">
      {/* Page Header */}
      <div className="report-header">
        <div className="report-header-content">
          <span className="report-badge">
            {t('badge')}
          </span>
          <h1 className="report-title">
            {t('title')}
          </h1>
          <p className="report-subtitle">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Reports Multi-Column Horizontal Grid */}
      <div className="report-hub-grid">
        {reportCards.map((card) => (
          <Link key={card.href} href={card.href} className="report-hub-card">
            <div>
              <div className="report-hub-icon-wrap">
                {card.icon}
              </div>
              <h2 className="report-hub-card-title">
                {card.title}
              </h2>
              <p className="report-hub-card-desc">
                {card.desc}
              </p>
            </div>

            <div className="report-hub-card-action">
              <span>{t('hub.viewReport') || 'Open report'}</span>
              <ArrowRight size={14} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
