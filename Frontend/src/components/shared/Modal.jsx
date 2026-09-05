'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Modal
 * Accessible neumorphic dialog with backdrop and escape key listener.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {function} props.onClose
 * @param {string} [props.title]
 * @param {React.ReactNode} props.children
 * @param {number|string} [props.maxWidth=520]
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 520,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="app-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="app-modal-dialog"
        style={{ maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth }}
      >
        {title && (
          <div className="app-modal-head">
            <h3 className="app-modal-title">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px',
              }}
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div className="app-modal-body">{children}</div>
      </div>
    </div>
  );
}
