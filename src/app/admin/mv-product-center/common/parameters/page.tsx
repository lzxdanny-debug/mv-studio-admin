'use client';

import { useEffect, useMemo, useState } from 'react';
import { Disc3, FileCheck2, Headphones, Link2, Maximize2, Palette, Settings2, UserSquare } from 'lucide-react';
import { AimvAssetsTab, AimvResolversTab } from '@/components/aimv-content-tabs';
import { AimvCreationStylesTab } from '@/components/aimv-creation-styles-tab';
import { AimvParameterManagement } from '@/components/aimv-parameter-management';
import { AimvFormatWhitelist } from '@/components/aimv-format-whitelist';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { cn } from '@/lib/utils';

type ParameterTab = 'aspect-ratios' | 'formats' | 'singers' | 'hot-music' | 'creation-styles' | 'assets' | 'resolvers';

const PARAMETER_TABS = [
  { key: 'aspect-ratios' as const, label: '比例设置', icon: Maximize2, permission: 'aimv.settings.view' },
  { key: 'formats' as const, label: '格式白名单', icon: FileCheck2, permission: 'aimv.settings.view' },
  { key: 'singers' as const, label: '歌手配置', icon: UserSquare, permission: 'aimv.content.view' },
  { key: 'hot-music' as const, label: 'Hot 音乐', icon: Disc3, permission: 'aimv.content.view' },
  { key: 'creation-styles' as const, label: '创作风格库', icon: Palette, permission: 'aimv.content.view' },
  { key: 'assets' as const, label: '素材库', icon: Headphones, permission: 'aimv.content.view' },
  { key: 'resolvers' as const, label: '歌曲链接识别', icon: Link2, permission: 'aimv.settings.view' },
];

export default function CommonParametersPage() {
  const permissions = useAdminAuthStore((state) => state.permissions);
  const hasPermission = useAdminAuthStore((state) => state.hasPermission);
  const visibleTabs = useMemo(() => PARAMETER_TABS.filter((item) => permissions.includes('*') || hasPermission(item.permission)), [hasPermission, permissions]);
  const [tab, setTab] = useState<ParameterTab>('aspect-ratios');

  useEffect(() => {
    if (!visibleTabs.some((item) => item.key === tab) && visibleTabs[0]) setTab(visibleTabs[0].key);
  }, [tab, visibleTabs]);

  return <div className="flex h-full min-h-0 flex-col bg-slate-50">
    <header className="shrink-0 border-b border-slate-200 bg-white px-6 pt-6 lg:px-8">
      <div className="pb-5">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Settings2 className="h-5 w-5 text-violet-600"/>参数配置</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">统一维护 MV 产品共用的比例、格式、歌手、音乐、创作风格、素材与歌曲链接识别能力。</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto" aria-label="参数配置分类">
        {visibleTabs.map((item) => { const Icon = item.icon; const selected = tab === item.key; return <button key={item.key} type="button" onClick={() => setTab(item.key)} className={cn('relative inline-flex h-12 shrink-0 items-center gap-2 px-4 text-sm font-medium transition-colors', selected ? 'text-violet-700' : 'text-slate-500 hover:text-slate-900')}><Icon className={cn('h-4 w-4', selected ? 'text-violet-600' : 'text-slate-400')}/>{item.label}{selected ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-violet-600"/> : null}</button>; })}
      </nav>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-8">
      <div className="mx-auto w-full max-w-[1680px] [&>div]:!mx-0 [&>div]:!max-w-none [&>div]:!w-full">
        {!visibleTabs.length ? <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">暂无参数配置查看权限</div> : tab === 'aspect-ratios' ? <AimvParameterManagement/> : tab === 'formats' ? <AimvFormatWhitelist/> : tab === 'singers' ? <AimvAssetsTab lockedKind="singer_photo"/> : tab === 'hot-music' ? <AimvAssetsTab lockedKind="hot_music"/> : tab === 'creation-styles' ? <AimvCreationStylesTab/> : tab === 'assets' ? <AimvAssetsTab/> : <AimvResolversTab/>}
      </div>
    </main>
  </div>;
}
