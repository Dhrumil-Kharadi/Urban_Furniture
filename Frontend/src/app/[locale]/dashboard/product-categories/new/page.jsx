'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/product-categories/new/page.jsx
//
// Create a product category.
// ============================================================

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';
import MasterDataFrame from '@/components/masterdata/MasterDataFrame';
import CategoryForm from '@/components/product-categories/CategoryForm';
import Card, { CardBody } from '@/reusablefiles/card';
import { PageHead } from '@/reusablefiles/dashboardshell';
import { useToast } from '@/context/ToastContext';
import { productCategoriesService } from '@/services/masterdata.service';

export default function NewProductCategoryPage() {
  const t = useTranslations('productCategories');
  const tShared = useTranslations('masterData');
  const router = useRouter();
  const toast = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setServerErrors([]);

    try {
      const category = await productCategoriesService.create(payload);
      toast.success(tShared('toast.created'));
      router.replace(`/dashboard/product-categories/${category.id}`);
    } catch (err) {
      setServerErrors(err?.errors?.length ? err.errors : [err?.message || tShared('toast.error')]);
      setSubmitting(false);
    }
  };

  return (
    <MasterDataFrame activeKey="productCategories">
      <div className="md-page">
        <PageHead
          badge={t('badge')}
          title={t('new.title')}
          subtitle={t('new.subtitle')}
        />

        <Card className="md-panel">
          <CardBody>
            <CategoryForm
              onSubmit={handleSubmit}
              cancelHref="/dashboard/product-categories"
              serverErrors={serverErrors}
              submitting={submitting}
            />
          </CardBody>
        </Card>
      </div>
    </MasterDataFrame>
  );
}
