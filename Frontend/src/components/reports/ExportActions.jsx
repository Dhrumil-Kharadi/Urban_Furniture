'use client';

/**
 * @file ExportActions Component
 * @spec Doc/project.md §6
 * 
 * PROMPT & IMPLEMENTATION GUIDELINES:
 * - Action buttons for Print, PDF Export, and Excel (.xlsx) Download.
 */

export default function ExportActions({ onExportPDF, onExportExcel, onPrint }) {
  return (
    <div className="flex gap-2">
      <button className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Print</button>
      <button className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">PDF</button>
      <button className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Excel</button>
    </div>
  );
}
