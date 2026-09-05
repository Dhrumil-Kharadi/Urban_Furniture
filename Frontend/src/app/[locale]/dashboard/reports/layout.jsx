'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/reports/layout.jsx
//
// Every reports route renders inside the dashboard shell.
//
// The report pages themselves were written as bare <div className="report-…">
// trees, so they rendered without a sidebar, without a topbar and without the
// role guard — reachable only by typing the URL, and looking like a different
// application once you got there. Putting the frame in a layout wires all
// eight routes (hub, balance sheet, P&L, budget, trial balance, general
// ledger, aged receivables, aged payables) at once, and keeps the guard in
// one place.
//
// Reference: project.md §6 · strict.md
// ============================================================

import React from 'react';
import MasterDataFrame from '@/components/masterdata/MasterDataFrame';

export default function ReportsLayout({ children }) {
  return <MasterDataFrame activeKey="reports">{children}</MasterDataFrame>;
}
