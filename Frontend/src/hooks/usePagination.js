'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useCallback } from 'react';

/**
 * usePagination
 * Manages pagination & sorting state synchronized with URL query params.
 * Allows filtered views to be bookmarkable, refresh-survivable, and back-button safe.
 */
export function usePagination(defaultLimit = 25) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || String(defaultLimit), 10);
  const sortBy = searchParams.get('sortBy') || '';
  const sortOrder = searchParams.get('sortOrder') || 'asc';
  const search = searchParams.get('search') || '';

  const updateParams = useCallback((newParams) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));

    Object.entries(newParams).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        current.delete(key);
      } else {
        current.set(key, String(value));
      }
    });

    router.replace(`${pathname}?${current.toString()}`);
  }, [router, pathname, searchParams]);

  const setPage = useCallback((newPage) => {
    updateParams({ page: newPage });
  }, [updateParams]);

  const setLimit = useCallback((newLimit) => {
    updateParams({ limit: newLimit, page: 1 });
  }, [updateParams]);

  const setSearch = useCallback((newSearch) => {
    updateParams({ search: newSearch, page: 1 });
  }, [updateParams]);

  const setSorting = useCallback((newSortBy) => {
    if (sortBy === newSortBy) {
      const nextOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      updateParams({ sortBy: newSortBy, sortOrder: nextOrder, page: 1 });
    } else {
      updateParams({ sortBy: newSortBy, sortOrder: 'asc', page: 1 });
    }
  }, [sortBy, sortOrder, updateParams]);

  return {
    page,
    limit,
    sortBy,
    sortOrder,
    search,
    setPage,
    setLimit,
    setSearch,
    setSorting,
    updateParams,
  };
}
