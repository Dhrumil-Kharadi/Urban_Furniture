'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/budgets/[id]/page.jsx
//
// Budget detail & variance tracking page (project.md §4.7, §8 · phase.md Phase 11).
// Strictly follows strict.md: pure CSS classes from budgets.css,
// zero Tailwind utility classes, Orbitron/Sora typography, and Frozen Lake palette tokens.
// ============================================================

import React, { useState, useEffect, useMemo, use } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Edit2, TrendingUp, AlertTriangle, CheckCircle, PieChart, FileText } from 'lucide-react';

import { Link, useRouter } from '@/i18n/navigation';
import Button from '@/reusablefiles/button';
import StatCard from '@/reusablefiles/statcard/StatCard';
import DataTable from '@/reusablefiles/datatable/DataTable';
import GroupedBarChart from '@/reusablefiles/graphs/GroupedBarChart';
import ProgressBar from '@/reusablefiles/graphs/ProgressBar';
import { MoneyText, StatusPill } from '@/components/masterdata/Cells';
import BudgetDrawer from '@/components/budgets/BudgetDrawer';
import api from '@/lib/api';

export default function BudgetDetailPage({ params }) {
  const resolvedParams = typeof params?.then === 'function' ? use(params) : params;
  const budgetId = resolvedParams?.id;

  const t = useTranslations('budgets');
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [budget, setBudget] = useState(null);
  const [lines, setLines] = useState([]);
  const [linesLoading, setLinesLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const fetchBudgetDetail = async () => {
    if (!budgetId) return;
    setLoading(true);
    try {
      const res = await api.get(`/budgets/${budgetId}`);
      const data = res?.data || res;
      setBudget(data);
    } catch (err) {
      console.error('Failed to load budget detail', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgetDetail();
  }, [budgetId]);

  useEffect(() => {
    if (!budget?.contributingLines) return;
    setLines(budget.contributingLines);
    setLinesLoading(false);
  }, [budget]);

  const chartData = useMemo(() => {
    if (!budget?.monthlyBreakdown || !budget.monthlyBreakdown.length) {
      return { categories: [], series: [] };
    }

    const categories = budget.monthlyBreakdown.map((m) => m.month);
    const plannedData = budget.monthlyBreakdown.map((m) => Number(m.planned) || 0);
    const actualData = budget.monthlyBreakdown.map((m) => Number(m.actual) || 0);

    return {
      categories,
      series: [
        { name: 'Planned', color: '#000080', data: plannedData },
        { name: 'Actual', color: '#6D8196', data: actualData },
      ],
    };
  }, [budget]);

  const lineColumns = useMemo(
    () => [
      {
        key: 'entry_date',
        header: t('detail.date'),
        render: (row) => row.entry_date?.split('T')[0] || '—',
      },
      {
        key: 'entry_number',
        header: t('detail.entry'),
        render: (row) => (
          <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
            {row.entry_number}
          </span>
        ),
      },
      {
        key: 'account',
        header: t('detail.account'),
        render: (row) => (
          <div>
            <span style={{ fontWeight: 500 }}>{row.account_name}</span>
            <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '6px' }}>
              [{row.account_code}]
            </span>
          </div>
        ),
      },
      {
        key: 'partner',
        header: t('detail.partner'),
        render: (row) => row.partner_name || '—',
      },
      {
        key: 'description',
        header: t('detail.description'),
        render: (row) => row.description || '—',
      },
      {
        key: 'amount',
        header: t('detail.amount'),
        align: 'right',
        render: (row) => (
          <span className="budget-val-negative">
            <MoneyText value={row.debit} />
          </span>
        ),
      },
    ],
    [t],
  );

  if (loading && !budget) {
    return (
      <div className="budget-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <p style={{ fontFamily: 'Sora, sans-serif', color: 'var(--text-secondary)' }}>Loading budget details…</p>
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="budget-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <p style={{ fontFamily: 'Sora, sans-serif', color: 'var(--text-secondary)' }}>Budget not found.</p>
        <div style={{ marginTop: '1rem' }}>
          <Link href="/dashboard/budgets">
            <Button variant="outline" size="sm">
              {t('detail.back')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isOver = budget.isOverBudget || (Number(budget.actualAmount) > Number(budget.plannedAmount));
  const consumption = Number(budget.consumptionPercent) || 0;

  return (
    <div className="budget-container">
      {/* Top Header */}
      <div className="budget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dashboard/budgets" className="budget-back-btn">
            <ArrowLeft size={18} />
          </Link>
          <div className="budget-header-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 className="budget-title">{budget.name}</h1>
              <StatusPill status={budget.status} label={t(`status.${budget.status}`)} />
            </div>
            <p className="budget-subtitle">
              Analytic Account: <strong style={{ color: 'var(--text-primary)' }}>{budget.analytic_account_name}</strong> [{budget.analytic_account_code}]
              {' · '}Period: {budget.period_start?.split('T')[0]} &rarr; {budget.period_end?.split('T')[0]}
            </p>
          </div>
        </div>

        <div>
          <Button
            variant="outline"
            onClick={() => setIsDrawerOpen(true)}
            icon={<Edit2 size={15} />}
          >
            {t('editBudget')}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="budget-kpi-grid">
        <StatCard
          title={t('fields.plannedAmount')}
          value={`₹${Number(budget.plannedAmount).toLocaleString()}`}
          icon={<PieChart size={18} />}
          tone="deep"
        />
        <StatCard
          title={t('table.actual')}
          value={`₹${Number(budget.actualAmount).toLocaleString()}`}
          icon={<TrendingUp size={18} />}
          tone="light"
        />
        <StatCard
          title={t('table.variance')}
          value={`₹${Number(budget.variance).toLocaleString()}`}
          icon={isOver ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          tone="light"
        />
        <StatCard
          title={t('table.usage')}
          value={`${consumption.toFixed(1)}%`}
          tone="light"
        />
      </div>

      {/* Progress Gauge */}
      <div className="budget-card-frame">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="budget-card-title">{t('detail.overview')}</h2>
          <span style={{
            fontFamily: 'Sora, sans-serif',
            fontSize: '0.78rem',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: '999px',
            background: isOver ? 'rgba(220, 38, 38, 0.1)' : 'rgba(22, 163, 74, 0.1)',
            color: isOver ? '#dc2626' : '#16a34a',
            border: isOver ? '1px solid rgba(220, 38, 38, 0.25)' : '1px solid rgba(22, 163, 74, 0.25)'
          }}>
            {isOver ? t('overBudget') : t('onTrack')} ({consumption.toFixed(1)}% utilized)
          </span>
        </div>
        <ProgressBar
          value={Math.min(consumption, 100)}
          max={100}
          color={isOver ? '#ef4444' : '#10b981'}
          size="lg"
          formatValue={() => `${consumption.toFixed(1)}%`}
        />
      </div>

      {/* Monthly Chart */}
      {chartData.categories.length > 0 && (
        <div className="budget-card-frame">
          <h2 className="budget-card-title">{t('detail.monthlyBreakdown')}</h2>
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <GroupedBarChart
              categories={chartData.categories}
              series={chartData.series}
              height={300}
              formatValue={(val) => `₹${Number(val).toLocaleString()}`}
            />
          </div>
        </div>
      )}

      {/* Itemized Transactions Table */}
      <div className="budget-table-card">
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="budget-card-title">{t('detail.contributingTransactions')}</h2>
            <p className="budget-subtitle" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
              Journal entries carrying tag: {budget.analytic_account_name}
            </p>
          </div>
          <span style={{ fontFamily: 'Orbitron, monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {lines.length} entries
          </span>
        </div>

        <DataTable
          columns={lineColumns}
          rows={lines}
          loading={linesLoading}
          loadingLabel="Loading contributing journal entries…"
          emptyLabel={
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
              <FileText size={24} style={{ margin: '0 auto 0.5rem', color: 'var(--text-secondary)', opacity: 0.6 }} />
              <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {t('detail.noLines')}
              </p>
            </div>
          }
        />
      </div>

      {/* Edit Drawer */}
      <BudgetDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSaved={() => {
          fetchBudgetDetail();
          fetchLines();
        }}
        budget={budget}
      />
    </div>
  );
}
