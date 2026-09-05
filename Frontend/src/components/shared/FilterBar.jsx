'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X, RotateCw } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

/**
 * FilterBar
 * Toolbar container for search input, status selects, custom filters, and refresh.
 *
 * @param {object} props
 * @param {string} [props.search='']
 * @param {function} [props.onSearchChange] - (debouncedVal) => void
 * @param {string} [props.searchPlaceholder]
 * @param {React.ReactNode} [props.children] - Additional filter controls (selects, date pickers)
 * @param {function} [props.onClear] - Clear filters handler
 * @param {function} [props.onRefresh] - Refresh data handler
 * @param {boolean} [props.hasActiveFilters=false]
 */
export default function FilterBar({
  search = '',
  onSearchChange,
  searchPlaceholder,
  children,
  onClear,
  onRefresh,
  hasActiveFilters = false,
}) {
  const t = useTranslations('common.actions');
  const [localSearch, setLocalSearch] = useState(search);
  const debouncedSearch = useDebounce(localSearch, 300);

  // Synchronize local input state if search prop changes externally
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Dispatch debounced search change to parent
  useEffect(() => {
    if (onSearchChange && debouncedSearch !== search) {
      onSearchChange(debouncedSearch);
    }
  }, [debouncedSearch, onSearchChange, search]);

  return (
    <div className="filter-bar">
      {/* Search Input */}
      {onSearchChange && (
        <div className="filter-search-wrap">
          <Search size={16} className="filter-search-icon" />
          <input
            type="text"
            className="filter-search-input"
            placeholder={searchPlaceholder || t('searchPlaceholder')}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                onSearchChange('');
              }}
              style={{
                position: 'absolute',
                right: '0.6rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
              }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Filter Slots */}
      {children}

      {/* Clear Filters Action */}
      {hasActiveFilters && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="master-tab-btn"
          style={{
            fontSize: '0.8rem',
            padding: '0.4rem 0.75rem',
            color: 'var(--dash-danger-text)',
          }}
        >
          {t('clearFilters')}
        </button>
      )}

      {/* Refresh Button */}
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="pagination-btn"
          style={{ marginLeft: 'auto' }}
          title={t('refresh')}
          aria-label={t('refresh')}
        >
          <RotateCw size={14} />
        </button>
      )}
    </div>
  );
}
