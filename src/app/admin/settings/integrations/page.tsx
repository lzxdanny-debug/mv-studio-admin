'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** 旧路径重定向到系统设置 · 账号 Tab */
export default function IntegrationsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/settings?tab=account&account=google');
  }, [router]);

  return (
    <div className="flex-1 flex items-center justify-center bg-slate-100 text-sm text-slate-500">
      正在跳转到系统设置…
    </div>
  );
}
