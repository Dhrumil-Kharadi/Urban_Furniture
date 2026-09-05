'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/product-categories/[id]/page.jsx
//
// Product category detail.
//
// Archiving is refused with a 409 while products still sit in the category —
// the server names the blocker and this page shows that sentence, because
// "could not archive" on its own tells the reader nothing to act on.
// ============================================================

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import MasterDataFrame from '@/components/masterdata/MasterDataFrame';
import CategoryForm from '@/components/product-categories/CategoryForm';
import { Fact, StatusPill } from '@/components/masterdata/Cells';
import { ListState } from '@/components/masterdata/ListChrome';

import Card, { CardBody } from '@/reusablefiles/card';
import Button from '@/reusablefiles/button';
import Skeleton from '@/reusablefiles/skeleton';
import { PageHead } from '@/reusablefiles/dashboardshell';

import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import useResourceRecord from '@/hooks/useResourceRecord';
import { productCategoriesService } from '@/services/masterdata.service';

export default function ProductCategoryDetailPage() {
  const t = useTranslations('productCategories');
  const tShared = useTranslations('masterData');
  const { id } = useParams();
  const toast = useToast();
  const { role } = useAuth();

  const canManage = role === 'business_owner';

  const { record: category, loading, error, refetch } =
    useResourceRecord(productCategoriesService, id);

  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);
  const [statusBusy, setStatusBusy] = useState(false);

  const handleSave = async (payload) => {
    setSubmitting(true);
    setServerErrors([]);

    try {
      await productCategoriesService.update(id, payload);
      refetch();
      setEditing(false);
      toast.success(tShared('toast.updated'));
    } catch (err) {
      setServerErrors(err?.errors?.length ? err.errors : [err?.message || tShared('toast.error')]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatus = async () => {
    const archiving = category.status === 'active';
    setStatusBusy(true);

    try {
      if (archiving) await productCategoriesService.archive(id);
      else await productCategoriesService.unarchive(id);

      refetch();
      toast.success(tShared(archiving ? 'toast.archived' : 'toast.unarchived'));
    } catch (err) {
      toast.error(err?.message || tShared('toast.error'));
    } finally {
      setStatusBusy(false);
    }
  };

  if (loading) {
    return (
      <MasterDataFrame activeKey="productCategories">
        <div className="md-page">
          <Card className="md-panel">
            <CardBody>
              <Skeleton w="34%" h={20} />
              <Skeleton w="60%" h={12} style={{ marginTop: 12 }} />
            </CardBody>
          </Card>
        </div>
      </MasterDataFrame>
    );
  }

  if (error || !category) {
    return (
      <MasterDataFrame activeKey="productCategories">
        <div className="md-page">
          <Card className="md-panel">
            <ListState
              title={tShared('states.notFound')}
              body={error || tShared('states.errorBody')}
              action={
                <Button variant="ghost" size="sm" href="/dashboard/product-categories">
                  {tShared('actions.back')}
                </Button>
              }
            />
          </Card>
        </div>
      </MasterDataFrame>
    );
  }

  return (
    <MasterDataFrame activeKey="productCategories">
      <div className="md-page">
        <PageHead
          badge={t('badge')}
          title={category.name}
          subtitle={category.description || t('subtitle')}
          actions={
            <>
              <Button variant="ghost" size="sm" href="/dashboard/product-categories">
                {tShared('actions.back')}
              </Button>

              {canManage && !editing ? (
                <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
                  {tShared('actions.edit')}
                </Button>
              ) : null}

              {canManage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={statusBusy}
                  disabled={statusBusy}
                  onClick={handleStatus}
                >
                  {tShared(category.status === 'active' ? 'actions.archive' : 'actions.unarchive')}
                </Button>
              ) : null}
            </>
          }
        />

        <Card className="md-panel">
          <CardBody>
            {editing ? (
              <CategoryForm
                category={category}
                isEdit
                onSubmit={handleSave}
                cancelHref={`/dashboard/product-categories/${category.id}`}
                serverErrors={serverErrors}
                submitting={submitting}
              />
            ) : (
              <div className="md-facts">
                <Fact label={t('fields.name')}>{category.name}</Fact>
                <Fact label={t('fields.description')}>{category.description}</Fact>
                <Fact label={t('fields.status')}>
                  <StatusPill
                    status={category.status}
                    label={tShared(`status.${category.status}`)}
                  />
                </Fact>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </MasterDataFrame>
  );
}
