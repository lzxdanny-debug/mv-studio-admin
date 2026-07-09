'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Save, Plug, CheckCircle2, XCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { SecretInput } from '@/components/secret-input';
import { FromEnvBadge } from './from-env-badge';

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

  return (
    <section>
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
        <div className={cn(!embedded && 'bg-white border border-slate-200 rounded-2xl p-5')}>
          <div className="flex items-start gap-3 mb-4">
            <Mail className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">阿里云邮件推送</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                用于注册验证码、找回密码等系统邮件。发信地址须已在阿里云 DirectMail 控制台验证。
              </p>
              {data && (
                <div className="flex items-center gap-1.5 mt-2">
                  {data.enabled ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-xs text-emerald-600 font-medium">
                        已配置 · {data.accountName}
                        <FromEnvBadge fromEnv={data.accessKeyIdFromEnv || data.accessKeySecretFromEnv} />
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs text-amber-600 font-medium">
                        未配置完整，验证码/找回密码邮件无法发送
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">邮件品牌名</label>
                <input
                  type="text"
                  value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  placeholder="AI MV Studio"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">发信地址</label>
                <input
                  type="text"
                  value={form.accountName}
                  onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                  placeholder="dk@yourdomain.com"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">地域 Region</label>
                <input
                  type="text"
                  value={form.regionId}
                  onChange={(e) => setForm((f) => ({ ...f, regionId: e.target.value }))}
                  placeholder="cn-hangzhou"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">AccessKey ID</label>
                <SecretInput
                  configured={data?.accessKeyIdConfigured}
                  maskedPreview={data?.accessKeyIdMasked}
                  value={form.accessKeyId}
                  onChange={(accessKeyId) => setForm((f) => ({ ...f, accessKeyId }))}
                  placeholder="LTAI..."
                  type="text"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">AccessKey Secret</label>
                <SecretInput
                  configured={data?.accessKeySecretConfigured}
                  maskedPreview={data?.accessKeySecretMasked}
                  value={form.accessKeySecret}
                  onChange={(accessKeySecret) => setForm((f) => ({ ...f, accessKeySecret }))}
                  placeholder="32 位字符串"
                  showToggle
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">测试收件邮箱</label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50"
              />
            </div>

            {msg && (
              <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
                {msg.text}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
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
                disabled={test.isPending || !data?.enabled}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                <Plug className={cn('h-3.5 w-3.5', test.isPending && 'animate-pulse')} />
                发送测试邮件
              </button>
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
