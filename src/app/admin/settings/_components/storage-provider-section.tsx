'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import {
  SettingsPanel,
  SettingsSaveBar,
  SettingsStatusBadge,
} from './settings-panel';

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
    desc: '默认主存储',
    accountHref: '/admin/settings?tab=account&account=cos',
  },
  {
    id: 's3',
    title: 'AWS S3',
    desc: '海外桶 + CDN',
    accountHref: '/admin/settings?tab=account&account=s3',
  },
];

export function StorageProviderSection() {
  const qc = useQueryClient();
  const [provider, setProvider] = useState<StorageProvider>('cos');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<GeneralConfigView>({
    queryKey: ['admin', 'settings', 'general'],
    queryFn: () =>
      apiClient.get('/admin/settings/general') as Promise<GeneralConfigView>,
  });

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
        text: `已切换为 ${cfg.storageProvider === 's3' ? 'AWS S3' : '腾讯云 COS'}（仅影响新写入）`,
      });
      setProvider(cfg.storageProvider);
      qc.setQueryData(['admin', 'settings', 'general'], cfg);
    },
    onError: (err: any) => {
      const text =
        err?.response?.data?.message ||
        err?.message ||
        '保存失败，请确认目标账号已配置完整。';
      setMsg({
        ok: false,
        text: Array.isArray(text) ? text.join('；') : String(text),
      });
    },
  });

  const activeLabel = data?.storageProvider === 's3' ? 'AWS S3' : '腾讯云 COS';
  const dirty = provider !== data?.storageProvider;

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      error={error}
      isEmpty={false}
      height="h-24"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          save.mutate({ storageProvider: provider });
        }}
      >
        <SettingsPanel
          title="主对象存储"
          tone="emerald"
          badge={
            <SettingsStatusBadge ok okText={`当前 ${activeLabel}`} />
          }
          summary="上传、镜像、Worker 预签名走当前主存储；历史 URL 不迁移"
          footer={
            <SettingsSaveBar
              msg={msg}
              saving={save.isPending}
              disabled={!dirty}
              label="保存切换"
            />
          }
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {OPTIONS.map((opt) => {
              const status = data?.storageProviders?.[opt.id];
              const ready = !!status?.configured;
              const selected = provider === opt.id;
              return (
                <label
                  key={opt.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors',
                    selected
                      ? 'border-emerald-500 bg-emerald-50/50'
                      : 'border-slate-200 hover:border-slate-300',
                    !ready && !selected && 'opacity-60',
                  )}
                >
                  <input
                    type="radio"
                    name="storageProvider"
                    value={opt.id}
                    checked={selected}
                    disabled={!ready && !selected}
                    onChange={() => setProvider(opt.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-medium text-slate-800">
                        {opt.title}
                      </p>
                      <span
                        className={cn(
                          'text-[11px]',
                          ready ? 'text-emerald-600' : 'text-amber-600',
                        )}
                      >
                        {ready ? '已配置' : '未配置'}
                      </span>
                      {!ready && (
                        <Link
                          href={opt.accountHref}
                          className="text-[11px] text-blue-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          去配置
                        </Link>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{opt.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </SettingsPanel>
      </form>
    </QueryState>
  );
}
