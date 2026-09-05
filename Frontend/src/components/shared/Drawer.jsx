'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Drawer
 * Slide-over panel component from the right viewport edge for quick create / side-inspections.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {function} props.onClose
 * @param {string} [props.title]
 * @param {React.ReactNode} props.children
 * @param {number|string} [props.width=460]
 */
export default function Drawer({
  isOpen,
  onClose,
  title,
  children,
  width = 460,
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
    <>
      <div className="app-drawer-backdrop" onClick={onClose} aria-hidden="true" />

      <aside
        className="app-drawer-panel"
        style={{ maxWidth: typeof width === 'number' ? `${width}px` : width }}
        role="dialog"
        aria-modal="true"
      >
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
            aria-label="Close drawer"
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1 }}>{children}</div>
      </aside>
    </>
  );
}
