'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/budgets/page.jsx
//
// Budgets overview & list page (project.md §4.7, §8 · phase.md Phase 11).
// Strictly follows strict.md: pure CSS classes from budgets.css,
// zero Tailwind utility classes, Orbitron/Sora typography, and Frozen Lake palette tokens.
// ============================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Search, Eye, Edit2, TrendingUp, AlertTriangle, CheckCircle, PieChart } from 'lucide-react';

import { Link, useRouter } from '@/i18n/navigation';
import Button from '@/reusablefiles/button';
import InputBox from '@/reusablefiles/inputbox';
import StatCard from '@/reusablefiles/statcard/StatCard';
import DataTable from '@/reusablefiles/datatable/DataTable';
import ProgressBar from '@/reusablefiles/graphs/ProgressBar';
import { MoneyText, StatusPill } from '@/components/masterdata/Cells';
import BudgetDrawer from '@/components/budgets/BudgetDrawer';
import api from '@/lib/api';

export default function BudgetsPage() {
  const t = useTranslations('budgets');
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState(null);

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', '50');

      const res = await api.get(`/budgets?${params.toString()}`);
      if (res?.data?.items) {
        setBudgets(res.data.items);
      } else if (res?.items) {
        setBudgets(res.items);
      } else {
        setBudgets([]);
      }
    } catch (err) {
      console.error('Failed to load budgets', err);
      setBudgets([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const stats = useMemo(() => {
    let plannedTotal = 0;
    let actualTotal = 0;
    let activeCount = 0;

    budgets.forEach((b) => {
      const p = Number(b.planned_amount) || 0;
      const a = Number(b.actual_amount) || 0;
      plannedTotal += p;
      actualTotal += a;
      if (b.status === 'active') activeCount++;
    });

    const variance = plannedTotal - actualTotal;

    return {
      plannedTotal: plannedTotal.toFixed(2),
      actualTotal: actualTotal.toFixed(2),
      variance: variance.toFixed(2),
      activeCount,
    };
  }, [budgets]);

  const handleEdit = (budget, e) => {
    e.stopPropagation();
    setSelectedBudget(budget);
    setIsDrawerOpen(true);
  };

  const handleCreate = () => {
    setSelectedBudget(null);
    setIsDrawerOpen(true);
  };

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: t('table.name'),
        render: (row) => (
          <div className="budget-name-cell">
            <Link
              href={`/dashboard/budgets/${row.id}`}
              className="budget-link"
            >
              {row.name}
            </Link>
            <span className="budget-date-sub">
              {row.period_start?.split('T')[0]} &rarr; {row.period_end?.split('T')[0]}
            </span>
          </div>
        ),
      },
      {
        key: 'analytic',
        header: t('table.analytic'),
        render: (row) => (
          <div className="budget-analytic-cell">
            <span className="budget-analytic-name">
              {row.analytic_account_name || '—'}
            </span>
            {row.analytic_account_code && (
              <span className="budget-analytic-code">
                [{row.analytic_account_code}]
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'planned',
        header: t('table.planned'),
        align: 'right',
        render: (row) => <MoneyText value={row.planned_amount} />,
      },
      {
        key: 'actual',
        header: t('table.actual'),
        align: 'right',
        render: (row) => <MoneyText value={row.actual_amount || '0.00'} />,
      },
      {
        key: 'variance',
        header: t('table.variance'),
        align: 'right',
        render: (row) => {
          const isOver = row.is_over_budget || (Number(row.actual_amount) > Number(row.planned_amount));
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span className={isOver ? 'budget-val-negative' : 'budget-val-positive'}>
                <MoneyText value={row.variance || '0.00'} />
              </span>
              <span className="budget-date-sub">
                {row.variance_percent}%
              </span>
            </div>
          );
        },
      },
      {
        key: 'usage',
        header: t('table.usage'),
        width: '180px',
        render: (row) => {
          const pct = Number(row.consumption_percent) || 0;
          const isOver = pct > 100;
          return (
            <div style={{ width: '100%' }}>
              <ProgressBar
                value={Math.min(pct, 100)}
                max={100}
                color={isOver ? '#ef4444' : '#10b981'}
                size="sm"
                formatValue={() => `${pct.toFixed(1)}%`}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span className="budget-date-sub">{isOver ? t('overBudget') : t('onTrack')}</span>
              </div>
            </div>
          );
        },
      },
      {
        key: 'status',
        header: t('table.status'),
        render: (row) => (
          <StatusPill status={row.status} label={t(`status.${row.status}`)} />
        ),
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row) => (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
            <Link
              href={`/dashboard/budgets/${row.id}`}
              className="budget-action-btn"
              title="View Detail"
            >
              <Eye size={15} />
            </Link>
            <button
              type="button"
              onClick={(e) => handleEdit(row, e)}
              className="budget-action-btn"
              title="Edit Budget"
            >
              <Edit2 size={15} />
            </button>
          </div>
        ),
      },
    ],
    [t, handleEdit],
  );

  return (
      <div className="budget-container">
      {/* Top Header */}
      <div className="budget-header">
        <div className="budget-header-content">
          <span className="budget-badge">
            {t('badge')}
          </span>
          <h1 className="budget-title">
            {t('title')}
          </h1>
          <p className="budget-subtitle">
            {t('subtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button variant="primary" onClick={handleCreate} icon={<Plus size={16} />}>
            {t('newBudget')}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="budget-kpi-grid">
        <StatCard
          title={t('kpi.totalPlanned')}
          value={`₹${Number(stats.plannedTotal).toLocaleString()}`}
          icon={<PieChart size={18} />}
          tone="deep"
        />
        <StatCard
          title={t('kpi.totalActual')}
          value={`₹${Number(stats.actualTotal).toLocaleString()}`}
          icon={<TrendingUp size={18} />}
          tone="light"
        />
        <StatCard
          title={t('kpi.netVariance')}
          value={`₹${Number(stats.variance).toLocaleString()}`}
          icon={Number(stats.variance) >= 0 ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          tone="light"
        />
        <StatCard
          title={t('kpi.activeBudgets')}
          value={stats.activeCount}
          tone="light"
        />
      </div>

      {/* Toolbar */}
      <div className="budget-toolbar">
        <div className="budget-search-box">
          <InputBox
            placeholder="Search budgets or analytic accounts…"
            value={search}
            onChange={setSearch}
            icon={<Search size={16} />}
            size="sm"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="budget-select"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Budgets Table */}
      <div className="budget-table-card">
        <DataTable
          columns={columns}
          rows={budgets}
          loading={loading}
          loadingLabel="Loading budgets from ledger…"
          emptyLabel={
            <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
              <h3 style={{ fontFamily: 'Orbitron, monospace', fontSize: '1rem', color: 'var(--text-primary)' }}>
                {t('empty.title')}
              </h3>
              <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                {t('empty.body')}
              </p>
              <div style={{ marginTop: '1rem' }}>
                <Button variant="outline" size="sm" onClick={handleCreate}>
                  {t('newBudget')}
                </Button>
              </div>
            </div>
          }
          onRowClick={(row) => router.push(`/dashboard/budgets/${row.id}`)}
        />
      </div>

      {/* Drawer */}
      <BudgetDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSaved={fetchBudgets}
        budget={selectedBudget}
      />
      </div>
  );
}
