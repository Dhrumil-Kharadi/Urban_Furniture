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
    <div className="tx-page tx-page--narrow">
      <div className="tx-detail-header">
        <Link
          href="/dashboard/vendor-bills"
          className="tx-back-btn"
        >
          <ArrowLeft className="tx-back-icon" />
        </Link>
        <div>
          <h1 className="tx-detail-title">
            <Receipt className="tx-detail-title-icon" />
            Create Vendor Bill
          </h1>
          <p className="tx-detail-subtitle">
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
