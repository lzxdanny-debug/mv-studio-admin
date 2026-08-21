'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import apiClient from '@/lib/api';
import { Switch } from '@/components/ui/switch';

type BenefitItem = {
  key: string;
  group: 'perks' | 'models';
  label: string;
  description: string;
};

type BenefitFlags = {
  fullHd1080p: boolean;
  unlimitedLength: boolean;
  cloudStorage6m: boolean;
  prioritySupport: boolean;
  liteMv: boolean;
  proMv: boolean;
  models: Record<string, boolean>;
};

type BenefitsResponse = {
  flags: BenefitFlags;
  items: BenefitItem[];
};

function isEnabled(flags: BenefitFlags, key: string, group: 'perks' | 'models'): boolean {
  if (group === 'models') return flags.models?.[key] !== false;
  return (flags as Record<string, unknown>)[key] !== false;
}

function toggleFlag(flags: BenefitFlags, item: BenefitItem, enabled: boolean): BenefitFlags {
  if (item.group === 'models') {
    return {
      ...flags,
      models: { ...flags.models, [item.key]: enabled },
    };
  }
  return { ...flags, [item.key]: enabled };
}

export function MembershipBenefitsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<BenefitsResponse>({
    queryKey: ['admin', 'billing', 'membership-benefits'],
    queryFn: () => apiClient.get('/admin/billing/membership-benefits') as Promise<BenefitsResponse>,
  });
  const [draft, setDraft] = useState<BenefitFlags | null>(null);

  useEffect(() => {
    if (data?.flags) setDraft(data.flags);
  }, [data]);

  const flags = draft ?? data?.flags ?? null;
  const dirty = useMemo(() => {
    if (!draft || !data?.flags) return false;
    return JSON.stringify(draft) !== JSON.stringify(data.flags);
  }, [draft, data]);

  const save = useMutation({
    mutationFn: (next: BenefitFlags) =>
      apiClient.put('/admin/billing/membership-benefits', { flags: next }) as Promise<BenefitsResponse>,
    onSuccess: (resp) => {
      setDraft(resp.flags);
      void qc.invalidateQueries({ queryKey: ['admin', 'billing', 'membership-benefits'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'billing', 'plans'] });
      void qc.invalidateQueries({ queryKey: ['billing', 'public-plans'] });
    },
  });

  if (isLoading || !flags || !data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
        正在加载共用权益…
      </div>
    );
  }

  const perks = data.items.filter((item) => item.group === 'perks');
  const models = data.items.filter((item) => item.group === 'models');

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">共用会员权益</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          周付 / 月付 / 年付三档权益完全相同。这里关闭某一项后，三张定价卡同步隐藏；1080p 与 Seedance 还会同步到在售计划的真实门控。积分行由各档订阅周期自动带出，不在此开关。
        </p>
      </div>
      <div className="grid gap-6 p-5 md:grid-cols-2">
        <BenefitGroup title="创作权益" items={perks} flags={flags} onToggle={(item, enabled) => setDraft(toggleFlag(flags, item, enabled))} />
        <BenefitGroup title="模型" items={models} flags={flags} onToggle={(item, enabled) => setDraft(toggleFlag(flags, item, enabled))} />
      </div>
      <div className="flex justify-end border-t border-slate-100 px-5 py-3">
        <button
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() => flags && save.mutate(flags)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {save.isPending ? '保存中…' : dirty ? '保存共用权益' : '已保存'}
        </button>
      </div>
    </section>
  );
}

function BenefitGroup({
  title,
  items,
  flags,
  onToggle,
}: {
  title: string;
  items: BenefitItem[];
  flags: BenefitFlags;
  onToggle: (item: BenefitItem, enabled: boolean) => void;
}) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.key} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-slate-800">{item.label}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-slate-400">{item.description}</p>
            </div>
            <Switch
              checked={isEnabled(flags, item.key, item.group)}
              onChange={(checked) => onToggle(item, checked)}
              label={item.label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
