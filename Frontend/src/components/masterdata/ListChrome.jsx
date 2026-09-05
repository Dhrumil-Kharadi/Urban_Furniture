'use client';

// ============================================================
// FILE: src/components/masterdata/ListChrome.jsx
//
// The furniture every master-data list wears: toolbar, pagination and the
// three states a list can be in besides "here are your rows".
//
// The states are deliberately four, not two:
//
//   loading    skeleton rows on first paint; a refetch dims the table it
//              already has instead of replacing it (see .is-refreshing)
//   empty      nothing exists yet         -> offer Create
//   no match   things exist, filters hide them -> offer Clear filters
//   error      say so, offer Retry; never a blank screen
//
// Collapsing "empty" and "no match" into one message is the most common way a
// list lies to the person reading it.
//
// None of these components hold user-facing text: every label is passed in
// already translated.
// ============================================================

import React from 'react';
import Button from '@/reusablefiles/button';
import InputBox from '@/reusablefiles/inputbox';
import Skeleton from '@/reusablefiles/skeleton';

/**
 * Search box, filter selects and the page's primary action.
 *
 * @param {string}   searchValue
 * @param {Function} onSearchChange - Receives the value (InputBox convention).
 * @param {string}   searchPlaceholder
 * @param {Array}    filters - [{ key, label, value, options: [{value,label}], onChange }]
 * @param {React.ReactNode} actions - Right-hand slot.
 */
export function ListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  filters = [],
  actions = null,
}) {
  return (
    <div className="md-toolbar">
      <div className="md-toolbar-search">
        <InputBox
          type="search"
          label={searchLabel}
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
      </div>

      {filters.map((filter) => (
        <div className="md-toolbar-filter" key={filter.key}>
          <InputBox
            as="select"
            label={filter.label}
            value={filter.value}
            onChange={filter.onChange}
            options={filter.options}
          />
        </div>
      ))}

      <div className="md-toolbar-spacer" />

      {actions ? <div className="md-toolbar-actions">{actions}</div> : null}
    </div>
  );
}

/**
 * Offset pagination controls.
 *
 * @param {object}   pagination - The API's pagination block.
 * @param {Function} onPageChange
 * @param {object}   labels - { summary(from,to,total), page(page,totalPages), previous, next }
 */
export function ListPagination({ pagination, onPageChange, labels }) {
  if (!pagination || pagination.total === 0) return null;

  const { page, limit, total, totalPages, hasNext, hasPrev } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="md-pagination">
      <span className="md-pagination-summary">
        {labels.summary({ from, to, total })}
      </span>

      <div className="md-pagination-controls">
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasPrev}
          onClick={() => onPageChange(page - 1)}
        >
          {labels.previous}
        </Button>

        <span className="md-pagination-page">
          {labels.page({ page, totalPages })}
        </span>

        <Button
          variant="ghost"
          size="sm"
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          {labels.next}
        </Button>
      </div>
    </div>
  );
}

/**
 * Placeholder rows sized to the table they stand in for, so the first paint
 * does not resize when the data lands.
 *
 * @param {number} rows
 * @param {number} columns
 */
export function ListSkeleton({ rows = 6, columns = 5 }) {
  return (
    <div className="md-skeleton-rows">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div className="md-skeleton-row" key={rowIndex}>
          {Array.from({ length: columns }, (_, colIndex) => (
            <Skeleton
              key={colIndex}
              h={12}
              w={colIndex === 0 ? '26%' : `${Math.max(10, 18 - colIndex * 2)}%`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * The shared shape of a state message: title, body, one action.
 *
 * @param {string} title
 * @param {string} body
 * @param {React.ReactNode} [action]
 */
export function ListState({ title, body, action = null }) {
  return (
    <div className="md-state">
      <p className="md-state-title">{title}</p>
      <p className="md-state-body">{body}</p>
      {action ? <div className="md-state-action">{action}</div> : null}
    </div>
  );
}

/**
 * Failure state. Always offers a way forward — a blank panel tells the reader
 * nothing about whether to wait, retry or leave.
 *
 * @param {string} title
 * @param {string} body    - The server's message when there is one.
 * @param {string} retryLabel
 * @param {Function} onRetry
 */
export function ListError({ title, body, retryLabel, onRetry }) {
  return (
    <ListState
      title={title}
      body={body}
      action={
        <Button variant="ghost" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      }
    />
  );
}
