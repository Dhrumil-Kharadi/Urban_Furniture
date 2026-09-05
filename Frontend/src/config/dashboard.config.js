// ============================================================
// FILE: src/config/dashboard.config.js
//
// Structure of the dashboard: which nav entries each role sees, which
// icon sits on which tile, and the shared icon size.
//
// Only KEYS live here — never display text. Pages resolve every key
// through `useTranslations('dashboard')`, so adding a locale needs no
// change to this file.
// ============================================================

import {
  Activity, Bell, Gauge, LeafyGreen, LogOut, Mail, Radio,
  Shield, ShieldCheck, Thermometer, TrendingUp, Users, Droplets,
  FileText, Receipt, Wallet, Landmark, AlertTriangle, CreditCard, BookOpen,
} from 'lucide-react';

// Navigation uses the filled set; stat tiles and the topbar stay on the
// stroke set, so the sidebar reads as chrome and content icons as content.
import { SOLID_ICONS } from '@/reusablefiles/icons';

/** One icon size across the whole dashboard. */
export const ICON = 19;
export const ICON_SM = 15;

/**
 * Navigation per role.
 *   groupKey / itemKey resolve to `dashboard.nav.<key>` in messages.
 *   `href` is a locale-agnostic path — <Link> adds the prefix.
 */
export const DASHBOARD_NAV = {
  // Contact (customer / vendor). Portal routes.
  user: [
    {
      key: 'menu',
      items: [
        { key: 'overview', icon: SOLID_ICONS.overview, href: '/portal' },
        { key: 'invoices', icon: SOLID_ICONS.fields, href: '/portal/invoices' },
        { key: 'bills', icon: SOLID_ICONS.deployments, href: '/portal/bills' },
        { key: 'payments', icon: SOLID_ICONS.irrigation, href: '/portal/payments' },
      ],
    },
  ],
  // Invoicing User (Accountant / Manager). Master read/create + transactions + reporting.
  manager: [
    {
      key: 'menu',
      items: [
        { key: 'overview', icon: SOLID_ICONS.overview, href: '/dashboard/manager' },
        { key: 'contacts', icon: SOLID_ICONS.team, href: '/dashboard/contacts' },
        { key: 'products', icon: SOLID_ICONS.fields, href: '/dashboard/products' },
        { key: 'accounts', icon: SOLID_ICONS.system, href: '/dashboard/accounts' },
        { key: 'journals', icon: SOLID_ICONS.directory, href: '/dashboard/journals' },
        { key: 'journalEntries', icon: SOLID_ICONS.analytics, href: '/dashboard/journal-entries' },
        { key: 'taxes', icon: SOLID_ICONS.roles, href: '/dashboard/taxes' },
        { key: 'analyticAccounts', icon: SOLID_ICONS.nodes, href: '/dashboard/analytic-accounts' },
        { key: 'sales', icon: SOLID_ICONS.deployments, href: '/dashboard/sales-orders' },
        { key: 'invoices', icon: SOLID_ICONS.fields, href: '/dashboard/customer-invoices' },
        { key: 'purchases', icon: SOLID_ICONS.nodes, href: '/dashboard/purchase-orders' },
        { key: 'bills', icon: SOLID_ICONS.deployments, href: '/dashboard/vendor-bills' },
        { key: 'payments', icon: SOLID_ICONS.irrigation, href: '/dashboard/payments' },
        { key: 'budgets', icon: SOLID_ICONS.calendar, href: '/dashboard/budgets' },
        { key: 'reports', icon: SOLID_ICONS.analytics, href: '/dashboard/reports' },
      ],
    },
  ],
  // Business Owner (Admin). Full permissions including Users and Organization Settings.
  admin: [
    {
      key: 'menu',
      items: [
        { key: 'overview', icon: SOLID_ICONS.overview, href: '/dashboard/admin' },
        { key: 'contacts', icon: SOLID_ICONS.team, href: '/dashboard/contacts' },
        { key: 'products', icon: SOLID_ICONS.fields, href: '/dashboard/products' },
        { key: 'accounts', icon: SOLID_ICONS.system, href: '/dashboard/accounts' },
        { key: 'journals', icon: SOLID_ICONS.directory, href: '/dashboard/journals' },
        { key: 'journalEntries', icon: SOLID_ICONS.analytics, href: '/dashboard/journal-entries' },
        { key: 'taxes', icon: SOLID_ICONS.roles, href: '/dashboard/taxes' },
        { key: 'analyticAccounts', icon: SOLID_ICONS.nodes, href: '/dashboard/analytic-accounts' },
        { key: 'sales', icon: SOLID_ICONS.deployments, href: '/dashboard/sales-orders' },
        { key: 'invoices', icon: SOLID_ICONS.fields, href: '/dashboard/customer-invoices' },
        { key: 'purchases', icon: SOLID_ICONS.nodes, href: '/dashboard/purchase-orders' },
        { key: 'bills', icon: SOLID_ICONS.deployments, href: '/dashboard/vendor-bills' },
        { key: 'payments', icon: SOLID_ICONS.irrigation, href: '/dashboard/payments' },
        { key: 'budgets', icon: SOLID_ICONS.calendar, href: '/dashboard/budgets' },
        { key: 'reports', icon: SOLID_ICONS.analytics, href: '/dashboard/reports' },
        { key: 'users', icon: SOLID_ICONS.directory, href: '/dashboard/users' },
      ],
    },
  ],
  super_admin: [
    {
      key: 'menu',
      items: [
        { key: 'overview', icon: SOLID_ICONS.overview, href: '/dashboard/super-admin' },
        { key: 'directory', icon: SOLID_ICONS.directory, href: '/dashboard/super-admin/directory' },
        { key: 'roles', icon: SOLID_ICONS.roles, href: '/dashboard/super-admin/roles' },
        { key: 'system', icon: SOLID_ICONS.system, href: '/dashboard/super-admin/system' },
      ],
    },
  ],
};

/**
 * Dedicated Portal Navigation for external contacts (customers/vendors).
 */
export const PORTAL_NAV = [
  { key: 'overview', icon: SOLID_ICONS.overview, href: '/portal' },
  { key: 'invoices', icon: SOLID_ICONS.fields, href: '/portal/invoices' },
  { key: 'bills', icon: SOLID_ICONS.deployments, href: '/portal/bills' },
  { key: 'payments', icon: SOLID_ICONS.irrigation, href: '/portal/payments' },
];

/** Second nav group — identical for every role. */
export const GENERAL_NAV = {
  key: 'general',
  items: [
    { key: 'settings', icon: SOLID_ICONS.settings },
    { key: 'help', icon: SOLID_ICONS.help },
  ],
};

/** Icons used by the stat tiles, keyed by metric. */
export const STAT_ICONS = {
  // ── accounting metrics ──────────────────────────────────
  invoices: FileText,
  bills: Receipt,
  receivable: Landmark,
  payable: Receipt,
  cash: Wallet,
  profit: TrendingUp,
  overdue: AlertTriangle,
  payments: CreditCard,
  ledger: BookOpen,
  // ── generic / directory metrics ─────────────────────────
  nodes: Radio,
  moisture: Droplets,
  temperature: Thermometer,
  health: LeafyGreen,
  yield: TrendingUp,
  uptime: Activity,
  latency: Gauge,
  users: Users,
  verified: ShieldCheck,
  pending: Shield,
  roles: Users,
  mail: Mail,
  alerts: Bell,
  logout: LogOut,
};

/** Chart id -> which `--graph-series-*` slot it leads with. */
export const SERIES_SLOT = {
  primary: 0,
  secondary: 2,
  tertiary: 4,
  muted: 6,
};
