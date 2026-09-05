'use client';

import DashboardFrame from '@/components/dashboard/DashboardFrame';

export default function ReportsLayout({ children }) {
  return (
    <DashboardFrame
      role="accountant"
      allowedRoles={['business_owner', 'accountant']}
      activeKey="reports"
    >
      {children}
    </DashboardFrame>
  );
}
