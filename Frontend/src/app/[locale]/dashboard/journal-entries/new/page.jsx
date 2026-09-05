'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/journal-entries/new/page.jsx
//
// Post a manual journal entry.
//
// It posts immediately — there is no draft step at this surface. A draft that
// can never be edited into balance is not useful, and one that could would
// need an edit path this phase deliberately does not build.
// ============================================================

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';
import MasterDataFrame from '@/components/masterdata/MasterDataFrame';
import ManualEntryForm from '@/components/journal-entries/ManualEntryForm';
import Card, { CardBody } from '@/reusablefiles/card';
import { PageHead } from '@/reusablefiles/dashboardshell';
import { useToast } from '@/context/ToastContext';
import { journalEntriesService } from '@/services/masterdata.service';

export default function NewJournalEntryPage() {
  const t = useTranslations('journalEntries');
  const tShared = useTranslations('masterData');
  const router = useRouter();
  const toast = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setServerErrors([]);

    try {
      const entry = await journalEntriesService.create(payload);
      toast.success(tShared('toast.created'));
      router.replace(`/dashboard/journal-entries/${entry.id}`);
    } catch (err) {
      // A 422 here is the server's own balance check disagreeing with the
      // client's. The server wins, and its sentence is what gets shown.
      setServerErrors(err?.errors?.length ? err.errors : [err?.message || tShared('toast.error')]);
      setSubmitting(false);
    }
  };

  return (
    <MasterDataFrame activeKey="journalEntries">
      <div className="md-page">
        <PageHead badge={t('badge')} title={t('new.title')} subtitle={t('new.subtitle')} />

        <Card className="md-panel">
          <CardBody>
            <ManualEntryForm
              onSubmit={handleSubmit}
              cancelHref="/dashboard/journal-entries"
              serverErrors={serverErrors}
              submitting={submitting}
            />
          </CardBody>
        </Card>
      </div>
    </MasterDataFrame>
  );
}
