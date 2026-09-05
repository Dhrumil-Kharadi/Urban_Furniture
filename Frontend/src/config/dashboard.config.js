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
  // Customer contact. Portal access only — own invoices and payments.
  customer: [
    {
      key: 'menu',
      items: [
        { key: 'overview', icon: SOLID_ICONS.overview, href: '/portal' },
        { key: 'invoices', icon: SOLID_ICONS.fields, href: '/portal/invoices' },
        { key: 'bills', icon: SOLID_ICONS.deployments, href: '/portal/bills' },
      ],
    },
  ],
  // Vendor contact. Portal access only — own bills.
  vendor: [
    {
      key: 'menu',
      items: [
        { key: 'overview', icon: SOLID_ICONS.overview, href: '/portal/vendor' },
        { key: 'bills', icon: SOLID_ICONS.deployments, href: '/portal/bills' },
      ],
    },
  ],
  // Accountant. Adds contacts and records transactions,
  // and may update product prices — but adding or deleting products and
  // other master data stays with the business owner.
  accountant: [
    {
      key: 'menu',
      items: [
        { key: 'overview', icon: SOLID_ICONS.overview, href: '/dashboard/accountant' },
        { key: 'contacts', icon: SOLID_ICONS.team, href: '/dashboard/contacts' },
        { key: 'products', icon: SOLID_ICONS.fields, href: '/dashboard/products' },
        { key: 'productCategories', icon: SOLID_ICONS.calendar, href: '/dashboard/product-categories' },
        { key: 'accounts', icon: SOLID_ICONS.analytics, href: '/dashboard/accounts' },
        { key: 'journals', icon: SOLID_ICONS.system, href: '/dashboard/journals' },
        { key: 'taxes', icon: SOLID_ICONS.roles, href: '/dashboard/taxes' },
        { key: 'analyticAccounts', icon: SOLID_ICONS.nodes, href: '/dashboard/analytic-accounts' },
        { key: 'sales', icon: SOLID_ICONS.deployments, href: '/dashboard/sales-orders' },
        { key: 'purchases', icon: SOLID_ICONS.nodes, href: '/dashboard/purchase-orders' },
        { key: 'payments', icon: SOLID_ICONS.irrigation, href: '/dashboard/payments' },
        { key: 'receipts', icon: SOLID_ICONS.deployments, href: '/dashboard/receipts' },
        { key: 'creditNotes', icon: SOLID_ICONS.invoices, href: '/dashboard/credit-notes' },
        { key: 'debitNotes', icon: SOLID_ICONS.bills, href: '/dashboard/debit-notes' },
        { key: 'budgets', icon: SOLID_ICONS.calendar, href: '/dashboard/budgets' },
        { key: 'reports', icon: SOLID_ICONS.analytics, href: '/dashboard/reports' },
      ],
    },
  ],
  // Business Owner. The only role that self-registers, the only one that
  // creates user accounts, and the only one that may add, modify or
  // archive master data.
  business_owner: [
    {
      key: 'menu',
      items: [
        { key: 'overview', icon: SOLID_ICONS.overview, href: '/dashboard/business-owner' },
        { key: 'contacts', icon: SOLID_ICONS.team, href: '/dashboard/contacts' },
        { key: 'products', icon: SOLID_ICONS.fields, href: '/dashboard/products' },
        { key: 'productCategories', icon: SOLID_ICONS.calendar, href: '/dashboard/product-categories' },
        { key: 'accounts', icon: SOLID_ICONS.analytics, href: '/dashboard/accounts' },
        { key: 'journals', icon: SOLID_ICONS.system, href: '/dashboard/journals' },
        { key: 'taxes', icon: SOLID_ICONS.roles, href: '/dashboard/taxes' },
        { key: 'analyticAccounts', icon: SOLID_ICONS.nodes, href: '/dashboard/analytic-accounts' },
        { key: 'sales', icon: SOLID_ICONS.deployments, href: '/dashboard/sales-orders' },
        { key: 'purchases', icon: SOLID_ICONS.nodes, href: '/dashboard/purchase-orders' },
        { key: 'payments', icon: SOLID_ICONS.irrigation, href: '/dashboard/payments' },
        { key: 'receipts', icon: SOLID_ICONS.deployments, href: '/dashboard/receipts' },
        { key: 'creditNotes', icon: SOLID_ICONS.invoices, href: '/dashboard/credit-notes' },
        { key: 'debitNotes', icon: SOLID_ICONS.bills, href: '/dashboard/debit-notes' },
        { key: 'budgets', icon: SOLID_ICONS.calendar, href: '/dashboard/budgets' },
        { key: 'reports', icon: SOLID_ICONS.analytics, href: '/dashboard/reports' },
        { key: 'users', icon: SOLID_ICONS.directory, href: '/dashboard/users' },
        { key: 'system', icon: SOLID_ICONS.system },
      ],
    },
  ],
};

/**
 * Second nav group — identical for every role.
 *
 * Entries without an `href` are hidden by DashboardFrame until their route
 * exists. Give one an href and it appears; nothing else needs to change.
 */
export const GENERAL_NAV = {
  key: 'general',
  items: [
    { key: 'settings', icon: SOLID_ICONS.settings, href: '/dashboard/settings', roles: ['business_owner'] },
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
