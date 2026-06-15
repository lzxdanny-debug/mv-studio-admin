'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { AdminSidebar } from '@/components/admin-sidebar';
import { ForbiddenPanel } from '@/components/forbidden-panel';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { adminUser, isAuthenticated, refreshSession, hasRoutePermission } =
    useAdminAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && localStorage.getItem('admin_access_token')) {
      refreshSession().catch(() => {});
    }
  }, [refreshSession]);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated || !adminUser) {
      router.replace('/login');
    }
  }, [mounted, isAuthenticated, adminUser, router]);

  if (!mounted) {
    return <div style={{ height: '100vh', backgroundColor: '#f5f7fa' }} />;
  }

  if (!isAuthenticated || !adminUser) {
    return (
      <div className="h-screen bg-[#f5f7fa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-teal-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">验证权限中...</p>
        </div>
      </div>
    );
  }

  const routeAllowed = hasRoutePermission(pathname);

  return (
    <div className="h-screen bg-[#f5f7fa] text-slate-900 flex overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {routeAllowed ? children : <ForbiddenPanel />}
      </main>
    </div>
  );
}
