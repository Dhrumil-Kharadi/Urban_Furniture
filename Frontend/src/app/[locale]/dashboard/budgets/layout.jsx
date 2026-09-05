'use client';

import DashboardFrame from '@/components/dashboard/DashboardFrame';

export default function BudgetsLayout({ children }) {
  return (
    <DashboardFrame
      role="accountant"
      allowedRoles={['business_owner', 'accountant']}
      activeKey="budgets"
    >
      {children}
    </DashboardFrame>
  );
}
