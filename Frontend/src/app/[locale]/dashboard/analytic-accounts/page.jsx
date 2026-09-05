'use strict';
'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Edit, Archive, RotateCcw } from 'lucide-react';

import DashboardFrame from '@/components/dashboard/DashboardFrame';
import { useAuth } from '@/context/AuthContext';
import { PageHead } from '@/reusablefiles/dashboardshell';
import Card, { CardBody } from '@/reusablefiles/card';
import DataTable from '@/reusablefiles/datatable';
import Button from '@/reusablefiles/button';
import Pill from '@/reusablefiles/pill';
import ListCard from '@/reusablefiles/listcard';
import InputBox from '@/reusablefiles/inputbox';
import { Skeleton } from '@/reusablefiles/skeleton';

import FilterBar from '@/components/shared/FilterBar';
import Pagination from '@/components/shared/Pagination';
import SortableHeader from '@/components/shared/SortableHeader';
import StatusPill from '@/components/shared/StatusPill';
import Drawer from '@/components/shared/Drawer';
import FormField from '@/components/shared/FormField';
import FormActions from '@/components/shared/FormActions';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/shared/ToastProvider';

import { useListFetch } from '@/hooks/useListFetch';
import { usePagination } from '@/hooks/usePagination';
import { canCreate, canModify } from '@/utils/permissions';
import api from '@/lib/api';

const INITIAL_ANALYTIC_FORM = {
  id: null,
  name: '',
  code: '',
  analytic_type: 'expense',
  department_or_project: '',
};

function AnalyticAccountsListContent() {
  const t = useTranslations('analyticAccounts');
  const tCommon = useTranslations('common');
  const { user } = useAuth();
  const { toast } = useToast();

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

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formData, setFormData] = useState(INITIAL_ANALYTIC_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Dialog state
  const [targetAccount, setTargetAccount] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { data: accounts, pagination, loading, error, refetch } = useListFetch('/analytic-accounts', {
    page,
    limit,
    search,
    sortBy: sortBy || 'name',
    sortOrder: sortOrder || 'asc',
    status: statusFilter,
    type: typeFilter,
  });

  const openCreateDrawer = () => {
    setFormData(INITIAL_ANALYTIC_FORM);
    setFormErrors({});
    setDrawerOpen(true);
  };

  const openEditDrawer = (acc) => {
    setFormData({
      id: acc.id,
      name: acc.name || '',
      code: acc.code || '',
      analytic_type: acc.analytic_type || 'expense',
      department_or_project: acc.department_or_project || '',
    });
    setFormErrors({});
    setDrawerOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!formData.name.trim()) errors.name = tCommon('validation.required');

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    setFormErrors({});

    try {
      let res;
      if (formData.id) {
        res = await api.patch(`/analytic-accounts/${formData.id}`, formData);
      } else {
        res = await api.post('/analytic-accounts', formData);
      }

      if (res.success) {
        toast({
          type: 'success',
          title: tCommon('toast.saved'),
          message: `Analytic account "${formData.name}" saved successfully.`,
        });
        setDrawerOpen(false);
        refetch();
      } else {
        toast({
          type: 'error',
          title: tCommon('toast.error'),
          message: res.message || 'Failed to save analytic account.',
        });
      }
    } catch (err) {
      toast({
        type: 'error',
        title: tCommon('toast.error'),
        message: err.message || 'An error occurred.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async () => {
    if (!targetAccount || !actionType) return;
    setActionLoading(true);
    try {
      const res = await api.patch(`/analytic-accounts/${targetAccount.id}/${actionType}`);
      if (res.success) {
        toast({
          type: 'success',
          title: tCommon('toast.saved'),
          message: `Analytic account "${targetAccount.name}" ${actionType}d successfully.`,
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

  const canEdit = canModify('analyticAccounts', user?.role);
  const canAdd = canCreate('analyticAccounts', user?.role);

  return (
    <DashboardFrame role={user?.role} activeKey="analyticAccounts" allowedRoles={['admin', 'manager']}>
      <div className="master-layout">
        <PageHead
          title={t('title')}
          subtitle={t('subtitle')}
          badge={pagination.total > 0 ? `${pagination.total}` : undefined}
          actions={
            canAdd && (
              <Button variant="primary" onClick={openCreateDrawer}>
                <Plus size={16} />
                <span>{t('createAccount')}</span>
              </Button>
            )
          }
        />

        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={tCommon('actions.searchPlaceholder')}
          filters={[
            {
              id: 'analytic_type',
              label: 'Classification',
              value: typeFilter,
              onChange: (val) => {
                setTypeFilter(val);
                setPage(1);
              },
              options: [
                { value: '', label: 'All Classifications' },
                { value: 'expense', label: 'Expense Cost Center' },
                { value: 'income', label: 'Revenue Project' },
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
        ) : !accounts || accounts.length === 0 ? (
          search || statusFilter || typeFilter ? (
            <EmptyState
              title={tCommon('table.emptyFiltered')}
              description="No analytic accounts matched your filter criteria."
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
              title="No Analytic Accounts Found"
              description="Create cost centers and project accounts to track transactional actuals vs budgets."
              actionLabel={canAdd ? t('createAccount') : undefined}
              onAction={canAdd ? openCreateDrawer : undefined}
            />
          )
        ) : (
          <>
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
                      <span style={{ fontFamily: "'Orbitron', monospace", fontWeight: 700, color: 'var(--accent-primary)' }}>
                        {row.code || '—'}
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
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</span>
                    ),
                  },
                  {
                    key: 'analytic_type',
                    label: 'Type',
                    render: (row) => (
                      <Pill tone={row.analytic_type === 'income' ? 'success' : 'warning'} size="sm">
                        {row.analytic_type === 'income' ? 'Revenue' : 'Cost Center'}
                      </Pill>
                    ),
                  },
                  {
                    key: 'department_or_project',
                    label: t('fields.department'),
                    render: (row) => row.department_or_project || <span style={{ color: 'var(--text-muted)' }}>—</span>,
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
                          <button
                            type="button"
                            className="dash-action-btn"
                            title={tCommon('actions.edit')}
                            onClick={() => openEditDrawer(row)}
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
                        )}
                        {canEdit && (
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

            <div className="mobile-cards-wrapper" style={{ display: 'none', flexDirection: 'column', gap: '0.75rem' }}>
              {accounts.map((acc) => (
                <ListCard
                  key={acc.id}
                  title={acc.name}
                  subtitle={acc.code ? `Code: ${acc.code}` : undefined}
                  badge={<StatusPill status={acc.status} size="sm" />}
                  meta={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                      <Pill tone={acc.analytic_type === 'income' ? 'success' : 'warning'} size="sm">
                        {acc.analytic_type === 'income' ? 'Revenue' : 'Cost Center'}
                      </Pill>
                      {acc.department_or_project && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {acc.department_or_project}
                        </span>
                      )}
                    </div>
                  }
                  actions={
                    canEdit && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button variant="secondary" size="sm" onClick={() => openEditDrawer(acc)}>
                          <Edit size={13} />
                          <span>{tCommon('actions.edit')}</span>
                        </Button>
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

        {/* Side Drawer for Quick Create / Edit */}
        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={formData.id ? t('editAccount') : t('createAccount')}
          width={500}
        >
          <form onSubmit={handleFormSubmit} className="app-form">
            <FormField label={t('fields.name')} required error={formErrors.name}>
              <InputBox
                name="name"
                value={formData.name}
                onChange={(val) => setFormData((prev) => ({ ...prev, name: val }))}
                placeholder="e.g. Retail Store - Ahmedabad"
                disabled={submitting}
              />
            </FormField>

            <FormField label={t('fields.code')} hint="Optional project or department identifier">
              <InputBox
                name="code"
                value={formData.code}
                onChange={(val) => setFormData((prev) => ({ ...prev, code: val }))}
                placeholder="e.g. AHM-01"
                disabled={submitting}
              />
            </FormField>

            <FormField label="Classification" required>
              <select
                className="form-select"
                value={formData.analytic_type}
                onChange={(e) => setFormData((prev) => ({ ...prev, analytic_type: e.target.value }))}
                disabled={submitting}
              >
                <option value="expense">Expense (Cost Center)</option>
                <option value="income">Income (Revenue Project)</option>
              </select>
            </FormField>

            <FormField label={t('fields.department')} hint="Organizational unit or operational context">
              <InputBox
                name="department_or_project"
                value={formData.department_or_project}
                onChange={(val) => setFormData((prev) => ({ ...prev, department_or_project: val }))}
                placeholder="e.g. Retail Operations"
                disabled={submitting}
              />
            </FormField>

            <FormActions
              onCancel={() => setDrawerOpen(false)}
              isSubmitting={submitting}
              submitLabel={tCommon('actions.save')}
            />
          </form>
        </Drawer>

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
          title={`${actionType === 'archive' ? 'Archive' : 'Restore'} Analytic Account`}
          description={
            actionType === 'archive'
              ? `Are you sure you want to archive analytic account "${targetAccount?.name}"?`
              : `Are you sure you want to unarchive analytic account "${targetAccount?.name}"?`
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

export default function AnalyticAccountsListPage() {
  return (
    <React.Suspense fallback={<div style={{ padding: '2rem' }}><Skeleton height="48px" /></div>}>
      <AnalyticAccountsListContent />
    </React.Suspense>
  );
}

