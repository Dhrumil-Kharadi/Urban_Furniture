'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/page.jsx
//
// Entry point for /dashboard — sends the visitor to the console that
// matches the role the server reported, or to login when there is no
// session. Renders only the shared loading state while deciding.
// ============================================================

import React, { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuth, getDashboardPath } from '@/context/AuthContext';

export default function DashboardIndexPage() {
  const t = useTranslations('dashboard');
  const { role, loading, isAuthenticated } = useAuth();
  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.replace('/auth/login');
      return;
    }

    router.replace(getDashboardPath(role));
  }, [loading, isAuthenticated, role, router]);

  return (
    <div className="dashboard-viewport-dash">
      <div className="dashboard-loading-dash">
        <span>{t('common.loading')}</span>
      </div>
    </div>
  );
}
