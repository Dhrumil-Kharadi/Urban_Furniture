'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import Modal from './Modal';

/**
 * ConfirmDialog
 * Modal dialog for confirming destructive or irreversible operations (post invoice, cancel order, delete).
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {function} props.onClose
 * @param {function} props.onConfirm
 * @param {string} props.title
 * @param {string} props.description
 * @param {string} [props.confirmLabel]
 * @param {string} [props.cancelLabel]
 * @param {boolean} [props.isDestructive=false]
 * @param {boolean} [props.isSubmitting=false]
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isDestructive = false,
  isSubmitting = false,
}) {
  const t = useTranslations('common.actions');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <p
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: '0.88rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            paddingTop: '0.5rem',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="pagination-btn"
            style={{
              padding: '0.55rem 1.1rem',
              height: 'auto',
              color: 'var(--text-secondary)',
            }}
          >
            {cancelLabel || t('cancel')}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="btn-primary-auth"
            style={{
              padding: '0.55rem 1.25rem',
              height: 'auto',
              fontSize: '0.85rem',
              borderRadius: '6px',
              backgroundColor: isDestructive ? 'var(--dash-danger-text)' : 'var(--btn-primary-bg)',
            }}
          >
            {confirmLabel || t('confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
