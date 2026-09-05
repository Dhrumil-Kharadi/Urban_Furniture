'use client';

// ============================================================
// FILE: src/components/masterdata/ResourceDetailPage.jsx
//
// The master-data detail page, once.
//
// Eight resources — accounts, journals, taxes, analytic accounts, contacts,
// products, categories — share the same detail behaviour: load one record,
// show its facts, let an admin flip into an edit form, let an admin archive or
// restore it, and surface the server's 409 sentence when archiving is refused.
// Only the facts and the form differ, so those are the two render props.
//
// Writing this eight times would mean fixing every detail-page bug eight
// times, and the archive-refusal path is exactly the one that gets fixed in
// six places and forgotten in the other two.
// ============================================================

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

import Card, { CardBody } from '@/reusablefiles/card';
import Button from '@/reusablefiles/button';
import Skeleton from '@/reusablefiles/skeleton';
import { PageHead } from '@/reusablefiles/dashboardshell';

import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import useResourceRecord from '@/hooks/useResourceRecord';
import MasterDataFrame from './MasterDataFrame';
import { ListState } from './ListChrome';

/**
 * @param {object}   props
 * @param {object}   props.service
 * @param {string}   props.id
 * @param {string}   props.activeKey  - Sidebar entry to highlight.
 * @param {string}   props.listHref
 * @param {object}   props.labels     - { badge, title(record), subtitle(record) }
 * @param {Function} props.renderFacts - (record) => ReactNode
 * @param {Function} props.renderForm  - ({ record, onSubmit, submitting, serverErrors, cancelHref }) => ReactNode
 * @param {React.ReactNode} [props.aside] - Optional right-hand column.
 */
export default function ResourceDetailPage({
  service,
  id,
  activeKey,
  listHref,
  labels,
  renderFacts,
  renderForm,
  aside = null,
}) {
  const tShared = useTranslations('masterData');
  const toast = useToast();
  const { role } = useAuth();

  // project.md §3 as finalised by §10 Decision 1: modify and archive are the
  // business owner's alone. The server enforces it; hiding the controls just
  // stops offering an accountant a button that would 403.
  const canManage = role === 'business_owner';

  const { record, loading, error, refetch } = useResourceRecord(service, id);

  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);
  const [statusBusy, setStatusBusy] = useState(false);

  const handleSave = async (payload) => {
    setSubmitting(true);
    setServerErrors([]);

    try {
      await service.update(id, payload);
      refetch();
      setEditing(false);
      toast.success(tShared('toast.updated'));
    } catch (err) {
      setServerErrors(err?.errors?.length ? err.errors : [err?.message || tShared('toast.error')]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatus = async () => {
    const archiving = record.status === 'active';
    setStatusBusy(true);

    try {
      if (archiving) await service.archive(id);
      else await service.unarchive(id);

      refetch();
      toast.success(tShared(archiving ? 'toast.archived' : 'toast.unarchived'));
    } catch (err) {
      // A 409 here is a guard doing its job — a system account, the last
      // journal of its type, a row something still points at. The server's
      // sentence names the blocker, so it is shown verbatim.
      toast.error(err?.message || tShared('toast.error'));
    } finally {
      setStatusBusy(false);
    }
  };

  if (loading) {
    return (
      <MasterDataFrame activeKey={activeKey}>
        <div className="md-page">
          <Card className="md-panel">
            <CardBody>
              <Skeleton w="34%" h={20} />
              <Skeleton w="60%" h={12} style={{ marginTop: 12 }} />
              <Skeleton w="46%" h={12} style={{ marginTop: 8 }} />
            </CardBody>
          </Card>
        </div>
      </MasterDataFrame>
    );
  }

  if (error || !record) {
    return (
      <MasterDataFrame activeKey={activeKey}>
        <div className="md-page">
          <Card className="md-panel">
            <ListState
              title={tShared('states.notFound')}
              body={error || tShared('states.errorBody')}
              action={
                <Button variant="ghost" size="sm" href={listHref}>
                  {tShared('actions.back')}
                </Button>
              }
            />
          </Card>
        </div>
      </MasterDataFrame>
    );
  }

  const detail = (
    <Card className="md-panel">
      <CardBody>
        {editing
          ? renderForm({
              record,
              onSubmit: handleSave,
              submitting,
              serverErrors,
              cancelHref: `${listHref}/${record.id}`,
            })
          : renderFacts(record)}
      </CardBody>
    </Card>
  );

  return (
    <MasterDataFrame activeKey={activeKey}>
      <div className="md-page">
        <PageHead
          badge={labels.badge}
          title={labels.title(record)}
          subtitle={labels.subtitle ? labels.subtitle(record) : undefined}
          actions={
            <>
              <Button variant="ghost" size="sm" href={listHref}>
                {tShared('actions.back')}
              </Button>

              {canManage && !editing ? (
                <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
                  {tShared('actions.edit')}
                </Button>
              ) : null}

              {canManage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={statusBusy}
                  disabled={statusBusy}
                  onClick={handleStatus}
                >
                  {tShared(record.status === 'active' ? 'actions.archive' : 'actions.unarchive')}
                </Button>
              ) : null}
            </>
          }
        />

        {aside ? (
          <div className="md-detail-grid">
            {detail}
            <div className="md-page">{aside}</div>
          </div>
        ) : (
          detail
        )}
      </div>
    </MasterDataFrame>
  );
}
