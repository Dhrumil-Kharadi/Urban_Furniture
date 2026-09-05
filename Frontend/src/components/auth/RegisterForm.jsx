'use client';

import React, { useState, useEffect, useCallback } from 'react';
import useFormDraft from '@/hooks/useFormDraft';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import api from '@/lib/api';
import { formatChallenge, normalizeDigits } from '@/lib/captcha';

export default function RegisterForm({ onSwitchToLogin, onSwitchToVerifyEmail }) {
  const t = useTranslations('auth');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorList, setErrorList] = useState([]);
  const [captcha, setCaptcha] = useState({ captchaId: '', challenge: '', operands: null, loading: true });

  // Retained across a locale switch (which remounts this tree). Both
  // password fields and the captcha answer are excluded — see useFormDraft.
  const [formData, setFormData, clearDraft] = useFormDraft(
    'auth:register',
    {
      organizationName: '',
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      captchaAnswer: '',
      agreeTerms: false,
    },
    { exclude: ['password', 'confirmPassword', 'captchaAnswer'] },
  );

  const fetchCaptcha = useCallback(async () => {
    try {
      setCaptcha((prev) => ({ ...prev, loading: true }));
      const res = await api.get('/auth/captcha');
      if (res.success && res.data) {
        setCaptcha({
          captchaId: res.data.captchaId,
          operands: res.data.operands || null,
          challenge: res.data.challenge,
          loading: false,
        });
      }
    } catch {
      setCaptcha((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadCaptcha() {
      try {
        const res = await api.get('/auth/captcha');
        if (!ignore && res.success && res.data) {
          setCaptcha({
            captchaId: res.data.captchaId,
          operands: res.data.operands || null,
            challenge: res.data.challenge,
            loading: false,
          });
        }
      } catch {
        if (!ignore) {
          setCaptcha((prev) => ({ ...prev, loading: false }));
        }
      }
    }
    loadCaptcha();
    return () => {
      ignore = true;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorList([]);

    if (
      !formData.organizationName.trim() ||
      !formData.fullName.trim() ||
      !formData.email.trim() ||
      !formData.password
    ) {
      setErrorList([t('errors.generic')]);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorList([t('errors.passwordsDoNotMatch')]);
      return;
    }

    if (!formData.agreeTerms) {
      setErrorList([t('errors.termsRequired')]);
      return;
    }

    if (!formData.captchaAnswer) {
      setErrorList([t('errors.captchaRequired')]);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        organizationName: formData.organizationName.trim(),
        name: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        captchaId: captcha.captchaId,
        captchaAnswer: normalizeDigits(formData.captchaAnswer.trim()),
      };

      const res = await api.post('/auth/register', payload);

      if (res.success) {
        clearDraft(); // the form served its purpose — drop the retained fields
        if (onSwitchToVerifyEmail) {
          onSwitchToVerifyEmail(formData.email.trim().toLowerCase());
        }
      }
    } catch (err) {
      if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
        setErrorList(err.errors);
      } else if (err.message) {
        setErrorList([err.message]);
      } else {
        setErrorList([t('errors.generic')]);
      }
      setFormData((prev) => ({ ...prev, captchaAnswer: '' }));
      fetchCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <header className="form-head-auth">
        <h1 className="form-title-auth">{t('register.title')}</h1>
        <p className="form-sub-auth">
          {t('register.subtitle')}{' '}
          {onSwitchToLogin ? (
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="btn-link-auth link-auth"
            >
              {t('register.switchAction')}
            </button>
          ) : (
            <Link href="/auth/login" className="link-auth">
              {t('register.switchAction')}
            </Link>
          )}
        </p>
      </header>

      {/* Error Message Banner */}
      {errorList.length > 0 && (
        <div className="error-banner-auth" role="alert">
          <svg
            className="error-icon-auth"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="error-content-auth">
            {errorList.length === 1 ? (
              <p className="error-title-auth">{errorList[0]}</p>
            ) : (
              <ul className="error-list-auth">
                {errorList.map((err, idx) => (
                  <li key={idx} className="error-list-item-auth">
                    {err}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <form className="login-form-auth" onSubmit={handleSubmit} noValidate>
        {/* Organization name — this is what registration actually creates,
            so it leads the form on its own full-width row. */}
        <div className="field-auth">
          <label className="field-label-auth" htmlFor="reg-organization">
            {t('register.organizationLabel')}
          </label>
          <input
            id="reg-organization"
            name="organizationName"
            type="text"
            autoComplete="organization"
            placeholder={t('register.organizationPlaceholder')}
            className="field-input-auth"
            value={formData.organizationName}
            onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
            required
            disabled={isSubmitting}
          />
        </div>

        {/* 2 by 2 Input Grid */}
        <div className="fields-grid-2x2-auth">
          {/* Full Name */}
          <div className="field-auth">
            <label className="field-label-auth" htmlFor="reg-name">
              {t('register.fullNameLabel')}
            </label>
            <input
              id="reg-name"
              name="fullName"
              type="text"
              autoComplete="name"
              placeholder={t('register.fullNamePlaceholder')}
              className="field-input-auth"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Email Address */}
          <div className="field-auth">
            <label className="field-label-auth" htmlFor="reg-email">
              {t('register.emailLabel')}
            </label>
            <input
              id="reg-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={t('register.emailPlaceholder')}
              className="field-input-auth"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Password with peek button */}
          <div className="field-auth">
            <label className="field-label-auth" htmlFor="reg-password">
              {t('register.passwordLabel')}
            </label>
            <div className="field-control-auth">
              <input
                id="reg-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={t('register.passwordPlaceholder')}
                className="field-input-auth"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="peek-btn-auth"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                aria-pressed={showPassword}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="peek-eye-auth" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M3 3l14 14M9.5 9.5a2.5 2.5 0 003.5 3.5m-1.5-6.5C14 6.5 17 9.5 17 9.5s-1.2 2.3-3.2 4.1M7.5 7.8C4.5 9.2 3 10 3 10s3 6 7 6c1.5 0 2.9-.5 4.1-1.3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg className="peek-eye-auth" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M1 10s3.2-6 9-6 9 6 9 6-3.2 6-9 6-9-6-9-6Z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                    />
                    <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="field-auth">
            <label className="field-label-auth" htmlFor="reg-confirm-password">
              {t('register.confirmPasswordLabel')}
            </label>
            <input
              id="reg-confirm-password"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={t('register.confirmPasswordPlaceholder')}
              className="field-input-auth"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* CAPTCHA Challenge — 1 row side-by-side grid */}
        <div className="captcha-container-auth">
          <label className="field-label-auth" htmlFor="reg-captcha">
            {t('captcha.label')}
          </label>
          <div className="captcha-row-auth">
            <div className="captcha-challenge-box-auth">
              <span className="captcha-challenge-text-auth">
                {captcha.loading ? t('captcha.loading') : formatChallenge(captcha)}
              </span>
              <button
                type="button"
                className="captcha-refresh-btn-auth"
                onClick={fetchCaptcha}
                disabled={captcha.loading || isSubmitting}
                aria-label={t('captcha.refresh')}
              >
                <svg
                  className="captcha-refresh-icon-auth"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span>{t('captcha.refresh')}</span>
              </button>
            </div>
            <input
              id="reg-captcha"
              name="captchaAnswer"
              type="text"
              inputMode="numeric"
              placeholder={t('captcha.placeholder')}
              className="field-input-auth"
              value={formData.captchaAnswer}
              onChange={(e) => setFormData({ ...formData, captchaAnswer: e.target.value })}
              required
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Terms Checkbox */}
        <div className="field-row-auth" style={{ margin: '0.9rem 0 1.2rem' }}>
          <label className="checkbox-auth">
            <input
              type="checkbox"
              name="agreeTerms"
              className="checkbox-input-auth"
              checked={formData.agreeTerms}
              onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
              required
              disabled={isSubmitting}
            />
            <span className="checkbox-box-auth" aria-hidden="true">
              <svg className="checkbox-check-auth" viewBox="0 0 12 10" aria-hidden="true">
                <path
                  d="M1 5l3.2 3.2L11 1"
                  stroke="white"
                  strokeWidth="1.6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="checkbox-text-auth">{t('register.agreeTerms')}</span>
          </label>
        </div>

        {/* Action Row: Account-type badge (Left) + Primary Submit Button (Right)
            There is no role picker here by design. Self-registration creates a
            new organization and is available to the business owner only —
            accountants and contacts are added from inside the organization.
            The role itself is assigned server-side; it is never chosen by the
            client. */}
        <div className="form-action-row-auth">
          <div className="custom-dropdown-auth">
            <label className="field-label-auth">{t('register.roleLabel')}</label>
            <div className="custom-dropdown-trigger-auth is-static" aria-disabled="true">
              <span>{t('register.roleOwner')}</span>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary-auth is-cta"
            disabled={isSubmitting}
          >
            <span>{isSubmitting ? t('register.submittingButton') : t('register.submitButton')}</span>
          </button>
        </div>

      </form>
    </>
  );
}
