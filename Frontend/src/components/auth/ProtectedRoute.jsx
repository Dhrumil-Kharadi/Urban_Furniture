'use client';

import React, { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuth, getDashboardPath } from '@/context/AuthContext';

/**
 * ProtectedRoute Component
 *
 * Client-side guard for UX protection:
 * - Redirects unauthenticated users to /auth/login
 * - Redirects authenticated users with mismatched role to their correct dashboard
 * - Prevents flash of protected content
 *
 * Uses a ref for router to prevent the redirect effect from re-firing
 * when the router object's identity changes across renders.
 *
 * NOTE: Backend authorization (RBAC) remains the actual security boundary.
 */
export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const t = useTranslations('dashboard');
  const { user, role, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.replace('/auth/login');
      return;
    }

    if (allowedRoles.length > 0 && role && !allowedRoles.includes(role)) {
      const correctDashboard = getDashboardPath(role);
      router.replace(correctDashboard);
    }
  }, [loading, isAuthenticated, role, allowedRoles, router]);

  if (loading) {
    return (
      <div className="dashboard-viewport-dash">
        <div className="dashboard-loading-dash">
          <span>{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (allowedRoles.length > 0 && !allowedRoles.includes(role))) {
    return null;
  }

  return <>{children}</>;
}
