'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Film,
  Clapperboard,
  Palette,
  FileText,
  Zap,
  Users,
  MessageCircle,
  LogOut,
  Shield,
  Settings,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import apiClient from '@/lib/api';

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badgeKey?: 'feedbackUnread';
};

type NavSection = {
  title?: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ href: '/admin', label: '仪表盘', icon: LayoutDashboard, exact: true }],
  },
  {
    title: 'MV 业务',
    items: [
      { href: '/admin/mv/projects', label: 'MV 项目', icon: Film },
      { href: '/admin/mv/shots', label: '镜头运维', icon: Clapperboard },
      { href: '/admin/mv/styles', label: '风格库', icon: Palette },
    ],
  },
  {
    title: '周边工具',
    items: [
      { href: '/admin/tools/lrc', label: 'LRC 任务', icon: FileText },
      { href: '/admin/tools/quick-video', label: '快速视频', icon: Zap },
    ],
  },
  {
    title: '运营',
    items: [
      { href: '/admin/users', label: '用户管理', icon: Users },
      {
        href: '/admin/feedback',
        label: '用户反馈',
        icon: MessageCircle,
        badgeKey: 'feedbackUnread',
      },
    ],
  },
];

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: '/admin/settings', label: '系统设置', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['admin', 'feedback', 'unread'],
    queryFn: () => apiClient.get('/admin/feedback/unread-count') as any,
    refetchInterval: 30_000,
    retry: false,
  });

  const badges: Record<string, number> = {
    feedbackUnread: unreadData?.count ?? 0,
  };

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const renderItem = (item: NavItem) => {
    const { href, label, icon: Icon, exact, badgeKey } = item;
    const active = isActive(href, exact);
    const badge = badgeKey ? badges[badgeKey] : 0;
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150',
          active
            ? 'bg-purple-50 text-purple-700 font-medium'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
        )}
      >
        <Icon
          className={cn('h-4 w-4 flex-shrink-0', active ? 'text-purple-600' : 'text-slate-400')}
        />
        <span className="flex-1">{label}</span>
        {badge > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-red-500 text-white">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside className="w-[220px] h-full flex-shrink-0 bg-white border-r border-slate-200 flex flex-col shadow-sm">
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-slate-200 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0">
          <Shield className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="font-bold text-sm text-slate-800">MV Studio 管理后台</span>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto flex flex-col">
        <div className="flex-1 space-y-4">
          {NAV_SECTIONS.map((section, idx) => (
            <div key={idx} className="space-y-0.5">
              {section.title && (
                <div className="px-3 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {section.title}
                </div>
              )}
              {section.items.map(renderItem)}
            </div>
          ))}
        </div>

        <div className="pt-2 mt-3 border-t border-slate-100 space-y-0.5">
          {BOTTOM_NAV_ITEMS.map(renderItem)}
        </div>
      </nav>

      <div className="px-3 pb-4 flex-shrink-0 border-t border-slate-200 pt-3">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-white">
              {user?.displayName?.[0]?.toUpperCase() || 'A'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-700 font-medium truncate">{user?.displayName}</p>
            <p className="text-[10px] text-slate-400 truncate">{user?.email || '管理员'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </div>
    </aside>
  );
}
