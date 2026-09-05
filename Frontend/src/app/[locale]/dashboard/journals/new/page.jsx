'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/journals/new/page.jsx
//
// Create a journal. Both roles may create master data (project.md §3).
// ============================================================

import React from 'react';
import { useTranslations } from 'next-intl';

import ResourceNewPage from '@/components/masterdata/ResourceNewPage';
import JournalForm from '@/components/journals/JournalForm';
import { journalsService } from '@/services/masterdata.service';

export default function NewJournalPage() {
  const t = useTranslations('journals');

  return (
    <ResourceNewPage
      service={journalsService}
      activeKey="journals"
      listHref="/dashboard/journals"
      labels={{
        badge: t('badge'),
        title: t('new.title'),
        subtitle: t('new.subtitle'),
      }}
      renderForm={(props) => <JournalForm {...props} />}
    />
  );
}
