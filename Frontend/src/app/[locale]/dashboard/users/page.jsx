'use client';

// ============================================================
// FILE: src/app/[locale]/dashboard/users/page.jsx
// ROUTE: /dashboard/users
//
// Organization user management — BUSINESS OWNER ONLY.
//
// project.md §2.1 and §3 make the business owner the only role that can
// create accounts, and the accountant the only role that can be created:
// contacts get their logins automatically when their Contact record is made,
// and nobody self-registers into an existing organization. This page is the
// screen that rule describes; without it the invite endpoint the backend
// already exposes had no way to be reached.
//
// The role is fixed server-side — POST /api/users/invite always writes
// role='accountant' — so there is deliberately no role picker here.
//
// Reference: project.md §2.1, §3 · strict.md
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { UserPlus, RefreshCw, Search } from 'lucide-react';

import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import DashboardFrame from '@/components/dashboard/DashboardFrame';
import { PageHead } from '@/reusablefiles/dashboardshell';
import Card, { CardBody, CardHead } from '@/reusablefiles/card';
import DataTable from '@/reusablefiles/datatable';
import InputBox from '@/reusablefiles/inputbox';
import Button from '@/reusablefiles/button';
import Pill, { RolePill } from '@/reusablefiles/pill';

const KNOWN_STATUSES = ['active', 'inactive', 'invited', 'suspended'];

export default function UsersManagementPage() {
  const t = useTranslations('users');
  const tDash = useTranslations('dashboard');
  const tCommon = useTranslations('dashboard.common');
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/users', { params: { limit: 100 } });
      if (res.success) {
        setUsers(res.data?.items || []);
      }
    } catch (err) {
      setError(err?.message || t('loadError'));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleInvite = async (e) => {
    e.preventDefault();

    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast.error(t('requiredFields'));
      return;
    }

    setInviting(true);
    try {
      const email = inviteEmail.trim().toLowerCase();
      await api.post('/users/invite', { name: inviteName.trim(), email });
      toast.success(t('inviteSent', { email }));
      setInviteName('');
      setInviteEmail('');
      setInviteOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err?.message || t('inviteFailed'));
    } finally {
      setInviting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    const nextStatus = user.status === 'active' ? 'inactive' : 'active';
    setBusyId(user.id);
    try {
      await api.patch(`/users/${user.id}/status`, { status: nextStatus });
      toast.success(t('statusUpdated'));
      fetchUsers();
    } catch (err) {
      toast.error(err?.message || t('statusFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.email].some((field) => field && String(field).toLowerCase().includes(q)),
    );
  }, [users, search]);

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: t('table.name'),
        render: (u) => <span className="ui-cell-strong">{u.name}</span>,
      },
      { key: 'email', header: t('table.email') },
      {
        key: 'role',
        header: t('table.role'),
        render: (u) => <RolePill role={u.role} label={tDash(`roles.${u.role}`)} />,
      },
      {
        key: 'status',
        header: t('table.status'),
        render: (u) => (
          <Pill tone={u.status === 'active' ? 'strong' : 'soft'} size="sm" dot>
            {KNOWN_STATUSES.includes(u.status) ? t(`status.${u.status}`) : u.status}
          </Pill>
        ),
      },
      {
        key: 'created_at',
        header: t('table.joined'),
        render: (u) => (u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'),
      },
      {
        key: 'actions',
        header: t('table.actions'),
        align: 'right',
        render: (u) =>
          // The owner's own account has no deactivate path — locking yourself
          // out of the organization you own is not a state worth reaching.
          u.role === 'business_owner' ? (
            <span className="users-locked-note">{t('ownerLocked')}</span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              loading={busyId === u.id}
              disabled={busyId === u.id}
              onClick={() => handleToggleStatus(u)}
            >
              {u.status === 'active' ? t('deactivate') : t('activate')}
            </Button>
          ),
      },
    ],
    // handleToggleStatus is stable enough for this list; it only closes over
    // setters and fetchUsers.
    [t, tDash, busyId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <DashboardFrame role="business_owner" activeKey="users">
      <div className="md-page">
        <PageHead
          badge={t('badge')}
          title={t('title')}
          subtitle={error || t('subtitle')}
          actions={
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={<RefreshCw size={14} className={loading ? 'ui-spin' : ''} />}
                onClick={fetchUsers}
                disabled={loading}
              >
                {tCommon('refresh')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<UserPlus size={15} />}
                onClick={() => setInviteOpen((open) => !open)}
              >
                {t('inviteAccountant')}
              </Button>
            </>
          }
        />

        {inviteOpen ? (
          <Card className="md-panel">
            <CardHead title={t('inviteTitle')} subtitle={t('inviteHint')} />
            <CardBody>
              <form className="users-invite-form" onSubmit={handleInvite} noValidate>
                <InputBox
                  label={t('nameLabel')}
                  value={inviteName}
                  onChange={setInviteName}
                  placeholder={t('namePlaceholder')}
                  disabled={inviting}
                />
                <InputBox
                  label={t('emailLabel')}
                  type="email"
                  value={inviteEmail}
                  onChange={setInviteEmail}
                  placeholder={t('emailPlaceholder')}
                  disabled={inviting}
                />
                <div className="users-invite-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInviteOpen(false)}
                    disabled={inviting}
                  >
                    {t('cancel')}
                  </Button>
                  <Button variant="primary" size="sm" type="submit" loading={inviting} disabled={inviting}>
                    {inviting ? t('sendingInvite') : t('sendInvite')}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        ) : null}

        <Card className="md-panel">
          <CardHead
            title={t('title')}
            action={
              <InputBox
                value={search}
                onChange={setSearch}
                placeholder={t('searchPlaceholder')}
                icon={<Search size={15} strokeWidth={2} aria-hidden="true" />}
                size="sm"
                className="ui-head-search"
                aria-label={t('searchPlaceholder')}
              />
            }
          />
          <CardBody>
            <DataTable
              columns={columns}
              rows={filtered}
              loading={loading}
              loadingLabel={tCommon('loadingDirectory')}
              emptyLabel={error || t('empty')}
            />
          </CardBody>
        </Card>
      </div>
    </DashboardFrame>
  );
}
