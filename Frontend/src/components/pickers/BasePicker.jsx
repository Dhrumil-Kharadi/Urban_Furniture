'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Search, ChevronDown, X, Check, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';

/**
 * BasePicker
 * High-performance server-side searched picker with 300ms debounce and AbortController.
 * TECHNICAL REQUIREMENT: Never loads entire collections into memory; queries backend with limit=20.
 *
 * @param {object} props
 * @param {string} props.endpoint - API endpoint (e.g. '/contacts')
 * @param {string|object} props.value - Currently selected ID or item
 * @param {function} props.onChange - (selectedItem) => void
 * @param {string} [props.placeholder='Select…']
 * @param {function} props.renderOption - (item) => ReactNode
 * @param {function} props.getOptionLabel - (item) => string
 * @param {function} [props.getOptionKey] - (item) => string
 * @param {object} [props.extraParams] - Extra search query params (e.g. { type: 'customer' })
 * @param {boolean} [props.disabled=false]
 */
export default function BasePicker({
  endpoint,
  value,
  onChange,
  placeholder = 'Select…',
  renderOption,
  getOptionLabel,
  getOptionKey = (item) => item.id,
  extraParams = {},
  disabled = false,
}) {
  const t = useTranslations('common.actions');
  const tTable = useTranslations('common.table');

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const containerRef = useRef(null);
  const abortControllerRef = useRef(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  // Sync selectedItem if value is object or already populated
  useEffect(() => {
    if (value && typeof value === 'object') {
      setSelectedItem(value);
    } else if (!value) {
      setSelectedItem(null);
    }
  }, [value]);

  // Fetch initial/matching options on search change or open
  const fetchOptions = useCallback(async (query) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);

    try {
      const res = await api.get(endpoint, {
        params: {
          search: query || undefined,
          limit: 20,
          ...extraParams,
        },
        signal: controller.signal,
      });

      if (res.success) {
        const items = res.data?.items || res.data || [];
        setOptions(items);

        // If value was an ID and selectedItem not yet set, find it in items
        if (value && typeof value === 'string' && !selectedItem) {
          const match = items.find((i) => getOptionKey(i) === value);
          if (match) setSelectedItem(match);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
        setOptions([]);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, [endpoint, extraParams, value, selectedItem, getOptionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isOpen) {
      fetchOptions(debouncedSearch);
    }
  }, [isOpen, debouncedSearch, fetchOptions]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item) => {
    setSelectedItem(item);
    setIsOpen(false);
    setSearchTerm('');
    if (onChange) onChange(item);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSelectedItem(null);
    setSearchTerm('');
    if (onChange) onChange(null);
  };

  const currentLabel = selectedItem ? getOptionLabel(selectedItem) : '';

  return (
    <div className="picker-container" ref={containerRef}>
      {/* Control Box */}
      <div
        className={`form-input ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          paddingRight: '0.6rem',
        }}
      >
        <span
          style={{
            color: currentLabel ? 'var(--text-primary)' : 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {currentLabel || placeholder}
        </span>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          {selectedItem && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
              }}
              aria-label="Clear selection"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={16}
            style={{
              color: 'var(--text-secondary)',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="picker-menu">
          {/* Search Box inside menu */}
          <div style={{ padding: '0.4rem 0.6rem 0.6rem', borderBottom: '1px solid var(--dash-divider)' }}>
            <div className="filter-search-wrap">
              <Search size={14} className="filter-search-icon" />
              <input
                type="text"
                className="filter-search-input"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem 0.4rem 2rem' }}
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Options List */}
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {loading ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '1.25rem',
                  color: 'var(--text-secondary)',
                  fontFamily: "'Sora', sans-serif",
                  fontSize: '0.82rem',
                }}
              >
                <Loader2 size={16} className="spinner" />
                <span>{tTable('loading')}</span>
              </div>
            ) : options.length === 0 ? (
              <div className="picker-empty">{tTable('empty')}</div>
            ) : (
              options.map((item) => {
                const key = getOptionKey(item);
                const isSelected = selectedItem && getOptionKey(selectedItem) === key;

                return (
                  <div
                    key={key}
                    className={`picker-option ${isSelected ? 'focused' : ''}`}
                    onClick={() => handleSelect(item)}
                  >
                    <div style={{ flex: 1 }}>
                      {renderOption ? renderOption(item) : getOptionLabel(item)}
                    </div>
                    {isSelected && <Check size={14} style={{ color: 'var(--accent-primary)' }} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
