'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Settings as SettingsIcon } from 'lucide-react';
import { WebBaseUrlSection } from './_components/web-base-url-section';
import { AllowedOriginsSection } from './_components/allowed-origins-section';
import { ComposeWorkerSection } from './_components/compose-worker-section';
import { TaskPollingSection } from './_components/task-polling-section';
import { AccountTab } from './_components/account-tab';
import { DatabaseSection } from './_components/database-section';
import { LineTabs } from './_components/line-tabs';

type SettingsTab = 'general' | 'account' | 'database' | 'worker' | 'polling';

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'general', label: '通用设置' },
  { id: 'account', label: '账号设置' },
  { id: 'polling', label: '任务轮询' },
  { id: 'database', label: '数据库' },
  { id: 'worker', label: 'Worker' },
];

function GeneralTab() {
  return (
    <div className="space-y-8">
      <WebBaseUrlSection />
      <AllowedOriginsSection />
    </div>
  );
}

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = useMemo<SettingsTab>(() => {
    const raw = searchParams.get('tab');
    if (raw === 'account' || raw === 'database' || raw === 'general' || raw === 'worker' || raw === 'polling') {
      return raw;
    }
    return 'general';
  }, [searchParams]);

  const setTab = (tab: SettingsTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    if (tab === 'account' && !params.get('account')) {
      params.set('account', 'google');
    }
    if (tab !== 'account') {
      params.delete('account');
    }
    router.replace(`/admin/settings?${params.toString()}`);
  };

  return (
    <div className="admin-page">
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-blue-600" />
            系统设置
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            按类型管理运行时配置；可编辑项写入数据库，环境变量作为兜底。
          </p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
          <LineTabs items={TABS} active={activeTab} onChange={setTab} variant="primary" />
        </div>

        <div>
          {activeTab === 'general' && <GeneralTab />}
          {activeTab === 'account' && <AccountTab />}
          {activeTab === 'polling' && <TaskPollingSection />}
          {activeTab === 'database' && (
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6">
              <DatabaseSection />
            </div>
          )}
          {activeTab === 'worker' && <ComposeWorkerSection />}
        </div>
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center bg-slate-100 text-sm text-slate-500">
          加载中…
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}
