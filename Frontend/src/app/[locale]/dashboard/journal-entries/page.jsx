'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/journal-entries/page.jsx
//
// The ledger list (project.md §4.5).
//
// Newest first by default: an accountant opening this page wants what just
// happened, not what happened when the books were opened.
// ============================================================

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';
import MasterDataFrame from '@/components/masterdata/MasterDataFrame';
import ResourceListPage from '@/components/masterdata/ResourceListPage';
import { MoneyText, Maybe } from '@/components/masterdata/Cells';
import Pill from '@/reusablefiles/pill';
import { journalEntriesService } from '@/services/masterdata.service';

export default function JournalEntriesPage() {
  const t = useTranslations('journalEntries');
  const tShared = useTranslations('masterData');
  const router = useRouter();

  const columns = useMemo(
    () => [
      {
        key: 'entry_number',
        header: t('table.entryNumber'),
        render: (row) => <span className="md-cell-code">{row.entry_number}</span>,
      },
      {
        key: 'entry_date',
        header: t('table.date'),
        render: (row) => (row.entry_date ? String(row.entry_date).slice(0, 10) : '—'),
      },
      {
        key: 'journal_name',
        header: t('table.journal'),
        render: (row) => <span className="md-cell-strong">{row.journal_name}</span>,
      },
      {
        key: 'reference',
        header: t('table.reference'),
        render: (row) => <Maybe value={row.reference} />,
      },
      {
        key: 'total_debit',
        header: t('table.debit'),
        align: 'right',
        render: (row) => <MoneyText value={row.total_debit} />,
      },
      {
        key: 'total_credit',
        header: t('table.credit'),
        align: 'right',
        render: (row) => <MoneyText value={row.total_credit} />,
      },
      {
        key: 'is_auto_generated',
        header: t('table.source'),
        // project.md §4.5's auto-generated flag, surfaced where it is useful:
        // telling a hand-keyed adjustment from one a document produced.
        render: (row) => (
          <Pill tone="mid" size="sm">
            {row.is_auto_generated ? t('source.auto') : t('source.manual')}
          </Pill>
        ),
      },
      {
        key: 'status',
        header: t('table.status'),
        render: (row) => (
          <Pill tone={row.status === 'posted' ? 'strong' : 'soft'} size="sm" dot>
            {t(`status.${row.status}`)}
          </Pill>
        ),
      },
    ],
    [t],
  );

  const filters = useMemo(
    () => [
      {
        key: 'status',
        label: tShared('filters.status'),
        options: [
          { value: '', label: tShared('filters.all') },
          { value: 'posted', label: t('status.posted') },
          { value: 'reversed', label: t('status.reversed') },
        ],
      },
      {
        key: 'source',
        label: t('fields.source'),
        options: [
          { value: '', label: t('source.all') },
          { value: 'manual', label: t('source.manual') },
          { value: 'auto', label: t('source.auto') },
        ],
      },
    ],
    [t, tShared],
  );

  return (
    <MasterDataFrame activeKey="journalEntries">
      <ResourceListPage
        service={journalEntriesService}
        columns={columns}
        filters={filters}
        createHref="/dashboard/journal-entries/new"
        onRowClick={(row) => router.push(`/dashboard/journal-entries/${row.id}`)}
        labels={{
          badge: t('badge'),
          title: t('title'),
          subtitle: t('subtitle'),
          createLabel: t('actions.post'),
          searchPlaceholder: t('placeholders.search'),
          emptyTitle: t('empty.title'),
          emptyBody: t('empty.body'),
        }}
      />
    </MasterDataFrame>
  );
}
