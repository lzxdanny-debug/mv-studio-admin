'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HardDrive, Settings as SettingsIcon, CheckCircle2, XCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { SecretInput } from '@/components/secret-input';

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
        <div className={cn(!embedded && 'bg-white border border-slate-200 rounded-2xl p-5')}>
          <div className="flex items-start gap-3 mb-4">
            <HardDrive className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">腾讯云 COS</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                将 AI 生成的视频、图片、音乐归档到永久存储，避免 Mountsea CDN 链接过期。
              </p>
              {data && (
                <div className="flex items-center gap-1.5 mt-2">
                  {configured ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-xs text-emerald-600 font-medium">
                        已配置 · {data.bucket} ({data.region})
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs text-amber-600 font-medium">
                        未配置完整，AI 生成文件将使用临时链接
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
                <label className="block text-xs font-medium text-slate-600 mb-1">SecretId</label>
                <SecretInput
                  configured={data?.secretIdConfigured}
                  maskedPreview={data?.secretIdMasked}
                  value={form.secretId}
                  onChange={(secretId) => setForm((f) => ({ ...f, secretId }))}
                  placeholder="AKIDxxxxxxxxxxxxxxxx"
                  type="text"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">SecretKey</label>
                <SecretInput
                  configured={data?.secretKeyConfigured}
                  maskedPreview={data?.secretKeyMasked}
                  value={form.secretKey}
                  onChange={(secretKey) => setForm((f) => ({ ...f, secretKey }))}
                  placeholder="32 位字符串"
                  showToggle
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Bucket</label>
                <input
                  type="text"
                  placeholder="aiconsole-1387810185"
                  value={form.bucket}
                  onChange={(e) => setForm((f) => ({ ...f, bucket: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Region</label>
                <input
                  type="text"
                  placeholder="ap-hongkong"
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
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
