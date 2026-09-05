'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/reports/balance-sheet/page.jsx
//
// Real-time Balance Sheet Statement (project.md §4.3, §6 · phase.md Phase 11).
// Strictly follows strict.md: pure CSS classes from reports.css,
// zero Tailwind utility classes, Orbitron/Sora typography.
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Calendar, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import Button from '@/reusablefiles/button';
import InputBox from '@/reusablefiles/inputbox';
import { StackedBarChart } from '@/reusablefiles/graphs';
import { MoneyText } from '@/components/masterdata/Cells';
import reportsService from '@/services/reports.service';

export default function BalanceSheetReportPage() {
  const t = useTranslations('reports.balanceSheet');
  const tReports = useTranslations('reports');

  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportsService.getBalanceSheet({ asOfDate });
      setData(res?.data || res);
    } catch (err) {
      setError(err?.message || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [asOfDate, t]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCsv = () => {
    const url = reportsService.exportCsvUrl('balance-sheet', { asOfDate });
    window.open(url, '_blank');
  };

  const chartConfig = useMemo(() => {
    if (!data) return null;

    const assetsVal = Math.max(0, Number(data.assets?.total) || 0);
    const liabVal = Math.max(0, Number(data.liabilities?.total) || 0);
    const eqVal = Math.max(0, (Number(data.equity?.total) || 0) + (Number(data.currentPeriodNetProfit) || 0));

    return {
      categories: [t('assets'), t('liabilitiesAndEquity')],
      series: [
        { name: t('assets'), color: 'var(--graph-series-1)', data: [assetsVal, 0] },
        { name: t('liabilities'), color: 'var(--graph-series-5)', data: [0, liabVal] },
        { name: t('equityAndProfit'), color: 'var(--graph-series-7)', data: [0, eqVal] },
      ],
    };
  }, [data, t]);

  return (
    <div className="report-container">
      {/* Top Header */}
      <div className="report-header">
        <div className="report-header-row">
          <Link href="/dashboard/reports" className="budget-back-btn" aria-label={tReports('back')}>
            <ArrowLeft size={18} />
          </Link>
          <div className="report-header-content">
            <span className="report-badge">
              {tReports('badge')}
            </span>
            <h1 className="report-title">
              {t('title')}
            </h1>
            <p className="report-subtitle">
              {t('subtitle')}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="report-toolbar">
          <div className="report-date-input">
            <InputBox
              type="date"
              value={asOfDate}
              onChange={setAsOfDate}
              size="sm"
              icon={<Calendar size={14} />}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            icon={<Download size={14} />}
          >
            {t('exportCsv')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="report-alert-banner unbalanced">
          {error}
        </div>
      )}

      {/* Balance Indicator Alert */}
      {data && (
        <div className={`report-alert-banner ${data.isBalanced ? 'balanced' : 'unbalanced'}`}>
          {data.isBalanced ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertTriangle size={18} />
          )}
          <span>
            {data.isBalanced
              ? t('balanced')
              : `${t('unbalanced')} — ${t('discrepancy', { amount: data.discrepancy })}`}
          </span>
        </div>
      )}

      {/* Visual Chart Frame */}
      {chartConfig && (
        <div className="report-chart-card">
          <h2 className="report-chart-title">
            {t('chartTitle')}
          </h2>
          <div className="report-chart-frame">
            <StackedBarChart
              categories={chartConfig.categories}
              series={chartConfig.series}
              height={240}
              formatValue={(val) => `₹${Number(val).toLocaleString()}`}
            />
          </div>
        </div>
      )}

      {/* Balance Sheet Statement */}
      <div className="report-sheet-card">
        {loading ? (
          <div className="report-state">{tReports('loading')}</div>
        ) : !data ? (
          <div className="report-state">{t('noData')}</div>
        ) : (
          <div>
            {/* ASSETS SECTION */}
            <div className="report-section-bar assets">
              <span>{t('assets')}</span>
              <span>
                <MoneyText value={data.assets?.total} />
              </span>
            </div>
            <table className="report-table">
              <tbody>
                {data.assets?.accounts?.map((acc) => (
                  <tr key={acc.code}>
                    <td className="report-code-col">[{acc.code}]</td>
                    <td className="report-name-col">{acc.name}</td>
                    <td className="report-amount-col">
                      <MoneyText value={acc.balance} />
                    </td>
                  </tr>
                ))}
                {(!data.assets?.accounts || data.assets.accounts.length === 0) && (
                  <tr>
                    <td colSpan={3} className="report-empty-cell">{t('noAssets')}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* LIABILITIES SECTION */}
            <div className="report-section-bar liabilities">
              <span>{t('liabilities')}</span>
              <span>
                <MoneyText value={data.liabilities?.total} />
              </span>
            </div>
            <table className="report-table">
              <tbody>
                {data.liabilities?.accounts?.map((acc) => (
                  <tr key={acc.code}>
                    <td className="report-code-col">[{acc.code}]</td>
                    <td className="report-name-col">{acc.name}</td>
                    <td className="report-amount-col">
                      <MoneyText value={acc.balance} />
                    </td>
                  </tr>
                ))}
                {(!data.liabilities?.accounts || data.liabilities.accounts.length === 0) && (
                  <tr>
                    <td colSpan={3} className="report-empty-cell">{t('noLiabilities')}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* EQUITY SECTION */}
            <div className="report-section-bar equity">
              <span>{t('equity')}</span>
              <span>
                <MoneyText value={data.equity?.total} />
              </span>
            </div>
            <table className="report-table">
              <tbody>
                {data.equity?.accounts?.map((acc) => (
                  <tr key={acc.code}>
                    <td className="report-code-col">[{acc.code}]</td>
                    <td className="report-name-col">{acc.name}</td>
                    <td className="report-amount-col">
                      <MoneyText value={acc.balance} />
                    </td>
                  </tr>
                ))}
                {/* Net Profit Row */}
                <tr className="highlight">
                  <td className="report-code-col">[P&L]</td>
                  <td className="report-name-col" style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                    {t('netProfit')}
                  </td>
                  <td className="report-amount-col" style={{ color: 'var(--accent-primary)' }}>
                    <MoneyText value={data.currentPeriodNetProfit} />
                  </td>
                </tr>
              </tbody>
            </table>

            {/* SUMMARY FOOTER */}
            <div className="report-totals-footer">
              <div>
                <span>{t('totalAssets')}: </span>
                <span style={{ color: 'var(--accent-primary)' }}>
                  <MoneyText value={data.assets?.total} />
                </span>
              </div>
              <div>
                <span>{t('totalLiabilitiesEquity')}: </span>
                <span className="report-total-positive">
                  <MoneyText value={data.totalLiabilitiesAndEquity} />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
