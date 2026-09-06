'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/products/[id]/page.jsx
//
// Product detail.
//
// The Edit control is rendered ONLY for the business owner — project.md §3
// lists Modify under Admin and not under Accountant, and price changes are the
// reason. The server enforces the same rule; this only keeps an accountant
// from being offered a button that would 403.
//
// Archiving and repricing change this record and nothing else. Documents
// already issued keep the price they were issued at.
// ============================================================

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import MasterDataFrame from '@/components/masterdata/MasterDataFrame';
import ProductForm from '@/components/products/ProductForm';
import { Fact, StatusPill, MoneyText } from '@/components/masterdata/Cells';
import { ListState } from '@/components/masterdata/ListChrome';

import Card, { CardBody } from '@/reusablefiles/card';
import Button from '@/reusablefiles/button';
import Pill from '@/reusablefiles/pill';
import Skeleton from '@/reusablefiles/skeleton';
import { PageHead } from '@/reusablefiles/dashboardshell';

import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import useResourceRecord from '@/hooks/useResourceRecord';
import { productsService } from '@/services/masterdata.service';

export default function ProductDetailPage() {
  const t = useTranslations('products');
  const tShared = useTranslations('masterData');
  const { id } = useParams();
  const toast = useToast();
  const { role } = useAuth();

  const canManage = role === 'business_owner';

  const { record: product, loading, error, refetch } = useResourceRecord(productsService, id);

  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);
  const [statusBusy, setStatusBusy] = useState(false);

  const handleSave = async (payload) => {
    setSubmitting(true);
    setServerErrors([]);

    try {
      await productsService.update(id, payload);
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
    const archiving = product.status === 'active';
    setStatusBusy(true);

    try {
      if (archiving) await productsService.archive(id);
      else await productsService.unarchive(id);

      refetch();
      toast.success(tShared(archiving ? 'toast.archived' : 'toast.unarchived'));
    } catch (err) {
      // A 409 here is the reference guard: the product is on a posted
      // document and may not be archived. Show the server's sentence, which
      // names the blocker.
      toast.error(err?.message || tShared('toast.error'));
    } finally {
      setStatusBusy(false);
    }
  };

  if (loading) {
    return (
      <MasterDataFrame activeKey="products">
        <div className="md-page">
          <Card className="md-panel">
            <CardBody>
              <Skeleton w="34%" h={20} />
              <Skeleton w="60%" h={12} style={{ marginTop: 12 }} />
              <Skeleton w="46%" h={12} style={{ marginTop: 8 }} />
            </CardBody>
          </Card>
        </div>
      </MasterDataFrame>
    );
  }

  if (error || !product) {
    return (
      <MasterDataFrame activeKey="products">
        <div className="md-page">
          <Card className="md-panel">
            <ListState
              title={tShared('states.notFound')}
              body={error || tShared('states.errorBody')}
              action={
                <Button variant="ghost" size="sm" href="/dashboard/products">
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
    <MasterDataFrame activeKey="products">
      <div className="md-page">
        <PageHead
          badge={t('badge')}
          title={product.name}
          subtitle={t(`types.${product.product_type}`)}
          actions={
            <>
              <Button variant="ghost" size="sm" href="/dashboard/products">
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
                  {tShared(product.status === 'active' ? 'actions.archive' : 'actions.unarchive')}
                </Button>
              ) : null}
            </>
          }
        />

        <Card className="md-panel">
          <CardBody>
            {editing ? (
              <ProductForm
                product={product}
                isEdit
                onSubmit={handleSave}
                cancelHref={`/dashboard/products/${product.id}`}
                serverErrors={serverErrors}
                submitting={submitting}
              />
            ) : (
              <>
                <div className="md-facts">
                  <Fact label={t('fields.name')}>{product.name}</Fact>
                  <Fact label={t('fields.sku')}>
                    {product.sku ? <span className="md-cell-code">{product.sku}</span> : null}
                  </Fact>
                  <Fact label={t('fields.type')}>
                    <Pill tone="mid" size="sm">{t(`types.${product.product_type}`)}</Pill>
                  </Fact>
                  <Fact label={t('fields.category')}>{product.category_name}</Fact>
                  {product.description ? (
                    <Fact label={t('fields.description')}>{product.description}</Fact>
                  ) : null}
                  <Fact label="Available Stock">
                    {Number(product.available_qty || 0) <= 0 ? (
                      <Pill tone="crit" size="sm">⚠️ Out of Stock (0 units)</Pill>
                    ) : Number(product.available_qty || 0) <= 5 ? (
                      <Pill tone="warn" size="sm">⚠️ Low Stock ({product.available_qty} units)</Pill>
                    ) : (
                      <Pill tone="good" size="sm">✅ In Stock ({product.available_qty} units)</Pill>
                    )}
                  </Fact>
                  <Fact label={t('fields.salesPrice')} money>
                    <MoneyText value={product.sales_price} />
                  </Fact>
                  <Fact label={t('fields.costPrice')} money>
                    <MoneyText value={product.cost_price} />
                  </Fact>
                  <Fact label={t('fields.salesTax')}>
                    {product.sales_tax_name ? `${product.sales_tax_name} (${product.sales_tax_rate}%)` : 'None'}
                  </Fact>
                  <Fact label={t('fields.purchaseTax')}>
                    {product.purchase_tax_name ? `${product.purchase_tax_name} (${product.purchase_tax_rate}%)` : 'None'}
                  </Fact>
                  <Fact label={t('fields.status')}>
                    <StatusPill
                      status={product.status}
                      label={tShared(`status.${product.status}`)}
                    />
                  </Fact>
                </div>

                <p className="md-form-hint">{t('priceNote')}</p>

                {product.product_type === 'combo' ? (
                  <p className="md-form-hint">{t('comboNote')}</p>
                ) : null}

                {!canManage ? (
                  <p className="md-form-hint">{t('pricesAdminOnly')}</p>
                ) : null}
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </MasterDataFrame>
  );
}
