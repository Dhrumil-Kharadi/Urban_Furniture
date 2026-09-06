'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { useToast } from '@/context/ToastContext';

export default function RouteStatusNotifier() {
  const pathname = usePathname();
  const toast = useToast();
  const t = useTranslations('dashboard');
  const firstPath = useRef(true);

  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }

    toast.success(t('common.pageReady'));
  }, [pathname, t, toast]);

  return null;
}
