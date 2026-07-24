'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HardDrive, Save, CheckCircle2, XCircle } from 'lucide-react';
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

  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        主对象存储
      </h2>
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <HardDrive className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">STORAGE_PROVIDER</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                上传、上游镜像、Worker 预签名统一走当前主存储。历史 URL 不迁移，且仍识别为已托管资产。
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OPTIONS.map((opt) => {
                const status = data?.storageProviders?.[opt.id];
                const ready = !!status?.configured;
                const selected = provider === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={cn(
                      'relative flex flex-col gap-2 rounded-xl border p-4 cursor-pointer transition-colors',
                      selected
                        ? 'border-blue-500 bg-blue-50/50'
                        : 'border-slate-200 hover:border-slate-300',
                      !ready && 'opacity-70',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="storageProvider"
                        value={opt.id}
                        checked={selected}
                        disabled={!ready && !selected}
                        onChange={() => setProvider(opt.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{opt.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{opt.desc}</p>
                        <div className="flex items-center gap-1.5 mt-2">
                          {ready ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="text-xs text-emerald-600 font-medium">已配置</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5 text-amber-500" />
                              <span className="text-xs text-amber-600 font-medium">未配置</span>
                              <Link
                                href={opt.accountHref}
                                className="text-xs text-blue-600 hover:underline ml-1"
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

            {msg && (
              <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
                {msg.text}
              </p>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={save.isPending || provider === data?.storageProvider}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                <Save className={cn('h-3.5 w-3.5', save.isPending && 'animate-spin')} />
                {save.isPending ? '保存中…' : '保存切换'}
              </button>
            </div>
          </form>
        </div>
      </QueryState>
    </section>
  );
}
