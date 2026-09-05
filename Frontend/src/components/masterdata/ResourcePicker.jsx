'use client';

// ============================================================
// FILE: src/components/masterdata/ResourcePicker.jsx
//
// Select one record from a master-data collection.
//
// Contacts, analytic accounts and journals all need the same select-from-a-
// scoped-list behaviour; only the service and the label differ. AccountPicker
// stays separate because it filters by account type, which is a rule and not
// just a label.
//
// The list endpoints are already tenant-scoped, so nothing here has to think
// about which organization it is in.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';

import InputBox from '@/reusablefiles/inputbox';

/**
 * @param {object}   props
 * @param {object}   props.service    - Anything with `.list(params, signal)`.
 * @param {string}   props.label
 * @param {string}   props.value
 * @param {Function} props.onChange   - Receives the id (InputBox convention).
 * @param {string}   props.emptyLabel
 * @param {Function} [props.getLabel] - (record) => string. Defaults to `name`.
 * @param {object}   [props.params]   - Extra list params, e.g. { type: 'sales' }.
 * @param {boolean}  [props.disabled]
 */
export default function ResourcePicker({
  service,
  label,
  value,
  onChange,
  emptyLabel,
  getLabel = (record) => record.name,
  params = null,
  disabled = false,
}) {
  const [records, setRecords] = useState([]);

  // Serialised so a fresh object literal each render does not refire the fetch.
  const paramsKey = JSON.stringify(params || {});

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;

    (async () => {
      try {
        const data = await service.list(
          { status: 'active', limit: 100, ...JSON.parse(paramsKey) },
          controller.signal,
        );
        if (!ignore) setRecords(data?.items ?? []);
      } catch {
        // A picker that fails to load leaves the field empty rather than
        // breaking the form around it.
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [service, paramsKey]);

  const options = useMemo(
    () => [
      { value: '', label: emptyLabel },
      ...records.map((record) => ({ value: record.id, label: getLabel(record) })),
    ],
    [records, emptyLabel, getLabel],
  );

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
