'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Save, XCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { SecretInput } from '@/components/secret-input';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { FromEnvBadge } from './from-env-badge';
import { CONTROL_WIDE, SECRET_INPUT_CLS } from './settings-form-styles';

interface RewardfulConfigView {
  enabled: boolean;
  enabledFromEnv: boolean;
  apiKeyMasked: string;
  apiKeyConfigured: boolean;
  apiKeyFromEnv: boolean;
  signupUrl: string;
  signupUrlFromEnv: boolean;
  live: boolean;
}

export function RewardfulSection() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    enabled: false,
    apiKey: '',
    signupUrl: '',
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<RewardfulConfigView>({
    queryKey: ['admin', 'settings', 'rewardful'],
    queryFn: async () => {
      const cfg = (await apiClient.get(
        '/admin/settings/rewardful',
      )) as unknown as RewardfulConfigView;
      setForm((f) => ({
        ...f,
        enabled: cfg.enabled,
        signupUrl: cfg.signupUrl,
      }));
      return cfg;
    },
  });

  const save = useMutation({
    mutationFn: (payload: {
      enabled: boolean;
      apiKey?: string;
      signupUrl?: string;
    }) => apiClient.patch('/admin/settings/rewardful', payload) as any,
    onSuccess: () => {
      setMsg({
        ok: true,
        text: 'Rewardful 配置已保存；C 端公开接口立即生效，无需发版。',
      });
      setForm((f) => ({ ...f, apiKey: '' }));
      qc.invalidateQueries({ queryKey: ['admin', 'settings', 'rewardful'] });
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请检查输入后重试。' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const payload: {
      enabled: boolean;
      apiKey?: string;
      signupUrl?: string;
    } = {
      enabled: form.enabled,
      signupUrl: form.signupUrl,
    };
    if (form.apiKey) payload.apiKey = form.apiKey;
    save.mutate(payload);
  };

  const enabled = !!data?.enabled;
  const live = !!data?.live;

  return (
    <section>
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className={cn(
              'flex items-center justify-between gap-4 rounded-2xl border px-5 py-4',
              enabled
                ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50'
                : 'border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/40',
            )}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-slate-900">Rewardful 现金联盟</p>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {enabled ? '已启用' : '已关闭'}
                </span>
                {data && <FromEnvBadge fromEnv={data.enabledFromEnv} />}
                {enabled && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      live ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                    )}
                  >
                    {live ? '追踪脚本可加载' : '缺 API Key'}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                对外 KOL 现金分佣（与站内邀请积分独立）。佣金在 Rewardful Dashboard 结算。
              </p>
            </div>
            {enabled ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
            ) : (
              <XCircle className="h-6 w-6 shrink-0 text-slate-400" />
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">开关</h2>
            </div>
            <div className="divide-y divide-slate-100 px-5 py-2">
              <FormField
                label="启用联盟计划"
                description="关闭后隐藏 Footer 入口，落地页显示暂未开放，且不下发 API Key。"
              >
                <Switch
                  checked={form.enabled}
                  onChange={(checked) => setForm((f) => ({ ...f, enabled: checked }))}
                  label="启用联盟计划"
                />
              </FormField>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">配置</h2>
            </div>
            <div className="divide-y divide-slate-100 px-5 py-2">
              <FormField
                label="API Key"
                description={
                  data?.apiKeyFromEnv
                    ? '当前生效值来自环境变量。留空保存表示不修改。'
                    : 'data-rewardful · 留空保存表示不修改。'
                }
                controlClassName={CONTROL_WIDE}
              >
                <SecretInput
                  configured={data?.apiKeyConfigured}
                  maskedPreview={data?.apiKeyMasked}
                  value={form.apiKey}
                  onChange={(apiKey) => setForm((f) => ({ ...f, apiKey }))}
                  placeholder="Rewardful 后台的 API Key"
                  type="text"
                  className={SECRET_INPUT_CLS}
                />
              </FormField>
              <FormField
                label="联盟申请页 URL"
                description={
                  data?.signupUrlFromEnv
                    ? '当前生效值来自环境变量。'
                    : 'Rewardful 注册/申请落地页。'
                }
                controlClassName={CONTROL_WIDE}
              >
                <Input
                  size="sm"
                  type="url"
                  value={form.signupUrl}
                  onChange={(e) => setForm((f) => ({ ...f, signupUrl: e.target.value }))}
                  placeholder="https://your-brand.getrewardful.com/signup"
                />
              </FormField>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {msg && (
              <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-rose-600')}>
                {msg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" />
              {save.isPending ? '保存中…' : '保存'}
            </button>
          </div>
        </form>
      </QueryState>
    </section>
  );
}
