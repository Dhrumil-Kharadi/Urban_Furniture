'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/accounts/[id]/page.jsx
//
// Chart of Accounts detail.
//
// A system account shows the reason it cannot be archived or retyped rather
// than just failing when someone tries — the ledger posts to these by role, so
// the constraint is worth explaining where it applies.
// ============================================================

import React from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import ResourceDetailPage from '@/components/masterdata/ResourceDetailPage';
import AccountForm from '@/components/accounts/AccountForm';
import { Fact, StatusPill, MoneyText } from '@/components/masterdata/Cells';
import Pill from '@/reusablefiles/pill';
import { accountsService } from '@/services/masterdata.service';

export default function AccountDetailPage() {
  const t = useTranslations('accounts');
  const tShared = useTranslations('masterData');
  const { id } = useParams();

  return (
    <ResourceDetailPage
      service={accountsService}
      id={id}
      activeKey="accounts"
      listHref="/dashboard/accounts"
      labels={{
        badge: t('badge'),
        title: (account) => `${account.code} · ${account.name}`,
        subtitle: (account) => t(`types.${account.account_type}`),
      }}
      renderFacts={(account) => (
        <>
          <div className="md-facts">
            <Fact label={t('fields.code')}>
              <span className="md-cell-code">{account.code}</span>
            </Fact>
            <Fact label={t('fields.name')}>{account.name}</Fact>
            <Fact label={t('fields.type')}>
              <Pill tone="mid" size="sm">{t(`types.${account.account_type}`)}</Pill>
            </Fact>
            <Fact label={t('fields.parent')}>{account.parent_account_name}</Fact>
            <Fact label={t('fields.openingBalance')} money>
              <MoneyText value={account.opening_balance} />
            </Fact>
            <Fact label={t('fields.system')}>
              {account.is_system ? t('yes') : t('no')}
            </Fact>
            <Fact label={t('fields.status')}>
              <StatusPill status={account.status} label={tShared(`status.${account.status}`)} />
            </Fact>
          </div>

          {account.is_system ? <p className="md-form-hint">{t('systemNote')}</p> : null}
        </>
      )}
      renderForm={({ record, ...rest }) => (
        <AccountForm account={record} isEdit {...rest} />
      )}
    />
  );
}
