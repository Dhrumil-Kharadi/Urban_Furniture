'use strict';
'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Plus, Edit, Archive, RotateCcw } from 'lucide-react';

import DashboardFrame from '@/components/dashboard/DashboardFrame';
import { useAuth } from '@/context/AuthContext';
import { PageHead } from '@/reusablefiles/dashboardshell';
import Card, { CardBody } from '@/reusablefiles/card';
import DataTable from '@/reusablefiles/datatable';
import Button from '@/reusablefiles/button';
import Pill from '@/reusablefiles/pill';
import ListCard from '@/reusablefiles/listcard';
import { Skeleton } from '@/reusablefiles/skeleton';

import FilterBar from '@/components/shared/FilterBar';
import Pagination from '@/components/shared/Pagination';
import SortableHeader from '@/components/shared/SortableHeader';
import StatusPill from '@/components/shared/StatusPill';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/shared/ToastProvider';

import { useListFetch } from '@/hooks/useListFetch';
import { usePagination } from '@/hooks/usePagination';
import { canCreate, canModify } from '@/utils/permissions';
import api from '@/lib/api';

function JournalsListContent() {
  const t = useTranslations('journals');
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
  } = usePagination(25);

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [targetJournal, setTargetJournal] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { data: journals, pagination, loading, error, refetch } = useListFetch('/journals', {
    page,
    limit,
    search,
    sortBy: sortBy || 'name',
    sortOrder: sortOrder || 'asc',
    status: statusFilter,
    journalType: typeFilter,
  });

  const handleAction = async () => {
    if (!targetJournal || !actionType) return;
    setActionLoading(true);
    try {
      const res = await api.patch(`/journals/${targetJournal.id}/${actionType}`);
      if (res.success) {
        toast({
          type: 'success',
          title: tCommon('toast.saved'),
          message: `Journal "${targetJournal.name}" ${actionType}d successfully.`,
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
      setTargetJournal(null);
      setActionType(null);
    }
  };

  const typeTone = (type) => {
    switch (type) {
      case 'sales':
        return 'success';
      case 'purchase':
        return 'warning';
      case 'bank':
      case 'cash':
        return 'info';
      default:
        return 'primary';
    }
  };

  const canEdit = canModify('journals', user?.role);
  const canAdd = canCreate('journals', user?.role);

  return (
    <DashboardFrame role={user?.role} activeKey="journals" allowedRoles={['admin', 'manager']}>
      <div className="master-layout">
        <PageHead
          title={t('title')}
          subtitle={t('subtitle')}
          badge={pagination.total > 0 ? `${pagination.total}` : undefined}
          actions={
            canAdd && (
              <Link href="/dashboard/journals/new">
                <Button variant="primary">
                  <Plus size={16} />
                  <span>{t('createJournal')}</span>
                </Button>
              </Link>
            )
          }
        />

        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={tCommon('actions.searchPlaceholder')}
          filters={[
            {
              id: 'journal_type',
              label: t('fields.type'),
              value: typeFilter,
              onChange: (val) => {
                setTypeFilter(val);
                setPage(1);
              },
              options: [
                { value: '', label: 'All Types' },
                { value: 'sales', label: t('types.sales') },
                { value: 'purchase', label: t('types.purchase') },
                { value: 'bank', label: t('types.bank') },
                { value: 'cash', label: t('types.cash') },
                { value: 'general', label: t('types.general') },
              ],
            },
            {
              id: 'status',
              label: t('fields.type'),
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

        {loading ? (
          <Card>
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
                <Skeleton height="36px" />
                <Skeleton height="48px" />
                <Skeleton height="48px" />
                <Skeleton height="48px" />
              </div>
            </CardBody>
          </Card>
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : !journals || journals.length === 0 ? (
          search || statusFilter || typeFilter ? (
            <EmptyState
              title={tCommon('table.emptyFiltered')}
              description="No journals matched your filter criteria."
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
              title="No Journals Found"
              description="Configure accounting journals to record ledger entries."
              actionLabel={canAdd ? t('createJournal') : undefined}
              onAction={canAdd ? () => router.push('/dashboard/journals/new') : undefined}
            />
          )
        ) : (
          <>
            <div className="table-responsive-wrapper">
              <DataTable
                columns={[
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
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</span>
                    ),
                  },
                  {
                    key: 'journal_type',
                    label: t('fields.type'),
                    render: (row) => (
                      <Pill tone={typeTone(row.journal_type)} size="sm">
                        {t(`types.${row.journal_type}`) || row.journal_type}
                      </Pill>
                    ),
                  },
                  {
                    key: 'sequence_prefix',
                    label: t('fields.sequencePrefix'),
                    render: (row) => (
                      <span style={{ fontFamily: "'Orbitron', monospace", fontWeight: 600 }}>
                        {row.sequence_prefix || '—'}
                      </span>
                    ),
                  },
                  {
                    key: 'default_debit_account',
                    label: t('fields.defaultDebitAccount'),
                    render: (row) =>
                      row.default_debit_account_name ? (
                        <span style={{ fontSize: '0.85rem' }}>
                          {row.default_debit_account_code} — {row.default_debit_account_name}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      ),
                  },
                  {
                    key: 'default_credit_account',
                    label: t('fields.defaultCreditAccount'),
                    render: (row) =>
                      row.default_credit_account_name ? (
                        <span style={{ fontSize: '0.85rem' }}>
                          {row.default_credit_account_code} — {row.default_credit_account_name}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      ),
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (row) => <StatusPill status={row.status} size="sm" />,
                  },
                  {
                    key: 'actions',
                    label: tCommon('table.actions'),
                    render: (row) => (
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        {canEdit && (
                          <Link href={`/dashboard/journals/${row.id}`}>
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
                        {canEdit && (
                          row.status === 'active' ? (
                            <button
                              type="button"
                              className="dash-action-btn"
                              title={tCommon('actions.archive')}
                              onClick={() => {
                                setTargetJournal(row);
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
                                setTargetJournal(row);
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
                data={journals}
              />
            </div>

            <div className="mobile-cards-wrapper" style={{ display: 'none', flexDirection: 'column', gap: '0.75rem' }}>
              {journals.map((j) => (
                <ListCard
                  key={j.id}
                  title={j.name}
                  subtitle={j.sequence_prefix ? `Prefix: ${j.sequence_prefix}` : undefined}
                  badge={<StatusPill status={j.status} size="sm" />}
                  meta={
                    <div style={{ marginTop: '0.5rem' }}>
                      <Pill tone={typeTone(j.journal_type)} size="sm">
                        {t(`types.${j.journal_type}`) || j.journal_type}
                      </Pill>
                    </div>
                  }
                  actions={
                    canEdit && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link href={`/dashboard/journals/${j.id}`}>
                          <Button variant="secondary" size="sm">
                            <Edit size={13} />
                            <span>{tCommon('actions.edit')}</span>
                          </Button>
                        </Link>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setTargetJournal(j);
                            setActionType(j.status === 'active' ? 'archive' : 'unarchive');
                          }}
                        >
                          {j.status === 'active' ? <Archive size={13} /> : <RotateCcw size={13} />}
                        </Button>
                      </div>
                    )
                  }
                />
              ))}
            </div>

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

        <ConfirmDialog
          isOpen={!!targetJournal && !!actionType}
          onClose={() => {
            setTargetJournal(null);
            setActionType(null);
          }}
          onConfirm={handleAction}
          isSubmitting={actionLoading}
          isDestructive={actionType === 'archive'}
          title={`${actionType === 'archive' ? 'Archive' : 'Restore'} Journal`}
          description={
            actionType === 'archive'
              ? `Are you sure you want to archive journal "${targetJournal?.name}"?`
              : `Are you sure you want to unarchive journal "${targetJournal?.name}"?`
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

export default function JournalsListPage() {
  return (
    <React.Suspense fallback={<div style={{ padding: '2rem' }}><Skeleton height="48px" /></div>}>
      <JournalsListContent />
    </React.Suspense>
  );
}

