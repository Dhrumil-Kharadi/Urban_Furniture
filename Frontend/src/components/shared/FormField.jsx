'use client';

import React from 'react';

/**
 * FormField
 * Standard form field wrapper providing label, required indicator, hint, and validation error.
 *
 * @param {object} props
 * @param {string} [props.label]
 * @param {string} [props.htmlFor]
 * @param {boolean} [props.required=false]
 * @param {string} [props.hint]
 * @param {string} [props.error]
 * @param {React.ReactNode} props.children
 * @param {string} [props.className='']
 */
export default function FormField({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  children,
  className = '',
}) {
  return (
    <div className={`form-field ${className}`}>
      {label && (
        <div className="form-field-label-row">
          <label htmlFor={htmlFor} className="form-field-label">
            {label}
            {required && <span className="form-field-required">*</span>}
          </label>
          {hint && <span className="form-field-hint">{hint}</span>}
        </div>
      )}

      <div className="form-field-control">{children}</div>

      {error && <span className="form-field-error">{error}</span>}
    </div>
  );
}
