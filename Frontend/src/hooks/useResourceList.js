'use client';

// ============================================================
// FILE: src/hooks/useResourceList.js
//
// The standard fetching hook for a master-data collection.
//
//   const { items, pagination, loading, refreshing, error, refetch } =
//     useResourceList(contactsService, params);
//
// Two things it does that a bare useEffect + fetch does not:
//
//   1. Aborts the in-flight request whenever the params change or the
//      component unmounts. Typing quickly into a filter otherwise lands
//      responses out of order and the table shows results for a filter the
//      user has already changed.
//
//   2. Separates `loading` (first paint — show skeletons) from `refreshing`
//      (a later fetch — dim the existing table). Swapping a populated table
//      for skeletons on every keystroke makes the page jump.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @param {{ list: Function }} service - A master-data service object.
 * @param {object} params - The list contract's query params.
 * @returns {{
 *   items: Array,
 *   pagination: object|null,
 *   loading: boolean,
 *   refreshing: boolean,
 *   error: string|null,
 *   refetch: Function,
 * }}
 */
export default function useResourceList(service, params) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const hasLoaded = useRef(false);

  // Params is a fresh object every render, so the effect keys off its
  // serialisation rather than its identity.
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;

    if (hasLoaded.current) setRefreshing(true);
    else setLoading(true);

    (async () => {
      try {
        const data = await service.list(JSON.parse(paramsKey), controller.signal);
        if (ignore) return;
        setItems(data?.items ?? []);
        setPagination(data?.pagination ?? null);
        setError(null);
      } catch (err) {
        // An abort is this hook doing its job, not a failure to report.
        if (ignore || err?.name === 'AbortError' || controller.signal.aborted) return;
        setError(err?.message || 'Something went wrong');
      } finally {
        if (!ignore) {
          hasLoaded.current = true;
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [service, paramsKey, reloadToken]);

  const refetch = useCallback(() => setReloadToken((n) => n + 1), []);

  return { items, pagination, loading, refreshing, error, refetch };
}
