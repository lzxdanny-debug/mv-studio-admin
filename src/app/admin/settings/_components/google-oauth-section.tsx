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
import { FromEnvBadge } from './from-env-badge';
import { CONTROL_WIDE, SECRET_INPUT_CLS } from './settings-form-styles';

interface GoogleOAuthConfigView {
  clientIdMasked: string;
  clientIdConfigured: boolean;
  clientIdFromEnv: boolean;
  clientSecretMasked: string;
  clientSecretConfigured: boolean;
  clientSecretFromEnv: boolean;
  callbackUrl: string;
  successUrl: string;
  failureUrl: string;
  enabled: boolean;
}

interface GoogleOAuthCredentials {
  clientId: string;
  clientSecret: string;
}

export function GoogleOAuthSection({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    clientId: '',
    clientSecret: '',
    callbackUrl: '',
    successUrl: '',
    failureUrl: '',
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<GoogleOAuthConfigView>({
    queryKey: ['admin', 'settings', 'google-oauth'],
    queryFn: async () => {
      const cfg = (await apiClient.get(
        '/admin/settings/google-oauth',
      )) as unknown as GoogleOAuthConfigView;
      setForm((f) => ({
        ...f,
        callbackUrl: cfg.callbackUrl,
        successUrl: cfg.successUrl,
        failureUrl: cfg.failureUrl,
      }));
      return cfg;
    },
  });

  const save = useMutation({
    mutationFn: (payload: Partial<typeof form>) =>
      apiClient.patch('/admin/settings/google-oauth', payload) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: 'Google OAuth 配置已保存，下一次登录请求即生效。' });
      setForm((f) => ({ ...f, clientId: '', clientSecret: '' }));
      qc.invalidateQueries({ queryKey: ['admin', 'settings', 'google-oauth'] });
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请检查输入后重试。' }),
  });

  const revealCredentials = async (): Promise<GoogleOAuthCredentials> =>
    apiClient.get('/admin/settings/google-oauth/reveal') as unknown as Promise<GoogleOAuthCredentials>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const payload: Partial<typeof form> = {
      callbackUrl: form.callbackUrl,
      successUrl: form.successUrl,
      failureUrl: form.failureUrl,
    };
    if (form.clientId) payload.clientId = form.clientId;
    if (form.clientSecret) payload.clientSecret = form.clientSecret;
    save.mutate(payload);
  };

  const enabled = !!data?.enabled;

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
              enabled
                ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50'
                : 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50',
            )}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-slate-900">Google OAuth 2.0</p>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                  )}
                >
                  {enabled ? '已配置' : '未配置'}
                </span>
                {data && (
                  <FromEnvBadge fromEnv={data.clientIdFromEnv || data.clientSecretFromEnv} />
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {enabled
                  ? 'C 端 Google 登录可用。回调地址须与 Google Cloud Console 登记一致。'
                  : '未配置完整时，Google 登录不可用。'}
              </p>
            </div>
            {enabled ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
            ) : (
              <XCircle className="h-6 w-6 shrink-0 text-amber-500" />
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">凭证</h2>
            </div>
            <div className="divide-y divide-slate-100 px-5 py-2">
              <FormField
                label="Client ID"
                description="Google Cloud OAuth 客户端 ID。留空保存表示不修改。"
                controlClassName={CONTROL_WIDE}
              >
                <SecretInput
                  configured={data?.clientIdConfigured}
                  maskedPreview={data?.clientIdMasked}
                  value={form.clientId}
                  onChange={(clientId) => setForm((f) => ({ ...f, clientId }))}
                  placeholder="xxxx.apps.googleusercontent.com"
                  showToggle
                  copyable
                  onReveal={async () => (await revealCredentials()).clientId}
                  type="text"
                  className={SECRET_INPUT_CLS}
                />
              </FormField>
              <FormField
                label="Client Secret"
                description="对应 Client Secret。留空保存表示不修改。"
                controlClassName={CONTROL_WIDE}
              >
                <SecretInput
                  configured={data?.clientSecretConfigured}
                  maskedPreview={data?.clientSecretMasked}
                  value={form.clientSecret}
                  onChange={(clientSecret) => setForm((f) => ({ ...f, clientSecret }))}
                  placeholder="GOCSPX-..."
                  showToggle
                  copyable
                  onReveal={async () => (await revealCredentials()).clientSecret}
                  className={SECRET_INPUT_CLS}
                />
              </FormField>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                回调与跳转
              </h2>
            </div>
            <div className="divide-y divide-slate-100 px-5 py-2">
              <FormField
                label="Callback URL"
                description="Google 授权完成后回调到本站的地址。"
                controlClassName={CONTROL_WIDE}
              >
                <Input
                  size="sm"
                  value={form.callbackUrl}
                  onChange={(e) => setForm((f) => ({ ...f, callbackUrl: e.target.value }))}
                  placeholder="http://localhost:3000/api/auth/google/redirect"
                />
              </FormField>
              <FormField
                label="登录成功跳转"
                description="OAuth 成功后前端落地页。"
                controlClassName={CONTROL_WIDE}
              >
                <Input
                  size="sm"
                  value={form.successUrl}
                  onChange={(e) => setForm((f) => ({ ...f, successUrl: e.target.value }))}
                  placeholder="http://localhost:3000/auth/callback"
                />
              </FormField>
              <FormField
                label="登录失败跳转"
                description="OAuth 失败或取消后的落地页。"
                controlClassName={CONTROL_WIDE}
              >
                <Input
                  size="sm"
                  value={form.failureUrl}
                  onChange={(e) => setForm((f) => ({ ...f, failureUrl: e.target.value }))}
                  placeholder="http://localhost:3000/login?error=oauth_failed"
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
