'use client';

// ============================================================
// FILE: src/components/landingpage/CTASection.jsx
//
// Static call-to-action section. Wired through useTranslations()
// so every visible string is locale-aware.
// ============================================================

import { useTranslations } from 'next-intl';
import { usePageTransition } from '@/reusablefiles/pagetransition';

export default function CTASection() {
  const t = useTranslations('cta');
  const tTitle = useTranslations('cta.titleParts');
  const tActions = useTranslations('cta.actions');
  const { trigger } = usePageTransition();

  const handleGetStarted = () => {
    trigger({
      to: '/auth/login',
      text: 'Initializing Furnova',
      subtitle: 'Preparing sign-in workspace',
    });
  };

  const handleSecondary = () => {
    const el = document.getElementById('features');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="cta-section">
      <div className="section-container">
        <div className="cta-box reveal">
          <div
            className="section-eyebrow"
            style={{ justifyContent: 'center', marginBottom: '20px' }}
          >
            {t('eyebrow')}
          </div>

          <h2 className="cta-title">
            {tTitle('before')}{' '}
            <span className="text-green">{tTitle('accent')}</span>{' '}
            {tTitle('after')}
          </h2>

          <p className="cta-desc">{t('intro')}</p>

          <div className="cta-actions">
            <button className="btn-primary" onClick={handleGetStarted}>
              {tActions('primary')}
            </button>
            <button className="btn-secondary" onClick={handleSecondary}>
              {tActions('secondary')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
