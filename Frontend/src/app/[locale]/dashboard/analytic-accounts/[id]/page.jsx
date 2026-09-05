'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/analytic-accounts/[id]/page.jsx
//
// Analytic account detail.
//
// Archiving one that already carries posted journal lines is refused: those
// lines are the "actual" side of a budget comparison, and hiding the dimension
// they hang off would make an existing Budget Report change its answer.
// ============================================================

import React from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import ResourceDetailPage from '@/components/masterdata/ResourceDetailPage';
import AnalyticAccountForm from '@/components/analytic-accounts/AnalyticAccountForm';
import { Fact, StatusPill } from '@/components/masterdata/Cells';
import Pill from '@/reusablefiles/pill';
import { analyticAccountsService } from '@/services/masterdata.service';

export default function AnalyticAccountDetailPage() {
  const t = useTranslations('analyticAccounts');
  const tShared = useTranslations('masterData');
  const { id } = useParams();

  return (
    <ResourceDetailPage
      service={analyticAccountsService}
      id={id}
      activeKey="analyticAccounts"
      listHref="/dashboard/analytic-accounts"
      labels={{
        badge: t('badge'),
        title: (analytic) => analytic.name,
        subtitle: (analytic) => t(`types.${analytic.analytic_type}`),
      }}
      renderFacts={(analytic) => (
        <>
          <div className="md-facts">
            <Fact label={t('fields.name')}>{analytic.name}</Fact>
            <Fact label={t('fields.code')}>
              {analytic.code ? <span className="md-cell-code">{analytic.code}</span> : null}
            </Fact>
            <Fact label={t('fields.type')}>
              <Pill tone="mid" size="sm">{t(`types.${analytic.analytic_type}`)}</Pill>
            </Fact>
            <Fact label={t('fields.department')}>{analytic.department}</Fact>
            <Fact label={t('fields.status')}>
              <StatusPill status={analytic.status} label={tShared(`status.${analytic.status}`)} />
            </Fact>
          </div>

          <p className="md-form-hint">{t('purposeNote')}</p>
        </>
      )}
      renderForm={({ record, ...rest }) => (
        <AnalyticAccountForm analyticAccount={record} isEdit {...rest} />
      )}
    />
  );
}
