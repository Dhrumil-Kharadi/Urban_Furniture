'use client';

// ============================================================
// FILE: src/components/masterdata/MasterDataFrame.jsx
//
// Shell wrapper for the master-data routes.
//
// DashboardFrame wants the role whose navigation to draw; these pages are
// reachable by both the business owner and the accountant, so the nav follows
// whoever is signed in while the guard admits both.
//
// The guard here is UX only. Every rule it expresses — who may read, who may
// modify — is enforced again on the server, which is the actual boundary.
// ============================================================

import React from 'react';

import DashboardFrame from '@/components/dashboard/DashboardFrame';
import { useAuth } from '@/context/AuthContext';

const MASTER_DATA_ROLES = ['business_owner', 'accountant'];

/**
 * @param {string} props.activeKey - Sidebar entry to highlight.
 * @param {React.ReactNode} props.children
 */
export default function MasterDataFrame({ activeKey, children }) {
  const { role } = useAuth();

  return (
    <DashboardFrame
      role={MASTER_DATA_ROLES.includes(role) ? role : 'accountant'}
      activeKey={activeKey}
      allowedRoles={MASTER_DATA_ROLES}
    >
      {children}
    </DashboardFrame>
  );
}

export { MASTER_DATA_ROLES };
