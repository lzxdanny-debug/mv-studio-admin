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

interface S3StorageConfig {
  accessKeyIdMasked: string;
  accessKeyIdConfigured: boolean;
  accessKeyIdFromEnv: boolean;
  secretAccessKeyMasked: string;
  secretAccessKeyConfigured: boolean;
  secretAccessKeyFromEnv: boolean;
  region: string;
  bucket: string;
  prefix: string;
  publicBase: string;
  publicOriginPrefix: string;
  configured: boolean;
}

interface S3StorageForm {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  prefix: string;
  publicBase: string;
  publicOriginPrefix: string;
}

export function S3StorageSection({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<S3StorageForm>({
    accessKeyId: '',
    secretAccessKey: '',
    region: '',
    bucket: '',
    prefix: '',
    publicBase: '',
    publicOriginPrefix: '',
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<S3StorageConfig>({
    queryKey: ['admin', 'settings', 'storage', 's3'],
    queryFn: async () => {
      const cfg = (await apiClient.get('/admin/settings/storage/s3')) as unknown as S3StorageConfig;
      setForm((f) => ({
        ...f,
        region: cfg.region,
        bucket: cfg.bucket,
        prefix: cfg.prefix,
        publicBase: cfg.publicBase,
        publicOriginPrefix: cfg.publicOriginPrefix,
      }));
      return cfg;
    },
  });

  const save = useMutation({
    mutationFn: (payload: Partial<S3StorageForm>) =>
      apiClient.patch('/admin/settings/storage/s3', payload) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: 'AWS S3 配置已保存。' });
      setForm((f) => ({ ...f, accessKeyId: '', secretAccessKey: '' }));
      qc.invalidateQueries({ queryKey: ['admin', 'settings', 'storage', 's3'] });
      qc.invalidateQueries({ queryKey: ['admin', 'settings', 'general'] });
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请检查输入后重试。' }),
  });

  const configured = !!data?.configured;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const payload: Partial<S3StorageForm> = {
      region: form.region,
      bucket: form.bucket,
      prefix: form.prefix,
      publicBase: form.publicBase,
      publicOriginPrefix: form.publicOriginPrefix,
    };
    if (form.accessKeyId) payload.accessKeyId = form.accessKeyId;
    if (form.secretAccessKey) payload.secretAccessKey = form.secretAccessKey;
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
                <p className="text-base font-semibold text-slate-900">AWS S3</p>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    configured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                  )}
                >
                  {configured ? '已配置' : '未配置'}
                </span>
                {data && (
                  <FromEnvBadge
                    fromEnv={data.accessKeyIdFromEnv || data.secretAccessKeyFromEnv}
                  />
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {configured
                  ? `${data?.bucket} · ${data?.region} · 可在「通用设置」切换为主存储`
                  : '未配置完整时，无法切换为主存储'}
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
                label="Access Key Id"
                description="留空保存表示不修改已有密钥。"
                controlClassName={CONTROL_WIDE}
              >
                <SecretInput
                  configured={data?.accessKeyIdConfigured}
                  maskedPreview={data?.accessKeyIdMasked}
                  value={form.accessKeyId}
                  onChange={(accessKeyId) => setForm((f) => ({ ...f, accessKeyId }))}
                  placeholder="AKIAxxxxxxxxxxxxxxxx"
                  type="text"
                  className={SECRET_INPUT_CLS}
                />
              </FormField>
              <FormField
                label="Secret Access Key"
                description="对应密钥。留空保存表示不修改。"
                controlClassName={CONTROL_WIDE}
              >
                <SecretInput
                  configured={data?.secretAccessKeyConfigured}
                  maskedPreview={data?.secretAccessKeyMasked}
                  value={form.secretAccessKey}
                  onChange={(secretAccessKey) => setForm((f) => ({ ...f, secretAccessKey }))}
                  placeholder="密钥明文"
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
              <FormField label="Bucket" description="S3 存储桶名称。" controlClassName={CONTROL_MD}>
                <Input
                  size="sm"
                  placeholder="msea-ai-prod-assets-…"
                  value={form.bucket}
                  onChange={(e) => setForm((f) => ({ ...f, bucket: e.target.value }))}
                />
              </FormField>
              <FormField label="Region" description="如 us-east-1。">
                <Input
                  size="sm"
                  placeholder="us-east-1"
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                />
              </FormField>
              <FormField
                label="Prefix"
                description="对象键前缀，如 mv-studio/permanent。"
                controlClassName={CONTROL_MD}
              >
                <Input
                  size="sm"
                  placeholder="mv-studio/permanent"
                  value={form.prefix}
                  onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))}
                />
              </FormField>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                公网访问
              </h2>
            </div>
            <div className="divide-y divide-slate-100 px-5 py-2">
              <FormField
                label="Public Base"
                description="公网 URL 优先使用该 CDN / 自定义域名。"
                controlClassName={CONTROL_WIDE}
              >
                <Input
                  size="sm"
                  type="url"
                  placeholder="https://assets.aimv.video"
                  value={form.publicBase}
                  onChange={(e) => setForm((f) => ({ ...f, publicBase: e.target.value }))}
                />
              </FormField>
              <FormField
                label="CDN Origin Prefix"
                description="CDN Origin Path 已包含该目录时填写；S3 保留完整路径，公网 URL 自动去除它。"
                controlClassName={CONTROL_MD}
              >
                <Input
                  size="sm"
                  placeholder="mv-studio"
                  value={form.publicOriginPrefix}
                  onChange={(e) => setForm((f) => ({ ...f, publicOriginPrefix: e.target.value }))}
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
