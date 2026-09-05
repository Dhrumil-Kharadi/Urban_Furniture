'use client';

// ============================================================
// FILE: src/components/dashboard/FinancialDashboard.jsx
//
// Phase 13 — Executive Financial Dashboard
// Reference: project.md §9 · technicalrequirement.md §6.13 · phase.md Phase 13 · strict.md
//
// Single request GET /api/dashboard/summary?period=
// Charts: GroupedBarChart, BarChart, DonutChart, Sparkline
// KPI cards via StatCard (tone="deep" on the primary Total Receivable)
// Period selector applies to EVERY KPI and chart together.
// ============================================================

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw, TrendingUp, AlertTriangle, Landmark, Receipt, Wallet, DollarSign } from 'lucide-react';
import api from '@/lib/api';
import Card, { CardHead, CardBody } from '@/reusablefiles/card';
import StatCard from '@/reusablefiles/statcard';
import { DashboardSkeleton } from '@/reusablefiles/skeleton';
import {
  GroupedBarChart,
  BarChart,
  DonutChart,
  Sparkline,
  seriesColor,
} from '@/reusablefiles/graphs';
import Button from '@/reusablefiles/button';

const PERIODS = ['this_month', 'this_quarter', 'this_year'];

/** Single currency — Phase 0 Decision 5 fixes the org to INR. */
function money(value) {
  return `₹${parseFloat(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function FinancialDashboard() {
  const t = useTranslations('dashboard.summary');
  const tCommon = useTranslations('dashboard.common');

  const [period, setPeriod] = useState('this_year');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The API client returns the parsed envelope itself — `res.success` and
      // `res.data`. Reading `res.data.success` here left `data` permanently
      // null, which is why every KPI on this page rendered as zero.
      const res = await api.get('/dashboard/summary', { params: { period } });
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      setError(err?.message || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [period, t]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const kpis = data?.kpis || {
    totalReceivable: '0.00',
    totalPayable: '0.00',
    totalIncome: '0.00',
    totalExpenses: '0.00',
    netProfit: '0.00',
    overdueCount: 0,
  };

  const series = data?.series || {};

  // 1. GroupedBarChart: Monthly Income vs Expense
  const monthlyData = useMemo(() => {
    const raw = series.monthlyIncomeExpense || [];
    const categories = raw.map((m) => m.month);
    const incomeData = raw.map((m) => parseFloat(m.income) || 0);
    const expenseData = raw.map((m) => parseFloat(m.expense) || 0);

    return {
      categories: categories.length ? categories : ['—'],
      series: [
        { name: t('series.income'), data: incomeData.length ? incomeData : [0], color: 'var(--graph-series-1)' },
        { name: t('series.expense'), data: expenseData.length ? expenseData : [0], color: 'var(--graph-series-5)' },
      ],
    };
  }, [series.monthlyIncomeExpense, t]);

  // 2. BarChart: Accounts Receivable Aging
  const agingData = useMemo(
    () =>
      (series.receivableAging || []).map((a, idx) => ({
        label: a.bucket,
        value: parseFloat(a.amount) || 0,
        color: seriesColor(idx * 2),
      })),
    [series.receivableAging],
  );

  // 3. BarChart: Top 5 Customers
  const topCustomersData = useMemo(
    () =>
      (series.topCustomers || []).map((c, idx) => ({
        label: c.name || '—',
        value: parseFloat(c.totalSales) || 0,
        color: seriesColor(idx),
      })),
    [series.topCustomers],
  );

  // 4. DonutChart: Expense Breakdown
  const expenseDonutData = useMemo(
    () =>
      (series.expenseBreakdown || []).map((e, idx) => ({
        label: e.label,
        value: parseFloat(e.value) || 0,
        color: seriesColor(idx * 2),
      })),
    [series.expenseBreakdown],
  );

  // 5. Sparkline: Cash Movement Trend
  const cashTrendPoints = useMemo(() => {
    const raw = series.cashTrend || [];
    if (!raw.length) return [0, 0, 0, 0];
    return raw.map((c) => parseFloat(c.netMovement) || 0);
  }, [series.cashTrend]);

  return (
    <div className="fin-dash-container">
      {/* Header & Period Selector */}
      <div className="fin-dash-header">
        <div className="fin-dash-header-content">
          <span className="fin-dash-badge">{t('badge')}</span>
          <h1 className="fin-dash-title">{t('title')}</h1>
          <p className="fin-dash-subtitle">{t('subtitle')}</p>
        </div>

        <div className="fin-dash-toolbar">
          {/* Unified Period Selector */}
          <div className="fin-dash-period-selector" role="group" aria-label={t('period')}>
            {PERIODS.map((key) => (
              <button
                key={key}
                type="button"
                className={`fin-dash-period-btn ${period === key ? 'active' : ''}`}
                onClick={() => setPeriod(key)}
                aria-pressed={period === key}
              >
                {t(`periods.${key}`)}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            onClick={fetchSummary}
            disabled={loading}
            icon={<RefreshCw size={14} className={loading ? 'ui-spin' : ''} />}
          >
            {tCommon('refresh')}
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <DashboardSkeleton count={4} />
      ) : error ? (
        <div className="fin-dash-state is-error">{error}</div>
      ) : (
        <>
          {/* 6 KPI Cards with tone="deep" on primary (Total Receivable) */}
          <div className="fin-dash-kpi-grid">
            <StatCard
              tone="deep"
              title={t('kpis.totalReceivable')}
              value={money(kpis.totalReceivable)}
              icon={<Landmark size={18} />}
              spark={cashTrendPoints}
            />
            <StatCard
              title={t('kpis.totalPayable')}
              value={money(kpis.totalPayable)}
              icon={<Receipt size={18} />}
            />
            <StatCard
              title={t('kpis.totalIncome')}
              value={money(kpis.totalIncome)}
              icon={<TrendingUp size={18} />}
            />
            <StatCard
              title={t('kpis.totalExpenses')}
              value={money(kpis.totalExpenses)}
              icon={<Wallet size={18} />}
            />
            <StatCard
              title={t('kpis.netProfit')}
              value={money(kpis.netProfit)}
              icon={<DollarSign size={18} />}
            />
            <StatCard
              title={t('kpis.overdueCount')}
              value={kpis.overdueCount || 0}
              icon={<AlertTriangle size={18} />}
            />
          </div>

          {/* Charts Row 1: Income vs Expense & Cash Movement */}
          <div className="fin-dash-charts-grid">
            <Card>
              <CardHead
                title={t('charts.incomeVsExpense')}
                subtitle={t('hints.monthlyPerformance', { period: t(`periods.${period}`) })}
              />
              <CardBody>
                <GroupedBarChart
                  categories={monthlyData.categories}
                  series={monthlyData.series}
                  height={270}
                  formatValue={(v) => `₹${Number(v).toLocaleString('en-IN')}`}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHead title={t('charts.cashTrend')} subtitle={t('hints.liquidity')} />
              <CardBody className="fin-dash-cash-body">
                <div className="fin-dash-cash-spark">
                  <Sparkline
                    data={cashTrendPoints}
                    height={100}
                    area
                    curve="smooth"
                    color="var(--accent-primary)"
                  />
                </div>
                <div className="fin-dash-cash-summary">
                  <span className="fin-dash-cash-figure">
                    ₹{cashTrendPoints[cashTrendPoints.length - 1]?.toLocaleString('en-IN') || '0.00'}
                  </span>
                  <div className="fin-dash-cash-caption">{t('latestCashPosition')}</div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Charts Row 2: Aging, Top Customers & Expense Donut */}
          <div className="fin-dash-triple-grid">
            <Card>
              <CardHead title={t('charts.receivableAging')} subtitle={t('hints.agingBuckets')} />
              <CardBody>
                {agingData.length ? (
                  <BarChart
                    data={agingData}
                    height={240}
                    formatValue={(v) => `₹${Number(v).toLocaleString('en-IN')}`}
                  />
                ) : (
                  <div className="fin-dash-state">{t('empty.aging')}</div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHead title={t('charts.topCustomers')} subtitle={t('hints.revenueContributors')} />
              <CardBody>
                {topCustomersData.length ? (
                  <BarChart
                    data={topCustomersData}
                    height={240}
                    horizontal
                    formatValue={(v) => `₹${Number(v).toLocaleString('en-IN')}`}
                  />
                ) : (
                  <div className="fin-dash-state">{t('empty.sales')}</div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHead title={t('charts.expenseBreakdown')} subtitle={t('hints.opexByCategory')} />
              <CardBody>
                {expenseDonutData.length ? (
                  <DonutChart
                    data={expenseDonutData}
                    size={220}
                    thickness={32}
                    formatValue={(v) => `₹${Number(v).toLocaleString('en-IN')}`}
                  />
                ) : (
                  <div className="fin-dash-state">{t('empty.expenses')}</div>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
