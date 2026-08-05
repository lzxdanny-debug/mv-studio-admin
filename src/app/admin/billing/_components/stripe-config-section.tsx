'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plug, Save, XCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { SecretInput } from '@/components/secret-input';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import type { StripeConfigView } from './types';

const CURRENCY_OPTIONS = [
  { value: 'usd', label: 'USD' },
  { value: 'eur', label: 'EUR' },
  { value: 'gbp', label: 'GBP' },
  { value: 'sgd', label: 'SGD' },
  { value: 'hkd', label: 'HKD' },
  { value: 'cny', label: 'CNY' },
  { value: 'jpy', label: 'JPY' },
];

const SECRET_INPUT_CLS = cn(
  'rounded-[10px] border-slate-200/90 bg-white',
  'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
  'focus:ring-[3px] focus:ring-blue-500/15 focus:border-blue-400',
);

/**
 * Stripe 充值/订阅密钥与 Checkout 回调配置。
 * 供系统设置「充值设置」Tab 与旧 billing/settings 入口复用。
 */
export function StripeConfigSection() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    secretKey: '',
    webhookSecret: '',
    successUrl: '',
    cancelUrl: '',
    currency: 'usd',
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
        currency: (cfg.currency || 'usd').toLowerCase(),
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

  const enabled = !!data?.enabled;
  const currencyOptions = CURRENCY_OPTIONS.some((o) => o.value === form.currency)
    ? CURRENCY_OPTIONS
    : [{ value: form.currency, label: form.currency.toUpperCase() }, ...CURRENCY_OPTIONS];

  return (
    <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          className={cn(
            'flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 shadow-sm',
            enabled
              ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50'
              : 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50',
          )}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-slate-900">Stripe 支付</p>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  enabled
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700',
                )}
              >
                {enabled ? '已启用' : '未配置'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {enabled ? (
                <>
                  密钥 {data?.secretKeyMasked}
                  {data?.secretKeyFromEnv ? '（来自环境变量）' : ''}
                  · USD 计价，Checkout 托管页
                </>
              ) : (
                '未配置 Secret Key 时，充值与订阅接口将返回 503'
              )}
            </p>
          </div>
          {enabled ? (
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
          ) : (
            <XCircle className="h-6 w-6 shrink-0 text-amber-500" />
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              密钥
            </h2>
          </div>
          <div className="divide-y divide-slate-100 px-5 py-2">
            <FormField
              label="Secret Key"
              description="sk_test_… / sk_live_…。留空保存表示不修改已有密钥。"
              controlClassName="sm:w-[320px] w-[220px]"
            >
              <SecretInput
                configured={data?.secretKeyConfigured}
                maskedPreview={data?.secretKeyMasked}
                value={form.secretKey}
                onChange={(secretKey) => setForm((f) => ({ ...f, secretKey }))}
                placeholder="sk_test_..."
                showToggle
                className={SECRET_INPUT_CLS}
              />
            </FormField>
            <FormField
              label="Webhook Secret"
              description="whsec_…，用于校验 Stripe Webhook 签名。"
              controlClassName="sm:w-[320px] w-[220px]"
            >
              <SecretInput
                configured={data?.webhookSecretConfigured}
                maskedPreview={data?.webhookSecretMasked}
                value={form.webhookSecret}
                onChange={(webhookSecret) => setForm((f) => ({ ...f, webhookSecret }))}
                placeholder="whsec_..."
                className={SECRET_INPUT_CLS}
              />
            </FormField>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Checkout 回调
            </h2>
          </div>
          <div className="divide-y divide-slate-100 px-5 py-2">
            <FormField
              label="Success URL"
              description="支付成功后跳转的前端地址，可含 {CHECKOUT_SESSION_ID}。"
              controlClassName="sm:w-[360px] w-[220px]"
            >
              <Input
                size="sm"
                value={form.successUrl}
                onChange={(e) => setForm((f) => ({ ...f, successUrl: e.target.value }))}
                placeholder="https://example.com/billing/success"
              />
            </FormField>
            <FormField
              label="Cancel URL"
              description="用户取消 Checkout 后的返回地址。"
              controlClassName="sm:w-[360px] w-[220px]"
            >
              <Input
                size="sm"
                value={form.cancelUrl}
                onChange={(e) => setForm((f) => ({ ...f, cancelUrl: e.target.value }))}
                placeholder="https://example.com/pricing"
              />
            </FormField>
            <FormField label="Currency" description="Stripe Checkout 计价货币（小写 ISO 码）。">
              <SimpleSelect
                size="sm"
                value={form.currency || 'usd'}
                onValueChange={(currency) => setForm((f) => ({ ...f, currency }))}
                options={currencyOptions}
              />
            </FormField>
          </div>
        </div>

        <p className="px-1 text-[11px] leading-relaxed text-slate-400">
          积分套餐、会员计划请到对应计费子页配置；注册/签到赠送请到「赠送积分」；计费系数与模型定价请到「定价策略」。
        </p>

        <div className="flex flex-col items-end gap-2">
          {msg && (
            <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
              {msg.text}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMsg(null);
                test.mutate();
              }}
              disabled={test.isPending || !enabled}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              <Plug className={cn('h-3.5 w-3.5', test.isPending && 'animate-pulse')} />
              {test.isPending ? '测试中…' : '测试连接'}
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" />
              {save.isPending ? '保存中…' : '保存配置'}
            </button>
          </div>
        </div>
      </form>
    </QueryState>
  );
}
