'use client';

// ============================================================
// FILE: src/hooks/useListParams.js
//
// Filters, search, sort and page live in the URL, not in component state.
//
// That choice is what makes a filtered list shareable, survive a refresh, and
// behave correctly under the back button — three things a useState-held filter
// silently gets wrong. It also means the page component has no filter state to
// keep in sync with anything.
//
//   const { params, setParam, setParams, reset, isFiltered } = useListParams();
//   <InputBox value={params.search} onChange={(v) => setParam('search', v)} />
//
// Search is debounced before it reaches the URL: typing "chair" should be one
// history entry and one request, not five.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';

/** Params the list contract understands, with their defaults. */
const DEFAULTS = {
  page: '1',
  limit: '25',
  search: '',
  status: '',
  type: '',
  categoryId: '',
  sortBy: '',
  sortOrder: '',
};

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Read the list contract's parameters out of the URL and write them back.
 *
 * @param {object} [overrides] - Per-page default values, e.g. { status: 'active' }.
 * @returns {{
 *   params: object,
 *   searchDraft: string,
 *   setSearchDraft: Function,
 *   setParam: Function,
 *   setParams: Function,
 *   reset: Function,
 *   isFiltered: boolean,
 * }}
 */
export default function useListParams(overrides = {}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const defaults = useMemo(() => ({ ...DEFAULTS, ...overrides }), [overrides]);

  const params = useMemo(() => {
    const next = {};
    for (const key of Object.keys(defaults)) {
      next[key] = searchParams.get(key) ?? defaults[key];
    }
    return next;
  }, [searchParams, defaults]);

  // The search box is typed into far faster than it should be navigated to, so
  // it holds its own draft and pushes to the URL on a debounce.
  const [searchDraft, setSearchDraft] = useState(params.search);
  const committedSearch = useRef(params.search);

  // Keep the draft in step when the URL changes from somewhere else — a back
  // navigation, or Clear filters.
  useEffect(() => {
    if (params.search !== committedSearch.current) {
      committedSearch.current = params.search;
      setSearchDraft(params.search);
    }
  }, [params.search]);

  const write = useCallback(
    (updates) => {
      const next = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === null || value === '' || value === defaults[key]) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }

      // Any change to a filter invalidates the current page number: page 4 of
      // an unfiltered list is rarely page 4 of a filtered one.
      if (!('page' in updates)) next.delete('page');

      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, pathname, router, defaults],
  );

  useEffect(() => {
    if (searchDraft === committedSearch.current) return undefined;

    const timer = setTimeout(() => {
      committedSearch.current = searchDraft;
      write({ search: searchDraft });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchDraft, write]);

  const setParam = useCallback((key, value) => write({ [key]: value }), [write]);
  const setParams = useCallback((updates) => write(updates), [write]);

  const reset = useCallback(() => {
    committedSearch.current = defaults.search;
    setSearchDraft(defaults.search);
    router.replace(pathname, { scroll: false });
  }, [router, pathname, defaults.search]);

  // "Nothing yet" and "nothing matches your filters" are different empty
  // states with different remedies, so the page needs to know which it is in.
  const isFiltered = useMemo(
    () =>
      Boolean(params.search) ||
      Boolean(params.status) ||
      Boolean(params.type) ||
      Boolean(params.categoryId),
    [params],
  );

  return { params, searchDraft, setSearchDraft, setParam, setParams, reset, isFiltered };
}
