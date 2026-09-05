'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/contacts/page.jsx
//
// Contacts list (project.md §4.1).
// ============================================================

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';
import MasterDataFrame from '@/components/masterdata/MasterDataFrame';
import ResourceListPage from '@/components/masterdata/ResourceListPage';
import { StatusPill, Maybe } from '@/components/masterdata/Cells';
import Pill from '@/reusablefiles/pill';
import { contactsService } from '@/services/masterdata.service';

export default function ContactsPage() {
  const t = useTranslations('contacts');
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
        key: 'contact_type',
        header: t('table.type'),
        render: (row) => <Pill tone="mid" size="sm">{t(`types.${row.contact_type}`)}</Pill>,
      },
      {
        key: 'email',
        header: t('table.email'),
        render: (row) => <Maybe value={row.email} />,
      },
      {
        key: 'mobile',
        header: t('table.mobile'),
        render: (row) => <Maybe value={row.mobile} />,
      },
      {
        key: 'city',
        header: t('table.city'),
        render: (row) => <Maybe value={row.city} />,
      },
      {
        key: 'portal',
        header: t('table.portal'),
        render: (row) => (
          <Pill tone={row.portal_access_enabled ? 'strong' : 'soft'} size="sm">
            {row.portal_access_enabled ? t('portal.enabled') : t('portal.disabled')}
          </Pill>
        ),
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
          { value: 'customer', label: t('types.customer') },
          { value: 'vendor', label: t('types.vendor') },
          { value: 'both', label: t('types.both') },
        ],
      },
    ],
    [t, tShared],
  );

  return (
    <MasterDataFrame activeKey="contacts">
      <ResourceListPage
        service={contactsService}
        columns={columns}
        filters={filters}
        createHref="/dashboard/contacts/new"
        onRowClick={(row) => router.push(`/dashboard/contacts/${row.id}`)}
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
