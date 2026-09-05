'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/contacts/[id]/page.jsx
//
// Contact detail — Details / Invoices / Bills / Payments (phase.md Phase 6).
//
// The three transaction tabs exist and say what will fill them. They are
// deliberately not wired to anything: sales, purchases and payments are
// Phases 8 and 9, and an empty tab that explains itself is more honest than
// one that is missing.
//
// Editing and archiving are admin-only (project.md §3 as finalised by §10
// Decision 1). The controls are hidden from an accountant, and the server
// refuses them regardless of what is rendered.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import MasterDataFrame from '@/components/masterdata/MasterDataFrame';
import ContactForm from '@/components/contacts/ContactForm';
import PortalAccessPanel from '@/components/contacts/PortalAccessPanel';
import ProfileImagePanel from '@/components/contacts/ProfileImagePanel';
import { Fact, StatusPill } from '@/components/masterdata/Cells';
import { ListState } from '@/components/masterdata/ListChrome';

import Card, { CardBody } from '@/reusablefiles/card';
import Button from '@/reusablefiles/button';
import Pill from '@/reusablefiles/pill';
import Skeleton from '@/reusablefiles/skeleton';
import { PageHead } from '@/reusablefiles/dashboardshell';

import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import useResourceRecord from '@/hooks/useResourceRecord';
import { contactsService } from '@/services/masterdata.service';

const TABS = ['details', 'invoices', 'bills', 'payments'];

export default function ContactDetailPage() {
  const t = useTranslations('contacts');
  const tShared = useTranslations('masterData');
  const { id } = useParams();
  const toast = useToast();
  const { role } = useAuth();

  const canManage = role === 'business_owner';

  const { record: contact, loading, error, refetch, setRecord } =
    useResourceRecord(contactsService, id);

  const [tab, setTab] = useState('details');
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);
  const [statusBusy, setStatusBusy] = useState(false);

  const handleSave = async (payload) => {
    setSubmitting(true);
    setServerErrors([]);

    try {
      await contactsService.update(id, payload);
      // Re-fetch rather than trusting the PATCH response: the detail view
      // carries the portal-user block, which the update endpoint does not.
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
    const archiving = contact.status === 'active';
    setStatusBusy(true);

    try {
      if (archiving) await contactsService.archive(id);
      else await contactsService.unarchive(id);

      refetch();
      toast.success(tShared(archiving ? 'toast.archived' : 'toast.unarchived'));
    } catch (err) {
      toast.error(err?.message || tShared('toast.error'));
    } finally {
      setStatusBusy(false);
    }
  };

  const tabs = useMemo(
    () =>
      TABS.map((key) => (
        <button
          key={key}
          type="button"
          className={`md-tab${tab === key ? ' is-active' : ''}`}
          onClick={() => setTab(key)}
          aria-current={tab === key ? 'true' : undefined}
        >
          {t(`tabs.${key}`)}
        </button>
      )),
    [tab, t],
  );

  if (loading) {
    return (
      <MasterDataFrame activeKey="contacts">
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

  if (error || !contact) {
    return (
      <MasterDataFrame activeKey="contacts">
        <div className="md-page">
          <Card className="md-panel">
            <ListState
              title={tShared('states.notFound')}
              body={error || tShared('states.errorBody')}
              action={
                <Button variant="ghost" size="sm" href="/dashboard/contacts">
                  {tShared('actions.back')}
                </Button>
              }
            />
          </Card>
        </div>
      </MasterDataFrame>
    );
  }

  return (
    <MasterDataFrame activeKey="contacts">
      <div className="md-page">
        <PageHead
          badge={t('badge')}
          title={contact.name}
          subtitle={t(`types.${contact.contact_type}`)}
          actions={
            <>
              <Button variant="ghost" size="sm" href="/dashboard/contacts">
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
                  {tShared(contact.status === 'active' ? 'actions.archive' : 'actions.unarchive')}
                </Button>
              ) : null}
            </>
          }
        />

        <div className="md-detail-grid">
          <Card tone="plain" className="md-panel">
            <div className="md-tabs">{tabs}</div>

            <div className="md-panel-body">
              {tab === 'details' ? (
                editing ? (
                  <ContactForm
                    contact={contact}
                    isEdit
                    onSubmit={handleSave}
                    cancelHref={`/dashboard/contacts/${contact.id}`}
                    serverErrors={serverErrors}
                    submitting={submitting}
                  />
                ) : (
                  <div className="md-facts">
                    <Fact label={t('fields.name')}>{contact.name}</Fact>
                    <Fact label={t('fields.type')}>
                      <Pill tone="mid" size="sm">{t(`types.${contact.contact_type}`)}</Pill>
                    </Fact>
                    <Fact label={t('fields.email')}>{contact.email}</Fact>
                    <Fact label={t('fields.mobile')}>{contact.mobile}</Fact>
                    <Fact label={t('fields.city')}>{contact.city}</Fact>
                    <Fact label={t('fields.state')}>{contact.state}</Fact>
                    <Fact label={t('fields.pincode')}>{contact.pincode}</Fact>
                    <Fact label={t('fields.status')}>
                      <StatusPill
                        status={contact.status}
                        label={tShared(`status.${contact.status}`)}
                      />
                    </Fact>
                  </div>
                )
              ) : (
                <ListState title={t(`tabs.${tab}`)} body={t('comingSoon')} />
              )}
            </div>
          </Card>

          <div className="md-page">
            <PortalAccessPanel
              contact={contact}
              canManage={canManage}
              // The toggle returns the contact without its portal_user block,
              // so merge rather than replace and let refetch fill the rest.
              onChange={(updated) => {
                setRecord((current) => ({ ...current, ...updated }));
                refetch();
              }}
            />

            <ProfileImagePanel
              contact={contact}
              canManage={canManage}
              onChange={(updated) =>
                setRecord((current) => ({ ...current, ...updated }))
              }
            />
          </div>
        </div>
      </div>
    </MasterDataFrame>
  );
}
