'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/journals/page.jsx
//
// Journals list (project.md §4.4).
// ============================================================

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';
import MasterDataFrame from '@/components/masterdata/MasterDataFrame';
import ResourceListPage from '@/components/masterdata/ResourceListPage';
import { StatusPill, Maybe } from '@/components/masterdata/Cells';
import Pill from '@/reusablefiles/pill';
import { journalsService } from '@/services/masterdata.service';

export default function JournalsPage() {
  const t = useTranslations('journals');
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
        key: 'journal_type',
        header: t('table.type'),
        render: (row) => <Pill tone="mid" size="sm">{t(`types.${row.journal_type}`)}</Pill>,
      },
      {
        key: 'sequence_prefix',
        header: t('table.prefix'),
        render: (row) =>
          row.sequence_prefix
            ? <span className="md-cell-code">{row.sequence_prefix}</span>
            : <Maybe value={null} />,
      },
      {
        key: 'default_debit_account_name',
        header: t('table.defaultDebit'),
        render: (row) => <Maybe value={row.default_debit_account_name} />,
      },
      {
        key: 'default_credit_account_name',
        header: t('table.defaultCredit'),
        render: (row) => <Maybe value={row.default_credit_account_name} />,
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
          { value: 'sales', label: t('types.sales') },
          { value: 'purchase', label: t('types.purchase') },
          { value: 'bank', label: t('types.bank') },
          { value: 'cash', label: t('types.cash') },
          { value: 'general', label: t('types.general') },
        ],
      },
    ],
    [t, tShared],
  );

  return (
    <MasterDataFrame activeKey="journals">
      <ResourceListPage
        service={journalsService}
        columns={columns}
        filters={filters}
        createHref="/dashboard/journals/new"
        onRowClick={(row) => router.push(`/dashboard/journals/${row.id}`)}
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
