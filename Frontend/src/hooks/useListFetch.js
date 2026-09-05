'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';

/**
 * useListFetch
 * Generic list-fetching hook factory.
 * Standard contract:
 *   const { data, pagination, loading, error, refetch } = useListFetch('/contacts', params);
 *
 * TECHNICAL REQUIREMENT:
 * Aborts in-flight HTTP requests using AbortController on unmount or parameter change,
 * preventing race conditions where fast filter typing renders out-of-order responses.
 *
 * @param {string} endpoint - API endpoint (e.g. '/contacts')
 * @param {object} params - { page, limit, search, status, sortBy, sortOrder, ... }
 * @returns {object} - { data, pagination, loading, error, refetch }
 */
export function useListFetch(endpoint, params = {}) {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    page: params.page || 1,
    limit: params.limit || 25,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Keep a ref to the active AbortController
  const abortControllerRef = useRef(null);

  // Serialized params for dependency tracking
  const paramsKey = JSON.stringify(params);

  const fetchData = useCallback(async () => {
    // Abort previous in-flight request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await api.get(endpoint, {
        params,
        signal: controller.signal,
      });

      if (res.success) {
        setData(res.data?.items || res.data || []);
        if (res.data?.pagination) {
          setPagination(res.data.pagination);
        }
      } else {
        setError(res.message || 'Failed to load records');
      }
    } catch (err) {
      // Don't flag state error if aborted intentionally
      if (err.name === 'AbortError' || err.name === 'CanceledError') {
        return;
      }
      setError(err.message || 'An error occurred while fetching data');
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, [endpoint, paramsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData]);

  return {
    data,
    pagination,
    loading,
    error,
    refetch: fetchData,
  };
}
