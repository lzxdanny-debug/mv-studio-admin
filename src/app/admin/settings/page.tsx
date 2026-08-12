'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Settings as SettingsIcon } from 'lucide-react';
import { WebBaseUrlSection } from './_components/web-base-url-section';
import { AllowedOriginsSection } from './_components/allowed-origins-section';
import { StorageProviderSection } from './_components/storage-provider-section';
import { SupportSettingsSection } from './_components/support-settings-section';
import { MvSettingsTab } from './_components/mv-settings-tab';
import { MediaOutputTab } from './_components/media-output-tab';
import { TaskPollingSection } from './_components/task-polling-section';
import { AccountTab } from './_components/account-tab';
import { DatabaseSection } from './_components/database-section';
import { RewardfulSection } from './_components/rewardful-section';
import { BillingRechargeTab } from './_components/billing-recharge-tab';
import { LineTabs } from './_components/line-tabs';

type SettingsTab =
  | 'general'
  | 'account'
  | 'database'
  | 'mv'
  | 'media'
  | 'polling'
  | 'billing'
  | 'rewardful'
  | 'support';

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'general', label: '通用设置' },
  { id: 'account', label: '账号设置' },
  { id: 'mv', label: 'MV设置' },
  { id: 'media', label: '成片资源' },
  { id: 'polling', label: '任务轮询' },
  { id: 'billing', label: '充值设置' },
  { id: 'support', label: '智能客服' },
  { id: 'rewardful', label: 'Rewardful' },
  { id: 'database', label: '数据库' },
];

function GeneralTab() {
  return (
    <div className="space-y-6">
      <WebBaseUrlSection />
      <AllowedOriginsSection />
      <StorageProviderSection />
    </div>
  );
}

function SupportTab() {
  return (
    <div className="space-y-4">
      <SupportSettingsSection />
    </div>
  );
}

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = useMemo<SettingsTab>(() => {
    const raw = searchParams.get('tab');
    if (raw === 'worker') return 'mv';
    if (
      raw === 'account' ||
      raw === 'database' ||
      raw === 'general' ||
      raw === 'mv' ||
      raw === 'media' ||
      raw === 'polling' ||
      raw === 'billing' ||
      raw === 'rewardful' ||
      raw === 'support'
    ) {
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
          {activeTab === 'mv' && <MvSettingsTab />}
          {activeTab === 'media' && <MediaOutputTab />}
          {activeTab === 'billing' && <BillingRechargeTab />}
          {activeTab === 'support' && <SupportTab />}
          {activeTab === 'rewardful' && <RewardfulSection />}
          {activeTab === 'database' && <DatabaseSection />}
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
