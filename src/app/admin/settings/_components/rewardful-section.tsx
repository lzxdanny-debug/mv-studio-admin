'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Save, Handshake } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { SecretInput } from '@/components/secret-input';
import { FromEnvBadge } from './from-env-badge';

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

  return (
    <section>
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6 space-y-5">
          <div className="flex items-start gap-3">
            <Handshake className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">Rewardful 现金联盟</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                对外 KOL 现金分佣（与站内「邀请送积分」独立）。启用后 C 端展示
                /affiliate-program 入口并加载追踪脚本；佣金结算在 Rewardful
                Dashboard，不计入本站成本表。
              </p>
              {data && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                  {data.enabled ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      已启用
                      <FromEnvBadge fromEnv={data.enabledFromEnv} />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                      <XCircle className="h-3.5 w-3.5" />
                      已关闭
                    </span>
                  )}
                  {data.live ? (
                    <span className="text-xs text-emerald-600">追踪脚本可加载</span>
                  ) : data.enabled ? (
                    <span className="text-xs text-amber-600">已启用但未配置 API Key，脚本不会加载</span>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-800">启用联盟计划</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  关闭后隐藏 Footer 入口，落地页显示暂未开放，且不下发 API Key。
                </p>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
            </label>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                API Key（data-rewardful）
              </label>
              <SecretInput
                configured={data?.apiKeyConfigured}
                maskedPreview={data?.apiKeyMasked}
                value={form.apiKey}
                onChange={(apiKey) => setForm((f) => ({ ...f, apiKey }))}
                placeholder="Rewardful 后台的 API Key"
                type="text"
              />
              {data?.apiKeyFromEnv && (
                <p className="text-[11px] text-slate-400 mt-1">
                  当前生效值来自环境变量
                  <FromEnvBadge fromEnv />
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                联盟申请页 URL
              </label>
              <input
                type="url"
                value={form.signupUrl}
                onChange={(e) => setForm((f) => ({ ...f, signupUrl: e.target.value }))}
                placeholder="https://your-brand.getrewardful.com/signup"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
              {data?.signupUrlFromEnv && (
                <p className="text-[11px] text-slate-400 mt-1">
                  当前生效值来自环境变量
                  <FromEnvBadge fromEnv />
                </p>
              )}
            </div>

            {msg && (
              <p
                className={cn(
                  'text-xs',
                  msg.ok ? 'text-emerald-600' : 'text-rose-600',
                )}
              >
                {msg.text}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={save.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                {save.isPending ? '保存中…' : '保存'}
              </button>
            </div>
          </form>
        </div>
      </QueryState>
    </section>
  );
}
