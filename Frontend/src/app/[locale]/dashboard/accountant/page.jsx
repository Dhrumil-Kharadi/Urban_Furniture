'use client';

import React from 'react';
import DashboardFrame from '@/components/dashboard/DashboardFrame';
import FinancialDashboard from '@/components/dashboard/FinancialDashboard';

export default function AccountantDashboard() {
  return (
    <DashboardFrame role="accountant" activeKey="overview">
      <FinancialDashboard />
    </DashboardFrame>
  );
}
