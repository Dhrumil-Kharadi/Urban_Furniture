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
import { Scale, TrendingUp, BarChart2, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';

export default function ReportsHubPage() {
  const t = useTranslations('reports');

  const reportCards = [
    {
      title: t('hub.balanceSheetTitle'),
      desc: t('hub.balanceSheetDesc'),
      href: '/dashboard/reports/balance-sheet',
      icon: <Scale size={26} />,
    },
    {
      title: t('hub.profitLossTitle'),
      desc: t('hub.profitLossDesc'),
      href: '/dashboard/reports/profit-loss',
      icon: <TrendingUp size={26} />,
    },
    {
      title: t('hub.budgetReportTitle'),
      desc: t('hub.budgetReportDesc'),
      href: '/dashboard/reports/budget-report',
      icon: <BarChart2 size={26} />,
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

      {/* Reports Grid */}
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
              <span>{t('hub.viewReport')}</span>
              <ArrowRight size={14} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
