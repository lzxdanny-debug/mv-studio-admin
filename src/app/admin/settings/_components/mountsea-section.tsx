'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, Save, XCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { SecretInput } from '@/components/secret-input';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { FromEnvBadge } from './from-env-badge';
import { CONTROL_WIDE, SECRET_INPUT_CLS } from './settings-form-styles';

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
    apisale: AiProviderStatus;
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

  const ssoOk = !!data?.ssoEnabled;
  const reconcileOk = !!data?.reconcileEnabled;

  return (
    <section>
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
        <form
          onSubmit={handleSubmit}
          className={cn('space-y-4', !embedded && 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm')}
        >
          <div
            className={cn(
              'flex items-center justify-between gap-4 rounded-2xl border px-5 py-4',
              ssoOk && reconcileOk
                ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50'
                : 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50',
            )}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-slate-900">Mountsea 集成</p>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    ssoOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                  )}
                >
                  SSO {ssoOk ? '就绪' : '未配置'}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    reconcileOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                  )}
                >
                  对账 {reconcileOk ? '就绪' : '未配置'}
                </span>
                {data && (
                  <FromEnvBadge fromEnv={data.userApiUrlFromEnv || data.usageTokenFromEnv} />
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                用户端 API 用于登录与 SSO；Usage Token 用于成本对账。AI Key 请在渠道凭证页配置。
              </p>
            </div>
            {ssoOk && reconcileOk ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
            ) : (
              <XCircle className="h-6 w-6 shrink-0 text-amber-500" />
            )}
          </div>

          {data && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  AI 渠道凭证（只读）
                </h2>
                <Link
                  href="/admin/ai-providers"
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  前往配置
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-1.5 px-5 py-4 text-sm text-slate-600">
                <p>{providerLabel(data.aiProviders.mountsea, 'Mountsea（文本/Hub）')}</p>
                <p>{providerLabel(data.aiProviders.apisale, 'apisale（媒体主渠道）')}</p>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                SSO 与对账
              </h2>
            </div>
            <div className="divide-y divide-slate-100 px-5 py-2">
              <FormField
                label="用户端 API 地址"
                description="对应 MOUNTSEA_USER_API_URL。"
                controlClassName={CONTROL_WIDE}
              >
                <Input
                  size="sm"
                  type="url"
                  value={form.userApiUrl}
                  onChange={(e) => setForm((f) => ({ ...f, userApiUrl: e.target.value }))}
                  placeholder="https://dk.mountsea.ai"
                />
              </FormField>
              <FormField
                label="对账 API 地址"
                description="对应 MOUNTSEA_USAGE_BASE_URL；留空则与用户端同域。"
                controlClassName={CONTROL_WIDE}
              >
                <Input
                  size="sm"
                  type="url"
                  value={form.usageBaseUrl}
                  onChange={(e) => setForm((f) => ({ ...f, usageBaseUrl: e.target.value }))}
                  placeholder="https://dk.mountsea.ai"
                />
              </FormField>
              <FormField
                label="Usage Token"
                description="用户 JWT（MOUNTSEA_USAGE_TOKEN）。登录后从 Network Bearer 复制，约 24h 有效。留空保存表示不修改。"
                controlClassName={CONTROL_WIDE}
              >
                <SecretInput
                  configured={data?.usageTokenConfigured}
                  maskedPreview={data?.usageTokenMasked}
                  value={form.usageToken}
                  onChange={(usageToken) => setForm((f) => ({ ...f, usageToken }))}
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  showToggle
                  className={SECRET_INPUT_CLS}
                />
              </FormField>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {msg && (
              <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
                {msg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" />
              {save.isPending ? '保存中…' : '保存配置'}
            </button>
          </div>
        </form>
      </QueryState>
    </section>
  );
}
