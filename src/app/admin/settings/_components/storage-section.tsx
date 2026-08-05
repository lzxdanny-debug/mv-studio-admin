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
import { CONTROL_MD, CONTROL_WIDE, SECRET_INPUT_CLS } from './settings-form-styles';

interface StorageConfig {
  secretIdMasked: string;
  secretIdConfigured: boolean;
  secretIdFromEnv: boolean;
  secretKeyMasked: string;
  secretKeyConfigured: boolean;
  secretKeyFromEnv: boolean;
  bucket: string;
  region: string;
}

interface StorageForm {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
}

export function StorageSection({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<StorageForm>({
    secretId: '',
    secretKey: '',
    bucket: '',
    region: '',
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<StorageConfig>({
    queryKey: ['admin', 'settings', 'storage'],
    queryFn: async () => {
      const cfg = (await apiClient.get('/admin/settings/storage')) as unknown as StorageConfig;
      setForm((f) => ({ ...f, bucket: cfg.bucket, region: cfg.region }));
      return cfg;
    },
  });

  const save = useMutation({
    mutationFn: (payload: Partial<StorageForm>) =>
      apiClient.patch('/admin/settings/storage', payload) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: 'COS 配置已保存。' });
      setForm((f) => ({ ...f, secretId: '', secretKey: '' }));
      qc.invalidateQueries({ queryKey: ['admin', 'settings', 'storage'] });
      qc.invalidateQueries({ queryKey: ['admin', 'settings', 'general'] });
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请检查输入后重试。' }),
  });

  const configured = !!(
    data?.secretIdConfigured &&
    data?.secretKeyConfigured &&
    data?.bucket &&
    data?.region
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const payload: Partial<StorageForm> = { bucket: form.bucket, region: form.region };
    if (form.secretId) payload.secretId = form.secretId;
    if (form.secretKey) payload.secretKey = form.secretKey;
    save.mutate(payload);
  };

  return (
    <section>
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-64">
        <form
          onSubmit={handleSubmit}
          className={cn('space-y-4', !embedded && 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm')}
        >
          <div
            className={cn(
              'flex items-center justify-between gap-4 rounded-2xl border px-5 py-4',
              configured
                ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50'
                : 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50',
            )}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-slate-900">腾讯云 COS</p>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    configured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                  )}
                >
                  {configured ? '已配置' : '未配置'}
                </span>
                {data && (
                  <FromEnvBadge fromEnv={data.secretIdFromEnv || data.secretKeyFromEnv} />
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {configured
                  ? `${data?.bucket} · ${data?.region} · 永久归档 AI 生成文件`
                  : '未配置完整时，AI 生成文件将使用临时链接'}
              </p>
            </div>
            {configured ? (
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
                label="SecretId"
                description="腾讯云 API 密钥 ID。留空保存表示不修改。"
                controlClassName={CONTROL_WIDE}
              >
                <SecretInput
                  configured={data?.secretIdConfigured}
                  maskedPreview={data?.secretIdMasked}
                  value={form.secretId}
                  onChange={(secretId) => setForm((f) => ({ ...f, secretId }))}
                  placeholder="AKIDxxxxxxxxxxxxxxxx"
                  type="text"
                  className={SECRET_INPUT_CLS}
                />
              </FormField>
              <FormField
                label="SecretKey"
                description="对应 SecretKey。留空保存表示不修改。"
                controlClassName={CONTROL_WIDE}
              >
                <SecretInput
                  configured={data?.secretKeyConfigured}
                  maskedPreview={data?.secretKeyMasked}
                  value={form.secretKey}
                  onChange={(secretKey) => setForm((f) => ({ ...f, secretKey }))}
                  placeholder="32 位字符串"
                  showToggle
                  className={SECRET_INPUT_CLS}
                />
              </FormField>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">存储桶</h2>
            </div>
            <div className="divide-y divide-slate-100 px-5 py-2">
              <FormField label="Bucket" description="COS 存储桶名称。" controlClassName={CONTROL_MD}>
                <Input
                  size="sm"
                  placeholder="aiconsole-1387810185"
                  value={form.bucket}
                  onChange={(e) => setForm((f) => ({ ...f, bucket: e.target.value }))}
                />
              </FormField>
              <FormField label="Region" description="存储桶所在地域，如 ap-hongkong。">
                <Input
                  size="sm"
                  placeholder="ap-hongkong"
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
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
