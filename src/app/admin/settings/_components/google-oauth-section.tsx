'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Chrome, Save, CheckCircle2, XCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { SecretInput } from '@/components/secret-input';
import { FromEnvBadge } from './from-env-badge';

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

  return (
    <section>
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
        <div className={cn(!embedded && 'bg-white border border-slate-200 rounded-2xl p-5')}>
          <div className="flex items-start gap-3 mb-4">
            <Chrome className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">Google OAuth 2.0</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                配置 C 端用户 Google 登录。回调地址须与 Google Cloud Console 登记的 Authorized redirect URI 完全一致。
              </p>
              {data && (
                <div className="flex items-center gap-1.5 mt-2">
                  {data.enabled ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-xs text-emerald-600 font-medium">
                        已配置
                        <FromEnvBadge fromEnv={data.clientIdFromEnv || data.clientSecretFromEnv} />
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs text-amber-600 font-medium">未配置完整，Google 登录不可用</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Client ID</label>
                <SecretInput
                  configured={data?.clientIdConfigured}
                  maskedPreview={data?.clientIdMasked}
                  value={form.clientId}
                  onChange={(clientId) => setForm((f) => ({ ...f, clientId }))}
                  placeholder="xxxx.apps.googleusercontent.com"
                  type="text"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Client Secret</label>
                <SecretInput
                  configured={data?.clientSecretConfigured}
                  maskedPreview={data?.clientSecretMasked}
                  value={form.clientSecret}
                  onChange={(clientSecret) => setForm((f) => ({ ...f, clientSecret }))}
                  placeholder="GOCSPX-..."
                  showToggle
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Callback URL（Google 回调）</label>
                <input
                  type="text"
                  value={form.callbackUrl}
                  onChange={(e) => setForm((f) => ({ ...f, callbackUrl: e.target.value }))}
                  placeholder="http://localhost:3000/api/auth/google/redirect"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">登录成功跳转 URL</label>
                <input
                  type="text"
                  value={form.successUrl}
                  onChange={(e) => setForm((f) => ({ ...f, successUrl: e.target.value }))}
                  placeholder="http://localhost:3000/auth/callback"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">登录失败跳转 URL</label>
                <input
                  type="text"
                  value={form.failureUrl}
                  onChange={(e) => setForm((f) => ({ ...f, failureUrl: e.target.value }))}
                  placeholder="http://localhost:3000/login?error=oauth_failed"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50"
                />
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
