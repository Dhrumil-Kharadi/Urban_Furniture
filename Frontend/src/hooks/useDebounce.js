'use client';

import { useState, useEffect } from 'react';

/**
 * useDebounce
 * Debounces any fast-changing value (e.g. search query input) by delay in ms.
 *
 * @param {any} value
 * @param {number} [delay=300]
 * @returns {any}
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
