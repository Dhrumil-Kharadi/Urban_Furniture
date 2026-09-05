'use client';

// ============================================================
// FILE: src/components/masterdata/ResourceListPage.jsx
//
// The master-data list page, once.
//
// Contacts, Products and Categories differ only in their columns, their
// filters and their labels — the fetching, the URL-held filter state, the four
// list states, the pagination and the refetch-dimming are identical. Writing
// them three times would mean fixing every list bug three times.
//
// A page supplies:
//   service      the resource service (list/get/create/…)
//   columns      DataTable column defs, built with useMemo in the page
//   filters      [{ key, label, options }] — values are read from the URL here
//   labels       every string, already translated by the page
//   createHref   where the primary action goes (null hides it)
// ============================================================

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import DataTable from '@/reusablefiles/datatable';
import Button from '@/reusablefiles/button';
import Card from '@/reusablefiles/card';
import { PageHead } from '@/reusablefiles/dashboardshell';

import useListParams from '@/hooks/useListParams';
import useResourceList from '@/hooks/useResourceList';
import {
  ListToolbar,
  ListPagination,
  ListSkeleton,
  ListState,
  ListError,
} from './ListChrome';

/**
 * @param {object}   props
 * @param {object}   props.service
 * @param {Array}    props.columns
 * @param {Array}    [props.filters] - [{ key, label, options }]
 * @param {object}   props.labels - { badge, title, subtitle, createLabel,
 *                                    emptyTitle, emptyBody, searchPlaceholder }
 * @param {string|null} [props.createHref]
 * @param {Function} [props.onRowClick]
 */
export default function ResourceListPage({
  service,
  columns,
  filters = [],
  labels,
  createHref = null,
  onRowClick,
}) {
  const t = useTranslations('masterData');

  // Default to active records: an archived contact is still findable through
  // the status filter, but it should not pad the working list.
  const { params, searchDraft, setSearchDraft, setParam, reset, isFiltered } =
    useListParams({ status: 'active' });

  const query = useMemo(
    () => ({
      page: params.page,
      limit: params.limit,
      search: params.search,
      status: params.status,
      type: params.type,
      categoryId: params.categoryId,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
    [params],
  );

  const { items, pagination, loading, refreshing, error, refetch } =
    useResourceList(service, query);

  const toolbarFilters = useMemo(
    () =>
      filters.map((filter) => ({
        key: filter.key,
        label: filter.label,
        value: params[filter.key] ?? '',
        options: filter.options,
        onChange: (value) => setParam(filter.key, value),
      })),
    [filters, params, setParam],
  );

  const paginationLabels = useMemo(
    () => ({
      summary: (values) => t('pagination.summary', values),
      page: (values) => t('pagination.page', values),
      previous: t('pagination.previous'),
      next: t('pagination.next'),
    }),
    [t],
  );

  /**
   * Decide which of the four states the table region is in. The order matters:
   * an error outranks an empty list, and "no rows" is only "nothing yet" when
   * no filter is hiding anything.
   */
  const body = (() => {
    if (loading) {
      return <ListSkeleton rows={6} columns={columns.length} />;
    }

    if (error) {
      return (
        <ListError
          title={t('states.errorTitle')}
          body={error || t('states.errorBody')}
          retryLabel={t('actions.retry')}
          onRetry={refetch}
        />
      );
    }

    if (items.length === 0) {
      return isFiltered ? (
        <ListState
          title={t('states.noMatchTitle')}
          body={t('states.noMatchBody')}
          action={
            <Button variant="ghost" size="sm" onClick={reset}>
              {t('actions.clearFilters')}
            </Button>
          }
        />
      ) : (
        <ListState
          title={labels.emptyTitle}
          body={labels.emptyBody}
          action={
            createHref ? (
              <Button variant="primary" size="sm" href={createHref}>
                {labels.createLabel}
              </Button>
            ) : null
          }
        />
      );
    }

    return (
      <DataTable
        columns={columns}
        rows={items}
        onRowClick={onRowClick}
        loadingLabel={t('states.loading')}
        emptyLabel={t('states.emptyBody')}
      />
    );
  })();

  return (
    <div className="md-page">
      <PageHead
        badge={labels.badge}
        title={labels.title}
        subtitle={labels.subtitle}
        actions={
          createHref ? (
            <Button variant="primary" size="sm" href={createHref}>
              {labels.createLabel}
            </Button>
          ) : null
        }
      />

      <Card tone="plain" className="md-panel">
        <ListToolbar
          searchLabel={t('filters.search')}
          searchValue={searchDraft}
          onSearchChange={setSearchDraft}
          searchPlaceholder={labels.searchPlaceholder}
          filters={toolbarFilters}
        />

        {/* A refetch dims the table rather than replacing it with skeletons,
            so filtering does not make the page jump under the reader. */}
        <div className={`md-table-region${refreshing ? ' is-refreshing' : ''}`}>
          {body}
        </div>

        <ListPagination
          pagination={pagination}
          onPageChange={(page) => setParam('page', String(page))}
          labels={paginationLabels}
        />
      </Card>
    </div>
  );
}
