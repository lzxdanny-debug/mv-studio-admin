'use client';

import { useEffect, useMemo, useState } from 'react';
import { Gauge, ListTodo } from 'lucide-react';
import { CapacityTab, QueueTab } from '@/components/aimv-runtime-tabs';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { cn } from '@/lib/utils';

type RuntimeTab = 'capacity' | 'queue';

const RUNTIME_TABS = [
  { key: 'capacity' as const, label: '并发配置', description: '模型容量与速率', icon: Gauge, permission: 'aimv.routing.view' },
  { key: 'queue' as const, label: '队列管理', description: '任务状态与人工处理', icon: ListTodo, permission: 'aimv.queue.view' },
];

export default function CommonRuntimePage() {
  const permissions = useAdminAuthStore((state) => state.permissions);
  const hasPermission = useAdminAuthStore((state) => state.hasPermission);
  const visibleTabs = useMemo(() => RUNTIME_TABS.filter((item) => permissions.includes('*') || hasPermission(item.permission)), [hasPermission, permissions]);
  const [tab, setTab] = useState<RuntimeTab>('capacity');

  useEffect(() => {
    if (!visibleTabs.some((item) => item.key === tab) && visibleTabs[0]) setTab(visibleTabs[0].key);
  }, [tab, visibleTabs]);

  return <div className="flex h-full min-h-0 flex-col bg-slate-50">
    <header className="shrink-0 border-b border-slate-200 bg-white px-6 pt-6 lg:px-8">
      <div className="pb-5"><h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Gauge className="h-5 w-5 text-violet-600"/>运行配置</h1><p className="mt-2 text-sm leading-6 text-slate-500">统一管理模型并发容量、提交速率和生成任务队列。</p></div>
      <nav className="flex gap-1 overflow-x-auto" aria-label="运行配置分类">
        {visibleTabs.map((item) => { const Icon = item.icon; const selected = tab === item.key; return <button key={item.key} type="button" onClick={() => setTab(item.key)} className={cn('relative inline-flex h-12 shrink-0 items-center gap-2 px-4 text-sm font-medium transition-colors', selected ? 'text-violet-700' : 'text-slate-500 hover:text-slate-900')}><Icon className={cn('h-4 w-4', selected ? 'text-violet-600' : 'text-slate-400')}/><span className="text-left"><span className="block">{item.label}</span><span className="block text-[10px] font-normal opacity-70">{item.description}</span></span>{selected ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-violet-600"/> : null}</button>; })}
      </nav>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-8"><div className="mx-auto w-full max-w-[1680px] [&>div]:!mx-0 [&>div]:!max-w-none [&>div]:!w-full">{!visibleTabs.length ? <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">暂无运行配置查看权限</div> : tab === 'capacity' ? <CapacityTab/> : <QueueTab/>}</div></main>
  </div>;
}
