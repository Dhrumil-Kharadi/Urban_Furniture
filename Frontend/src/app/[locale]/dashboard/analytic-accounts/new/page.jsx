'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/analytic-accounts/new/page.jsx
//
// Create an analytic account. Both roles may create master data
// (project.md §3).
// ============================================================

import React from 'react';
import { useTranslations } from 'next-intl';

import ResourceNewPage from '@/components/masterdata/ResourceNewPage';
import AnalyticAccountForm from '@/components/analytic-accounts/AnalyticAccountForm';
import { analyticAccountsService } from '@/services/masterdata.service';

export default function NewAnalyticAccountPage() {
  const t = useTranslations('analyticAccounts');

  return (
    <ResourceNewPage
      service={analyticAccountsService}
      activeKey="analyticAccounts"
      listHref="/dashboard/analytic-accounts"
      labels={{
        badge: t('badge'),
        title: t('new.title'),
        subtitle: t('new.subtitle'),
      }}
      renderForm={(props) => <AnalyticAccountForm {...props} />}
    />
  );
}
