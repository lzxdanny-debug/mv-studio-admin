'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Save, Plug } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { SecretInput } from '@/components/secret-input';
import type { StripeConfigView } from './types';

export function StripeConfigSection() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    secretKey: '',
    webhookSecret: '',
    successUrl: '',
    cancelUrl: '',
    currency: '',
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<StripeConfigView>({
    queryKey: ['admin', 'billing', 'stripe-config'],
    queryFn: async () => {
      const cfg = (await apiClient.get(
        '/admin/billing/stripe-config',
      )) as unknown as StripeConfigView;
      setForm((f) => ({
        ...f,
        successUrl: cfg.successUrl,
        cancelUrl: cfg.cancelUrl,
        currency: cfg.currency,
      }));
      return cfg;
    },
  });

  const save = useMutation({
    mutationFn: (payload: Partial<typeof form>) =>
      apiClient.patch('/admin/billing/stripe-config', payload) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: 'Stripe 配置已保存。' });
      setForm((f) => ({ ...f, secretKey: '', webhookSecret: '' }));
      qc.invalidateQueries({ queryKey: ['admin', 'billing', 'stripe-config'] });
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请重试。' }),
  });

  const test = useMutation({
    mutationFn: () =>
      apiClient.post('/admin/billing/stripe-config/test', {}) as unknown as Promise<{
        ok: boolean;
        message?: string;
        livemode?: boolean;
      }>,
    onSuccess: (res) => {
      setMsg(
        res.ok
          ? {
              ok: true,
              text: `连接成功（${res.livemode ? 'live' : 'test'} 模式）。`,
            }
          : { ok: false, text: `连接失败：${res.message ?? '未知错误'}` },
      );
    },
    onError: () => setMsg({ ok: false, text: '测试请求失败。' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const payload: Partial<typeof form> = {
      successUrl: form.successUrl,
      cancelUrl: form.cancelUrl,
      currency: form.currency,
    };
    if (form.secretKey) payload.secretKey = form.secretKey;
    if (form.webhookSecret) payload.webhookSecret = form.webhookSecret;
    save.mutate(payload);
  };

  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Stripe 密钥
      </h2>
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-1.5 mb-4">
            {data?.enabled ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs text-emerald-600 font-medium">
                  已启用 · 密钥 {data.secretKeyMasked}
                  {data.secretKeyFromEnv && '（来自环境变量）'}
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs text-amber-600 font-medium">
                  未配置密钥，充值/订阅接口将返回 503
                </span>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Secret Key (sk_...)
                </label>
                <SecretInput
                  configured={data?.secretKeyConfigured}
                  maskedPreview={data?.secretKeyMasked}
                  value={form.secretKey}
                  onChange={(secretKey) => setForm((f) => ({ ...f, secretKey }))}
                  placeholder="sk_test_..."
                  showToggle
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Webhook Secret (whsec_...)
                </label>
                <SecretInput
                  configured={data?.webhookSecretConfigured}
                  maskedPreview={data?.webhookSecretMasked}
                  value={form.webhookSecret}
                  onChange={(webhookSecret) => setForm((f) => ({ ...f, webhookSecret }))}
                  placeholder="whsec_..."
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Success URL</label>
                <input
                  type="text"
                  value={form.successUrl}
                  onChange={(e) => setForm((f) => ({ ...f, successUrl: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-slate-50"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Cancel URL</label>
                <input
                  type="text"
                  value={form.cancelUrl}
                  onChange={(e) => setForm((f) => ({ ...f, cancelUrl: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Currency</label>
                <input
                  type="text"
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  placeholder="usd"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-slate-50"
                />
              </div>
            </div>

            {msg && (
              <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
                {msg.text}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => test.mutate()}
                disabled={test.isPending || !data?.enabled}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                <Plug className={cn('h-3.5 w-3.5', test.isPending && 'animate-pulse')} />
                测试连接
              </button>
              <button
                type="submit"
                disabled={save.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
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
