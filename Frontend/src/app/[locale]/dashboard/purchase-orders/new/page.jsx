'use client';

import React, { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useToast } from '@/components/shared';
import PurchaseOrderForm from '@/components/purchase-orders/PurchaseOrderForm';
import { purchaseOrdersService } from '@/services/purchases.service';
import { ArrowLeft, FileText } from 'lucide-react';
import { Link } from '@/i18n/navigation';

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData) => {
    setLoading(true);
    try {
      const created = await purchaseOrdersService.create(formData);
      addToast({
        title: 'Success',
        description: `Purchase order ${created.po_number} created in draft`,
        type: 'success',
      });
      router.push(`/dashboard/purchase-orders/${created.id}`);
    } catch (err) {
      addToast({
        title: 'Creation Failed',
        description: err.message || 'Could not create purchase order',
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
          href="/dashboard/purchase-orders"
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            Create Purchase Order
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Draft a procurement order for goods or materials from a vendor
          </p>
        </div>
      </div>

      <PurchaseOrderForm
        onSubmit={handleSubmit}
        onCancel={() => router.push('/dashboard/purchase-orders')}
        loading={loading}
      />
    </div>
  );
}
