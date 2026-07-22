'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cloud, Settings as SettingsIcon, CheckCircle2, XCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { SecretInput } from '@/components/secret-input';
import { FromEnvBadge } from './from-env-badge';

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
        <div className={cn(!embedded && 'bg-white border border-slate-200 rounded-2xl p-5')}>
          <div className="flex items-start gap-3 mb-4">
            <Cloud className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">AWS S3</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                海外主存储账号。配置完成后可在「通用设置」切换为主存储；公网 URL 优先使用 Public Base（CDN）。
              </p>
              {data && (
                <div className="flex items-center gap-1.5 mt-2">
                  {configured ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-xs text-emerald-600 font-medium">
                        已配置 · {data.bucket} ({data.region})
                        <FromEnvBadge fromEnv={data.accessKeyIdFromEnv || data.secretAccessKeyFromEnv} />
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs text-amber-600 font-medium">
                        未配置完整，无法切换为主存储
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
                <label className="block text-xs font-medium text-slate-600 mb-1">Access Key Id</label>
                <SecretInput
                  configured={data?.accessKeyIdConfigured}
                  maskedPreview={data?.accessKeyIdMasked}
                  value={form.accessKeyId}
                  onChange={(accessKeyId) => setForm((f) => ({ ...f, accessKeyId }))}
                  placeholder="AKIAxxxxxxxxxxxxxxxx"
                  type="text"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Secret Access Key</label>
                <SecretInput
                  configured={data?.secretAccessKeyConfigured}
                  maskedPreview={data?.secretAccessKeyMasked}
                  value={form.secretAccessKey}
                  onChange={(secretAccessKey) => setForm((f) => ({ ...f, secretAccessKey }))}
                  placeholder="密钥明文"
                  showToggle
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Bucket</label>
                <input
                  type="text"
                  placeholder="msea-ai-prod-assets-…"
                  value={form.bucket}
                  onChange={(e) => setForm((f) => ({ ...f, bucket: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Region</label>
                <input
                  type="text"
                  placeholder="us-east-1"
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Prefix</label>
                <input
                  type="text"
                  placeholder="mv-studio/permanent"
                  value={form.prefix}
                  onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Public Base</label>
                <input
                  type="url"
                  placeholder="https://assets.aimv.video"
                  value={form.publicBase}
                  onChange={(e) => setForm((f) => ({ ...f, publicBase: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">CDN Origin Prefix</label>
                <input
                  type="text"
                  placeholder="mv-studio"
                  value={form.publicOriginPrefix}
                  onChange={(e) => setForm((f) => ({ ...f, publicOriginPrefix: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                />
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  CDN 的 Origin Path 已包含该目录时填写；S3 保留完整路径，公网 URL 自动去除它。
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                <SettingsIcon className={cn('h-3.5 w-3.5', save.isPending && 'animate-spin')} />
                {save.isPending ? '保存中…' : '保存配置'}
              </button>
            </div>
          </form>
        </div>
      </QueryState>
    </section>
  );
}
