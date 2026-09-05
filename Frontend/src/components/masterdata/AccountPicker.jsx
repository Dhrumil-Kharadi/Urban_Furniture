'use client';

// ============================================================
// FILE: src/components/masterdata/AccountPicker.jsx
//
// Select an account from the chart.
//
// Journals, taxes and the accounts form itself all need this, and each one
// needs it filtered differently — a tax account must be a liability or an
// asset, a parent account must match its child's type. So the filtering is a
// prop rather than three separate pickers.
//
// The list endpoint is already tenant-scoped and archived rows are excluded,
// so nothing here has to think about either.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';

import InputBox from '@/reusablefiles/inputbox';
import { accountsService } from '@/services/masterdata.service';

/**
 * @param {object}   props
 * @param {string}   props.label
 * @param {string}   props.value
 * @param {Function} props.onChange   - Receives the id (InputBox convention).
 * @param {string}   props.emptyLabel - Text for the "none selected" option.
 * @param {string[]} [props.allowedTypes] - Restrict to these account types.
 * @param {string}   [props.excludeId]    - Hide one account (an account cannot
 *                                          be its own parent).
 * @param {boolean}  [props.disabled]
 */
export default function AccountPicker({
  label,
  value,
  onChange,
  emptyLabel,
  allowedTypes = null,
  excludeId = null,
  disabled = false,
}) {
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;

    (async () => {
      try {
        // MAX_LIMIT is 100 server-side; a chart of accounts larger than that
        // wants a searchable picker, which is a Phase 11 concern.
        const data = await accountsService.list(
          { status: 'active', limit: 100, sortBy: 'code' },
          controller.signal,
        );
        if (!ignore) setAccounts(data?.items ?? []);
      } catch {
        // A picker that fails to load leaves the field empty rather than
        // breaking the whole form.
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, []);

  const options = useMemo(() => {
    const usable = accounts.filter((account) => {
      if (excludeId && account.id === excludeId) return false;
      if (allowedTypes && !allowedTypes.includes(account.account_type)) return false;
      return true;
    });

    return [
      { value: '', label: emptyLabel },
      ...usable.map((account) => ({
        value: account.id,
        label: `${account.code} · ${account.name}`,
      })),
    ];
  }, [accounts, allowedTypes, excludeId, emptyLabel]);

  return (
    <InputBox
      as="select"
      label={label}
      value={value ?? ''}
      onChange={onChange}
      options={options}
      disabled={disabled}
    />
  );
}
