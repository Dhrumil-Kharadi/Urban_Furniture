'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/contacts/new/page.jsx
//
// Create a contact. Both the business owner and the accountant may create
// master data (project.md §3).
// ============================================================

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';
import MasterDataFrame from '@/components/masterdata/MasterDataFrame';
import ContactForm from '@/components/contacts/ContactForm';
import Card, { CardBody } from '@/reusablefiles/card';
import { PageHead } from '@/reusablefiles/dashboardshell';
import { useToast } from '@/context/ToastContext';
import { contactsService } from '@/services/masterdata.service';

export default function NewContactPage() {
  const t = useTranslations('contacts');
  const tShared = useTranslations('masterData');
  const router = useRouter();
  const toast = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setServerErrors([]);

    try {
      const contact = await contactsService.create(payload);
      toast.success(tShared('toast.created'));
      router.replace(`/dashboard/contacts/${contact.id}`);
    } catch (err) {
      // Field errors come back as a list; a rule violation comes back as one
      // sentence. Show whichever the server actually sent.
      setServerErrors(err?.errors?.length ? err.errors : [err?.message || tShared('toast.error')]);
      setSubmitting(false);
    }
  };

  return (
    <MasterDataFrame activeKey="contacts">
      <div className="md-page">
        <PageHead
          badge={t('badge')}
          title={t('new.title')}
          subtitle={t('new.subtitle')}
        />

        <Card className="md-panel">
          <CardBody>
            <ContactForm
              onSubmit={handleSubmit}
              cancelHref="/dashboard/contacts"
              serverErrors={serverErrors}
              submitting={submitting}
            />
          </CardBody>
        </Card>
      </div>
    </MasterDataFrame>
  );
}
