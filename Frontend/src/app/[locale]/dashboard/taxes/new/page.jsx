'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/taxes/new/page.jsx
//
// Create a tax rate. Both roles may create master data (project.md §3).
// ============================================================

import React from 'react';
import { useTranslations } from 'next-intl';

import ResourceNewPage from '@/components/masterdata/ResourceNewPage';
import TaxForm from '@/components/taxes/TaxForm';
import { taxesService } from '@/services/masterdata.service';

export default function NewTaxPage() {
  const t = useTranslations('taxes');

  return (
    <ResourceNewPage
      service={taxesService}
      activeKey="taxes"
      listHref="/dashboard/taxes"
      labels={{
        badge: t('badge'),
        title: t('new.title'),
        subtitle: t('new.subtitle'),
      }}
      renderForm={(props) => <TaxForm {...props} />}
    />
  );
}
