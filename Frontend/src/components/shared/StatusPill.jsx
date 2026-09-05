'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { statusToTone, statusToLabelKey } from '@/utils/status';

/**
 * StatusPill
 * Renders status badges for accounting entities and documents.
 *
 * @param {object} props
 * @param {string} props.status - draft | posted | paid | cancelled | overdue | active ...
 * @param {string} [props.label] - Optional explicit label override
 */
export default function StatusPill({ status, label }) {
  const t = useTranslations('common.status');
  const tone = statusToTone(status);
  const key = statusToLabelKey(status);

  // Derive label from translations if not explicitly passed
  let displayLabel = label;
  if (!displayLabel) {
    try {
      displayLabel = t(key);
    } catch {
      displayLabel = status;
    }
  }

  // Token-based styles derived from Frozen Lake palette
  const toneStyleMap = {
    draft: {
      bg: 'var(--status-draft-bg)',
      color: 'var(--status-draft-text)',
      dot: 'var(--status-draft-text)',
    },
    posted: {
      bg: 'var(--status-posted-bg)',
      color: 'var(--status-posted-text)',
      dot: 'var(--status-posted-text)',
    },
    paid: {
      bg: 'var(--status-paid-bg)',
      color: 'var(--status-paid-text)',
      dot: 'var(--status-paid-text)',
    },
    partial: {
      bg: 'var(--dash-state-mid-bg)',
      color: 'var(--dash-state-mid)',
      dot: 'var(--dash-state-mid)',
    },
    cancelled: {
      bg: 'var(--status-cancelled-bg)',
      color: 'var(--status-cancelled-text)',
      dot: 'var(--status-cancelled-text)',
    },
    overdue: {
      bg: 'var(--status-overdue-bg)',
      color: 'var(--status-overdue-text)',
      dot: 'var(--status-overdue-text)',
    },
    neutral: {
      bg: 'var(--dash-nav-hover-bg)',
      color: 'var(--text-secondary)',
      dot: 'var(--text-secondary)',
    },
  };

  const style = toneStyleMap[tone] || toneStyleMap.neutral;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.2rem 0.65rem',
        borderRadius: '12px',
        backgroundColor: style.bg,
        color: style.color,
        fontFamily: "'Orbitron', monospace",
        fontSize: '0.72rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: style.dot,
        }}
        aria-hidden="true"
      />
      {displayLabel}
    </span>
  );
}
