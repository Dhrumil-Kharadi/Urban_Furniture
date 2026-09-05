'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Pagination
 * Server-side pagination controls with limit selector and page range.
 *
 * @param {object} props
 * @param {number} props.page - Current page (1-based)
 * @param {number} props.limit - Rows per page
 * @param {number} props.total - Total number of records
 * @param {number} props.totalPages - Total pages computed
 * @param {function} props.onPageChange - (newPage) => void
 * @param {function} props.onLimitChange - (newLimit) => void
 */
export default function Pagination({
  page = 1,
  limit = 25,
  total = 0,
  totalPages = 1,
  onPageChange,
  onLimitChange,
}) {
  const t = useTranslations('common.table');

  const startRecord = total === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="pagination-container">
      {/* Records info & Rows-per-page */}
      <div className="pagination-info" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span>
          {t('showing', { start: startRecord, end: endRecord, total })}
        </span>

        {onLimitChange && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {t('rowsPerPage')}:
            </span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
              className="form-select"
              style={{
                padding: '0.2rem 0.5rem',
                fontSize: '0.78rem',
                width: 'auto',
                height: '30px',
              }}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        )}
      </div>

      {/* Page buttons */}
      <div className="pagination-controls">
        <button
          type="button"
          onClick={() => onPageChange && onPageChange(page - 1)}
          disabled={page <= 1}
          className="pagination-btn"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        {getPageNumbers().map((p, idx) =>
          p === '...' ? (
            <span
              key={`ellipsis-${idx}`}
              style={{
                padding: '0 0.4rem',
                color: 'var(--text-muted)',
                fontFamily: "'Sora', sans-serif",
              }}
            >
              …
            </span>
          ) : (
            <button
              key={`page-${p}`}
              type="button"
              onClick={() => onPageChange && onPageChange(p)}
              className={`pagination-btn ${page === p ? 'active' : ''}`}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange && onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="pagination-btn"
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
