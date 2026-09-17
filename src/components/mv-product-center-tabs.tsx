'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clapperboard, Settings2, Sparkles, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuthStore } from '@/stores/admin-auth.store';

type ProductCenterTab = {
  key: 'aimv' | 'inspiration' | 'common' | 'content';
  label: string;
  icon: typeof Wand2;
  destinations: Array<{ href: string; permission: string }>;
};

const TABS: ProductCenterTab[] = [
  { key: 'aimv', label: 'AIMV', icon: Wand2, destinations: [
    { href: '/admin/aimv-generator/settings', permission: 'aimv.settings.view' },
    { href: '/admin/aimv-generator/templates', permission: 'aimv.content.view' },
    { href: '/admin/aimv-generator/models', permission: 'aimv.routing.view' },
  ] },
  { key: 'inspiration', label: 'Inspiration', icon: Sparkles, destinations: [
    { href: '/admin/inspiration/products', permission: 'inspiration.content.view' },
    { href: '/admin/inspiration/models', permission: 'inspiration.models.view' },
    { href: '/admin/inspiration/tasks', permission: 'inspiration.tasks.view' },
  ] },
  { key: 'common', label: '通用配置', icon: Settings2, destinations: [
    { href: '/admin/mv-product-center/common/parameters', permission: 'aimv.content.view' },
    { href: '/admin/mv-product-center/common/parameters', permission: 'aimv.settings.view' },
    { href: '/admin/mv-product-center/common/runtime', permission: 'aimv.routing.view' },
    { href: '/admin/mv-product-center/common/runtime', permission: 'aimv.queue.view' },
    { href: '/admin/aimv-generator/pricing', permission: 'aimv.pricing.view' },
  ] },
  { key: 'content', label: '生成内容', icon: Clapperboard, destinations: [
    { href: '/admin/mv-product-center/content', permission: 'aimv.queue.view' },
    { href: '/admin/mv-product-center/content', permission: 'inspiration.tasks.view' },
  ] },
];

const AIMV_PATHS = ['/admin/aimv-generator/settings', '/admin/aimv-generator/parameters', '/admin/aimv-generator/templates', '/admin/aimv-generator/models'];
const COMMON_PATHS = ['/admin/mv-product-center/common/parameters', '/admin/mv-product-center/common/runtime', '/admin/aimv-generator/singers', '/admin/aimv-generator/hot-music', '/admin/aimv-generator/creation-styles', '/admin/aimv-generator/assets', '/admin/aimv-generator/resolvers', '/admin/aimv-generator/capacity', '/admin/aimv-generator/queue', '/admin/aimv-generator/retention', '/admin/aimv-generator/pricing'];
const CONTENT_PATHS = ['/admin/mv-product-center/content', '/admin/mv/projects', '/admin/ai-music-video/projects', '/admin/inspiration/created'];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function productCenterTabForPath(pathname: string): ProductCenterTab['key'] | null {
  if (matches(pathname, CONTENT_PATHS)) return 'content';
  if (matches(pathname, COMMON_PATHS)) return 'common';
  if (pathname === '/admin/inspiration' || pathname.startsWith('/admin/inspiration/')) return 'inspiration';
  if (matches(pathname, AIMV_PATHS) || pathname === '/admin/aimv-generator') return 'aimv';
  return null;
}

export function isMvProductCenterPath(pathname: string) {
  return productCenterTabForPath(pathname) !== null;
}

export function MvProductCenterTabs() {
  const pathname = usePathname();
  const permissions = useAdminAuthStore((state) => state.permissions);
  const hasPermission = useAdminAuthStore((state) => state.hasPermission);
  const active = productCenterTabForPath(pathname);
  const visibleTabs = TABS.map((tab) => ({
    ...tab,
    href: permissions.includes('*') ? tab.destinations[0].href : tab.destinations.find((item) => hasPermission(item.permission))?.href,
  })).filter((tab): tab is ProductCenterTab & { href: string } => Boolean(tab.href));

  return <nav aria-label="MV 产品中心" className="shrink-0 border-b border-slate-200 bg-white px-5 lg:px-8">
    <div className="flex min-h-14 items-end gap-1 overflow-x-auto">
      {visibleTabs.map((tab) => { const Icon = tab.icon; const selected = active === tab.key; return <Link key={tab.key} href={tab.href} className={cn('relative inline-flex h-14 shrink-0 items-center gap-2 px-4 text-sm font-medium transition-colors', selected ? 'text-violet-700' : 'text-slate-500 hover:text-slate-900')}><Icon className={cn('h-4 w-4', selected ? 'text-violet-600' : 'text-slate-400')}/>{tab.label}{selected ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-violet-600"/> : null}</Link>; })}
    </div>
  </nav>;
}
