'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuth, getDashboardPath } from '@/context/AuthContext';
import { usePageTransition } from '@/reusablefiles/pagetransition';
import AuthLayout from './AuthLayout';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import VerifyEmailForm from './VerifyEmailForm';
import VerifyResetOtpForm from './VerifyResetOtpForm';
import ResetPasswordForm from './ResetPasswordForm';

/**
 * Unified AuthPage container
 * Handles dynamic switching between auth modes (login, register, forgot-password, verify-email, verify-reset-otp, reset-password)
 * If user is already authenticated, redirects automatically to the role's dashboard.
 * Maintains transient registration / recovery state (email, resetToken).
 */
export default function AuthPage({ initialMode = 'login' }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const { isAuthenticated, role, loading } = useAuth();
  const { state: transitionState } = usePageTransition();
  const [mode, setMode] = useState(initialMode);
  const [targetEmail, setTargetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');

  // Redirect authenticated users to their dashboard, but ONLY when
  // no page transition is in progress. This prevents a double-navigation
  // race: LoginForm's trigger() handles the animated redirect after login,
  // so this effect should only fire when a logged-in user directly visits
  // an auth URL (e.g. typing /auth/login while already authenticated).
  const transitionBusy = transitionState.status !== 'IDLE';

  useEffect(() => {
    // The guard the comment above describes was never actually applied — the
    // transition state was read and then ignored, so a sign-in raced its own
    // animated redirect. Checking it here leaves the animated navigation to
    // LoginForm / VerifyEmailForm and keeps this effect for the plain case:
    // an already-signed-in visitor landing on an auth URL.
    if (!loading && isAuthenticated && !transitionBusy) {
      const targetDashboard = getDashboardPath(role || 'customer');
      router.replace(targetDashboard);
    }
  }, [loading, isAuthenticated, role, router, transitionBusy]);

  if (loading || (isAuthenticated && !transitionBusy)) {
    return null;
  }

  // Derive art copy based on current active view
  let artBadge = 'Double-Entry Ledger';
  let artTitle = t('art.welcomeTitle');
  let artSubtitle = t('art.welcomeSub');

  if (mode === 'register') {
    artBadge = 'Business Owner Signup';
    artTitle = t('art.registerTitle');
    artSubtitle = t('art.registerSub');
  } else if (mode === 'forgot-password') {
    artBadge = 'Secure Recovery';
    artTitle = t('art.forgotTitle');
    artSubtitle = t('art.forgotSub');
  } else if (mode === 'verify-email') {
    artBadge = 'Encrypted Stream';
    artTitle = t('art.verifyTitle');
    artSubtitle = t('art.verifySub');
  } else if (mode === 'verify-reset-otp' || mode === 'reset-password') {
    artBadge = 'Access Shield';
    artTitle = t('art.resetTitle');
    artSubtitle = t('art.resetSub');
  }

  return (
    <AuthLayout artBadge={artBadge} artTitle={artTitle} artSubtitle={artSubtitle}>
      {mode === 'login' && (
        <LoginForm
          initialEmail={targetEmail}
          onSwitchToRegister={() => setMode('register')}
          onSwitchToForgot={() => setMode('forgot-password')}
          onSwitchToVerifyEmail={(email) => {
            setTargetEmail(email);
            setMode('verify-email');
          }}
        />
      )}
      {mode === 'register' && (
        <RegisterForm
          onSwitchToLogin={() => setMode('login')}
          onSwitchToVerifyEmail={(email) => {
            setTargetEmail(email);
            setMode('verify-email');
          }}
        />
      )}
      {mode === 'forgot-password' && (
        <ForgotPasswordForm
          onSwitchToLogin={() => setMode('login')}
          onProceedToVerify={(email) => {
            setTargetEmail(email);
            setMode('verify-reset-otp');
          }}
        />
      )}
      {mode === 'verify-email' && (
        <VerifyEmailForm
          email={targetEmail}
          onSwitchToLogin={(email) => {
            if (email) setTargetEmail(email);
            setMode('login');
          }}
          onSuccess={(email) => {
            if (email) setTargetEmail(email);
            setMode('login');
          }}
        />
      )}
      {mode === 'verify-reset-otp' && (
        <VerifyResetOtpForm
          email={targetEmail}
          onSwitchToLogin={() => setMode('login')}
          onSuccess={(token) => {
            setResetToken(token);
            setMode('reset-password');
          }}
        />
      )}
      {mode === 'reset-password' && (
        <ResetPasswordForm
          resetToken={resetToken}
          onSwitchToLogin={() => setMode('login')}
          onSwitchToForgot={() => setMode('forgot-password')}
        />
      )}
    </AuthLayout>
  );
}
