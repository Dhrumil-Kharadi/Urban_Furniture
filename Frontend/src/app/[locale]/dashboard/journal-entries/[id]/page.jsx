'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/journal-entries/[id]/page.jsx
//
// Journal entry detail.
//
// There is NO edit button and NO delete button, and that is the design.
// A posted entry is immutable (technicalrequirement.md §3.8) — the only
// correction is a reversing entry, which is the one action offered here. The
// database enforces the same thing in a trigger, so an edit control would only
// produce an error nobody could act on.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import MasterDataFrame from '@/components/masterdata/MasterDataFrame';
import EntryTotals from '@/components/journal-entries/EntryTotals';
import { Fact, MoneyText, Maybe } from '@/components/masterdata/Cells';
import { ListState } from '@/components/masterdata/ListChrome';

import Card, { CardHead, CardBody } from '@/reusablefiles/card';
import Button from '@/reusablefiles/button';
import Pill from '@/reusablefiles/pill';
import Skeleton from '@/reusablefiles/skeleton';
import DataTable from '@/reusablefiles/datatable';
import InputBox from '@/reusablefiles/inputbox';
import { PageHead } from '@/reusablefiles/dashboardshell';

import { useToast } from '@/context/ToastContext';
import useResourceRecord from '@/hooks/useResourceRecord';
import { journalEntriesService } from '@/services/masterdata.service';
import { sumMinorUnits } from '@/lib/minorUnits';

export default function JournalEntryDetailPage() {
  const t = useTranslations('journalEntries');
  const tShared = useTranslations('masterData');
  const { id } = useParams();
  const toast = useToast();

  const { record: entry, loading, error, refetch } = useResourceRecord(journalEntriesService, id);

  const [reversing, setReversing] = useState(false);
  const [showReverse, setShowReverse] = useState(false);
  const [reason, setReason] = useState('');
  const [reversalDate, setReversalDate] = useState(new Date().toISOString().slice(0, 10));

  const lines = entry?.lines ?? [];
  const totalDebitMinor = useMemo(() => sumMinorUnits(lines.map((l) => l.debit)), [lines]);
  const totalCreditMinor = useMemo(() => sumMinorUnits(lines.map((l) => l.credit)), [lines]);

  const columns = useMemo(
    () => [
      { key: 'line_no', header: t('lines.lineNo'), width: 40 },
      {
        key: 'account',
        header: t('lines.account'),
        render: (line) => (
          <span className="md-cell-strong">{line.account_code} · {line.account_name}</span>
        ),
      },
      {
        key: 'partner_contact_name',
        header: t('lines.partner'),
        render: (line) => <Maybe value={line.partner_contact_name} />,
      },
      {
        key: 'analytic_account_name',
        header: t('lines.analytic'),
        render: (line) => <Maybe value={line.analytic_account_name} />,
      },
      {
        key: 'description',
        header: t('lines.description'),
        render: (line) => <Maybe value={line.description} />,
      },
      {
        key: 'debit',
        header: t('lines.debit'),
        align: 'right',
        render: (line) => (line.debit === '0.00' ? '—' : <MoneyText value={line.debit} />),
      },
      {
        key: 'credit',
        header: t('lines.credit'),
        align: 'right',
        render: (line) => (line.credit === '0.00' ? '—' : <MoneyText value={line.credit} />),
      },
    ],
    [t],
  );

  const handleReverse = async () => {
    setReversing(true);
    try {
      await journalEntriesService.reverse(id, {
        reason: reason.trim() || null,
        reversal_date: reversalDate,
      });
      setShowReverse(false);
      setReason('');
      refetch();
      toast.success(tShared('toast.updated'));
    } catch (err) {
      toast.error(err?.message || tShared('toast.error'));
    } finally {
      setReversing(false);
    }
  };

  if (loading) {
    return (
      <MasterDataFrame activeKey="journalEntries">
        <div className="md-page">
          <Card className="md-panel">
            <CardBody>
              <Skeleton w="34%" h={20} />
              <Skeleton w="60%" h={12} style={{ marginTop: 12 }} />
              <Skeleton w="46%" h={12} style={{ marginTop: 8 }} />
            </CardBody>
          </Card>
        </div>
      </MasterDataFrame>
    );
  }

  if (error || !entry) {
    return (
      <MasterDataFrame activeKey="journalEntries">
        <div className="md-page">
          <Card className="md-panel">
            <ListState
              title={tShared('states.notFound')}
              body={error || tShared('states.errorBody')}
              action={
                <Button variant="ghost" size="sm" href="/dashboard/journal-entries">
                  {tShared('actions.back')}
                </Button>
              }
            />
          </Card>
        </div>
      </MasterDataFrame>
    );
  }

  const canReverse = entry.status === 'posted';

  return (
    <MasterDataFrame activeKey="journalEntries">
      <div className="md-page">
        <PageHead
          badge={t('badge')}
          title={entry.entry_number}
          subtitle={entry.journal_name}
          actions={
            <>
              <Button variant="ghost" size="sm" href="/dashboard/journal-entries">
                {tShared('actions.back')}
              </Button>

              {canReverse && !showReverse ? (
                <Button variant="primary" size="sm" onClick={() => setShowReverse(true)}>
                  {t('actions.reverse')}
                </Button>
              ) : null}
            </>
          }
        />

        <Card className="md-panel">
          <CardBody>
            <div className="md-entry-meta">
              <Pill tone={entry.status === 'posted' ? 'strong' : 'soft'} size="sm" dot>
                {t(`status.${entry.status}`)}
              </Pill>
              <Pill tone="mid" size="sm">
                {entry.is_auto_generated ? t('source.auto') : t('source.manual')}
              </Pill>
            </div>

            <div className="md-facts">
              <Fact label={t('fields.entryNumber')}>
                <span className="md-cell-code">{entry.entry_number}</span>
              </Fact>
              <Fact label={t('fields.entryDate')}>
                {entry.entry_date ? String(entry.entry_date).slice(0, 10) : null}
              </Fact>
              <Fact label={t('fields.journal')}>{entry.journal_name}</Fact>
              <Fact label={t('fields.reference')}>{entry.reference}</Fact>
              <Fact label={t('fields.narration')}>{entry.narration}</Fact>

              {entry.reversed_by_entry_number ? (
                <Fact label={t('reversedBy')}>
                  <span className="md-cell-code">{entry.reversed_by_entry_number}</span>
                </Fact>
              ) : null}
            </div>

            <p className="md-form-hint">{t('immutableNote')}</p>
          </CardBody>
        </Card>

        <Card tone="plain" className="md-panel">
          <CardHead title={t('lines.title')} />
          <div className="md-panel-body">
            <DataTable
              columns={columns}
              rows={lines}
              rowKey={(line) => line.id}
              emptyLabel={tShared('states.emptyBody')}
            />

            {/* The same footer the entry form uses. A posted entry always
                balances — the database would not have accepted it otherwise —
                so this reads as confirmation rather than a warning. */}
            <EntryTotals
              totalDebitMinor={totalDebitMinor}
              totalCreditMinor={totalCreditMinor}
            />
          </div>
        </Card>

        {showReverse ? (
          <Card className="md-panel">
            <CardHead title={t('reverse.title')} />
            <CardBody>
              <p className="md-portal-note">{t('reverse.note')}</p>

              <div className="md-form-grid">
                <InputBox
                  label={t('reverse.reason')}
                  value={reason}
                  onChange={setReason}
                  placeholder={t('reverse.reasonPlaceholder')}
                  disabled={reversing}
                />
                <InputBox
                  type="date"
                  label={t('reverse.date')}
                  value={reversalDate}
                  onChange={setReversalDate}
                  disabled={reversing}
                />
              </div>

              <div className="md-form-actions">
                <Button
                  variant="primary"
                  size="sm"
                  loading={reversing}
                  disabled={reversing}
                  onClick={handleReverse}
                >
                  {reversing ? t('actions.reversing') : t('reverse.confirm')}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={reversing}
                  onClick={() => setShowReverse(false)}
                >
                  {tShared('actions.cancel')}
                </Button>
              </div>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </MasterDataFrame>
  );
}
