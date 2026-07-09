'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Palette, RefreshCw, ImageOff, Pencil, Loader2, AlertCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/dialog-provider';
import { StyleEditor } from './_components/style-editor';

/**
 * Admin 风格库页面。
 *
 * 后端返回的每条 style 不止有原来的预览图字段，还附带 admin 覆盖元信息：
 *   - hasOverride / overrideFields  ——  判断显示"已覆盖"badge
 *   - defaults                       ——  编辑模态框"恢复默认"用
 *   - updatedAt / updatedBy          ——  审计展示
 *
 * 卡片右下角两个按钮：
 *   - "编辑 prompt"     →  打开 StyleEditor 模态框
 *   - "重新生成预览图"   →  同步调用 POST /:tag/regenerate（30s-2min）
 */
export interface StyleDef {
  tag: string;
  labelZh: string;
  descriptionZh: string;
  veoKeywords: string;
  filmPreamble: string | null;
  previewUrl: string | null;
  hasOverride: boolean;
  overrideFields: Array<'veoKeywords' | 'filmPreamble' | 'descriptionZh'>;
  defaults: {
    veoKeywords: string;
    filmPreamble: string | null;
    descriptionZh: string;
  };
  updatedAt: string | null;
  updatedBy: string | null;
}

export default function AdminMvStylesPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<StyleDef | null>(null);

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
      setTimeout(() => qc.invalidateQueries({ queryKey: ['admin', 'mv', 'styles'] }), 5_000);
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '触发失败' }),
  });

  return (
    <div className="admin-page">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Palette className="h-5 w-5 text-blue-600" />
              MV 风格库
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              编辑风格 prompt 会同时影响 admin 预览图 + 实际 MV 生成时 Veo 注入的关键词
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
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
              <StyleCard key={style.tag} style={style} onEdit={() => setEditing(style)} />
            ))}
          </div>
        </QueryState>
      </div>

      <StyleEditor open={!!editing} style={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function StyleCard({ style, onEdit }: { style: StyleDef; onEdit: () => void }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  const regenerate = useMutation({
    mutationFn: () =>
      apiClient.post(`/admin/mv/styles/${encodeURIComponent(style.tag)}/regenerate`) as any,
    onSuccess: () => {
      setLocalMsg(null);
      qc.invalidateQueries({ queryKey: ['admin', 'mv', 'styles'] });
    },
    onError: (err: any) => setLocalMsg(err?.message || '重新生成失败'),
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
      <div className="aspect-video bg-slate-100 relative">
        {style.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={style.previewUrl}
            alt={style.labelZh}
            className={cn(
              'w-full h-full object-cover transition-opacity',
              regenerate.isPending && 'opacity-30',
            )}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
        {regenerate.isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30 text-white text-xs gap-1.5">
            <Loader2 className="h-4 w-4 animate-spin" />
            重新生成中…
          </div>
        )}
        {style.hasOverride && (
          <span className="absolute top-2 left-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/95 text-white shadow">
            已覆盖 prompt
          </span>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <p className="text-sm font-medium text-slate-800">{style.labelZh}</p>
        <p className="text-[10px] uppercase tracking-wider text-slate-400">{style.tag}</p>
        <p className="text-xs text-slate-500 line-clamp-3">{style.descriptionZh}</p>
        {localMsg && (
          <div className="mt-1 rounded-lg bg-red-50 border border-red-100 text-[11px] text-red-700 px-2 py-1 flex items-start gap-1">
            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span className="leading-tight">{localMsg}</span>
          </div>
        )}
      </div>
      <div className="px-3 py-2 border-t border-slate-100 flex items-center gap-2">
        <button
          onClick={onEdit}
          disabled={regenerate.isPending}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-50"
        >
          <Pencil className="h-3 w-3" />
          编辑 prompt
        </button>
        <button
          onClick={async () => {
            const ok = await confirm({
              title: '重新生成预览图？',
              description: `将用当前 prompt 重新生成「${style.labelZh}」的预览图，约 30s-2min，已有图会被覆盖。`,
              confirmText: '重新生成',
            });
            if (ok) regenerate.mutate();
          }}
          disabled={regenerate.isPending}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
        >
          {regenerate.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          重新生成
        </button>
      </div>
    </div>
  );
}
