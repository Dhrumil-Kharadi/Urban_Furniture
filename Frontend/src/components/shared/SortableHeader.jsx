'use client';

import React from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';

/**
 * SortableHeader
 * Header component for Sortable table columns with URL-state integration.
 *
 * @param {object} props
 * @param {string} props.column - Unique column name (e.g. 'name', 'total')
 * @param {string} props.label - Display label
 * @param {string} props.currentSortBy
 * @param {string} props.currentSortOrder - 'asc' | 'desc'
 * @param {function} props.onSort - (column) => void
 * @param {string} [props.align='left'] - 'left' | 'right'
 */
export default function SortableHeader({
  column,
  label,
  currentSortBy,
  currentSortOrder,
  onSort,
  align = 'left',
}) {
  const isSorted = currentSortBy === column;

  return (
    <button
      type="button"
      onClick={() => onSort && onSort(column)}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 0,
        fontFamily: "'Orbitron', monospace",
        fontSize: '0.75rem',
        fontWeight: 700,
        color: isSorted ? 'var(--accent-primary)' : 'var(--text-secondary)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        gap: '0.35rem',
        width: '100%',
        textAlign: align,
        transition: 'color 0.15s ease',
      }}
    >
      <span>{label}</span>
      <span style={{ display: 'inline-flex', opacity: isSorted ? 1 : 0.4 }}>
        {isSorted ? (
          currentSortOrder === 'desc' ? (
            <ArrowDown size={14} />
          ) : (
            <ArrowUp size={14} />
          )
        ) : (
          <ChevronsUpDown size={14} />
        )}
      </span>
    </button>
  );
}
