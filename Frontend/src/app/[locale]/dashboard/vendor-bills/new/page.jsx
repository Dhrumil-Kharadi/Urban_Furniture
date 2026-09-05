'use client';

import React, { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useToast } from '@/components/shared';
import VendorBillForm from '@/components/vendor-bills/VendorBillForm';
import { vendorBillsService } from '@/services/purchases.service';
import { ArrowLeft, Receipt } from 'lucide-react';
import { Link } from '@/i18n/navigation';

export default function NewVendorBillPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData) => {
    setLoading(true);
    try {
      const created = await vendorBillsService.create(formData);
      addToast({
        title: 'Bill Created',
        description: `Draft bill ${created.bill_number} created successfully`,
        type: 'success',
      });
      router.push(`/dashboard/vendor-bills/${created.id}`);
    } catch (err) {
      addToast({
        title: 'Creation Failed',
        description: err.message || 'Could not create vendor bill',
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
          href="/dashboard/vendor-bills"
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-400" />
            Create Vendor Bill
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Record a vendor bill with GL expense allocations and tax credits
          </p>
        </div>
      </div>

      <VendorBillForm
        onSubmit={handleSubmit}
        onCancel={() => router.push('/dashboard/vendor-bills')}
        loading={loading}
      />
    </div>
  );
}
