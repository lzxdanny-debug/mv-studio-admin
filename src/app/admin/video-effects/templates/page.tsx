'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ImageOff,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Wand2,
  X,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { useConfirm } from '@/components/ui/dialog-provider';

const PREVIEW_POPOVER_W = 300;
const PREVIEW_POPOVER_H = 400;
const PREVIEW_POPOVER_GAP = 12;

interface TemplateRow {
  id: string;
  slug: string;
  internalCode: string;
  status: string;
  featured: boolean;
  newBadge: boolean;
  sortOrder: number;
  currentPublishedVersionId: string | null;
  ownerTeam: string | null;
  coverUrl: string | null;
  previewVideoUrl: string | null;
  coverPrompt: string | null;
  nameZh: string | null;
  nameEn: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  reviewing: '审核中',
  published: '已发布',
  paused: '已暂停',
  archived: '已归档',
};

const STATUS_CLASS: Record<string, string> = {
  published: 'bg-emerald-50 text-emerald-600',
  draft: 'bg-slate-100 text-slate-500',
  reviewing: 'bg-amber-50 text-amber-600',
  paused: 'bg-orange-50 text-orange-600',
  archived: 'bg-slate-100 text-slate-400',
};

const WEB_ORIGIN =
  process.env.NEXT_PUBLIC_MAIN_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';

function resolveAssetUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${WEB_ORIGIN}${url}`;
  return url;
}

const INPUT =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

export default function AdminVideoEffectTemplatesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const canEdit = useAdminAuthStore((s) => s.hasPermission('effects.template.edit'));
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ slug: '', internalCode: '', sortOrder: 0 });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<TemplateRow | null>(null);

  const { data, isLoading, isError, error } = useQuery<TemplateRow[]>({
    queryKey: ['admin', 'video-effects', 'templates'],
    queryFn: () => apiClient.get('/admin/video-effects/templates') as any,
    // 后台批量生成预览较慢；有缺失时轮询，避免页面一直显示「无预览」
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      const missing = rows.some((r) => r.coverUrl && !r.previewVideoUrl);
      return missing ? 8_000 : false;
    },
  });

  const rows = [...(data ?? [])]
    .filter((r) => {
      if (filter === 'published') return r.status === 'published';
      if (filter === 'draft') return r.status === 'draft' || r.status === 'reviewing';
      return true;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const create = useMutation({
    mutationFn: () =>
      apiClient.post('/admin/video-effects/templates', {
        slug: form.slug.trim(),
        internalCode: form.internalCode.trim() || form.slug.trim(),
        sortOrder: form.sortOrder,
      }) as any,
    onSuccess: (res: TemplateRow & { id: string }) => {
      setMsg({ ok: true, text: '模板已创建。' });
      setCreating(false);
      setForm({ slug: '', internalCode: '', sortOrder: 0 });
      qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'templates'] });
      if (res?.id) router.push(`/admin/video-effects/templates/${res.id}`);
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '创建失败' }),
  });

  const generate = useMutation({
    mutationFn: (force: boolean) =>
      apiClient.post('/admin/video-effects/templates/generate-covers', { force }) as any,
    onSuccess: (res: any) => {
      setMsg({ ok: true, text: res?.message || '已触发批量封面生成（后台异步）' });
      setTimeout(
        () => qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'templates'] }),
        8_000,
      );
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '触发失败' }),
  });

  const generatePreviews = useMutation({
    mutationFn: (force: boolean) =>
      apiClient.post('/admin/video-effects/templates/generate-previews', { force }) as any,
    onSuccess: (res: any) => {
      setMsg({
        ok: true,
        text: res?.message || '已触发批量预览视频生成（后台异步，较耗时）',
      });
      setTimeout(
        () => qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'templates'] }),
        20_000,
      );
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '触发失败' }),
  });

  return (
    <div className="admin-page">
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Wand2 className="h-5 w-5 text-blue-600" />
              特效模板库
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              封面用 Nano Banana；hover 预览视频用 effectVideoI2V（需先有远端封面）。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => generate.mutate(false)}
                  disabled={generate.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', generate.isPending && 'animate-spin')} />
                  补齐缺失封面
                </button>
                <button
                  type="button"
                  onClick={() => generatePreviews.mutate(false)}
                  disabled={generatePreviews.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                >
                  <RefreshCw
                    className={cn(
                      'h-3.5 w-3.5',
                      generatePreviews.isPending && 'animate-spin',
                    )}
                  />
                  补齐预览视频
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: '强制重新生成所有模板封面？',
                      description: '耗时较长且会消耗 AI 配额，已有远端封面也会被覆盖。',
                      variant: 'warning',
                      confirmText: '全量重生',
                    });
                    if (ok) generate.mutate(true);
                  }}
                  disabled={generate.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  全量重生封面
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  新建
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {(
            [
              ['all', '全部'],
              ['published', '已发布'],
              ['draft', '草稿'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium',
                filter === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {msg && (
          <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
            {msg.text}
          </p>
        )}

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!isLoading && !rows.length}
          emptyMessage="暂无模板"
          height="h-48"
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {rows.map((row) => (
              <TemplateCard
                key={row.id}
                row={row}
                canEdit={canEdit}
                onEditPrompt={() => setEditing(row)}
                onMsg={setMsg}
              />
            ))}
          </div>
        </QueryState>

        <CoverPromptEditor
          open={!!editing}
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => setMsg({ ok: true, text })}
        />

        {creating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">新建模板</h2>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">
                    Slug
                  </span>
                  <input
                    className={INPUT}
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    placeholder="e.g. freeze-dance"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">
                    内部 Code
                  </span>
                  <input
                    className={INPUT}
                    value={form.internalCode}
                    onChange={(e) => setForm((f) => ({ ...f, internalCode: e.target.value }))}
                    placeholder="默认与 slug 相同"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">
                    排序
                  </span>
                  <input
                    type="number"
                    className={INPUT}
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))
                    }
                  />
                </label>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-xl px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={create.isPending || !form.slug.trim()}
                  onClick={() => create.mutate()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  <Save className="h-3.5 w-3.5" />
                  {create.isPending ? '创建中…' : '创建'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateCard({
  row,
  canEdit,
  onEditPrompt,
  onMsg,
}: {
  row: TemplateRow;
  canEdit: boolean;
  onEditPrompt: () => void;
  onMsg: (msg: { ok: boolean; text: string }) => void;
}) {
  const qc = useQueryClient();
  const cardMediaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
    side: 'left' | 'right';
  } | null>(null);
  const cover = resolveAssetUrl(row.coverUrl);
  const previewUrl = resolveAssetUrl(row.previewVideoUrl);
  const title = row.nameZh || row.nameEn || row.slug;

  const regenerate = useMutation({
    mutationFn: () =>
      apiClient.post(`/admin/video-effects/templates/${row.id}/regenerate-cover`) as any,
    onSuccess: () => {
      onMsg({ ok: true, text: `${row.slug} 封面已重新生成` });
      qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'templates'] });
    },
    onError: (err: any) => onMsg({ ok: false, text: err?.message || '封面生成失败' }),
  });

  const regeneratePreview = useMutation({
    mutationFn: () =>
      apiClient.post(`/admin/video-effects/templates/${row.id}/regenerate-preview`) as any,
    onSuccess: () => {
      onMsg({ ok: true, text: `${row.slug} 预览视频已重新生成` });
      qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'templates'] });
    },
    onError: (err: any) =>
      onMsg({ ok: false, text: err?.message || '预览视频生成失败' }),
  });

  const busy = regenerate.isPending || regeneratePreview.isPending;

  function clearCloseTimer() {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function computePopoverPos() {
    const rect = cardMediaRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;
    const side: 'left' | 'right' =
      spaceRight >= PREVIEW_POPOVER_W + PREVIEW_POPOVER_GAP ||
      spaceRight >= spaceLeft
        ? 'right'
        : 'left';
    const left =
      side === 'right'
        ? Math.min(
            rect.right + PREVIEW_POPOVER_GAP,
            window.innerWidth - PREVIEW_POPOVER_W - 8,
          )
        : Math.max(8, rect.left - PREVIEW_POPOVER_GAP - PREVIEW_POPOVER_W);
    const top = Math.max(
      8,
      Math.min(
        rect.top + rect.height / 2 - PREVIEW_POPOVER_H / 2,
        window.innerHeight - PREVIEW_POPOVER_H - 8,
      ),
    );
    return { top, left, side };
  }

  function openPreview() {
    if (!previewUrl || busy) return;
    clearCloseTimer();
    const pos = computePopoverPos();
    if (!pos) return;
    setPopoverPos(pos);
    setPreviewOpen(true);
  }

  function scheduleClosePreview() {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setPreviewOpen(false);
      setPopoverPos(null);
      const video = videoRef.current;
      if (!video) return;
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        /* ignore */
      }
    }, 80);
  }

  useLayoutEffect(() => {
    if (!previewOpen) return;
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      const play = video.play();
      if (play && typeof play.catch === 'function') {
        play.catch(() => undefined);
      }
    }
  }, [previewOpen, previewUrl]);

  useEffect(() => {
    if (!previewOpen) return;
    const reposition = () => {
      const pos = computePopoverPos();
      if (pos) setPopoverPos(pos);
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [previewOpen]);

  useEffect(
    () => () => {
      clearCloseTimer();
    },
    [],
  );

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div
        ref={cardMediaRef}
        className="relative aspect-[4/3] overflow-hidden bg-slate-100"
        onMouseEnter={openPreview}
        onMouseLeave={scheduleClosePreview}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={title}
            className={cn(
              'h-full w-full object-cover transition-opacity',
              busy && 'opacity-30',
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <ImageOff className="h-6 w-6" />
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-1.5 bg-slate-900/35 text-xs text-white">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {regeneratePreview.isPending ? '预览生成中…' : '封面生成中…'}
          </div>
        )}
        <span
          className={cn(
            'absolute left-2 top-2 z-10 rounded px-1.5 py-0.5 text-[10px] font-medium',
            STATUS_CLASS[row.status] ?? 'bg-slate-100 text-slate-500',
          )}
        >
          {STATUS_LABEL[row.status] ?? row.status}
        </span>
        {previewUrl ? (
          <span className="absolute bottom-2 left-2 z-10 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
            有预览 · 悬停放大
          </span>
        ) : (
          <span className="absolute bottom-2 left-2 z-10 rounded bg-slate-700/80 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
            无预览
          </span>
        )}
      </div>

      {previewOpen &&
        previewUrl &&
        popoverPos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="pointer-events-auto fixed z-[80] overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-2xl shadow-black/40"
            style={{
              top: popoverPos.top,
              left: popoverPos.left,
              width: PREVIEW_POPOVER_W,
              height: PREVIEW_POPOVER_H,
            }}
            onMouseEnter={() => {
              clearCloseTimer();
              setPreviewOpen(true);
            }}
            onMouseLeave={scheduleClosePreview}
          >
            <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
              <video
                ref={videoRef}
                src={previewUrl}
                muted
                loop
                playsInline
                preload="auto"
                className="absolute inset-0 h-full w-full scale-[1.48] object-cover object-center"
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/70 to-transparent px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-white">{title}</p>
              <p className="truncate font-mono text-[10px] text-white/55">{row.slug}</p>
            </div>
          </div>,
          document.body,
        )}

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <div>
          <p className="truncate text-sm font-medium text-slate-800">{title}</p>
          <p className="truncate font-mono text-[10px] text-slate-400">{row.slug}</p>
        </div>
        <div className="mt-auto flex flex-wrap gap-1.5">
          <Link
            href={`/admin/video-effects/templates/${row.id}`}
            className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
          >
            详情
          </Link>
          {canEdit && (
            <>
              <button
                type="button"
                onClick={onEditPrompt}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
              >
                <Pencil className="h-3 w-3" />
                编辑提示词
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => regenerate.mutate()}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className="h-3 w-3" />
                重生封面
              </button>
              <button
                type="button"
                disabled={busy || !row.coverUrl}
                onClick={() => regeneratePreview.mutate()}
                className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                <RefreshCw className="h-3 w-3" />
                重生预览
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CoverPromptEditor({
  open,
  template,
  onClose,
  onSaved,
}: {
  open: boolean;
  template: TemplateRow | null;
  onClose: () => void;
  onSaved: (text: string) => void;
}) {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !template) return;
    setPrompt(template.coverPrompt ?? '');
    setErr(null);
  }, [open, template]);

  const save = useMutation({
    mutationFn: () => {
      if (!template) throw new Error('no template');
      return apiClient.patch(`/admin/video-effects/templates/${template.id}`, {
        coverPrompt: prompt,
      }) as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'templates'] });
      onSaved('封面提示词已保存（未自动重生图，可再点「重生封面」）');
      onClose();
    },
    onError: (e: any) => setErr(e?.message || '保存失败'),
  });

  const saveAndRegen = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error('no template');
      await apiClient.patch(`/admin/video-effects/templates/${template.id}`, {
        coverPrompt: prompt,
      });
      return apiClient.post(
        `/admin/video-effects/templates/${template.id}/regenerate-cover`,
      ) as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'templates'] });
      onSaved('提示词已保存，封面已重新生成');
      onClose();
    },
    onError: (e: any) => setErr(e?.message || '保存或生成失败'),
  });

  if (!open || !template) return null;

  const busy = save.isPending || saveAndRegen.isPending;
  const title = template.nameZh || template.nameEn || template.slug;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">编辑封面提示词</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {title} · <span className="font-mono">{template.slug}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Cover Prompt（Nano Banana）
            </span>
            <textarea
              className={cn(INPUT, 'min-h-[220px] font-mono text-xs leading-5')}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="英文描述画面主体、镜头感、光线；不要写可读文字/水印。留空则按模板名称自动拼装。"
            />
          </label>
          <p className="text-[11px] leading-relaxed text-slate-400">
            「仅保存」只更新 Prompt；「保存并重生封面」会同步调用 Nano Banana 覆盖当前封面。
          </p>
          {err && <p className="text-xs font-medium text-red-500">{err}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => save.mutate()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            仅保存
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => saveAndRegen.mutate()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saveAndRegen.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            保存并重生封面
          </button>
        </div>
      </div>
    </div>
  );
}
