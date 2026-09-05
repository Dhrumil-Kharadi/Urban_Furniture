'use strict';
'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import {
  Plus, Edit, Archive, RotateCcw, Landmark, AlertTriangle,
  TrendingUp, TrendingDown, DollarSign, Wallet
} from 'lucide-react';

import DashboardFrame from '@/components/dashboard/DashboardFrame';
import { useAuth } from '@/context/AuthContext';
import { PageHead } from '@/reusablefiles/dashboardshell';
import Card, { CardBody } from '@/reusablefiles/card';
import StatCard from '@/reusablefiles/statcard';
import DataTable from '@/reusablefiles/datatable';
import Button from '@/reusablefiles/button';
import Pill from '@/reusablefiles/pill';
import ListCard from '@/reusablefiles/listcard';
import { Skeleton } from '@/reusablefiles/skeleton';

import FilterBar from '@/components/shared/FilterBar';
import Pagination from '@/components/shared/Pagination';
import SortableHeader from '@/components/shared/SortableHeader';
import StatusPill from '@/components/shared/StatusPill';
import MoneyText from '@/components/shared/MoneyText';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/shared/ToastProvider';

import { useListFetch } from '@/hooks/useListFetch';
import { usePagination } from '@/hooks/usePagination';
import { canCreate, canModify } from '@/utils/permissions';
import api from '@/lib/api';

function AccountsListContent() {
  const t = useTranslations('accounts');
  const tCommon = useTranslations('common');
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const {
    page,
    limit,
    sortBy,
    sortOrder,
    search,
    setPage,
    setLimit,
    setSearch,
    setSorting,
    updateParams,
  } = usePagination(25);

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Dialog state
  const [targetAccount, setTargetAccount] = useState(null);
  const [actionType, setActionType] = useState(null); // 'archive' | 'unarchive'
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch accounts list with params
  const { data: accounts, pagination, loading, error, refetch } = useListFetch('/accounts', {
    page,
    limit,
    search,
    sortBy: sortBy || 'code',
    sortOrder: sortOrder || 'asc',
    status: statusFilter,
    type: typeFilter,
  });

  // Calculate quick summary metrics
  const summary = useMemo(() => {
    const list = Array.isArray(accounts) ? accounts : [];
    const counts = { asset: 0, liability: 0, capital: 0, income: 0, expense: 0 };
    list.forEach((acc) => {
      if (counts[acc.account_type] !== undefined) {
        counts[acc.account_type]++;
      }
    });
    return counts;
  }, [accounts]);

  const handleAction = async () => {
    if (!targetAccount || !actionType) return;
    setActionLoading(true);
    try {
      const endpoint = `/accounts/${targetAccount.id}/${actionType}`;
      const res = await api.patch(endpoint);
      if (res.success) {
        toast({
          type: 'success',
          title: tCommon('toast.saved'),
          message: `Account ${targetAccount.code} ${actionType}d successfully.`,
        });
        refetch();
      } else {
        toast({
          type: 'error',
          title: tCommon('toast.error'),
          message: res.message || 'Action failed.',
        });
      }
    } catch (err) {
      toast({
        type: 'error',
        title: tCommon('toast.error'),
        message: err.message || 'Action failed.',
      });
    } finally {
      setActionLoading(false);
      setTargetAccount(null);
      setActionType(null);
    }
  };

  const typeTone = (type) => {
    switch (type) {
      case 'asset':
        return 'info';
      case 'liability':
        return 'warning';
      case 'capital':
        return 'primary';
      case 'income':
        return 'success';
      case 'expense':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const canEdit = canModify('accounts', user?.role);
  const canAdd = canCreate('accounts', user?.role);

  return (
    <DashboardFrame role={user?.role} activeKey="accounts" allowedRoles={['admin', 'manager']}>
      <div className="master-layout">
        {/* Page Head */}
        <PageHead
          title={t('title')}
          subtitle={t('subtitle')}
          badge={pagination.total > 0 ? `${pagination.total}` : undefined}
          actions={
            canAdd && (
              <Link href="/dashboard/accounts/new">
                <Button variant="primary">
                  <Plus size={16} />
                  <span>{t('createAccount')}</span>
                </Button>
              </Link>
            )
          }
        />

        {/* Classification KPIs */}
        <div className="dash-grid-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <StatCard
            label={t('types.asset')}
            value={summary.asset}
            icon={Landmark}
            trend="neutral"
            caption={`${summary.asset} ${t('types.asset').toLowerCase()} accounts`}
          />
          <StatCard
            label={t('types.liability')}
            value={summary.liability}
            icon={AlertTriangle}
            trend="neutral"
            caption={`${summary.liability} ${t('types.liability').toLowerCase()} accounts`}
          />
          <StatCard
            label={t('types.capital')}
            value={summary.capital}
            icon={Wallet}
            trend="neutral"
            caption={`${summary.capital} ${t('types.capital').toLowerCase()} accounts`}
          />
          <StatCard
            label={t('types.income')}
            value={summary.income}
            icon={TrendingUp}
            trend="neutral"
            caption={`${summary.income} ${t('types.income').toLowerCase()} accounts`}
          />
          <StatCard
            label={t('types.expense')}
            value={summary.expense}
            icon={TrendingDown}
            trend="neutral"
            caption={`${summary.expense} ${t('types.expense').toLowerCase()} accounts`}
          />
        </div>

        {/* Filters */}
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={tCommon('actions.searchPlaceholder')}
          filters={[
            {
              id: 'account_type',
              label: t('fields.type'),
              value: typeFilter,
              onChange: (val) => {
                setTypeFilter(val);
                setPage(1);
              },
              options: [
                { value: '', label: 'All Classifications' },
                { value: 'asset', label: t('types.asset') },
                { value: 'liability', label: t('types.liability') },
                { value: 'capital', label: t('types.capital') },
                { value: 'income', label: t('types.income') },
                { value: 'expense', label: t('types.expense') },
              ],
            },
            {
              id: 'status',
              label: t('fields.status'),
              value: statusFilter,
              onChange: (val) => {
                setStatusFilter(val);
                setPage(1);
              },
              options: [
                { value: '', label: 'All Statuses' },
                { value: 'active', label: tCommon('status.active') },
                { value: 'archived', label: tCommon('status.archived') },
              ],
            },
          ]}
          onReset={() => {
            setSearch('');
            setStatusFilter('');
            setTypeFilter('');
            setPage(1);
          }}
        />

        {/* Table / Content States */}
        {loading ? (
          <Card>
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
                <Skeleton height="36px" />
                <Skeleton height="48px" />
                <Skeleton height="48px" />
                <Skeleton height="48px" />
                <Skeleton height="48px" />
              </div>
            </CardBody>
          </Card>
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : !accounts || accounts.length === 0 ? (
          search || statusFilter || typeFilter ? (
            <EmptyState
              title={tCommon('table.emptyFiltered')}
              description="Try clearing your search query or dropdown filters to view accounts."
              actionLabel={tCommon('actions.clearFilters')}
              onAction={() => {
                setSearch('');
                setStatusFilter('');
                setTypeFilter('');
                setPage(1);
              }}
            />
          ) : (
            <EmptyState
              title="No Accounts Found"
              description="Get started by configuring your Chart of Accounts."
              actionLabel={canAdd ? t('createAccount') : undefined}
              onAction={canAdd ? () => router.push('/dashboard/accounts/new') : undefined}
            />
          )
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="table-responsive-wrapper">
              <DataTable
                columns={[
                  {
                    key: 'code',
                    label: (
                      <SortableHeader
                        column="code"
                        currentSort={sortBy}
                        currentOrder={sortOrder}
                        onSort={setSorting}
                      >
                        {t('fields.code')}
                      </SortableHeader>
                    ),
                    render: (row) => (
                      <span
                        style={{
                          fontFamily: "'Orbitron', monospace",
                          fontWeight: 700,
                          color: 'var(--accent-primary)',
                        }}
                      >
                        {row.code}
                      </span>
                    ),
                  },
                  {
                    key: 'name',
                    label: (
                      <SortableHeader
                        column="name"
                        currentSort={sortBy}
                        currentOrder={sortOrder}
                        onSort={setSorting}
                      >
                        {t('fields.name')}
                      </SortableHeader>
                    ),
                    render: (row) => (
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</div>
                        {row.parent_account_name && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ↳ {row.parent_account_code} — {row.parent_account_name}
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'account_type',
                    label: t('fields.type'),
                    render: (row) => (
                      <Pill tone={typeTone(row.account_type)} size="sm">
                        {t(`types.${row.account_type}`) || row.account_type}
                      </Pill>
                    ),
                  },
                  {
                    key: 'opening_balance',
                    label: (
                      <div style={{ textAlign: 'right', width: '100%' }}>
                        <SortableHeader
                          column="opening_balance"
                          currentSort={sortBy}
                          currentOrder={sortOrder}
                          onSort={setSorting}
                        >
                          {t('fields.openingBalance')}
                        </SortableHeader>
                      </div>
                    ),
                    render: (row) => (
                      <div style={{ textAlign: 'right' }}>
                        <MoneyText amount={row.opening_balance} />
                      </div>
                    ),
                  },
                  {
                    key: 'is_system',
                    label: t('fields.isSystem'),
                    render: (row) =>
                      row.is_system ? (
                        <Pill tone="neutral" size="sm">
                          System
                        </Pill>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      ),
                  },
                  {
                    key: 'status',
                    label: t('fields.status'),
                    render: (row) => <StatusPill status={row.status} size="sm" />,
                  },
                  {
                    key: 'actions',
                    label: tCommon('table.actions'),
                    render: (row) => (
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        {canEdit && (
                          <Link href={`/dashboard/accounts/${row.id}`}>
                            <button
                              type="button"
                              className="dash-action-btn"
                              title={tCommon('actions.edit')}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                              }}
                            >
                              <Edit size={15} />
                            </button>
                          </Link>
                        )}
                        {canEdit && !row.is_system && (
                          row.status === 'active' ? (
                            <button
                              type="button"
                              className="dash-action-btn"
                              title={tCommon('actions.archive')}
                              onClick={() => {
                                setTargetAccount(row);
                                setActionType('archive');
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                              }}
                            >
                              <Archive size={15} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="dash-action-btn"
                              title={tCommon('actions.restore')}
                              onClick={() => {
                                setTargetAccount(row);
                                setActionType('unarchive');
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                              }}
                            >
                              <RotateCcw size={15} />
                            </button>
                          )
                        )}
                      </div>
                    ),
                  },
                ]}
                data={accounts}
              />
            </div>

            {/* Mobile Stacked Card View (<768px) */}
            <div className="mobile-cards-wrapper" style={{ display: 'none', flexDirection: 'column', gap: '0.75rem' }}>
              {accounts.map((acc) => (
                <ListCard
                  key={acc.id}
                  title={`${acc.code} — ${acc.name}`}
                  subtitle={acc.parent_account_name ? `↳ ${acc.parent_account_code} ${acc.parent_account_name}` : undefined}
                  badge={<StatusPill status={acc.status} size="sm" />}
                  meta={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                      <Pill tone={typeTone(acc.account_type)} size="sm">
                        {t(`types.${acc.account_type}`) || acc.account_type}
                      </Pill>
                      <MoneyText amount={acc.opening_balance} />
                    </div>
                  }
                  actions={
                    canEdit && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link href={`/dashboard/accounts/${acc.id}`}>
                          <Button variant="secondary" size="sm">
                            <Edit size={13} />
                            <span>{tCommon('actions.edit')}</span>
                          </Button>
                        </Link>
                        {!acc.is_system && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setTargetAccount(acc);
                              setActionType(acc.status === 'active' ? 'archive' : 'unarchive');
                            }}
                          >
                            {acc.status === 'active' ? <Archive size={13} /> : <RotateCcw size={13} />}
                          </Button>
                        )}
                      </div>
                    )
                  }
                />
              ))}
            </div>

            {/* Pagination Controls */}
            <Pagination
              page={pagination.page}
              limit={pagination.limit}
              total={pagination.total}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
              onLimitChange={setLimit}
            />
          </>
        )}

        {/* Confirmation Modal */}
        <ConfirmDialog
          isOpen={!!targetAccount && !!actionType}
          onClose={() => {
            setTargetAccount(null);
            setActionType(null);
          }}
          onConfirm={handleAction}
          isSubmitting={actionLoading}
          isDestructive={actionType === 'archive'}
          title={`${actionType === 'archive' ? 'Archive' : 'Restore'} Account`}
          description={
            actionType === 'archive'
              ? `Are you sure you want to archive "${targetAccount?.code} — ${targetAccount?.name}"? It will no longer be selectable in journals or transactions.`
              : `Are you sure you want to unarchive "${targetAccount?.code} — ${targetAccount?.name}"?`
          }
          confirmLabel={actionType === 'archive' ? tCommon('actions.archive') : tCommon('actions.restore')}
        />
      </div>

      <style jsx global>{`
        @media (max-width: 768px) {
          .table-responsive-wrapper {
            display: none !important;
          }
          .mobile-cards-wrapper {
            display: flex !important;
          }
        }
      `}</style>
    </DashboardFrame>
  );
}

export default function AccountsListPage() {
  return (
    <React.Suspense fallback={<div style={{ padding: '2rem' }}><Skeleton height="48px" /></div>}>
      <AccountsListContent />
    </React.Suspense>
  );
}

