'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/taxes/page.jsx
//
// Taxes list (project.md §7).
// ============================================================

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';
import MasterDataFrame from '@/components/masterdata/MasterDataFrame';
import ResourceListPage from '@/components/masterdata/ResourceListPage';
import { StatusPill, Maybe } from '@/components/masterdata/Cells';
import Pill from '@/reusablefiles/pill';
import { taxesService } from '@/services/masterdata.service';

/** Trim the stored 4dp scale for display: "18" reads better than "18.0000". */
function formatRate(rate) {
  if (rate === null || rate === undefined) return '—';
  return `${String(rate).replace(/\.?0+$/, '')}%`;
}

export default function TaxesPage() {
  const t = useTranslations('taxes');
  const tShared = useTranslations('masterData');
  const router = useRouter();

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: t('table.name'),
        render: (row) => <span className="md-cell-strong">{row.name}</span>,
      },
      {
        key: 'rate',
        header: t('table.rate'),
        align: 'right',
        render: (row) => <span className="md-cell-money">{formatRate(row.rate)}</span>,
      },
      {
        key: 'tax_scope',
        header: t('table.scope'),
        render: (row) => <Pill tone="mid" size="sm">{t(`scopes.${row.tax_scope}`)}</Pill>,
      },
      {
        key: 'tax_account_name',
        header: t('table.account'),
        render: (row) => <Maybe value={row.tax_account_name} />,
      },
      {
        key: 'status',
        header: t('table.status'),
        render: (row) => (
          <StatusPill status={row.status} label={tShared(`status.${row.status}`)} />
        ),
      },
    ],
    [t, tShared],
  );

  const filters = useMemo(
    () => [
      {
        key: 'status',
        label: tShared('filters.status'),
        options: [
          { value: '', label: tShared('filters.all') },
          { value: 'active', label: tShared('status.active') },
          { value: 'archived', label: tShared('status.archived') },
        ],
      },
    ],
    [tShared],
  );

  return (
    <MasterDataFrame activeKey="taxes">
      <ResourceListPage
        service={taxesService}
        columns={columns}
        filters={filters}
        createHref="/dashboard/taxes/new"
        onRowClick={(row) => router.push(`/dashboard/taxes/${row.id}`)}
        labels={{
          badge: t('badge'),
          title: t('title'),
          subtitle: t('subtitle'),
          createLabel: tShared('actions.create'),
          searchPlaceholder: t('placeholders.name'),
          emptyTitle: t('empty.title'),
          emptyBody: t('empty.body'),
        }}
      />
    </MasterDataFrame>
  );
}
