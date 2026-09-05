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
    <div className="tx-page tx-page--narrow">
      <div className="tx-detail-header">
        <Link
          href="/dashboard/purchase-orders"
          className="tx-back-btn"
        >
          <ArrowLeft className="tx-back-icon" />
        </Link>
        <div>
          <h1 className="tx-detail-title">
            <FileText className="tx-detail-title-icon" />
            Create Purchase Order
          </h1>
          <p className="tx-detail-subtitle">
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
