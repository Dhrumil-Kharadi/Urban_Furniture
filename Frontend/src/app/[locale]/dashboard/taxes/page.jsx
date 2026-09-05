'use strict';
'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Edit, Archive, RotateCcw, Percent } from 'lucide-react';

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
import AccountPicker from '@/components/pickers/AccountPicker';
import EmptyState from '@/components/shared/EmptyState';
import ErrorState from '@/components/shared/ErrorState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/shared/ToastProvider';

import { useListFetch } from '@/hooks/useListFetch';
import { usePagination } from '@/hooks/usePagination';
import { canCreate, canModify } from '@/utils/permissions';
import api from '@/lib/api';

const INITIAL_TAX_FORM = {
  id: null,
  name: '',
  rate: '18.0000',
  tax_scope: 'both',
  computation: 'percentage',
  collected_account_id: null,
  paid_account_id: null,
};

function TaxesListContent() {
  const t = useTranslations('taxes');
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
  const [scopeFilter, setScopeFilter] = useState('');

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formData, setFormData] = useState(INITIAL_TAX_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Dialog state
  const [targetTax, setTargetTax] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { data: taxes, pagination, loading, error, refetch } = useListFetch('/taxes', {
    page,
    limit,
    search,
    sortBy: sortBy || 'name',
    sortOrder: sortOrder || 'asc',
    status: statusFilter,
    taxScope: scopeFilter,
  });

  const openCreateDrawer = () => {
    setFormData(INITIAL_TAX_FORM);
    setFormErrors({});
    setDrawerOpen(true);
  };

  const openEditDrawer = (tax) => {
    setFormData({
      id: tax.id,
      name: tax.name || '',
      rate: tax.rate ? Number(tax.rate).toString() : '0',
      tax_scope: tax.tax_scope || 'both',
      computation: tax.computation || 'percentage',
      collected_account_id: tax.collected_account_id || null,
      paid_account_id: tax.paid_account_id || null,
    });
    setFormErrors({});
    setDrawerOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!formData.name.trim()) errors.name = tCommon('validation.required');
    const numRate = Number(formData.rate);
    if (isNaN(numRate) || numRate < 0 || numRate > 100) {
      errors.rate = 'Rate must be between 0 and 100';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    setFormErrors({});

    try {
      let res;
      if (formData.id) {
        res = await api.patch(`/taxes/${formData.id}`, formData);
      } else {
        res = await api.post('/taxes', formData);
      }

      if (res.success) {
        toast({
          type: 'success',
          title: tCommon('toast.saved'),
          message: `Tax rate "${formData.name}" saved successfully.`,
        });
        setDrawerOpen(false);
        refetch();
      } else {
        toast({
          type: 'error',
          title: tCommon('toast.error'),
          message: res.message || 'Failed to save tax rate.',
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
    if (!targetTax || !actionType) return;
    setActionLoading(true);
    try {
      const res = await api.patch(`/taxes/${targetTax.id}/${actionType}`);
      if (res.success) {
        toast({
          type: 'success',
          title: tCommon('toast.saved'),
          message: `Tax rate "${targetTax.name}" ${actionType}d successfully.`,
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
      setTargetTax(null);
      setActionType(null);
    }
  };

  const scopeTone = (scope) => {
    switch (scope) {
      case 'sales':
        return 'success';
      case 'purchase':
        return 'warning';
      case 'both':
      default:
        return 'primary';
    }
  };

  const canEdit = canModify('taxes', user?.role);
  const canAdd = canCreate('taxes', user?.role);

  return (
    <DashboardFrame role={user?.role} activeKey="taxes" allowedRoles={['admin', 'manager']}>
      <div className="master-layout">
        <PageHead
          title={t('title')}
          subtitle={t('subtitle')}
          badge={pagination.total > 0 ? `${pagination.total}` : undefined}
          actions={
            canAdd && (
              <Button variant="primary" onClick={openCreateDrawer}>
                <Plus size={16} />
                <span>{t('createTax')}</span>
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
              id: 'tax_scope',
              label: t('fields.scope'),
              value: scopeFilter,
              onChange: (val) => {
                setScopeFilter(val);
                setPage(1);
              },
              options: [
                { value: '', label: 'All Scopes' },
                { value: 'both', label: t('scopes.both') },
                { value: 'sales', label: t('scopes.sales') },
                { value: 'purchase', label: t('scopes.purchase') },
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
            setScopeFilter('');
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
        ) : !taxes || taxes.length === 0 ? (
          search || statusFilter || scopeFilter ? (
            <EmptyState
              title={tCommon('table.emptyFiltered')}
              description="No tax rates matched your filter criteria."
              actionLabel={tCommon('actions.clearFilters')}
              onAction={() => {
                setSearch('');
                setStatusFilter('');
                setScopeFilter('');
                setPage(1);
              }}
            />
          ) : (
            <EmptyState
              title="No Tax Rates Found"
              description="Define sales and purchase tax rates to automate line computation."
              actionLabel={canAdd ? t('createTax') : undefined}
              onAction={canAdd ? openCreateDrawer : undefined}
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
                    key: 'rate',
                    label: (
                      <SortableHeader
                        column="rate"
                        currentSort={sortBy}
                        currentOrder={sortOrder}
                        onSort={setSorting}
                      >
                        {t('fields.rate')}
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
                        {Number(row.rate).toFixed(2)}%
                      </span>
                    ),
                  },
                  {
                    key: 'tax_scope',
                    label: t('fields.scope'),
                    render: (row) => (
                      <Pill tone={scopeTone(row.tax_scope)} size="sm">
                        {t(`scopes.${row.tax_scope}`) || row.tax_scope}
                      </Pill>
                    ),
                  },
                  {
                    key: 'collected_account',
                    label: t('fields.collectedAccount'),
                    render: (row) =>
                      row.collected_account_name ? (
                        <span style={{ fontSize: '0.85rem' }}>
                          {row.collected_account_code} — {row.collected_account_name}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      ),
                  },
                  {
                    key: 'paid_account',
                    label: t('fields.paidAccount'),
                    render: (row) =>
                      row.paid_account_name ? (
                        <span style={{ fontSize: '0.85rem' }}>
                          {row.paid_account_code} — {row.paid_account_name}
                        </span>
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
                                setTargetTax(row);
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
                                setTargetTax(row);
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
                data={taxes}
              />
            </div>

            <div className="mobile-cards-wrapper" style={{ display: 'none', flexDirection: 'column', gap: '0.75rem' }}>
              {taxes.map((tx) => (
                <ListCard
                  key={tx.id}
                  title={tx.name}
                  subtitle={`Scope: ${t(`scopes.${tx.tax_scope}`) || tx.tax_scope}`}
                  badge={<StatusPill status={tx.status} size="sm" />}
                  meta={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                      <span style={{ fontFamily: "'Orbitron', monospace", fontWeight: 700, color: 'var(--accent-primary)' }}>
                        {Number(tx.rate).toFixed(2)}%
                      </span>
                      <Pill tone={scopeTone(tx.tax_scope)} size="sm">
                        {t(`scopes.${tx.tax_scope}`) || tx.tax_scope}
                      </Pill>
                    </div>
                  }
                  actions={
                    canEdit && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button variant="secondary" size="sm" onClick={() => openEditDrawer(tx)}>
                          <Edit size={13} />
                          <span>{tCommon('actions.edit')}</span>
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setTargetTax(tx);
                            setActionType(tx.status === 'active' ? 'archive' : 'unarchive');
                          }}
                        >
                          {tx.status === 'active' ? <Archive size={13} /> : <RotateCcw size={13} />}
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

        {/* Side Drawer for Short Form Create / Edit */}
        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={formData.id ? t('editTax') : t('createTax')}
          width={500}
        >
          <form onSubmit={handleFormSubmit} className="app-form">
            <FormField label={t('fields.name')} required error={formErrors.name}>
              <InputBox
                name="name"
                value={formData.name}
                onChange={(val) => setFormData((prev) => ({ ...prev, name: val }))}
                placeholder="e.g. GST 18%"
                disabled={submitting}
              />
            </FormField>

            <FormField label={t('fields.rate')} required error={formErrors.rate} hint="Percentage rate between 0 and 100">
              <InputBox
                name="rate"
                type="number"
                step="0.01"
                value={formData.rate}
                onChange={(val) => setFormData((prev) => ({ ...prev, rate: val }))}
                placeholder="18.00"
                disabled={submitting}
              />
            </FormField>

            <FormField label={t('fields.scope')} required>
              <select
                className="form-select"
                value={formData.tax_scope}
                onChange={(e) => setFormData((prev) => ({ ...prev, tax_scope: e.target.value }))}
                disabled={submitting}
              >
                <option value="both">{t('scopes.both')}</option>
                <option value="sales">{t('scopes.sales')}</option>
                <option value="purchase">{t('scopes.purchase')}</option>
              </select>
            </FormField>

            <FormField label={t('fields.collectedAccount')} hint="Output Tax Liability account (collected on sales)">
              <AccountPicker
                value={formData.collected_account_id}
                onChange={(id) => setFormData((prev) => ({ ...prev, collected_account_id: id }))}
                type="liability"
                disabled={submitting}
              />
            </FormField>

            <FormField label={t('fields.paidAccount')} hint="Input Tax Asset account (paid on purchases)">
              <AccountPicker
                value={formData.paid_account_id}
                onChange={(id) => setFormData((prev) => ({ ...prev, paid_account_id: id }))}
                type="asset"
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
          isOpen={!!targetTax && !!actionType}
          onClose={() => {
            setTargetTax(null);
            setActionType(null);
          }}
          onConfirm={handleAction}
          isSubmitting={actionLoading}
          isDestructive={actionType === 'archive'}
          title={`${actionType === 'archive' ? 'Archive' : 'Restore'} Tax Rate`}
          description={
            actionType === 'archive'
              ? `Are you sure you want to archive tax rate "${targetTax?.name}"?`
              : `Are you sure you want to unarchive tax rate "${targetTax?.name}"?`
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

export default function TaxesListPage() {
  return (
    <React.Suspense fallback={<div style={{ padding: '2rem' }}><Skeleton height="48px" /></div>}>
      <TaxesListContent />
    </React.Suspense>
  );
}

