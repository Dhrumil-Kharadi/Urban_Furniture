'use client';

// ============================================================
// FILE: src/components/masterdata/ResourceNewPage.jsx
//
// The master-data create page, once.
//
// Every one of them does the same three things: render a form, POST it, and
// go to the new record's detail page. The only variable is the form, so that
// is the render prop.
//
// The submit button is disabled while the request is in flight (see
// FormShell) — a double-submitted record is a duplicate, and on a document it
// would be a double posting.
// ============================================================

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';
import Card, { CardBody } from '@/reusablefiles/card';
import { PageHead } from '@/reusablefiles/dashboardshell';
import { useToast } from '@/context/ToastContext';
import MasterDataFrame from './MasterDataFrame';

/**
 * @param {object}   props
 * @param {object}   props.service
 * @param {string}   props.activeKey
 * @param {string}   props.listHref
 * @param {object}   props.labels - { badge, title, subtitle }
 * @param {Function} props.renderForm - ({ onSubmit, submitting, serverErrors, cancelHref }) => ReactNode
 */
export default function ResourceNewPage({
  service,
  activeKey,
  listHref,
  labels,
  renderForm,
}) {
  const tShared = useTranslations('masterData');
  const router = useRouter();
  const toast = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setServerErrors([]);

    try {
      const record = await service.create(payload);
      toast.success(tShared('toast.created'));
      router.replace(`${listHref}/${record.id}`);
    } catch (err) {
      // Field errors arrive as a list; a rule violation arrives as one
      // sentence. Show whichever the server actually sent.
      setServerErrors(err?.errors?.length ? err.errors : [err?.message || tShared('toast.error')]);
      setSubmitting(false);
    }
  };

  return (
    <MasterDataFrame activeKey={activeKey}>
      <div className="md-page">
        <PageHead badge={labels.badge} title={labels.title} subtitle={labels.subtitle} />

        <Card className="md-panel">
          <CardBody>
            {renderForm({
              onSubmit: handleSubmit,
              submitting,
              serverErrors,
              cancelHref: listHref,
            })}
          </CardBody>
        </Card>
      </div>
    </MasterDataFrame>
  );
}
