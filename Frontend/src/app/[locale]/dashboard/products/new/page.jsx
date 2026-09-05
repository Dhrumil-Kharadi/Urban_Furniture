'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/products/new/page.jsx
//
// Create a product. Both roles may create (project.md §3); only the business
// owner may edit one afterwards, which is where the price rule bites.
// ============================================================

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';
import MasterDataFrame from '@/components/masterdata/MasterDataFrame';
import ProductForm from '@/components/products/ProductForm';
import Card, { CardBody } from '@/reusablefiles/card';
import { PageHead } from '@/reusablefiles/dashboardshell';
import { useToast } from '@/context/ToastContext';
import { productsService } from '@/services/masterdata.service';

export default function NewProductPage() {
  const t = useTranslations('products');
  const tShared = useTranslations('masterData');
  const router = useRouter();
  const toast = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setServerErrors([]);

    try {
      const product = await productsService.create(payload);
      toast.success(tShared('toast.created'));
      router.replace(`/dashboard/products/${product.id}`);
    } catch (err) {
      setServerErrors(err?.errors?.length ? err.errors : [err?.message || tShared('toast.error')]);
      setSubmitting(false);
    }
  };

  return (
    <MasterDataFrame activeKey="products">
      <div className="md-page">
        <PageHead
          badge={t('badge')}
          title={t('new.title')}
          subtitle={t('new.subtitle')}
        />

        <Card className="md-panel">
          <CardBody>
            <ProductForm
              onSubmit={handleSubmit}
              cancelHref="/dashboard/products"
              serverErrors={serverErrors}
              submitting={submitting}
            />
          </CardBody>
        </Card>
      </div>
    </MasterDataFrame>
  );
}
