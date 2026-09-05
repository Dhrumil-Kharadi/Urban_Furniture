'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/journals/[id]/page.jsx
//
// Journal detail.
//
// Archiving the only active journal of a type is refused by the server with a
// sentence saying why — documents of that kind could not be posted without it.
// ============================================================

import React from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import ResourceDetailPage from '@/components/masterdata/ResourceDetailPage';
import JournalForm from '@/components/journals/JournalForm';
import JournalEntriesPanel from '@/components/journals/JournalEntriesPanel';
import { Fact, StatusPill } from '@/components/masterdata/Cells';
import Pill from '@/reusablefiles/pill';
import { journalsService } from '@/services/masterdata.service';

export default function JournalDetailPage() {
  const t = useTranslations('journals');
  const tShared = useTranslations('masterData');
  const { id } = useParams();

  return (
    <ResourceDetailPage
      service={journalsService}
      id={id}
      activeKey="journals"
      listHref="/dashboard/journals"
      labels={{
        badge: t('badge'),
        title: (journal) => journal.name,
        subtitle: (journal) => t(`types.${journal.journal_type}`),
      }}
      renderFacts={(journal) => (
        <>
          <div className="md-facts">
            <Fact label={t('fields.name')}>{journal.name}</Fact>
            <Fact label={t('fields.type')}>
              <Pill tone="mid" size="sm">{t(`types.${journal.journal_type}`)}</Pill>
            </Fact>
            <Fact label={t('fields.prefix')}>
              {journal.sequence_prefix
                ? <span className="md-cell-code">{journal.sequence_prefix}</span>
                : null}
            </Fact>
            <Fact label={t('fields.status')}>
              <StatusPill status={journal.status} label={tShared(`status.${journal.status}`)} />
            </Fact>
            <Fact label={t('fields.defaultDebit')}>{journal.default_debit_account_name}</Fact>
            <Fact label={t('fields.defaultCredit')}>{journal.default_credit_account_name}</Fact>
          </div>

          <p className="md-form-hint">{t('lastOfTypeNote')}</p>

          {/* What has actually been posted through this journal — the reason
              someone opens a journal in the first place. */}
          <JournalEntriesPanel journalId={journal.id} />
        </>
      )}
      renderForm={({ record, ...rest }) => (
        <JournalForm journal={record} isEdit {...rest} />
      )}
    />
  );
}
