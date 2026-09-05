'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/reports/budget-report/page.jsx
//
// Real-time Budget Performance Report (project.md §4.7, §6, §8 · phase.md Phase 11).
// Strictly follows strict.md: pure CSS classes from reports.css and budgets.css,
// zero Tailwind utility classes, Orbitron/Sora typography.
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Download, PieChart, TrendingUp, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import Button from '@/reusablefiles/button';
import StatCard from '@/reusablefiles/statcard/StatCard';
import DataTable from '@/reusablefiles/datatable/DataTable';
import { GroupedBarChart, ProgressBar } from '@/reusablefiles/graphs';
import { MoneyText, StatusPill } from '@/components/masterdata/Cells';
import reportsService from '@/services/reports.service';

export default function BudgetReportPage() {
  const t = useTranslations('reports.budgetReport');
  const tReports = useTranslations('reports');

  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedBudgetId) params.budgetId = selectedBudgetId;
      const res = await reportsService.getBudgetReport(params);
      setData(res?.data || res);
    } catch (err) {
      setError(err?.message || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [selectedBudgetId, t]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCsv = () => {
    const params = selectedBudgetId ? { budgetId: selectedBudgetId } : {};
    const url = reportsService.exportCsvUrl('budget', params);
    window.open(url, '_blank');
  };

  const budgetsList = data?.budgets || [];
  const totals = data?.totals || {
    totalPlanned: '0.00',
    totalActual: '0.00',
    totalVariance: '0.00',
    overallConsumption: '0.00',
  };

  const chartConfig = useMemo(() => {
    if (!budgetsList.length) return null;

    const topBudgets = budgetsList.slice(0, 8);
    const categories = topBudgets.map((b) => b.name);
    const plannedData = topBudgets.map((b) => Number(b.plannedAmount) || 0);
    const actualData = topBudgets.map((b) => Number(b.actualAmount) || 0);

    return {
      categories,
      series: [
        { name: t('planned'), color: 'var(--graph-series-1)', data: plannedData },
        { name: t('actual'), color: 'var(--graph-series-5)', data: actualData },
      ],
    };
  }, [budgetsList, t]);

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: t('budget'),
        render: (row) => (
          <div className="budget-name-cell">
            <Link
              href={`/dashboard/budgets/${row.id}`}
              className="budget-link"
            >
              {row.name}
            </Link>
            <span className="budget-date-sub">
              {row.periodStart?.split('T')[0]} &rarr; {row.periodEnd?.split('T')[0]}
            </span>
          </div>
        ),
      },
      {
        key: 'analytic',
        header: t('analyticAccount'),
        render: (row) => (
          <div className="budget-analytic-cell">
            <span className="budget-analytic-name">
              {row.analyticAccountName || '—'}
            </span>
            {row.analyticAccountCode && (
              <span className="budget-analytic-code">
                [{row.analyticAccountCode}]
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'planned',
        header: t('planned'),
        align: 'right',
        render: (row) => <MoneyText value={row.plannedAmount} />,
      },
      {
        key: 'actual',
        header: t('actual'),
        align: 'right',
        render: (row) => <MoneyText value={row.actualAmount} />,
      },
      {
        key: 'variance',
        header: t('variance'),
        align: 'right',
        render: (row) => {
          const isOver = row.isOverBudget || (Number(row.actualAmount) > Number(row.plannedAmount));
          return (
            <div className="budget-variance-cell">
              <span className={isOver ? 'budget-val-negative' : 'budget-val-positive'}>
                <MoneyText value={row.variance} />
              </span>
              <span className="budget-date-sub">
                {row.variancePercent}%
              </span>
            </div>
          );
        },
      },
      {
        key: 'usage',
        header: t('percent'),
        width: '180px',
        render: (row) => {
          const pct = Number(row.consumptionPercent) || 0;
          const isOver = pct > 100;
          return (
            <div className="budget-usage-cell">
              <ProgressBar
                value={Math.min(pct, 100)}
                max={100}
                color={isOver ? 'var(--status-error)' : 'var(--status-success)'}
                size="sm"
                formatValue={() => `${pct.toFixed(1)}%`}
              />
              <div className="budget-usage-legend">
                <span className="budget-date-sub">{isOver ? t('overBudget') : t('underBudget')}</span>
              </div>
            </div>
          );
        },
      },
      {
        key: 'status',
        header: t('status'),
        render: (row) => (
          <StatusPill status={row.status} label={row.status} />
        ),
      },
    ],
    [t],
  );

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

        {/* Filter Controls & Export */}
        <div className="report-toolbar">
          <div>
            <select
              value={selectedBudgetId}
              onChange={(e) => setSelectedBudgetId(e.target.value)}
              className="budget-select"
            >
              <option value="">{t('allBudgets')}</option>
              {budgetsList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
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
          title={t('planned')}
          value={`₹${Number(totals.totalPlanned).toLocaleString()}`}
          icon={<PieChart size={18} />}
          tone="deep"
        />
        <StatCard
          title={t('actual')}
          value={`₹${Number(totals.totalActual).toLocaleString()}`}
          icon={<TrendingUp size={18} />}
          tone="light"
        />
        <StatCard
          title={t('variance')}
          value={`₹${Number(totals.totalVariance).toLocaleString()}`}
          icon={Number(totals.totalVariance) >= 0 ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          tone="light"
        />
        <StatCard
          title={t('percent')}
          value={`${Number(totals.overallConsumption).toFixed(1)}%`}
          tone="light"
        />
      </div>

      {/* Visual Chart */}
      {chartConfig && (
        <div className="report-chart-card">
          <h2 className="report-chart-title">
            {t('chartTitle')}
          </h2>
          <div className="report-chart-frame">
            <GroupedBarChart
              categories={chartConfig.categories}
              series={chartConfig.series}
              height={260}
              formatValue={(val) => `₹${Number(val).toLocaleString()}`}
            />
          </div>
        </div>
      )}

      {/* Budgets Performance Table */}
      <div className="budget-table-card">
        <DataTable
          columns={columns}
          rows={budgetsList}
          loading={loading}
          loadingLabel={tReports('loading')}
          emptyLabel={t('noData')}
        />
      </div>
    </div>
  );
}
