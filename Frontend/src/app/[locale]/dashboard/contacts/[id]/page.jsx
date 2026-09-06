'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/contacts/[id]/page.jsx
//
// Contact detail — Details / Invoices / Bills / Payments.
// Shows contact profile, connected customer invoices, vendor bills, and payments.
// ============================================================

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import MasterDataFrame from '@/components/masterdata/MasterDataFrame';
import ContactForm from '@/components/contacts/ContactForm';
import PortalAccessPanel from '@/components/contacts/PortalAccessPanel';
import ProfileImagePanel from '@/components/contacts/ProfileImagePanel';
import { Fact, StatusPill, MoneyText } from '@/components/masterdata/Cells';
import { ListState } from '@/components/masterdata/ListChrome';

import Card, { CardBody } from '@/reusablefiles/card';
import Button from '@/reusablefiles/button';
import Pill from '@/reusablefiles/pill';
import Skeleton from '@/reusablefiles/skeleton';
import DataTable from '@/reusablefiles/datatable';
import { PageHead } from '@/reusablefiles/dashboardshell';

import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import useResourceRecord from '@/hooks/useResourceRecord';
import { contactsService } from '@/services/masterdata.service';
import { customerInvoicesService } from '@/services/sales.service';
import { vendorBillsService } from '@/services/purchases.service';
import { paymentsService } from '@/services/payments.service';
import { formatDate } from '@/utils/format';

const TABS = ['details', 'invoices', 'bills', 'payments'];

export default function ContactDetailPage() {
  const t = useTranslations('contacts');
  const tShared = useTranslations('masterData');
  const { id } = useParams();
  const toast = useToast();
  const { role } = useAuth();

  const canManage = role === 'business_owner';

  const { record: contact, loading, error, refetch, setRecord } =
    useResourceRecord(contactsService, id);

  const [tab, setTab] = useState('details');
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);
  const [statusBusy, setStatusBusy] = useState(false);

  // Transaction tab states
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);

  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const fetchInvoices = useCallback(async () => {
    if (!id) return;
    setInvoicesLoading(true);
    try {
      const res = await customerInvoicesService.list({ customer_contact_id: id, limit: 50 });
      setInvoices(res?.items || []);
    } catch {
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, [id]);

  const fetchBills = useCallback(async () => {
    if (!id) return;
    setBillsLoading(true);
    try {
      const res = await vendorBillsService.list({ vendor_contact_id: id, limit: 50 });
      setBills(res?.items || []);
    } catch {
      setBills([]);
    } finally {
      setBillsLoading(false);
    }
  }, [id]);

  const fetchPayments = useCallback(async () => {
    if (!id) return;
    setPaymentsLoading(true);
    try {
      const res = await paymentsService.list({ contact_id: id, limit: 50 });
      setPayments(res?.items || []);
    } catch {
      setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (tab === 'invoices') fetchInvoices();
    else if (tab === 'bills') fetchBills();
    else if (tab === 'payments') fetchPayments();
  }, [tab, fetchInvoices, fetchBills, fetchPayments]);

  const handleSave = async (payload) => {
    setSubmitting(true);
    setServerErrors([]);

    try {
      await contactsService.update(id, payload);
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
    const archiving = contact.status === 'active';
    setStatusBusy(true);

    try {
      if (archiving) await contactsService.archive(id);
      else await contactsService.unarchive(id);

      refetch();
      toast.success(tShared(archiving ? 'toast.archived' : 'toast.unarchived'));
    } catch (err) {
      toast.error(err?.message || tShared('toast.error'));
    } finally {
      setStatusBusy(false);
    }
  };

  const tabs = useMemo(
    () =>
      TABS.map((key) => (
        <button
          key={key}
          type="button"
          className={`md-tab${tab === key ? ' is-active' : ''}`}
          onClick={() => setTab(key)}
          aria-current={tab === key ? 'true' : undefined}
        >
          {t(`tabs.${key}`)}
        </button>
      )),
    [tab, t],
  );

  const invoiceColumns = useMemo(
    () => [
      {
        key: 'invoice_number',
        header: 'Invoice #',
        render: (row) => (
          <Link
            href={`/dashboard/customer-invoices/${row.id}`}
            style={{ fontWeight: 600, color: 'var(--accent-primary)', textDecoration: 'none' }}
          >
            {row.invoice_number}
          </Link>
        ),
      },
      {
        key: 'invoice_date',
        header: 'Date',
        render: (row) => formatDate(row.invoice_date),
      },
      {
        key: 'due_date',
        header: 'Due Date',
        render: (row) => formatDate(row.due_date),
      },
      {
        key: 'total_amount',
        header: 'Total',
        align: 'right',
        render: (row) => <MoneyText value={row.total_amount} />,
      },
      {
        key: 'amount_due',
        header: 'Due',
        align: 'right',
        render: (row) => (
          <span style={{ fontWeight: 600, color: Number(row.amount_due) > 0 ? '#ef4444' : '#10b981' }}>
            <MoneyText value={row.amount_due} />
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <Pill
            tone={
              row.status === 'paid'
                ? 'strong'
                : row.status === 'overdue' || row.is_overdue
                ? 'danger'
                : row.status === 'posted'
                ? 'mid'
                : 'soft'
            }
            size="sm"
            dot
          >
            {row.is_overdue && row.status !== 'paid' ? 'overdue' : row.status}
          </Pill>
        ),
      },
    ],
    [],
  );

  const billColumns = useMemo(
    () => [
      {
        key: 'bill_number',
        header: 'Bill #',
        render: (row) => (
          <Link
            href={`/dashboard/vendor-bills/${row.id}`}
            style={{ fontWeight: 600, color: 'var(--accent-primary)', textDecoration: 'none' }}
          >
            {row.bill_number}
          </Link>
        ),
      },
      {
        key: 'bill_date',
        header: 'Date',
        render: (row) => formatDate(row.bill_date),
      },
      {
        key: 'due_date',
        header: 'Due Date',
        render: (row) => formatDate(row.due_date),
      },
      {
        key: 'total_amount',
        header: 'Total',
        align: 'right',
        render: (row) => <MoneyText value={row.total_amount} />,
      },
      {
        key: 'amount_due',
        header: 'Due',
        align: 'right',
        render: (row) => (
          <span style={{ fontWeight: 600, color: Number(row.amount_due) > 0 ? '#ef4444' : '#10b981' }}>
            <MoneyText value={row.amount_due} />
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <Pill
            tone={row.status === 'paid' ? 'strong' : row.status === 'posted' ? 'mid' : 'soft'}
            size="sm"
            dot
          >
            {row.status}
          </Pill>
        ),
      },
    ],
    [],
  );

  const paymentColumns = useMemo(
    () => [
      {
        key: 'payment_number',
        header: 'Payment #',
        render: (row) => (
          <Link
            href={`/dashboard/payments/${row.id}`}
            style={{ fontWeight: 600, color: 'var(--accent-primary)', textDecoration: 'none' }}
          >
            {row.payment_number}
          </Link>
        ),
      },
      {
        key: 'payment_date',
        header: 'Date',
        render: (row) => formatDate(row.payment_date),
      },
      {
        key: 'direction',
        header: 'Direction',
        render: (row) => (
          <Pill tone={row.direction === 'inbound' ? 'strong' : 'mid'} size="sm">
            {row.direction === 'inbound' ? 'Customer Payment' : 'Vendor Payment'}
          </Pill>
        ),
      },
      {
        key: 'method',
        header: 'Method',
        render: (row) => <Pill tone="soft" size="sm">{row.method}</Pill>,
      },
      {
        key: 'amount',
        header: 'Amount',
        align: 'right',
        render: (row) => <MoneyText value={row.amount} />,
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <Pill tone={row.status === 'posted' ? 'strong' : 'soft'} size="sm" dot>
            {row.status}
          </Pill>
        ),
      },
    ],
    [],
  );

  if (loading) {
    return (
      <MasterDataFrame activeKey="contacts">
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

  if (error || !contact) {
    return (
      <MasterDataFrame activeKey="contacts">
        <div className="md-page">
          <Card className="md-panel">
            <ListState
              title={tShared('states.notFound')}
              body={error || tShared('states.errorBody')}
              action={
                <Button variant="ghost" size="sm" href="/dashboard/contacts">
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
    <MasterDataFrame activeKey="contacts">
      <div className="md-page">
        <PageHead
          badge={t('badge')}
          title={contact.name}
          subtitle={t(`types.${contact.contact_type}`)}
          actions={
            <>
              <Button variant="ghost" size="sm" href="/dashboard/contacts">
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
                  {tShared(contact.status === 'active' ? 'actions.archive' : 'actions.unarchive')}
                </Button>
              ) : null}
            </>
          }
        />

        <div className="md-detail-grid">
          <Card tone="plain" className="md-panel">
            <div className="md-tabs">{tabs}</div>

            <div className="md-panel-body">
              {tab === 'details' && (
                editing ? (
                  <ContactForm
                    contact={contact}
                    isEdit
                    onSubmit={handleSave}
                    cancelHref={`/dashboard/contacts/${contact.id}`}
                    serverErrors={serverErrors}
                    submitting={submitting}
                  />
                ) : (
                  <div className="md-facts">
                    <Fact label={t('fields.name')}>{contact.name}</Fact>
                    <Fact label={t('fields.type')}>
                      <Pill tone="mid" size="sm">{t(`types.${contact.contact_type}`)}</Pill>
                    </Fact>
                    <Fact label={t('fields.email')}>{contact.email}</Fact>
                    <Fact label={t('fields.mobile')}>{contact.mobile}</Fact>
                    <Fact label={t('fields.city')}>{contact.city}</Fact>
                    <Fact label={t('fields.state')}>{contact.state}</Fact>
                    <Fact label={t('fields.pincode')}>{contact.pincode}</Fact>
                    <Fact label={t('fields.status')}>
                      <StatusPill
                        status={contact.status}
                        label={tShared(`status.${contact.status}`)}
                      />
                    </Fact>
                  </div>
                )
              )}

              {tab === 'invoices' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Customer Invoices</h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                        All sales invoices issued to {contact.name}
                      </p>
                    </div>
                    {(contact.contact_type === 'customer' || contact.contact_type === 'both') && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Plus size={14} />}
                        href={`/dashboard/customer-invoices/new?customer_id=${contact.id}`}
                      >
                        New Invoice
                      </Button>
                    )}
                  </div>

                  <DataTable
                    columns={invoiceColumns}
                    rows={invoices}
                    loading={invoicesLoading}
                    loadingLabel="Loading invoices…"
                    emptyLabel="No customer invoices found for this contact."
                  />
                </div>
              )}

              {tab === 'bills' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Vendor Bills</h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                        All bills received from {contact.name}
                      </p>
                    </div>
                    {(contact.contact_type === 'vendor' || contact.contact_type === 'both') && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Plus size={14} />}
                        href={`/dashboard/vendor-bills/new?vendor_id=${contact.id}`}
                      >
                        New Bill
                      </Button>
                    )}
                  </div>

                  <DataTable
                    columns={billColumns}
                    rows={bills}
                    loading={billsLoading}
                    loadingLabel="Loading vendor bills…"
                    emptyLabel="No vendor bills found for this contact."
                  />
                </div>
              )}

              {tab === 'payments' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Payment Transactions</h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                        All payment entries recorded with {contact.name}
                      </p>
                    </div>
                  </div>

                  <DataTable
                    columns={paymentColumns}
                    rows={payments}
                    loading={paymentsLoading}
                    loadingLabel="Loading payments…"
                    emptyLabel="No payments recorded for this contact."
                  />
                </div>
              )}
            </div>
          </Card>

          <div className="md-page">
            <PortalAccessPanel
              contact={contact}
              canManage={canManage}
              onChange={(updated) => {
                setRecord((current) => ({ ...current, ...updated }));
                refetch();
              }}
            />

            <ProfileImagePanel
              contact={contact}
              canManage={canManage}
              onChange={(updated) =>
                setRecord((current) => ({ ...current, ...updated }))
              }
            />
          </div>
        </div>
      </div>
    </MasterDataFrame>
  );
}
