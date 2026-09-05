'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/product-categories/page.jsx
//
// Product categories list.
// ============================================================

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';
import MasterDataFrame from '@/components/masterdata/MasterDataFrame';
import ResourceListPage from '@/components/masterdata/ResourceListPage';
import { StatusPill, Maybe } from '@/components/masterdata/Cells';
import { productCategoriesService } from '@/services/masterdata.service';

export default function ProductCategoriesPage() {
  const t = useTranslations('productCategories');
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
        key: 'description',
        header: t('table.description'),
        render: (row) => <Maybe value={row.description} />,
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
    <MasterDataFrame activeKey="productCategories">
      <ResourceListPage
        service={productCategoriesService}
        columns={columns}
        filters={filters}
        createHref="/dashboard/product-categories/new"
        onRowClick={(row) => router.push(`/dashboard/product-categories/${row.id}`)}
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
