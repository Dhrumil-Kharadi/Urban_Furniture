import api from '@/lib/api';

/** Month index list ending on the current month, oldest first. */
export function lastMonths(count = 6, now = new Date()) {
  const months = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    months.push({ year: date.getFullYear(), month: date.getMonth() });
  }
  return months;
}

/** Load organization users from the authenticated backend session. */
export async function fetchUsers() {
  try {
    const res = await api.get('/auth/admin/users');
    if (res.success && Array.isArray(res.data?.users)) {
      return { users: res.data.users, error: null };
    }
    return { users: [], error: null };
  } catch (error) {
    return { users: [], error: error?.message || 'Failed to load users' };
  }
}

/** Change a user's role through the server-authorized admin endpoint. */
export async function updateUserRole(userId, role) {
  if (!['customer', 'vendor', 'accountant', 'business_owner'].includes(role)) {
    throw new Error('Unsupported role');
  }
  return api.patch(`/auth/admin/users/${userId}/role`, { role });
}

export const ROLE_KEYS = ['customer', 'vendor', 'accountant', 'business_owner'];

/** Derive directory metrics from the real organization user rows. */
export function buildDirectoryMetrics(users = [], now = new Date()) {
  const total = users.length;
  const verified = users.filter((user) => user.email_verified).length;
  const pending = total - verified;
  const months = lastMonths(6, now);
  const signups = months.map(({ year, month }) => users.filter((user) => {
    if (!user.created_at) return false;
    const date = new Date(user.created_at);
    return date.getFullYear() === year && date.getMonth() === month;
  }).length);
  const verifiedByMonth = months.map(({ year, month }) => users.filter((user) => {
    if (!user.created_at || !user.email_verified) return false;
    const date = new Date(user.created_at);
    return date.getFullYear() === year && date.getMonth() === month;
  }).length);
  const ageByRole = ROLE_KEYS.map((role) => ({
    role,
    values: users
      .filter((user) => user.role === role && user.created_at)
      .map((user) => Math.max(0, (now - new Date(user.created_at)) / 86400000)),
  })).filter((group) => group.values.length);

  return {
    total,
    verified,
    pending,
    verificationRate: total ? Math.round((verified / total) * 100) : 0,
    byRole: ROLE_KEYS.map((role) => ({
      role,
      value: users.filter((user) => user.role === role).length,
    })),
    months,
    signups,
    verifiedByMonth,
    newestThisMonth: signups[signups.length - 1] || 0,
    ageByRole,
  };
}
