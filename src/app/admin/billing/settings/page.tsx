'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** 旧入口：充值设置已迁到系统设置 Tab */
export default function AdminBillingSettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/settings?tab=billing');
  }, [router]);

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-100 text-sm text-slate-500">
      正在跳转到系统设置 · 充值设置…
    </div>
  );
}
