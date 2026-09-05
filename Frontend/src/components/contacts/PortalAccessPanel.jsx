'use client';

// ============================================================
// FILE: src/components/contacts/PortalAccessPanel.jsx
//
// Grant or revoke a contact's portal login (project.md §2.1 / §2.2).
//
// Two things this panel is careful about:
//
//   1. It is shown to everyone but only ACTIONABLE for an admin. Hiding it
//      from a manager would leave them unable to see whether a contact can log
//      in, which is information they need; the button is what is withheld.
//      The server enforces the rule regardless of what this component renders.
//
//   2. Revoking is described as revoking. "Disable" reads reversible and
//      cosmetic; what actually happens is that every live session for that
//      contact stops working immediately.
// ============================================================

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

import Card, { CardHead, CardBody } from '@/reusablefiles/card';
import Button from '@/reusablefiles/button';
import Pill from '@/reusablefiles/pill';
import { useToast } from '@/context/ToastContext';
import { contactsService } from '@/services/masterdata.service';

/**
 * @param {object}   props.contact  - Contact record including `portal_user`.
 * @param {boolean}  props.canManage - True only for admin.
 * @param {Function} props.onChange  - Receives the updated contact.
 */
export default function PortalAccessPanel({ contact, canManage, onChange }) {
  const t = useTranslations('contacts');
  const tShared = useTranslations('masterData');
  const toast = useToast();

  const [busy, setBusy] = useState(false);

  const enabled = Boolean(contact.portal_access_enabled);
  const hasEmail = Boolean(contact.email);
  const portalUser = contact.portal_user || null;

  const stateLabel = (() => {
    if (!enabled) return portalUser ? t('portal.loginRevoked') : t('portal.disabled');
    if (portalUser?.must_change_password) return t('portal.invitePending');
    return t('portal.loginActive');
  })();

  const toggle = async (next) => {
    setBusy(true);
    try {
      const updated = await contactsService.setPortalAccess(contact.id, next);
      onChange(updated);
      toast.success(tShared('toast.updated'));
    } catch (err) {
      toast.error(err?.message || tShared('toast.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="md-panel">
      <CardHead title={t('portal.title')} />
      <CardBody>
        <div className="md-portal-state">
          <Pill tone={enabled ? 'strong' : 'soft'} size="sm" dot>
            {stateLabel}
          </Pill>
        </div>

        <p className="md-portal-note">
          {hasEmail ? t('portal.description') : t('portal.needsEmail')}
        </p>

        {canManage ? (
          <Button
            variant={enabled ? 'ghost' : 'primary'}
            size="sm"
            loading={busy}
            disabled={busy || (!enabled && !hasEmail)}
            onClick={() => toggle(!enabled)}
          >
            {enabled ? t('portal.disable') : t('portal.enable')}
          </Button>
        ) : (
          <p className="md-form-hint">{t('portal.adminOnly')}</p>
        )}
      </CardBody>
    </Card>
  );
}
