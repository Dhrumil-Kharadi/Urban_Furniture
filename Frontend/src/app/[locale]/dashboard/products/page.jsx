'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/products/page.jsx
//
// Products list (project.md §4.2).
//
// Money columns are right-aligned with tabular figures so decimal points line
// up down the column, and are formatted from the server's string amount —
// nothing here computes with a price.
// ============================================================

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';
import MasterDataFrame from '@/components/masterdata/MasterDataFrame';
import ResourceListPage from '@/components/masterdata/ResourceListPage';
import { StatusPill, MoneyText, Maybe } from '@/components/masterdata/Cells';
import Pill from '@/reusablefiles/pill';
import { productsService } from '@/services/masterdata.service';

export default function ProductsPage() {
  const t = useTranslations('products');
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
        key: 'sku',
        header: t('table.sku'),
        render: (row) =>
          row.sku ? <span className="md-cell-code">{row.sku}</span> : <Maybe value={null} />,
      },
      {
        key: 'product_type',
        header: t('table.type'),
        render: (row) => <Pill tone="mid" size="sm">{t(`types.${row.product_type}`)}</Pill>,
      },
      {
        key: 'category_name',
        header: t('table.category'),
        render: (row) => <Maybe value={row.category_name} />,
      },
      {
        key: 'sales_price',
        header: t('table.salesPrice'),
        align: 'right',
        render: (row) => <MoneyText value={row.sales_price} />,
      },
      {
        key: 'cost_price',
        header: t('table.costPrice'),
        align: 'right',
        render: (row) => <MoneyText value={row.cost_price} />,
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
          { value: 'goods', label: t('types.goods') },
          { value: 'service', label: t('types.service') },
          { value: 'combo', label: t('types.combo') },
        ],
      },
    ],
    [t, tShared],
  );

  return (
    <MasterDataFrame activeKey="products">
      <ResourceListPage
        service={productsService}
        columns={columns}
        filters={filters}
        createHref="/dashboard/products/new"
        onRowClick={(row) => router.push(`/dashboard/products/${row.id}`)}
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
