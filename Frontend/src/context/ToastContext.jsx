'use client';

// ============================================================
// FILE: src/context/ToastContext.jsx
//
// Transient confirmations and failures. Small on purpose — a toast queue is
// not a reason to add a state library.
//
//   const toast = useToast();
//   toast.success(t('masterData.toast.created'));
//   toast.error(err.message);
//
// The component holds NO user-facing text: callers pass translated strings.
// ============================================================

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext({ push: () => {}, success: () => {}, error: () => {} });

const DISMISS_AFTER_MS = 4000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message, tone = 'strong') => {
      if (!message) return;

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [...current, { id, message, tone }]);

      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_AFTER_MS),
      );
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      push,
      dismiss,
      success: (message) => push(message, 'strong'),
      error: (message) => push(message, 'soft'),
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* aria-live so a confirmation is announced, not just drawn. */}
      <div className="ui-toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            className={`ui-toast ui-toast-${toast.tone}`}
            onClick={() => dismiss(toast.id)}
          >
            {toast.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Access the toast queue. Safe outside a provider — it simply does nothing,
 * so a component is never broken by where it is mounted.
 */
export function useToast() {
  return useContext(ToastContext);
}
