'use client';

// ============================================================
// FILE: src/app/[locale]/portal/page.jsx
//
// Where a Contact lands after signing in.
//
// SCOPE — Phase 6 provisions the login; the portal itself is Phase 12. This
// page exists so the exit criteria hold end to end: a portal-enabled contact
// sets a password, logs in, and arrives HERE rather than at /dashboard, which
// is organization-wide and none of their business (project.md §3).
//
// The guard admits only role 'user'. Anyone else is bounced to their own
// dashboard by ProtectedRoute, and the backend refuses them regardless.
// ============================================================

import React from 'react';
import { useTranslations } from 'next-intl';

import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Button from '@/reusablefiles/button';
import { useAuth } from '@/context/AuthContext';

export default function PortalPage() {
  const t = useTranslations('portal');
  const { user, logout } = useAuth();

  return (
    <ProtectedRoute allowedRoles={['user']}>
      <main className="md-portal-page">
        <section className="md-portal-card">
          <span className="dashboard-badge-dash">{t('badge')}</span>

          <h1 className="md-portal-title">{t('title')}</h1>

          <p className="md-portal-sub">
            {user?.name ? t('welcome', { name: user.name }) : t('subtitle')}
          </p>

          <p className="md-portal-sub">{t('comingSoon')}</p>

          <div className="md-form-actions">
            <Button variant="ghost" size="sm" onClick={logout}>
              {t('signOut')}
            </Button>
          </div>
        </section>
      </main>
    </ProtectedRoute>
  );
}
