'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import MasterDataFrame from '@/components/masterdata/MasterDataFrame';
import { MoneyText } from '@/components/masterdata/Cells';
import reportsService from '@/services/reports.service';
import { accountsService, journalsService } from '@/services/masterdata.service';

const initialFilters = { search: '', accountId: '', journalId: '', dateFrom: '', dateTo: '' };

export default function GeneralLedgerReportPage() {
  const t = useTranslations('reports.generalLedger');
  const tReports = useTranslations('reports');
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    reportsService.getGeneralLedger({ ...appliedFilters, page: 1, limit: 100 })
      .then((res) => {
        if (!active) return;
        const data = res?.data || res;
        setRows(data?.items || []);
        setPagination(data?.pagination || null);
        setError(null);
      })
      .catch((requestError) => {
        if (active) setError(requestError?.message || t('loadError'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [appliedFilters, t]);

  useEffect(() => {
    let active = true;
    Promise.all([
      accountsService.list({ status: 'active', limit: 200 }),
      journalsService.list({ status: 'active', limit: 100 }),
    ]).then(([accountData, journalData]) => {
      if (!active) return;
      setAccounts(accountData?.items || []);
      setJournals(journalData?.items || []);
    }).catch(() => {
      // The report remains usable with date and text filters if lookups fail.
    });
    return () => { active = false; };
  }, []);

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <MasterDataFrame activeKey="reports">
      <div className="report-container">
        <div className="report-header">
          <div className="report-header-row">
            <Link href="/dashboard/reports" className="budget-back-btn" aria-label={tReports('back')}>
              <ArrowLeft size={18} />
            </Link>
            <div className="report-header-content">
              <span className="report-badge">{tReports('badge')}</span>
              <h1 className="report-title">{t('title')}</h1>
              <p className="report-subtitle">{t('subtitle')}</p>
            </div>
          </div>
        </div>

        <form className="report-toolbar" onSubmit={(event) => { event.preventDefault(); setAppliedFilters(filters); }}>
          <label className="report-date-input">
            <span>{t('account')}</span>
            <select value={filters.accountId} onChange={(event) => setFilter('accountId', event.target.value)}>
              <option value="">{t('allAccounts')}</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
            </select>
          </label>
          <label className="report-date-input">
            <span>{t('journal')}</span>
            <select value={filters.journalId} onChange={(event) => setFilter('journalId', event.target.value)}>
              <option value="">{t('allJournals')}</option>
              {journals.map((journal) => <option key={journal.id} value={journal.id}>{journal.name}</option>)}
            </select>
          </label>
          <label className="report-date-input">
            <span>{t('search')}</span>
            <div className="report-search-input">
              <Search size={14} aria-hidden="true" />
              <input value={filters.search} onChange={(event) => setFilter('search', event.target.value)} />
            </div>
          </label>
          <label className="report-date-input">
            <span>{t('dateFrom')}</span>
            <input type="date" value={filters.dateFrom} onChange={(event) => setFilter('dateFrom', event.target.value)} />
          </label>
          <label className="report-date-input">
            <span>{t('dateTo')}</span>
            <input type="date" value={filters.dateTo} onChange={(event) => setFilter('dateTo', event.target.value)} />
          </label>
          <button type="submit" className="report-filter-submit">{t('apply')}</button>
        </form>

        {error ? <div className="report-alert-banner unbalanced">{error}</div> : null}
        <div className="report-sheet-card">
          {loading ? <div className="report-state">{tReports('loading')}</div> : null}
          {!loading && !rows.length ? <div className="report-state">{t('empty')}</div> : null}
          {!loading && rows.length ? (
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>{t('date')}</th>
                    <th>{t('entry')}</th>
                    <th>{t('account')}</th>
                    <th>{t('journal')}</th>
                    <th>{t('reference')}</th>
                    <th>{t('description')}</th>
                    <th>{t('debit')}</th>
                    <th>{t('credit')}</th>
                    <th>{t('balance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{String(row.entry_date).slice(0, 10)}</td>
                      <td>{row.entry_number}</td>
                      <td>{row.account_code} · {row.account_name}</td>
                      <td>{row.journal_name}</td>
                      <td>{row.reference || t('emptyValue')}</td>
                      <td>{row.description || row.narration || t('emptyValue')}</td>
                      <td><MoneyText value={row.debit} /></td>
                      <td><MoneyText value={row.credit} /></td>
                      <td><MoneyText value={row.running_balance} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {pagination?.total ? <p className="report-state">{pagination.total}</p> : null}
        </div>
      </div>
    </MasterDataFrame>
  );
}
