'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Settings as SettingsIcon,
  HardDrive,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  SlidersHorizontal,
  ArrowRight,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';

interface StorageConfig {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
}

interface StorageForm {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
}

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<StorageForm>({
    secretId: '',
    secretKey: '',
    bucket: '',
    region: '',
  });
  const [showSecret, setShowSecret] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<StorageConfig>({
    queryKey: ['admin', 'settings', 'storage'],
    queryFn: async () => {
      const cfg = (await apiClient.get('/admin/settings/storage')) as unknown as StorageConfig;
      // 同步 bucket/region 到表单（secretId/secretKey 留空表示"不修改"）
      setForm((f) => ({ ...f, bucket: cfg.bucket, region: cfg.region }));
      return cfg;
    },
  });

  const save = useMutation({
    mutationFn: (payload: Partial<StorageForm>) =>
      apiClient.patch('/admin/settings/storage', payload) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: '存储配置已保存。' });
      setForm((f) => ({ ...f, secretId: '', secretKey: '' }));
      qc.invalidateQueries({ queryKey: ['admin', 'settings', 'storage'] });
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请检查输入后重试。' }),
  });

  const configured = !!(data?.secretId && data?.secretKey && data?.bucket && data?.region);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const payload: Partial<StorageForm> = { bucket: form.bucket, region: form.region };
    if (form.secretId) payload.secretId = form.secretId;
    if (form.secretKey) payload.secretKey = form.secretKey;
    save.mutate(payload);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4 max-w-3xl">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-purple-600" />
            系统设置
          </h1>
          <p className="text-sm text-slate-500 mt-1">配置 MV Studio 运行时依赖</p>
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={false}
          height="h-64"
        >
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              对象存储（腾讯云 COS）
            </h2>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <HardDrive className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">腾讯云 COS</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    用于将 AI 生成的视频、图片、音乐归档到永久存储，避免 Mountsea CDN 链接过期。
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
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder={configured ? '留空则不修改' : 'AKIDxxxxxxxxxxxxxxxx'}
                      value={form.secretId}
                      onChange={(e) => setForm((f) => ({ ...f, secretId: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">SecretKey</label>
                    <div className="relative">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder={configured ? '留空则不修改' : '32 位字符串'}
                        value={form.secretKey}
                        onChange={(e) => setForm((f) => ({ ...f, secretKey: e.target.value }))}
                        className="w-full px-3 py-2 pr-9 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-slate-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showSecret ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Bucket</label>
                    <input
                      type="text"
                      placeholder="aiconsole-1387810185"
                      value={form.bucket}
                      onChange={(e) => setForm((f) => ({ ...f, bucket: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Region</label>
                    <input
                      type="text"
                      placeholder="ap-hongkong"
                      value={form.region}
                      onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-slate-50"
                    />
                  </div>
                </div>

                {msg && (
                  <p
                    className={cn(
                      'text-xs font-medium',
                      msg.ok ? 'text-emerald-600' : 'text-red-500',
                    )}
                  >
                    {msg.text}
                  </p>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={save.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                  >
                    <SettingsIcon className={cn('h-3.5 w-3.5', save.isPending && 'animate-spin')} />
                    {save.isPending ? '保存中…' : '保存配置'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </QueryState>

        {/* MV 默认配置已迁移到独立页面：保留一个跳转入口避免老用户找不到 */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            其他配置
          </h2>
          <Link
            href="/admin/mv/defaults"
            className="block bg-white border border-slate-200 rounded-2xl p-4 hover:border-purple-300 hover:bg-purple-50/30 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                <SlidersHorizontal className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">MV 默认配置</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  字幕样式默认 / 音频压缩参数 已迁移至独立页面
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-purple-600 transition-colors" />
            </div>
          </Link>
        </section>
      </div>
    </div>
  );
}
