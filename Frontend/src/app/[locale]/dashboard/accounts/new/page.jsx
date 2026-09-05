'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/accounts/new/page.jsx
//
// Create a Chart of Accounts row. Both roles may create master data
// (project.md §3); only the business owner may edit or archive one.
// ============================================================

import React from 'react';
import { useTranslations } from 'next-intl';

import ResourceNewPage from '@/components/masterdata/ResourceNewPage';
import AccountForm from '@/components/accounts/AccountForm';
import { accountsService } from '@/services/masterdata.service';

export default function NewAccountPage() {
  const t = useTranslations('accounts');

  return (
    <ResourceNewPage
      service={accountsService}
      activeKey="accounts"
      listHref="/dashboard/accounts"
      labels={{
        badge: t('badge'),
        title: t('new.title'),
        subtitle: t('new.subtitle'),
      }}
      renderForm={(props) => <AccountForm {...props} />}
    />
  );
}
