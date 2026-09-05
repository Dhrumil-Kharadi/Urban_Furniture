'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/accounts/page.jsx
//
// Chart of Accounts list (project.md §4.3).
// ============================================================

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';
import MasterDataFrame from '@/components/masterdata/MasterDataFrame';
import ResourceListPage from '@/components/masterdata/ResourceListPage';
import { StatusPill, MoneyText, Maybe } from '@/components/masterdata/Cells';
import Pill from '@/reusablefiles/pill';
import { accountsService } from '@/services/masterdata.service';

export default function AccountsPage() {
  const t = useTranslations('accounts');
  const tShared = useTranslations('masterData');
  const router = useRouter();

  const columns = useMemo(
    () => [
      {
        key: 'code',
        header: t('table.code'),
        render: (row) => <span className="md-cell-code">{row.code}</span>,
      },
      {
        key: 'name',
        header: t('table.name'),
        render: (row) => <span className="md-cell-strong">{row.name}</span>,
      },
      {
        key: 'account_type',
        header: t('table.type'),
        render: (row) => <Pill tone="mid" size="sm">{t(`types.${row.account_type}`)}</Pill>,
      },
      {
        key: 'parent_account_name',
        header: t('table.parent'),
        render: (row) => <Maybe value={row.parent_account_name} />,
      },
      {
        key: 'opening_balance',
        header: t('table.openingBalance'),
        align: 'right',
        render: (row) => <MoneyText value={row.opening_balance} />,
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
          { value: 'asset', label: t('types.asset') },
          { value: 'liability', label: t('types.liability') },
          { value: 'expense', label: t('types.expense') },
          { value: 'income', label: t('types.income') },
          { value: 'capital', label: t('types.capital') },
        ],
      },
    ],
    [t, tShared],
  );

  return (
    <MasterDataFrame activeKey="accounts">
      <ResourceListPage
        service={accountsService}
        columns={columns}
        filters={filters}
        createHref="/dashboard/accounts/new"
        onRowClick={(row) => router.push(`/dashboard/accounts/${row.id}`)}
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
