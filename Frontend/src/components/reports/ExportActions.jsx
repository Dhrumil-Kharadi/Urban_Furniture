'use client';

/**
 * @file ExportActions Component
 * @spec Doc/project.md §6
 * 
 * Action buttons for Print, PDF Export, and Excel (.xlsx) Download
 * using Frozen Lake design tokens.
 */

import React from 'react';
import { Printer, FileDown, Table } from 'lucide-react';
import Button from '@/reusablefiles/button';

export default function ExportActions({ onExportPDF, onExportExcel, onPrint }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {onPrint && (
        <Button variant="outline" size="sm" onClick={onPrint} icon={<Printer size={13} />}>
          Print
        </Button>
      )}
      {onExportPDF && (
        <Button variant="outline" size="sm" onClick={onExportPDF} icon={<FileDown size={13} />}>
          PDF
        </Button>
      )}
      {onExportExcel && (
        <Button variant="outline" size="sm" onClick={onExportExcel} icon={<Table size={13} />}>
          Excel
        </Button>
      )}
    </div>
  );
}
