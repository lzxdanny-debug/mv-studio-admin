'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cloud, Save, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { SecretInput } from '@/components/secret-input';
import { FromEnvBadge } from './from-env-badge';

interface AiProviderStatus {
  configured: boolean;
  source: 'db' | 'env' | 'none';
  baseUrl: string | null;
}

interface MountseaOpsConfigView {
  userApiUrl: string;
  userApiUrlFromEnv: boolean;
  usageBaseUrl: string;
  usageBaseUrlFromEnv: boolean;
  usageTokenMasked: string;
  usageTokenConfigured: boolean;
  usageTokenFromEnv: boolean;
  ssoEnabled: boolean;
  reconcileEnabled: boolean;
  aiProviders: {
    mountsea: AiProviderStatus;
    mountseaMs: AiProviderStatus;
  };
}

export function MountseaSection({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    userApiUrl: '',
    usageBaseUrl: '',
    usageToken: '',
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<MountseaOpsConfigView>({
    queryKey: ['admin', 'settings', 'mountsea'],
    queryFn: async () => {
      const cfg = (await apiClient.get(
        '/admin/settings/mountsea',
      )) as unknown as MountseaOpsConfigView;
      setForm((f) => ({
        ...f,
        userApiUrl: cfg.userApiUrl,
        usageBaseUrl: cfg.usageBaseUrl,
      }));
      return cfg;
    },
  });

  const save = useMutation({
    mutationFn: (payload: Partial<typeof form>) =>
      apiClient.patch('/admin/settings/mountsea', payload) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: 'Mountsea 配置已保存，SSO 与对账将立即使用新值。' });
      setForm((f) => ({ ...f, usageToken: '' }));
      qc.invalidateQueries({ queryKey: ['admin', 'settings', 'mountsea'] });
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请检查输入后重试。' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const payload: Partial<typeof form> = {
      userApiUrl: form.userApiUrl,
      usageBaseUrl: form.usageBaseUrl,
    };
    if (form.usageToken) payload.usageToken = form.usageToken;
    save.mutate(payload);
  };

  const providerLabel = (p: AiProviderStatus, name: string) => {
    if (!p.configured) return `${name}：未配置`;
    const src = p.source === 'db' ? '后台' : p.source === 'env' ? 'env' : '';
    return `${name}：已配置${src ? `（${src}）` : ''}${p.baseUrl ? ` · ${p.baseUrl}` : ''}`;
  };

  return (
    <section>
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
        <div className={cn(!embedded && 'bg-white border border-slate-200 rounded-2xl p-5')}>
          <div className="flex items-start gap-3 mb-4">
            <Cloud className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">Mountsea 集成</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                用户端 API 用于 Mountsea 账号登录与 SSO；Usage Token 用于成本对账拉取真实积分流水。
                AI 生成用的 API Key 请在{' '}
                <Link
                  href="/admin/ai-providers"
                  className="text-teal-600 hover:text-teal-700 underline underline-offset-2"
                >
                  AI 渠道凭证
                </Link>{' '}
                页配置，避免重复录入。
              </p>
              {data && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                  <div className="flex items-center gap-1.5">
                    {data.ssoEnabled ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-xs text-emerald-600 font-medium">
                          SSO 已就绪
                          <FromEnvBadge fromEnv={data.userApiUrlFromEnv} />
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-xs text-amber-600 font-medium">用户 API 未配置</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {data.reconcileEnabled ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-xs text-emerald-600 font-medium">
                          对账 Token 已配置
                          <FromEnvBadge fromEnv={data.usageTokenFromEnv} />
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-xs text-amber-600 font-medium">对账 Token 未配置</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {data && (
            <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-600 space-y-1">
              <p className="font-medium text-slate-700">AI 渠道凭证（只读）</p>
              <p>{providerLabel(data.aiProviders.mountsea, 'Mountsea Legacy')}</p>
              <p>{providerLabel(data.aiProviders.mountseaMs, 'Mountsea /ms/v1')}</p>
              <Link
                href="/admin/ai-providers"
                className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 mt-1"
              >
                前往配置 MOUNTSEA_API_KEY
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  用户端 API 地址
                </label>
                <input
                  type="url"
                  value={form.userApiUrl}
                  onChange={(e) => setForm((f) => ({ ...f, userApiUrl: e.target.value }))}
                  placeholder="https://dk.mountsea.ai"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50"
                />
                <p className="text-[11px] text-slate-400 mt-1">对应 MOUNTSEA_USER_API_URL</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  对账 API 地址
                </label>
                <input
                  type="url"
                  value={form.usageBaseUrl}
                  onChange={(e) => setForm((f) => ({ ...f, usageBaseUrl: e.target.value }))}
                  placeholder="https://dk.mountsea.ai"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  对应 MOUNTSEA_USAGE_BASE_URL，留空则与用户端同域
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Usage Token（用户 JWT）
                </label>
                <SecretInput
                  configured={data?.usageTokenConfigured}
                  maskedPreview={data?.usageTokenMasked}
                  value={form.usageToken}
                  onChange={(usageToken) => setForm((f) => ({ ...f, usageToken }))}
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  showToggle
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  对应 MOUNTSEA_USAGE_TOKEN。登录 dk.mountsea.ai 后从 Network 请求头 Bearer 复制，约
                  24h 有效。
                </p>
              </div>
            </div>

            {msg && (
              <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
                {msg.text}
              </p>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={save.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                {save.isPending ? '保存中…' : '保存配置'}
              </button>
            </div>
          </form>
        </div>
      </QueryState>
    </section>
  );
}
