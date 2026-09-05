'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, RotateCw } from 'lucide-react';

/**
 * ErrorState
 * Renders user-friendly error banners and retry actions.
 *
 * @param {object} props
 * @param {string} [props.message]
 * @param {function} [props.onRetry]
 */
export default function ErrorState({ message, onRetry }) {
  const t = useTranslations('common.actions');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        background: 'var(--bg-raised)',
        borderRadius: '14px',
        border: '1px solid var(--dash-card-border)',
        boxShadow: '4px 4px 12px var(--nm-shadow-dark), -2px -2px 8px var(--nm-shadow-light)',
        width: '100%',
        margin: '1rem 0',
      }}
    >
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--dash-state-strong-bg)',
          color: 'var(--accent-primary)',
          marginBottom: '1rem',
        }}
      >
        <AlertTriangle size={24} />
      </div>

      <h3
        style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: '1.05rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '0.35rem',
        }}
      >
        {message || 'An error occurred while loading data'}
      </h3>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="pagination-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 1.1rem',
            height: 'auto',
            color: 'var(--accent-primary)',
            fontWeight: 600,
            marginTop: '0.75rem',
          }}
        >
          <RotateCw size={14} />
          <span>{t('retry')}</span>
        </button>
      )}
    </div>
  );
}
