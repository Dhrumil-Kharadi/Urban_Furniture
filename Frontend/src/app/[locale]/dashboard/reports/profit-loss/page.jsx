'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/reports/profit-loss/page.jsx
//
// Real-time Profit & Loss Statement (project.md §6 · phase.md Phase 11).
// Strictly follows strict.md: pure CSS classes from reports.css,
// zero Tailwind utility classes, Orbitron/Sora typography.
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Download, TrendingUp, TrendingDown, DollarSign, ArrowLeft } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import Button from '@/reusablefiles/button';
import InputBox from '@/reusablefiles/inputbox';
import StatCard from '@/reusablefiles/statcard/StatCard';
import { AreaChart, DonutChart } from '@/reusablefiles/graphs';
import { MoneyText } from '@/components/masterdata/Cells';
import reportsService from '@/services/reports.service';

export default function ProfitAndLossReportPage() {
  const t = useTranslations('reports.profitLoss');
  const tReports = useTranslations('reports');

  const [dates, setDates] = useState(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    const to = now.toISOString().split('T')[0];
    return { fromDate: from, toDate: to };
  });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportsService.getProfitLoss(dates);
      setData(res?.data || res);
    } catch (err) {
      console.error('Failed to load P&L report', err);
      setError(err?.message || 'Failed to generate profit and loss report');
    } finally {
      setLoading(false);
    }
  }, [dates]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCsv = () => {
    const url = reportsService.exportCsvUrl('profit-loss', dates);
    window.open(url, '_blank');
  };

  const trendChartConfig = useMemo(() => {
    if (!data?.trendSeries || !data.trendSeries.length) return null;

    const categories = data.trendSeries.map((s) => s.month);
    const incomeData = data.trendSeries.map((s) => Number(s.income) || 0);
    const expenseData = data.trendSeries.map((s) => Number(s.expense) || 0);
    const netProfitData = data.trendSeries.map((s) => Number(s.netProfit) || 0);

    return {
      categories,
      series: [
        { name: 'Income', color: '#000080', data: incomeData, area: true },
        { name: 'Expense', color: '#6D8196', data: expenseData, area: true },
        { name: 'Net Profit', color: '#ADD8E6', data: netProfitData, dashed: true },
      ],
    };
  }, [data]);

  const donutData = useMemo(() => {
    if (!data?.expenseBreakdown || !data.expenseBreakdown.length) return [];
    return data.expenseBreakdown.map((item) => ({
      label: item.label,
      value: Number(item.value) || 0,
    }));
  }, [data]);

  const totals = data?.totals || {
    totalIncome: '0.00',
    totalExpenses: '0.00',
    netProfit: '0.00',
    isProfitable: true,
  };

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

        {/* Date Filter & Export */}
        <div className="report-toolbar">
          <div className="report-date-input">
            <InputBox
              type="date"
              value={dates.fromDate}
              onChange={(val) => setDates((prev) => ({ ...prev, fromDate: val }))}
              size="sm"
            />
          </div>
          <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>to</span>
          <div className="report-date-input">
            <InputBox
              type="date"
              value={dates.toDate}
              onChange={(val) => setDates((prev) => ({ ...prev, toDate: val }))}
              size="sm"
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

      {/* KPI Cards */}
      <div className="budget-kpi-grid">
        <StatCard
          title={t('income')}
          value={`₹${Number(totals.totalIncome).toLocaleString()}`}
          icon={<DollarSign size={18} />}
          tone="deep"
        />
        <StatCard
          title={t('expenses')}
          value={`₹${Number(totals.totalExpenses).toLocaleString()}`}
          icon={<TrendingDown size={18} />}
          tone="light"
        />
        <StatCard
          title={totals.isProfitable ? t('netProfit') : t('netLoss')}
          value={`₹${Number(totals.netProfit).toLocaleString()}`}
          icon={totals.isProfitable ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          tone="light"
        />
      </div>

      {/* Visual Graphs */}
      <div className="report-dual-charts-grid">
        {/* Trend AreaChart */}
        <div className="report-chart-card">
          <div>
            <h2 className="report-chart-title">
              {t('profitTrend')}
            </h2>
            <p className="budget-subtitle" style={{ fontSize: '0.78rem', marginTop: '2px' }}>
              Monthly movement of revenue vs operating expenses
            </p>
          </div>
          {trendChartConfig ? (
            <div style={{ width: '100%' }}>
              <AreaChart
                categories={trendChartConfig.categories}
                series={trendChartConfig.series}
                height={260}
                formatValue={(val) => `₹${Number(val).toLocaleString()}`}
              />
            </div>
          ) : (
            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              No trend data available for this range
            </div>
          )}
        </div>

        {/* Expense Breakdown DonutChart */}
        <div className="report-chart-card">
          <div>
            <h2 className="report-chart-title">
              {t('expenseBreakdown')}
            </h2>
            <p className="budget-subtitle" style={{ fontSize: '0.78rem', marginTop: '2px' }}>
              Top expense accounts distribution
            </p>
          </div>
          {donutData.length > 0 ? (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '0.5rem 0' }}>
              <DonutChart
                data={donutData}
                size={220}
                thickness={32}
                formatValue={(val) => `₹${Number(val).toLocaleString()}`}
              />
            </div>
          ) : (
            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              No expenses recorded for this period
            </div>
          )}
        </div>
      </div>

      {/* Itemized P&L Statement Table */}
      <div className="report-sheet-card">
        {loading ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', fontFamily: 'Sora, sans-serif', color: 'var(--text-secondary)' }}>
            Generating statement from posted journal entries…
          </div>
        ) : !data ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', fontFamily: 'Sora, sans-serif', color: 'var(--text-secondary)' }}>
            No transaction records found for the selected dates.
          </div>
        ) : (
          <div>
            {/* INCOME ACCOUNTS */}
            <div className="report-section-bar assets">
              <span>{t('income')}</span>
              <span>
                <MoneyText value={totals.totalIncome} />
              </span>
            </div>
            <table className="report-table">
              <tbody>
                {data.income?.map((acc) => (
                  <tr key={acc.code}>
                    <td className="report-code-col">[{acc.code}]</td>
                    <td className="report-name-col">{acc.name}</td>
                    <td className="report-amount-col" style={{ color: 'var(--accent-primary)' }}>
                      <MoneyText value={acc.amount} />
                    </td>
                  </tr>
                ))}
                {(!data.income || data.income.length === 0) && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No income recorded in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* EXPENSE ACCOUNTS */}
            <div className="report-section-bar liabilities">
              <span>{t('expenses')}</span>
              <span>
                <MoneyText value={totals.totalExpenses} />
              </span>
            </div>
            <table className="report-table">
              <tbody>
                {data.expenses?.map((acc) => (
                  <tr key={acc.code}>
                    <td className="report-code-col">[{acc.code}]</td>
                    <td className="report-name-col">{acc.name}</td>
                    <td className="report-amount-col" style={{ color: '#dc2626' }}>
                      <MoneyText value={acc.amount} />
                    </td>
                  </tr>
                ))}
                {(!data.expenses || data.expenses.length === 0) && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No operating expenses recorded in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* NET PROFIT / LOSS SUMMARY */}
            <div className="report-totals-footer">
              <span>{totals.isProfitable ? t('netProfit') : t('netLoss')}:</span>
              <span style={{ color: totals.isProfitable ? '#16a34a' : '#dc2626', fontSize: '1.15rem' }}>
                <MoneyText value={totals.netProfit} />
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
