'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, HelpCircle, Save } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import type { PricingConfigView, PricingParam } from '../_components/types';

const BONUS_PARAM_KEYS = ['signupBonus', 'dailyCheckInBonus', 'referralInviteBonus'] as const;

const SOURCE_LABEL: Record<PricingParam['source'], string> = {
  db: '已配置',
  env: '环境变量',
  default: '默认值',
};

const SOURCE_CLS: Record<PricingParam['source'], string> = {
  db: 'bg-emerald-50 text-emerald-600',
  env: 'bg-sky-50 text-sky-600',
  default: 'bg-slate-100 text-slate-400',
};

export default function BonusConfigPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, number>>({});
  const [openHelp, setOpenHelp] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<PricingConfigView>({
    queryKey: ['admin', 'billing', 'pricing-config'],
    queryFn: async () =>
      (await apiClient.get('/admin/billing/pricing-config')) as unknown as PricingConfigView,
  });

  const bonusParams = useMemo(
    () =>
      (data?.params ?? []).filter((p) =>
        (BONUS_PARAM_KEYS as readonly string[]).includes(p.key),
      ),
    [data],
  );

  useEffect(() => {
    if (!bonusParams.length) return;
    setForm(
      Object.fromEntries(
        bonusParams.map((p) => [p.key, Number(p.value)]),
      ) as Record<string, number>,
    );
  }, [bonusParams]);

  const dirty = bonusParams.some((p) => {
    const cur = form[p.key];
    const saved = Number(p.value);
    if (typeof cur !== 'number') return false;
    return Math.abs(cur - saved) > 1e-9;
  });

  const save = useMutation({
    mutationFn: (payload: Record<string, number>) =>
      apiClient.patch('/admin/billing/pricing-config', payload) as Promise<PricingConfigView>,
    onSuccess: (res) => {
      setMsg({ ok: true, text: '赠送积分配置已保存。' });
      const next = (res.params ?? []).filter((p) =>
        (BONUS_PARAM_KEYS as readonly string[]).includes(p.key),
      );
      setForm(Object.fromEntries(next.map((p) => [p.key, Number(p.value)])));
      qc.setQueryData(['admin', 'billing', 'pricing-config'], res);
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请重试。' }),
  });

  const handleSave = () => {
    setMsg(null);
    const payload: Record<string, number> = {};
    for (const p of bonusParams) {
      payload[p.key] = form[p.key] ?? Number(p.value);
    }
    save.mutate(payload);
  };

  return (
    <div className="admin-page">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Gift className="h-5 w-5 text-blue-600" />
            赠送积分
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            配置注册一次性赠送、每日签到与邀请拉新奖励。写入 bonus 流水，可在「成本统计 / 赠送积分」中查看营销成本。
          </p>
        </div>

        <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
              注册与签到
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {bonusParams.map((p) => {
                const displayValue = form[p.key] ?? Number(p.value);
                return (
                  <div
                    key={p.key}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-slate-700">
                          {p.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => setOpenHelp(openHelp === p.key ? null : p.key)}
                          className="flex-shrink-0 text-slate-400 hover:text-blue-600"
                          title="查看说明"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span
                        className={cn(
                          'flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                          SOURCE_CLS[p.source],
                        )}
                      >
                        {SOURCE_LABEL[p.source]}
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center gap-1.5">
                      <input
                        type="number"
                        step={p.step ?? 'any'}
                        min={p.min}
                        max={p.max}
                        value={displayValue}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, [p.key]: Number(e.target.value) }))
                        }
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      {p.unit && (
                        <span className="w-14 flex-shrink-0 text-xs text-slate-400">
                          {p.unit}
                        </span>
                      )}
                    </div>

                    {openHelp === p.key && (
                      <p className="mt-2.5 rounded-lg border border-slate-100 bg-white p-2.5 text-xs leading-relaxed text-slate-500">
                        {p.description}
                        <span className="mt-1 block text-slate-400">
                          默认值：{String(p.default)}
                          {p.unit ? ` ${p.unit}` : ''}
                        </span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col items-end gap-2">
              {msg && (
                <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
                  {msg.text}
                </p>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={save.isPending || !dirty}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" />
                {save.isPending ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </QueryState>
      </div>
    </div>
  );
}
