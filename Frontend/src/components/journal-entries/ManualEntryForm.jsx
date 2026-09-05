'use client';

// ============================================================
// FILE: src/components/journal-entries/ManualEntryForm.jsx
//
// Post a manual journal entry.
//
// Three behaviours here are not cosmetic:
//
//   1. Typing in DEBIT clears CREDIT and vice versa. A line is one side or the
//      other — the database CHECK constraint says so — and letting someone
//      fill both only to be told no at submit time wastes their work.
//
//   2. The live balance indicator updates on every keystroke, in exact integer
//      paise. Not floats: 0.1 + 0.2 would show a balanced entry as off.
//
//   3. SAVE IS DISABLED WHILE UNBALANCED. The client mirrors the server rule
//      purely for fast feedback — THE SERVER REMAINS THE AUTHORITY, re-checks
//      through decimal.js, and the database checks it a third time in a
//      deferrable trigger. Disabling the button is a courtesy, not the
//      control.
//
// Submit is also disabled in flight: a double-posted entry hits the ledger
// twice, and the ledger has no undo — only a reversing entry.
// ============================================================

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';

import InputBox from '@/reusablefiles/inputbox';
import Button from '@/reusablefiles/button';
import AccountPicker from '@/components/masterdata/AccountPicker';
import ResourcePicker from '@/components/masterdata/ResourcePicker';
import EntryTotals from './EntryTotals';
import {
  journalsService,
  contactsService,
  analyticAccountsService,
} from '@/services/masterdata.service';
import { sumMinorUnits, isAmountInput } from '@/lib/minorUnits';

/** A journal entry starts with two empty lines, because it needs at least two. */
function emptyLine() {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    account_id: '',
    partner_contact_id: '',
    analytic_account_id: '',
    debit: '',
    credit: '',
    description: '',
  };
}

/**
 * @param {object}   props
 * @param {Function} props.onSubmit
 * @param {string}   props.cancelHref
 * @param {string[]} [props.serverErrors]
 * @param {boolean}  [props.submitting]
 */
export default function ManualEntryForm({
  onSubmit,
  cancelHref,
  serverErrors = [],
  submitting = false,
}) {
  const t = useTranslations('journalEntries');
  const tShared = useTranslations('masterData');

  const [header, setHeader] = useState({
    journal_id: '',
    entry_date: new Date().toISOString().slice(0, 10),
    reference: '',
    narration: '',
  });
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);
  const [localErrors, setLocalErrors] = useState([]);

  const setHeaderField = (field) => (value) =>
    setHeader((current) => ({ ...current, [field]: value }));

  const updateLine = useCallback((key, field, value) => {
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line;

        // Rule 1: the two sides are mutually exclusive.
        if (field === 'debit') return { ...line, debit: value, credit: value ? '' : line.credit };
        if (field === 'credit') return { ...line, credit: value, debit: value ? '' : line.debit };

        return { ...line, [field]: value };
      }),
    );
  }, []);

  const handleAmountChange = useCallback(
    (key, field) => (value) => {
      // Reject a keystroke that could not become a valid amount, rather than
      // accepting it and failing at submit.
      if (!isAmountInput(value)) return;
      updateLine(key, field, value);
    },
    [updateLine],
  );

  const addLine = () => setLines((current) => [...current, emptyLine()]);

  const removeLine = (key) =>
    // Never below two: an entry with one line is not a double entry.
    setLines((current) => (current.length <= 2 ? current : current.filter((l) => l.key !== key)));

  const totalDebitMinor = useMemo(() => sumMinorUnits(lines.map((l) => l.debit)), [lines]);
  const totalCreditMinor = useMemo(() => sumMinorUnits(lines.map((l) => l.credit)), [lines]);

  const balanced = totalDebitMinor === totalCreditMinor;
  const hasAmount = totalDebitMinor > 0;
  const allLinesComplete = lines.every(
    (line) => line.account_id && (line.debit || line.credit),
  );

  // Rule 3. Note what this does NOT do: it never enables the button on the
  // strength of the client's arithmetic alone — the server decides.
  const canSubmit =
    balanced && hasAmount && allLinesComplete && Boolean(header.journal_id) && !submitting;

  const validate = () => {
    const errors = [];

    if (!header.journal_id) errors.push(`${t('fields.journal')} — ${tShared('form.required')}`);
    if (!header.entry_date) errors.push(`${t('fields.entryDate')} — ${tShared('form.required')}`);
    if (!allLinesComplete) errors.push(t('lines.noAccount'));
    if (!balanced || !hasAmount) errors.push(t('totals.unbalanced'));

    setLocalErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting || !validate()) return;

    onSubmit({
      journal_id: header.journal_id,
      entry_date: header.entry_date,
      reference: header.reference.trim() || null,
      narration: header.narration.trim() || null,
      lines: lines.map((line) => ({
        account_id: line.account_id,
        partner_contact_id: line.partner_contact_id || null,
        analytic_account_id: line.analytic_account_id || null,
        // Amounts stay STRINGS all the way to the server.
        debit: line.debit || '0',
        credit: line.credit || '0',
        description: line.description.trim() || null,
      })),
    });
  };

  /** The per-line controls, shared by the table and the stacked-card layout. */
  const lineFields = (line) => ({
    account: (
      <AccountPicker
        label={null}
        value={line.account_id}
        onChange={(value) => updateLine(line.key, 'account_id', value)}
        emptyLabel={t('lines.noAccount')}
        disabled={submitting}
      />
    ),
    partner: (
      <ResourcePicker
        service={contactsService}
        label={null}
        value={line.partner_contact_id}
        onChange={(value) => updateLine(line.key, 'partner_contact_id', value)}
        emptyLabel={t('lines.noPartner')}
        disabled={submitting}
      />
    ),
    analytic: (
      <ResourcePicker
        service={analyticAccountsService}
        label={null}
        value={line.analytic_account_id}
        onChange={(value) => updateLine(line.key, 'analytic_account_id', value)}
        emptyLabel={t('lines.noAnalytic')}
        disabled={submitting}
      />
    ),
    debit: (
      <div className="md-line-amount">
        <InputBox
          value={line.debit}
          onChange={handleAmountChange(line.key, 'debit')}
          placeholder="0.00"
          inputMode="decimal"
          disabled={submitting}
        />
      </div>
    ),
    credit: (
      <div className="md-line-amount">
        <InputBox
          value={line.credit}
          onChange={handleAmountChange(line.key, 'credit')}
          placeholder="0.00"
          inputMode="decimal"
          disabled={submitting}
        />
      </div>
    ),
    remove: (
      <Button
        variant="icon"
        size="sm"
        ariaLabel={t('lines.removeLine')}
        disabled={lines.length <= 2 || submitting}
        onClick={() => removeLine(line.key)}
        icon={<Trash2 size={15} strokeWidth={1.9} aria-hidden="true" />}
      />
    ),
  });

  return (
    <form className="md-form" onSubmit={handleSubmit} noValidate>
      {[...localErrors, ...serverErrors].length > 0 ? (
        <ul className="md-form-errors">
          {[...localErrors, ...serverErrors].map((message) => (
            <li className="md-form-error" key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      {/* ── Header ── */}
      <div className="md-form-grid">
        <ResourcePicker
          service={journalsService}
          label={t('fields.journal')}
          value={header.journal_id}
          onChange={setHeaderField('journal_id')}
          emptyLabel={t('filters.allJournals')}
          disabled={submitting}
        />

        <InputBox
          type="date"
          label={t('fields.entryDate')}
          value={header.entry_date}
          onChange={setHeaderField('entry_date')}
          disabled={submitting}
        />

        <InputBox
          label={t('fields.reference')}
          value={header.reference}
          onChange={setHeaderField('reference')}
          placeholder={t('placeholders.reference')}
          disabled={submitting}
        />

        <InputBox
          label={t('fields.narration')}
          value={header.narration}
          onChange={setHeaderField('narration')}
          placeholder={t('placeholders.narration')}
          disabled={submitting}
        />
      </div>

      {/* ── Lines: table at desktop widths ── */}
      <div>
        <p className="md-form-section-title">{t('lines.title')}</p>

        <table className="md-line-grid">
          <thead>
            <tr>
              <th style={{ width: 32 }}>{t('lines.lineNo')}</th>
              <th>{t('lines.account')}</th>
              <th>{t('lines.partner')}</th>
              <th>{t('lines.analytic')}</th>
              <th className="is-amount" style={{ width: 130 }}>{t('lines.debit')}</th>
              <th className="is-amount" style={{ width: 130 }}>{t('lines.credit')}</th>
              <th aria-label={t('lines.removeLine')} />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const fields = lineFields(line);
              return (
                <tr key={line.key}>
                  <td className="md-line-no">{index + 1}</td>
                  <td>{fields.account}</td>
                  <td>{fields.partner}</td>
                  <td>{fields.analytic}</td>
                  <td>{fields.debit}</td>
                  <td>{fields.credit}</td>
                  <td className="md-line-actions">{fields.remove}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── Lines: stacked cards below 768px, per the responsive contract ── */}
        <div className="md-line-cards">
          {lines.map((line, index) => {
            const fields = lineFields(line);
            return (
              <div className="md-line-card" key={line.key}>
                <div className="md-line-card-head">
                  <span className="md-line-no">{index + 1}</span>
                  {fields.remove}
                </div>
                {fields.account}
                {fields.partner}
                {fields.analytic}
                <div className="md-form-grid">
                  <div>
                    <span className="md-total-label">{t('lines.debit')}</span>
                    {fields.debit}
                  </div>
                  <div>
                    <span className="md-total-label">{t('lines.credit')}</span>
                    {fields.credit}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="md-form-actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={addLine}
            disabled={submitting}
            icon={<Plus size={15} strokeWidth={2} aria-hidden="true" />}
          >
            {t('lines.addLine')}
          </Button>
        </div>
      </div>

      {/* ── Running totals ── */}
      <EntryTotals totalDebitMinor={totalDebitMinor} totalCreditMinor={totalCreditMinor} />

      <div className="md-form-actions">
        <Button type="submit" variant="primary" loading={submitting} disabled={!canSubmit}>
          {submitting ? t('actions.posting') : t('actions.post')}
        </Button>

        <Button variant="ghost" href={cancelHref}>
          {tShared('actions.cancel')}
        </Button>
      </div>

      <p className="md-form-hint">{t('immutableNote')}</p>
    </form>
  );
}
