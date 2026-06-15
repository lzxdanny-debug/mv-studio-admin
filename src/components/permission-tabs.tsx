'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import {
  TAB_PERMISSION_REGISTRY,
  firstAllowedTab,
  hasPermission,
} from '@/lib/admin-permissions';
import { ForbiddenPanel } from './forbidden-panel';

export type PermissionTabDef<T extends string = string> = {
  key: T;
  label: string;
  permission?: string;
  panel: React.ReactNode;
};

interface PermissionTabsProps<T extends string> {
  pageKey: string;
  tabs: PermissionTabDef<T>[];
  defaultTab?: T;
  className?: string;
  tabClassName?: string;
  /** URL query 参数名，用于深链 ?tab=costs */
  queryParam?: string;
}

export function PermissionTabs<T extends string>({
  pageKey,
  tabs,
  defaultTab,
  className,
  tabClassName,
  queryParam = 'tab',
}: PermissionTabsProps<T>) {
  const permissions = useAdminAuthStore((s) => s.permissions);
  const searchParams = useSearchParams();

  const visibleTabs = useMemo(() => {
    const registry = TAB_PERMISSION_REGISTRY[pageKey];
    return tabs.filter((t) => {
      const perm =
        t.permission ??
        registry?.find((r) => r.key === t.key)?.permission;
      if (!perm) return true;
      return hasPermission(permissions, perm);
    });
  }, [tabs, pageKey, permissions]);

  const urlTab = searchParams.get(queryParam) as T | null;
  const initial = useMemo(() => {
    if (urlTab && visibleTabs.some((t) => t.key === urlTab)) return urlTab;
    if (defaultTab && visibleTabs.some((t) => t.key === defaultTab)) return defaultTab;
    return (firstAllowedTab(permissions, pageKey) as T | null) ?? visibleTabs[0]?.key;
  }, [urlTab, defaultTab, visibleTabs, permissions, pageKey]);

  const [active, setActive] = useState<T | undefined>(initial);

  useEffect(() => {
    if (!visibleTabs.length) return;
    if (!active || !visibleTabs.some((t) => t.key === active)) {
      setActive(visibleTabs[0].key);
    }
  }, [visibleTabs, active]);

  if (!visibleTabs.length) {
    return <ForbiddenPanel title="无可用 Tab" description="当前账号无权查看此页面的任何分区。" />;
  }

  const current = visibleTabs.find((t) => t.key === active) ?? visibleTabs[0];

  return (
    <div className={className}>
      <div
        className={cn(
          'flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-4',
          tabClassName,
        )}
      >
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition',
              current.key === t.key
                ? 'bg-teal-600 text-white'
                : 'text-slate-500 hover:bg-slate-100',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {current.panel}
    </div>
  );
}
