'use client';

import React, { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useToast } from '@/components/shared';
import CustomerInvoiceForm from '@/components/customer-invoices/CustomerInvoiceForm';
import { customerInvoicesService } from '@/services/sales.service';
import { ArrowLeft, Receipt } from 'lucide-react';
import { Link } from '@/i18n/navigation';

export default function NewCustomerInvoicePage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData) => {
    setLoading(true);
    try {
      const created = await customerInvoicesService.create(formData);
      addToast({
        title: 'Success',
        description: `Customer invoice created in draft`,
        type: 'success',
      });
      router.push(`/dashboard/customer-invoices/${created.id}`);
    } catch (err) {
      addToast({
        title: 'Creation Failed',
        description: err.message || 'Could not create customer invoice',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/customer-invoices"
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-400" />
            Create Customer Invoice
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Issue a direct customer invoice for sales revenue and output tax
          </p>
        </div>
      </div>

      <CustomerInvoiceForm
        onSubmit={handleSubmit}
        onCancel={() => router.push('/dashboard/customer-invoices')}
        loading={loading}
      />
    </div>
  );
}
