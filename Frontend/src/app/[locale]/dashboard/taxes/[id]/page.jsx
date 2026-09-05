'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/taxes/[id]/page.jsx
//
// Tax detail.
//
// Changing a rate affects documents raised from now on and nothing already
// posted — a posted line stores the rate it was taxed at, the same way it
// stores the price it was sold at.
// ============================================================

import React from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import ResourceDetailPage from '@/components/masterdata/ResourceDetailPage';
import TaxForm from '@/components/taxes/TaxForm';
import { Fact, StatusPill } from '@/components/masterdata/Cells';
import Pill from '@/reusablefiles/pill';
import { taxesService } from '@/services/masterdata.service';

/** Trim the stored 4dp scale for display. */
function formatRate(rate) {
  if (rate === null || rate === undefined) return null;
  return `${String(rate).replace(/\.?0+$/, '')}%`;
}

export default function TaxDetailPage() {
  const t = useTranslations('taxes');
  const tShared = useTranslations('masterData');
  const { id } = useParams();

  return (
    <ResourceDetailPage
      service={taxesService}
      id={id}
      activeKey="taxes"
      listHref="/dashboard/taxes"
      labels={{
        badge: t('badge'),
        title: (tax) => tax.name,
        subtitle: (tax) => t(`scopes.${tax.tax_scope}`),
      }}
      renderFacts={(tax) => (
        <>
          <div className="md-facts">
            <Fact label={t('fields.name')}>{tax.name}</Fact>
            <Fact label={t('fields.rate')} money>{formatRate(tax.rate)}</Fact>
            <Fact label={t('fields.scope')}>
              <Pill tone="mid" size="sm">{t(`scopes.${tax.tax_scope}`)}</Pill>
            </Fact>
            <Fact label={t('fields.account')}>
              {tax.tax_account_name
                ? `${tax.tax_account_code} · ${tax.tax_account_name}`
                : null}
            </Fact>
            <Fact label={t('fields.status')}>
              <StatusPill status={tax.status} label={tShared(`status.${tax.status}`)} />
            </Fact>
          </div>

          <p className="md-form-hint">{t('accountNote')}</p>
        </>
      )}
      renderForm={({ record, ...rest }) => (
        <TaxForm tax={record} isEdit {...rest} />
      )}
    />
  );
}
