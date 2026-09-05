'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Inbox, FilterX, Plus } from 'lucide-react';

/**
 * EmptyState
 * Displays formatted empty state for tables, lists, and collections.
 *
 * @param {object} props
 * @param {boolean} [props.isFiltered=false] - If true, displays filter mismatch message
 * @param {string} [props.title]
 * @param {string} [props.description]
 * @param {string} [props.actionLabel]
 * @param {function} [props.onAction]
 * @param {function} [props.onClearFilters]
 */
export default function EmptyState({
  isFiltered = false,
  title,
  description,
  actionLabel,
  onAction,
  onClearFilters,
}) {
  const tActions = useTranslations('common.actions');
  const tTable = useTranslations('common.table');

  const defaultTitle = isFiltered ? tTable('emptyFiltered') : tTable('empty');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        textAlign: 'center',
        background: 'var(--bg-raised)',
        borderRadius: '14px',
        border: '1px solid var(--border-subtle)',
        boxShadow: '4px 4px 12px var(--nm-shadow-dark), -2px -2px 8px var(--nm-shadow-light)',
        width: '100%',
        margin: '1rem 0',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-base)',
          color: 'var(--text-secondary)',
          boxShadow: 'inset 2px 2px 4px var(--nm-inset-dark), inset -2px -2px 4px var(--nm-inset-light)',
          marginBottom: '1rem',
        }}
      >
        {isFiltered ? <FilterX size={26} /> : <Inbox size={26} />}
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
        {title || defaultTitle}
      </h3>

      {description && (
        <p
          style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            maxWidth: '380px',
            marginBottom: '1.25rem',
          }}
        >
          {description}
        </p>
      )}

      {/* Action buttons */}
      {isFiltered && onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="pagination-btn"
          style={{
            padding: '0.5rem 1rem',
            height: 'auto',
            color: 'var(--accent-primary)',
            fontWeight: 600,
            marginTop: '0.5rem',
          }}
        >
          {tActions('clearFilters')}
        </button>
      )}

      {!isFiltered && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="btn-primary-auth"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 1.25rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            marginTop: '0.5rem',
          }}
        >
          <Plus size={16} />
          <span>{actionLabel || tActions('create')}</span>
        </button>
      )}
    </div>
  );
}
