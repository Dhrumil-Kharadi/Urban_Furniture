'use client';

import React from 'react';
import DashboardFrame from '@/components/dashboard/DashboardFrame';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from '@/i18n/navigation';

export default function TransactionLayout({ children }) {
  const { role } = useAuth();
  const pathname = usePathname();
  const allowedRoles = ['business_owner', 'accountant'];
  const activeKey = pathname.includes('purchase') || pathname.includes('vendor-bill')
    ? 'purchases'
    : pathname.includes('sales') || pathname.includes('customer-invoice')
      ? 'sales'
      : pathname.includes('payment')
        ? 'payments'
        : 'overview';

  return (
    <DashboardFrame
      role={role || 'accountant'}
      allowedRoles={allowedRoles}
      activeKey={activeKey}
    >
      {children}
    </DashboardFrame>
  );
}
