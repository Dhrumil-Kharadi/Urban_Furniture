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
      const res = await api.get('/dashboard/summary', {
        params: { period },
      });
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to load financial dashboard');
    } finally {
      setLoading(false);
    }
  }, [period]);

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
      categories: categories.length ? categories : ['No Data'],
      series: [
        { name: 'Income', data: incomeData.length ? incomeData : [0], color: 'var(--graph-series-1)' },
        { name: 'Expense', data: expenseData.length ? expenseData : [0], color: 'var(--graph-series-5)' },
      ],
    };
  }, [series.monthlyIncomeExpense]);

  // 2. BarChart: Accounts Receivable Aging
  const agingData = useMemo(() => {
    return (series.receivableAging || []).map((a, idx) => ({
      label: a.bucket,
      value: parseFloat(a.amount) || 0,
      color: seriesColor(idx * 2),
    }));
  }, [series.receivableAging]);

  // 3. BarChart: Top 5 Customers
  const topCustomersData = useMemo(() => {
    return (series.topCustomers || []).map((c, idx) => ({
      label: c.name || 'Customer',
      value: parseFloat(c.totalSales) || 0,
      color: seriesColor(idx),
    }));
  }, [series.topCustomers]);

  // 4. DonutChart: Expense Breakdown
  const expenseDonutData = useMemo(() => {
    return (series.expenseBreakdown || []).map((e, idx) => ({
      label: e.label,
      value: parseFloat(e.value) || 0,
      color: seriesColor(idx * 2),
    }));
  }, [series.expenseBreakdown]);

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
          <span className="fin-dash-badge">Technical Recommendation</span>
          <h1 className="fin-dash-title">{t('title')}</h1>
          <p className="fin-dash-subtitle">{t('subtitle')}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Unified Period Selector */}
          <div className="fin-dash-period-selector" role="group" aria-label={t('period')}>
            <button
              type="button"
              className={`fin-dash-period-btn ${period === 'this_month' ? 'active' : ''}`}
              onClick={() => setPeriod('this_month')}
            >
              {t('periods.this_month')}
            </button>
            <button
              type="button"
              className={`fin-dash-period-btn ${period === 'this_quarter' ? 'active' : ''}`}
              onClick={() => setPeriod('this_quarter')}
            >
              {t('periods.this_quarter')}
            </button>
            <button
              type="button"
              className={`fin-dash-period-btn ${period === 'this_year' ? 'active' : ''}`}
              onClick={() => setPeriod('this_year')}
            >
              {t('periods.this_year')}
            </button>
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
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>{error}</div>
      ) : (
        <>
          {/* 6 KPI Cards with tone="deep" on primary (Total Receivable) */}
          <div className="fin-dash-kpi-grid">
            <StatCard
              tone="deep"
              title={t('kpis.totalReceivable')}
              value={`₹${parseFloat(kpis.totalReceivable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              icon={<Landmark size={18} />}
              spark={cashTrendPoints}
            />

            <StatCard
              title={t('kpis.totalPayable')}
              value={`₹${parseFloat(kpis.totalPayable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              icon={<Receipt size={18} />}
            />

            <StatCard
              title={t('kpis.totalIncome')}
              value={`₹${parseFloat(kpis.totalIncome || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              icon={<TrendingUp size={18} />}
            />

            <StatCard
              title={t('kpis.totalExpenses')}
              value={`₹${parseFloat(kpis.totalExpenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              icon={<Wallet size={18} />}
            />

            <StatCard
              title={t('kpis.netProfit')}
              value={`₹${parseFloat(kpis.netProfit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
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
                subtitle={`Monthly performance for ${t(`periods.${period}`)}`}
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
              <CardHead
                title={t('charts.cashTrend')}
                subtitle="6-Month Liquidity Trend"
              />
              <CardBody style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '270px' }}>
                <div style={{ width: '100%', padding: '1rem 0' }}>
                  <Sparkline
                    data={cashTrendPoints}
                    height={100}
                    area
                    curve="smooth"
                    color="var(--accent-primary)"
                  />
                </div>
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <span style={{ fontFamily: 'Orbitron', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    ₹{cashTrendPoints[cashTrendPoints.length - 1]?.toLocaleString('en-IN') || '0.00'}
                  </span>
                  <div style={{ fontFamily: 'Sora', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Latest Cash Position
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Charts Row 2: Aging, Top Customers & Expense Donut */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', width: '100%' }}>
            <Card>
              <CardHead
                title={t('charts.receivableAging')}
                subtitle="Accounts receivable bucket distribution"
              />
              <CardBody>
                {agingData.length ? (
                  <BarChart
                    data={agingData}
                    height={240}
                    formatValue={(v) => `₹${Number(v).toLocaleString('en-IN')}`}
                  />
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No aging data</div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHead
                title={t('charts.topCustomers')}
                subtitle="Revenue contributors for period"
              />
              <CardBody>
                {topCustomersData.length ? (
                  <BarChart
                    data={topCustomersData}
                    height={240}
                    horizontal
                    formatValue={(v) => `₹${Number(v).toLocaleString('en-IN')}`}
                  />
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No sales in period</div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHead
                title={t('charts.expenseBreakdown')}
                subtitle="Operating expenses by category"
              />
              <CardBody style={{ display: 'flex', justifyContent: 'center' }}>
                {expenseDonutData.length ? (
                  <DonutChart
                    data={expenseDonutData}
                    size={220}
                    thickness={32}
                    formatValue={(v) => `₹${Number(v).toLocaleString('en-IN')}`}
                  />
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No expense entries</div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Recent Activity Section */}
          <Card>
            <CardHead
              title={t('charts.recentActivity')}
              subtitle="Latest state-changing financial and compliance actions"
            />
            <CardBody>
              {data?.recentActivity?.length ? (
                <table className="fin-dash-activity-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Actor</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentActivity.map((act) => (
                      <tr key={act.id}>
                        <td>
                          <span style={{
                            fontFamily: 'Orbitron',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--accent-primary)',
                          }}>
                            {act.action}
                          </span>
                        </td>
                        <td>
                          <code style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {act.entity_type} ({act.entity_id ? act.entity_id.slice(0, 8) + '…' : '—'})
                          </code>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {act.actor_name || act.actor_email || 'System'}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'Orbitron', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {act.created_at ? new Date(act.created_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No recent activity recorded
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
