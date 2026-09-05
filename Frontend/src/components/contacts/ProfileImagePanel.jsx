'use client';

// ============================================================
// FILE: src/components/contacts/ProfileImagePanel.jsx
//
// Profile image for a Contact (project.md §4.1).
//
// The size and type checks below are courtesy, not security. The server
// identifies the file from its magic bytes and rejects anything that is not a
// genuine JPEG, PNG or WebP, whatever this component or the file picker
// believed. Checking here just saves the reader a pointless 2 MB upload.
// ============================================================

import React, { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import Card, { CardHead, CardBody } from '@/reusablefiles/card';
import Button from '@/reusablefiles/button';
import { useToast } from '@/context/ToastContext';
import { contactsService } from '@/services/masterdata.service';

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = 'image/jpeg,image/png,image/webp';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api')
  .replace(/\/api\/?$/, '');

/**
 * @param {object}   props.contact
 * @param {boolean}  props.canManage
 * @param {Function} props.onChange
 */
export default function ProfileImagePanel({ contact, canManage, onChange }) {
  const t = useTranslations('contacts');
  const tShared = useTranslations('masterData');
  const toast = useToast();

  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const initials = (contact.name || '?')
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    // Clear immediately so picking the same file twice still fires a change.
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_BYTES || !ACCEPTED.split(',').includes(file.type)) {
      toast.error(tShared('toast.error'));
      return;
    }

    setBusy(true);
    try {
      const updated = await contactsService.uploadProfileImage(contact.id, file);
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
      <CardHead title={t('fields.profileImage')} />
      <CardBody>
        <div className="md-avatar-block">
          {contact.profile_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="md-avatar"
              src={`${API_ORIGIN}${contact.profile_image_url}`}
              alt=""
            />
          ) : (
            <span className="md-avatar-fallback" aria-hidden="true">
              {initials}
            </span>
          )}

          {canManage ? (
            <div>
              <input
                ref={inputRef}
                id={`contact-image-${contact.id}`}
                className="md-file-input"
                type="file"
                accept={ACCEPTED}
                onChange={handleFile}
                disabled={busy}
              />
              <Button
                variant="ghost"
                size="sm"
                loading={busy}
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                {busy ? tShared('actions.uploading') : tShared('actions.upload')}
              </Button>
            </div>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
