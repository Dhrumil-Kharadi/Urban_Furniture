'use client';

// ============================================================
// FILE: src/components/masterdata/FormShell.jsx
//
// The wrapper every master-data form uses: an error block, a field grid, and
// the submit/cancel row.
//
// The submit button is disabled while a request is in flight, and that is not
// cosmetic: a double-submitted contact is a duplicate, and a double-submitted
// document would hit the ledger twice. Disabling on `submitting` is the
// cheapest place to stop it.
//
// Holds no user-facing text — labels arrive translated.
// ============================================================

import React from 'react';
import Button from '@/reusablefiles/button';

/**
 * @param {Function} onSubmit
 * @param {string[]} errors        - Already-translated or server-sent messages.
 * @param {boolean}  submitting
 * @param {string}   submitLabel
 * @param {string}   submittingLabel
 * @param {string}   cancelLabel
 * @param {string}   cancelHref
 * @param {React.ReactNode} children - The fields.
 * @param {React.ReactNode} [extraActions]
 */
export default function FormShell({
  onSubmit,
  errors = [],
  submitting = false,
  submitLabel,
  submittingLabel,
  cancelLabel,
  cancelHref,
  children,
  extraActions = null,
}) {
  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting) return;
    onSubmit();
  };

  return (
    <form className="md-form" onSubmit={handleSubmit} noValidate>
      {errors.length > 0 ? (
        <ul className="md-form-errors">
          {errors.map((message) => (
            <li className="md-form-error" key={message}>
              {message}
            </li>
          ))}
        </ul>
      ) : null}

      {children}

      <div className="md-form-actions">
        <Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </Button>

        <Button variant="ghost" href={cancelHref}>
          {cancelLabel}
        </Button>

        {extraActions}
      </div>
    </form>
  );
}
