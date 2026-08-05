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
import { FromEnvBadge } from './from-env-badge';
import { CONTROL_MD, CONTROL_WIDE, SECRET_INPUT_CLS } from './settings-form-styles';

interface MailConfigView {
  brand: string;
  accountName: string;
  regionId: string;
  accessKeyIdMasked: string;
  accessKeyIdConfigured: boolean;
  accessKeyIdFromEnv: boolean;
  accessKeySecretMasked: string;
  accessKeySecretConfigured: boolean;
  accessKeySecretFromEnv: boolean;
  enabled: boolean;
}

export function MailSection({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    brand: '',
    accountName: '',
    regionId: '',
    accessKeyId: '',
    accessKeySecret: '',
  });
  const [testEmail, setTestEmail] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<MailConfigView>({
    queryKey: ['admin', 'settings', 'mail'],
    queryFn: async () => {
      const cfg = (await apiClient.get('/admin/settings/mail')) as unknown as MailConfigView;
      setForm((f) => ({
        ...f,
        brand: cfg.brand,
        accountName: cfg.accountName,
        regionId: cfg.regionId,
      }));
      return cfg;
    },
  });

  const save = useMutation({
    mutationFn: (payload: Partial<typeof form>) =>
      apiClient.patch('/admin/settings/mail', payload) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: '邮件配置已保存，下一次发信即生效。' });
      setForm((f) => ({ ...f, accessKeyId: '', accessKeySecret: '' }));
      qc.invalidateQueries({ queryKey: ['admin', 'settings', 'mail'] });
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请检查输入后重试。' }),
  });

  const test = useMutation({
    mutationFn: (to: string) =>
      apiClient.post('/admin/settings/mail/test', { to }) as unknown as Promise<{
        ok: boolean;
        message?: string;
      }>,
    onSuccess: (res) => {
      setMsg(
        res.ok
          ? { ok: true, text: res.message ?? '测试邮件已发送。' }
          : { ok: false, text: '测试失败。' },
      );
    },
    onError: (e: any) => {
      setMsg({ ok: false, text: e?.message || e?.error || '测试请求失败。' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const payload: Partial<typeof form> = {
      brand: form.brand,
      accountName: form.accountName,
      regionId: form.regionId,
    };
    if (form.accessKeyId) payload.accessKeyId = form.accessKeyId;
    if (form.accessKeySecret) payload.accessKeySecret = form.accessKeySecret;
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
                <p className="text-base font-semibold text-slate-900">阿里云邮件推送</p>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                  )}
                >
                  {enabled ? '已配置' : '未配置'}
                </span>
                {data && (
                  <FromEnvBadge
                    fromEnv={data.accessKeyIdFromEnv || data.accessKeySecretFromEnv}
                  />
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {enabled
                  ? `发信地址 ${data?.accountName} · 用于注册验证码、找回密码等`
                  : '未配置完整时，验证码/找回密码邮件无法发送'}
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
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                发信身份
              </h2>
            </div>
            <div className="divide-y divide-slate-100 px-5 py-2">
              <FormField label="邮件品牌名" description="邮件正文与标题中展示的品牌名。">
                <Input
                  size="sm"
                  value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  placeholder="AI MV Studio"
                />
              </FormField>
              <FormField
                label="发信地址"
                description="须已在阿里云 DirectMail 控制台验证。"
                controlClassName={CONTROL_MD}
              >
                <Input
                  size="sm"
                  value={form.accountName}
                  onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                  placeholder="dk@yourdomain.com"
                />
              </FormField>
              <FormField label="地域 Region" description="阿里云地域，如 cn-hangzhou。">
                <Input
                  size="sm"
                  value={form.regionId}
                  onChange={(e) => setForm((f) => ({ ...f, regionId: e.target.value }))}
                  placeholder="cn-hangzhou"
                />
              </FormField>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">凭证</h2>
            </div>
            <div className="divide-y divide-slate-100 px-5 py-2">
              <FormField
                label="AccessKey ID"
                description="留空保存表示不修改已有密钥。"
                controlClassName={CONTROL_MD}
              >
                <SecretInput
                  configured={data?.accessKeyIdConfigured}
                  maskedPreview={data?.accessKeyIdMasked}
                  value={form.accessKeyId}
                  onChange={(accessKeyId) => setForm((f) => ({ ...f, accessKeyId }))}
                  placeholder="LTAI..."
                  type="text"
                  className={SECRET_INPUT_CLS}
                />
              </FormField>
              <FormField
                label="AccessKey Secret"
                description="对应 Secret。留空保存表示不修改。"
                controlClassName={CONTROL_WIDE}
              >
                <SecretInput
                  configured={data?.accessKeySecretConfigured}
                  maskedPreview={data?.accessKeySecretMasked}
                  value={form.accessKeySecret}
                  onChange={(accessKeySecret) => setForm((f) => ({ ...f, accessKeySecret }))}
                  placeholder="32 位字符串"
                  showToggle
                  className={SECRET_INPUT_CLS}
                />
              </FormField>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">连通性</h2>
            </div>
            <div className="divide-y divide-slate-100 px-5 py-2">
              <FormField
                label="测试收件邮箱"
                description="点击「发送测试邮件」时使用，不会随配置保存。"
                controlClassName={CONTROL_MD}
              >
                <Input
                  size="sm"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your@email.com"
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
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMsg(null);
                  if (!testEmail.trim()) {
                    setMsg({ ok: false, text: '请先填写测试收件邮箱。' });
                    return;
                  }
                  test.mutate(testEmail.trim());
                }}
                disabled={test.isPending || !enabled}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                <Plug className={cn('h-3.5 w-3.5', test.isPending && 'animate-pulse')} />
                {test.isPending ? '发送中…' : '发送测试邮件'}
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
    </section>
  );
}
