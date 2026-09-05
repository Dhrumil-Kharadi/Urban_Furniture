'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/analytic-accounts/page.jsx
//
// Analytic accounts list (project.md §4.6, §8).
// ============================================================

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';
import MasterDataFrame from '@/components/masterdata/MasterDataFrame';
import ResourceListPage from '@/components/masterdata/ResourceListPage';
import { StatusPill, Maybe } from '@/components/masterdata/Cells';
import Pill from '@/reusablefiles/pill';
import { analyticAccountsService } from '@/services/masterdata.service';

export default function AnalyticAccountsPage() {
  const t = useTranslations('analyticAccounts');
  const tShared = useTranslations('masterData');
  const router = useRouter();

  const columns = useMemo(
    () => [
      {
        key: 'code',
        header: t('table.code'),
        render: (row) =>
          row.code ? <span className="md-cell-code">{row.code}</span> : <Maybe value={null} />,
      },
      {
        key: 'name',
        header: t('table.name'),
        render: (row) => <span className="md-cell-strong">{row.name}</span>,
      },
      {
        key: 'analytic_type',
        header: t('table.type'),
        render: (row) => <Pill tone="mid" size="sm">{t(`types.${row.analytic_type}`)}</Pill>,
      },
      {
        key: 'department',
        header: t('table.department'),
        render: (row) => <Maybe value={row.department} />,
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
      {
        key: 'type',
        label: tShared('filters.type'),
        options: [
          { value: '', label: tShared('filters.all') },
          { value: 'income', label: t('types.income') },
          { value: 'expense', label: t('types.expense') },
        ],
      },
    ],
    [t, tShared],
  );

  return (
    <MasterDataFrame activeKey="analyticAccounts">
      <ResourceListPage
        service={analyticAccountsService}
        columns={columns}
        filters={filters}
        createHref="/dashboard/analytic-accounts/new"
        onRowClick={(row) => router.push(`/dashboard/analytic-accounts/${row.id}`)}
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
