'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Palette, RefreshCw, ImageOff } from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/dialog-provider';

interface StyleDef {
  tag: string;
  labelZh: string;
  descriptionZh: string;
  veoKeywords: string;
  previewUrl: string | null;
}

export default function AdminMvStylesPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<StyleDef[]>({
    queryKey: ['admin', 'mv', 'styles'],
    queryFn: () => apiClient.get('/admin/mv/styles') as any,
  });

  const generate = useMutation({
    mutationFn: (force: boolean) =>
      apiClient.post('/admin/mv/styles/generate-all', { force }) as any,
    onSuccess: (res: any) => {
      setMsg({
        ok: true,
        text: res?.message || '已触发批量生成（后台异步）',
      });
      // 延迟刷新，让用户看到生成中的状态变化
      setTimeout(() => qc.invalidateQueries({ queryKey: ['admin', 'mv', 'styles'] }), 5_000);
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '触发失败' }),
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Palette className="h-5 w-5 text-purple-600" />
              MV 风格库
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              展示所有内置视觉风格定义与 COS 预览图缓存状态
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => generate.mutate(false)}
              disabled={generate.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', generate.isPending && 'animate-spin')} />
              补齐缺失预览图
            </button>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: '强制重新生成所有风格预览图？',
                  description: '耗时较长且会消耗 AI 配额，已有的预览图也会被覆盖。',
                  variant: 'warning',
                  confirmText: '全量重生',
                });
                if (ok) generate.mutate(true);
              }}
              disabled={generate.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', generate.isPending && 'animate-spin')} />
              强制全量重生
            </button>
          </div>
        </div>

        {msg && (
          <div
            className={cn(
              'rounded-xl border px-3 py-2 text-xs',
              msg.ok
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                : 'bg-red-50 border-red-100 text-red-700',
            )}
          >
            {msg.text}
          </div>
        )}

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!data?.length}
          emptyMessage="暂无风格定义"
          height="h-64"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data?.map((style) => (
              <div
                key={style.tag}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col"
              >
                <div className="aspect-video bg-slate-100 relative">
                  {style.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={style.previewUrl}
                      alt={style.labelZh}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImageOff className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col gap-1.5">
                  <p className="text-sm font-medium text-slate-800">{style.labelZh}</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                    {style.tag}
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-3">{style.descriptionZh}</p>
                </div>
              </div>
            ))}
          </div>
        </QueryState>
      </div>
    </div>
  );
}
