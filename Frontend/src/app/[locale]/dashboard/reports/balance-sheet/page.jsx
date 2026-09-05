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
      console.error('Failed to load balance sheet', err);
      setError(err?.message || 'Failed to generate balance sheet report');
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

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
      categories: ['Assets', 'Liabilities & Equity'],
      series: [
        { name: 'Assets', color: '#000080', data: [assetsVal, 0] },
        { name: 'Liabilities', color: '#6D8196', data: [0, liabVal] },
        { name: 'Equity & Profit', color: '#c0ccd6', data: [0, eqVal] },
      ],
    };
  }, [data]);

  return (
    <div className="report-container">
      {/* Top Header */}
      <div className="report-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dashboard/reports" className="budget-back-btn">
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
              : `${t('unbalanced')} (Discrepancy: ₹${data.discrepancy})`}
          </span>
        </div>
      )}

      {/* Visual Chart Frame */}
      {chartConfig && (
        <div className="report-chart-card">
          <h2 className="report-chart-title">
            Balance Structure (₹)
          </h2>
          <div style={{ width: '100%' }}>
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
          <div style={{ padding: '3rem 1rem', textAlign: 'center', fontFamily: 'Sora, sans-serif', color: 'var(--text-secondary)' }}>
            Calculating real-time ledger balances…
          </div>
        ) : !data ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', fontFamily: 'Sora, sans-serif', color: 'var(--text-secondary)' }}>
            No statement data available for the selected date.
          </div>
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
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No asset movements recorded as of this date.
                    </td>
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
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No liability movements recorded as of this date.
                    </td>
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
                <span style={{ color: '#16a34a' }}>
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
