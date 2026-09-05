 'use client';

import { useRouter } from '@/i18n/navigation';
import BudgetDrawer from '@/components/budgets/BudgetDrawer';

export default function NewBudgetPage() {
  const router = useRouter();

  return (
    <BudgetDrawer
      isOpen
      onClose={() => router.push('/dashboard/budgets')}
      onSaved={() => router.push('/dashboard/budgets')}
    />
  );
}
