'use client';

// ============================================================
// FILE: src/hooks/useResourceRecord.js
//
// Single-record counterpart to useResourceList: fetches one row for a detail
// or edit page, with the same abort-on-unmount discipline and the same
// loading / error / refetch surface.
//
//   const { record, loading, error, refetch, setRecord } =
//     useResourceRecord(contactsService, id);
//
// `setRecord` lets a mutation on the page (archive, portal toggle) push the
// server's response straight into state instead of triggering a second GET.
// ============================================================

import { useCallback, useEffect, useState } from 'react';

/**
 * @param {{ get: Function }} service
 * @param {string|null} id
 * @returns {{
 *   record: object|null,
 *   loading: boolean,
 *   error: string|null,
 *   refetch: Function,
 *   setRecord: Function,
 * }}
 */
export default function useResourceRecord(service, id) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    // No id means there is nothing to fetch. The initial state already says
    // "not loading, no record", so the effect simply does not run — setting
    // state here instead would be a synchronous cascade for no gain.
    if (!id) return undefined;

    const controller = new AbortController();
    let ignore = false;

    (async () => {
      // Inside the async body rather than the effect body: setting state
      // synchronously while the effect runs triggers a cascading render, and
      // this flag only needs to be true by the time the request is in flight.
      setLoading(true);

      try {
        const data = await service.get(id, controller.signal);
        if (ignore) return;
        setRecord(data);
        setError(null);
      } catch (err) {
        if (ignore || err?.name === 'AbortError' || controller.signal.aborted) return;
        setRecord(null);
        setError(err?.message || 'Something went wrong');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [service, id, reloadToken]);

  const refetch = useCallback(() => setReloadToken((n) => n + 1), []);

  return { record, loading, error, refetch, setRecord };
}
