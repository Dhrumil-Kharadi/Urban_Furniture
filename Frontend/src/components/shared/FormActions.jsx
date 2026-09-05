'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

/**
 * FormActions
 * Form action bar with submit, cancel, and optional draft actions.
 * TECHNICAL REQUIREMENT: Disables submit button while in flight to prevent double posting.
 *
 * @param {object} props
 * @param {boolean} [props.isSubmitting=false]
 * @param {string} [props.submitLabel]
 * @param {string} [props.submittingLabel]
 * @param {function} [props.onCancel]
 * @param {string} [props.cancelLabel]
 * @param {React.ReactNode} [props.secondaryAction]
 */
export default function FormActions({
  isSubmitting = false,
  submitLabel,
  submittingLabel,
  onCancel,
  cancelLabel,
  secondaryAction,
}) {
  const t = useTranslations('common.actions');

  return (
    <div className="form-actions">
      {secondaryAction && <div className="form-actions-left">{secondaryAction}</div>}

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="pagination-btn"
          style={{
            padding: '0.6rem 1.25rem',
            height: 'auto',
            color: 'var(--text-secondary)',
          }}
        >
          {cancelLabel || t('cancel')}
        </button>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-primary-auth"
        style={{
          padding: '0.6rem 1.5rem',
          fontSize: '0.85rem',
          borderRadius: '6px',
        }}
      >
        <span>{isSubmitting ? submittingLabel || t('submitting') : submitLabel || t('save')}</span>
      </button>
    </div>
  );
}
