'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Save, XCircle } from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';

type StorageProvider = 'cos' | 's3';

interface GeneralConfigView {
  storageProvider: StorageProvider;
  storageProviders: {
    cos: { configured: boolean; label: string };
    s3: { configured: boolean; label: string };
  };
}

const OPTIONS: Array<{
  id: StorageProvider;
  title: string;
  desc: string;
  accountHref: string;
}> = [
  {
    id: 'cos',
    title: '腾讯云 COS',
    desc: '默认主存储，适合国内访问与现有历史资产。',
    accountHref: '/admin/settings?tab=account&account=cos',
  },
  {
    id: 's3',
    title: 'AWS S3',
    desc: '海外桶 + CDN（Public Base），切换后新上传走 S3。',
    accountHref: '/admin/settings?tab=account&account=s3',
  },
];

export function StorageProviderSection() {
  const qc = useQueryClient();
  const [provider, setProvider] = useState<StorageProvider>('cos');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<GeneralConfigView>({
    queryKey: ['admin', 'settings', 'general'],
    queryFn: () => apiClient.get('/admin/settings/general') as Promise<GeneralConfigView>,
  });

  // 同页多个区块共用 queryKey；缓存命中时不会重跑 queryFn，必须从 data 同步选中态
  useEffect(() => {
    if (data?.storageProvider === 'cos' || data?.storageProvider === 's3') {
      setProvider(data.storageProvider);
    }
  }, [data?.storageProvider]);

  const save = useMutation({
    mutationFn: (payload: { storageProvider: StorageProvider }) =>
      apiClient.patch('/admin/settings/general', payload) as Promise<GeneralConfigView>,
    onSuccess: (cfg) => {
      setMsg({
        ok: true,
        text: `主存储已切换为 ${cfg.storageProvider === 's3' ? 'AWS S3' : '腾讯云 COS'}。仅影响新写入。`,
      });
      setProvider(cfg.storageProvider);
      qc.setQueryData(['admin', 'settings', 'general'], cfg);
    },
    onError: (err: any) => {
      const text =
        err?.response?.data?.message ||
        err?.message ||
        '保存失败，请确认目标账号已配置完整。';
      setMsg({ ok: false, text: Array.isArray(text) ? text.join('；') : String(text) });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    save.mutate({ storageProvider: provider });
  };

  const activeLabel = data?.storageProvider === 's3' ? 'AWS S3' : '腾讯云 COS';

  return (
    <section>
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/40 px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-slate-900">主对象存储</p>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                  当前 {activeLabel}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                上传、上游镜像、Worker 预签名统一走当前主存储。历史 URL 不迁移。
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                STORAGE_PROVIDER
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
              {OPTIONS.map((opt) => {
                const status = data?.storageProviders?.[opt.id];
                const ready = !!status?.configured;
                const selected = provider === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={cn(
                      'relative flex cursor-pointer flex-col gap-2 rounded-[12px] border p-4 transition-colors',
                      selected
                        ? 'border-blue-500 bg-blue-50/50 ring-[3px] ring-blue-500/10'
                        : 'border-slate-200 hover:border-slate-300',
                      !ready && 'opacity-70',
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="storageProvider"
                        value={opt.id}
                        checked={selected}
                        disabled={!ready && !selected}
                        onChange={() => setProvider(opt.id)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800">{opt.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{opt.desc}</p>
                        <div className="mt-2 flex items-center gap-1.5">
                          {ready ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="text-xs font-medium text-emerald-600">已配置</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5 text-amber-500" />
                              <span className="text-xs font-medium text-amber-600">未配置</span>
                              <Link
                                href={opt.accountHref}
                                className="ml-1 text-xs text-blue-600 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                去配置
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })}
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
              disabled={save.isPending || provider === data?.storageProvider}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" />
              {save.isPending ? '保存中…' : '保存切换'}
            </button>
          </div>
        </form>
      </QueryState>
    </section>
  );
}
