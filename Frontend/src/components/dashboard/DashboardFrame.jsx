'use client';

// ============================================================
// FILE: src/components/dashboard/DashboardFrame.jsx
//
// App-level composition of the reusable shell. Every dashboard route
// renders through this, so the guard, sidebar, topbar, navigation and
// logout are wired exactly once instead of four times.
//
//   <DashboardFrame role="user" activeKey="overview">
//     <PageHead …/>
//     <div className="dash-grid"> …cards… </div>
//   </DashboardFrame>
//
// The shell itself lives in src/reusablefiles/dashboardshell/ — this
// file only supplies the app's data (auth user, nav config, i18n).
// ============================================================

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Bell, LeafyGreen, Mail } from 'lucide-react';
import { SOLID_ICONS } from '@/reusablefiles/icons';

import sidebarArt from '@/assets/STaCOFXUuo.gif';

import ProtectedRoute from '@/components/auth/ProtectedRoute';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useAuth } from '@/context/AuthContext';
import { DASHBOARD_NAV, GENERAL_NAV, ICON } from '@/config/dashboard.config';
import {
  DashboardShell,
  Sidebar,
  Topbar,
} from '@/reusablefiles/dashboardshell';

export default function DashboardFrame({
  role,
  activeKey = 'overview',
  allowedRoles,
  search,
  onSearchChange,
  children,
}) {
  const t = useTranslations('dashboard');
  const { user, logout } = useAuth();
  const [internalSearch, setInternalSearch] = useState('');

  const searchValue = onSearchChange ? search : internalSearch;
  const handleSearch = onSearchChange || setInternalSearch;

  const groups = useMemo(() => {
    // An unknown or not-yet-loaded role must still render a shell. The old
    // fallback pointed at DASHBOARD_NAV.user, a key that no longer exists
    // after the role rename, so any such render threw on `.map` and took the
    // whole page down instead of degrading to an empty sidebar.
    const roleGroups = DASHBOARD_NAV[role] || DASHBOARD_NAV.customer || [];

    // Only entries that actually go somewhere are shown. The config lists the
    // whole intended menu, including sections later phases will build, but a
    // nav item that silently does nothing when clicked is worse than one that
    // is not there yet — it reads as a broken app rather than an unfinished
    // one. Adding an `href` in dashboard.config.js is all it takes to surface
    // a section once its route exists.
    const mapItems = (items) =>
      items
        .filter((item) => {
          const roleAllowed = !item.roles || item.roles.includes(role);
          return roleAllowed && (Boolean(item.href) || typeof item.onClick === 'function');
        })
        .map((item) => {
          const Icon = item.icon || SOLID_ICONS.overview;
          return {
            key: item.key,
            label: t(`nav.${item.key}`),
            href: item.href,
            // solid glyphs are fill-based — no stroke weight to set
            icon: typeof Icon === 'function' ? <Icon size={ICON} /> : (Icon || null),
            active: item.key === activeKey,
            badge: item.badge,
            onClick: item.onClick,
          };
        });

    return [
      ...roleGroups
        .map((g) => ({
          key: g.key,
          label: t(`nav.${g.key}`),
          items: mapItems(g.items),
        }))
        .filter((g) => g.items.length > 0),
      {
        key: GENERAL_NAV.key,
        label: t(`nav.${GENERAL_NAV.key}`),
        items: [
          ...mapItems(GENERAL_NAV.items),
          {
            key: 'logout',
            label: t('common.logout'),
            icon: <SOLID_ICONS.logout size={ICON} />,
            onClick: logout,
          },
        ],
      },
    ];
  }, [role, activeKey, t, logout]);

  const sidebar = (
    <Sidebar
      brand="Furnova"
      brandHref="/"
      brandMark={<LeafyGreen size={19} strokeWidth={1.9} aria-hidden="true" />}
      groups={groups}
      closeLabel={t('common.closeMenu')}
      collapseLabel={t('common.collapseMenu')}
      expandLabel={t('common.expandMenu')}
      media={
        /* decorative — `unoptimized` keeps the GIF animated, which the
           default image pipeline would flatten to a still frame */
        <Image
          src={sidebarArt}
          alt=""
          aria-hidden="true"
          unoptimized
          loading="eager"
          className="dash-sidebar-art"
        />
      }
    />
  );

  const topbar = (
    <Topbar
      search={searchValue}
      onSearchChange={handleSearch}
      searchPlaceholder={t('common.search')}
      menuLabel={t('common.openMenu')}
      actions={[
        {
          key: 'messages',
          label: t('common.messages'),
          icon: <Mail size={17} strokeWidth={1.8} aria-hidden="true" />,
        },
        {
          key: 'notifications',
          label: t('common.notifications'),
          icon: <Bell size={17} strokeWidth={1.8} aria-hidden="true" />,
          badge: true,
        },
      ]}
      extras={<LanguageSwitcher />}
      user={user ? { name: user.name || '', email: user.email || '' } : null}
    />
  );

  return (
    <ProtectedRoute allowedRoles={allowedRoles || [role]}>
      <DashboardShell sidebar={sidebar} topbar={topbar}>
        {children}
      </DashboardShell>
    </ProtectedRoute>
  );
}
