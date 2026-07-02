'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  ImageOff,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/dialog-provider';
import { BeatEffectEditor } from './_components/beat-effect-editor';

export interface BeatEffectDef {
  id: string;
  title: string;
  titleEn: string;
  desc: string;
  descEn: string;
  prompt: string;
  promptEn: string;
  cover: string;
  coverPrompt: string;
  previewUrl: string | null;
  aspect: 'portrait' | 'landscape' | 'square';
  tags: string[];
  accent: 'cyan' | 'green' | 'violet' | 'rose' | 'amber';
  pattern: 'pulse' | 'split' | 'flash' | 'orbit' | 'shake' | 'freeze';
  styleTag: string;
  enabled: boolean;
  sortOrder: number;
  isCustom: boolean;
  hasOverride: boolean;
  overrideFields: string[];
  defaults: {
    title: string;
    titleEn: string;
    desc: string;
    descEn: string;
    prompt: string;
    promptEn: string;
    cover: string;
    coverPrompt: string;
    aspect: 'portrait' | 'landscape' | 'square';
    tags: string[];
    accent: 'cyan' | 'green' | 'violet' | 'rose' | 'amber';
    pattern: 'pulse' | 'split' | 'flash' | 'orbit' | 'shake' | 'freeze';
    styleTag: string;
    enabled: boolean;
    sortOrder: number;
  };
  updatedAt: string | null;
  updatedBy: string | null;
}

const WEB_ORIGIN =
  process.env.NEXT_PUBLIC_MAIN_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';

function resolveCoverUrl(cover: string): string {
  if (!cover) return '';
  if (cover.startsWith('http://') || cover.startsWith('https://')) return cover;
  if (cover.startsWith('/')) return `${WEB_ORIGIN}${cover}`;
  return cover;
}

function displayCoverUrl(template: BeatEffectDef): string {
  return template.previewUrl || resolveCoverUrl(template.cover);
}

function aspectClass(aspect: BeatEffectDef['aspect']) {
  if (aspect === 'portrait') return 'aspect-[4/5]';
  if (aspect === 'square') return 'aspect-square';
  return 'aspect-[16/9]';
}

export default function AdminMvBeatEffectsPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<BeatEffectDef | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, isError, error } = useQuery<BeatEffectDef[]>({
    queryKey: ['admin', 'mv', 'beat-effects'],
    queryFn: () => apiClient.get('/admin/mv/beat-effects') as any,
  });

  const generate = useMutation({
    mutationFn: (force: boolean) =>
      apiClient.post('/admin/mv/beat-effects/generate-all', { force }) as any,
    onSuccess: (res: any) => {
      setMsg({ ok: true, text: res?.message || '已触发批量生成（后台异步）' });
      setTimeout(() => qc.invalidateQueries({ queryKey: ['admin', 'mv', 'beat-effects'] }), 5_000);
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '触发失败' }),
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-teal-600" />
              节拍特效库
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              管理 C 端 /beat-effects 页面展示的特效模板；编辑 cover prompt 影响封面图生成
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              添加节拍特效
            </button>
            <button
              onClick={() => generate.mutate(false)}
              disabled={generate.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', generate.isPending && 'animate-spin')} />
              补齐缺失封面
            </button>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: '强制重新生成所有封面？',
                  description: '耗时较长且会消耗 AI 配额，已有封面也会被覆盖。',
                  variant: 'warning',
                  confirmText: '全量重生',
                });
                if (ok) generate.mutate(true);
              }}
              disabled={generate.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
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
          emptyMessage="暂无节拍特效模板"
          height="h-64"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data?.map((template) => (
              <BeatEffectCard
                key={template.id}
                template={template}
                onEdit={() => setEditing(template)}
              />
            ))}
          </div>
        </QueryState>
      </div>

      <BeatEffectEditor
        open={creating}
        mode="create"
        template={null}
        onClose={() => setCreating(false)}
      />
      <BeatEffectEditor
        open={!!editing}
        mode="edit"
        template={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function BeatEffectCard({
  template,
  onEdit,
}: {
  template: BeatEffectDef;
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [localMsg, setLocalMsg] = useState<string | null>(null);
  const coverUrl = displayCoverUrl(template);

  const regenerate = useMutation({
    mutationFn: () =>
      apiClient.post(`/admin/mv/beat-effects/${encodeURIComponent(template.id)}/regenerate`) as any,
    onSuccess: () => {
      setLocalMsg(null);
      qc.invalidateQueries({ queryKey: ['admin', 'mv', 'beat-effects'] });
    },
    onError: (err: any) => setLocalMsg(err?.message || '重新生成失败'),
  });

  return (
    <div
      className={cn(
        'bg-white border rounded-2xl overflow-hidden flex flex-col',
        template.enabled ? 'border-slate-200' : 'border-slate-200 opacity-60',
      )}
    >
      <div className={cn('bg-slate-100 relative', aspectClass(template.aspect))}>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={template.title}
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
        {template.hasOverride && !template.isCustom && (
          <span className="absolute top-2 left-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/95 text-white shadow">
            已覆盖
          </span>
        )}
        {template.isCustom && (
          <span className="absolute top-2 left-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-teal-600/95 text-white shadow">
            自定义
          </span>
        )}
        {!template.enabled && (
          <span className="absolute top-2 right-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-700/90 text-white shadow">
            已禁用
          </span>
        )}
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-black/55 text-white backdrop-blur">
          <Sparkles className="h-3 w-3" />
          {template.pattern}
        </span>
      </div>
      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <p className="text-sm font-medium text-slate-800">{template.title}</p>
        <p className="text-[10px] uppercase tracking-wider text-slate-400">{template.id}</p>
        <p className="text-xs text-slate-500 line-clamp-2">{template.desc}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {template.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex px-1.5 py-0.5 rounded-md text-[10px] bg-slate-100 text-slate-500"
            >
              {tag}
            </span>
          ))}
        </div>
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
          编辑模板
        </button>
        <button
          onClick={async () => {
            const ok = await confirm({
              title: '重新生成封面？',
              description: `将用当前 cover prompt 重新生成「${template.title}」封面，约 30s-2min。`,
              confirmText: '重新生成',
            });
            if (ok) regenerate.mutate();
          }}
          disabled={regenerate.isPending}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
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
