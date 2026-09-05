'use client';

// ============================================================
// FILE: src/components/journals/JournalEntriesPanel.jsx
//
// The postings made through one journal.
//
// The journal detail page showed only the master record — name, type, prefix,
// default accounts — so "open the Sales journal" answered nothing about what
// had actually been posted through it. This panel puts the ledger lines where
// someone looking at a journal expects to find them, newest first, each row a
// link into the full entry with its debit/credit breakdown.
//
// Reference: project.md §4.4, §4.5
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import DataTable from '@/reusablefiles/datatable';
import Button from '@/reusablefiles/button';
import Pill from '@/reusablefiles/pill';
import { MoneyText, Maybe } from '@/components/masterdata/Cells';
import { journalEntriesService } from '@/services/masterdata.service';

const PAGE_LIMIT = 10;

/**
 * @param {string} props.journalId
 */
export default function JournalEntriesPanel({ journalId }) {
  const t = useTranslations('journals');
  const tEntries = useTranslations('journalEntries');

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (signal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await journalEntriesService.list(
          { journalId, limit: PAGE_LIMIT, sortBy: 'entry_date', sortOrder: 'desc' },
          signal,
        );
        setEntries(res?.items || []);
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setError(err?.message || t('entries.loadError'));
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [journalId, t],
  );

  useEffect(() => {
    if (!journalId) return undefined;
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [journalId, load]);

  const columns = [
    {
      key: 'entry_number',
      header: tEntries('table.entryNumber'),
      render: (row) => (
        <Link href={`/dashboard/journal-entries/${row.id}`} className="md-cell-code md-cell-link">
          {row.entry_number}
        </Link>
      ),
    },
    {
      key: 'entry_date',
      header: tEntries('table.date'),
      render: (row) => (row.entry_date ? String(row.entry_date).slice(0, 10) : '—'),
    },
    {
      key: 'reference',
      header: tEntries('table.reference'),
      render: (row) => <Maybe value={row.reference} />,
    },
    {
      key: 'total_debit',
      header: tEntries('table.debit'),
      align: 'right',
      render: (row) => <MoneyText value={row.total_debit} />,
    },
    {
      key: 'total_credit',
      header: tEntries('table.credit'),
      align: 'right',
      render: (row) => <MoneyText value={row.total_credit} />,
    },
    {
      key: 'status',
      header: tEntries('table.status'),
      render: (row) => (
        <Pill tone={row.status === 'posted' ? 'strong' : 'soft'} size="sm" dot>
          {tEntries(`status.${row.status}`)}
        </Pill>
      ),
    },
  ];

  return (
    <section className="md-subsection">
      <header className="md-subsection-head">
        <div>
          <h2 className="md-subsection-title">{t('entries.title')}</h2>
          <p className="md-form-hint">{t('entries.subtitle')}</p>
        </div>
        <Button variant="ghost" size="sm" href={`/dashboard/journal-entries?journalId=${journalId}`}>
          {t('entries.viewAll')}
        </Button>
      </header>

      <DataTable
        columns={columns}
        rows={entries}
        loading={loading}
        loadingLabel={tEntries('title')}
        emptyLabel={error || t('entries.empty')}
      />
    </section>
  );
}
