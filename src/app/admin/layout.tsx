'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { AdminSidebar } from '@/components/admin-sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, refreshUser } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // 启动时与服务端同步用户信息：避免 persist 状态过期或角色变更未刷新。
    // 仅在本地存在 token 时尝试，否则会立即 401 噪音日志。
    if (typeof window !== 'undefined' && localStorage.getItem('admin_access_token')) {
      refreshUser().catch(() => {
        // refreshUser 内部已处理失败 → set user=null，layout 守卫会接管跳转。
      });
    }
  }, [refreshUser]);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated || !user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'admin') {
      router.replace('/login');
    }
  }, [mounted, isAuthenticated, user, router]);

  if (!mounted) {
    return <div style={{ height: '100vh', backgroundColor: '#f1f5f9' }} />;
  }

  if (!isAuthenticated || !user || user.role !== 'admin') {
    return (
      <div className="h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-purple-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">验证权限中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-100 flex overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
