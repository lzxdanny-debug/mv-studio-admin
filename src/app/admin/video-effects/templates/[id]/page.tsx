'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ImageOff, Loader2, RefreshCw, Rocket, Save, Wand2 } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { useAlert, useConfirm } from '@/components/ui/dialog-provider';

const WEB_ORIGIN =
  process.env.NEXT_PUBLIC_MAIN_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';

function resolveCoverUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${WEB_ORIGIN}${url}`;
  return url;
}

interface TemplateVersion {
  id: string;
  templateId: string;
  versionNo: number;
  nameZh: string;
  nameEn: string;
  shortDescZh: string | null;
  shortDescEn: string | null;
  scenarioId: string;
  workflowProfileId: string;
  pricingProfileId: string;
  promptProfileId: string;
  routeProfileId: string;
  isPremium: boolean;
  allowUserPrompt: boolean;
  allowRemoveWatermark: boolean;
  locked: boolean;
  publishedAt: string | null;
  publishNotes: string | null;
  tags: string[];
}

interface TemplateAsset {
  id: string;
  assetType: string;
  url: string;
}

interface TemplateDetail {
  id: string;
  slug: string;
  internalCode: string;
  status: string;
  featured: boolean;
  newBadge: boolean;
  sortOrder: number;
  currentPublishedVersionId: string | null;
  ownerTeam: string | null;
  coverPrompt: string | null;
  coverUrl: string | null;
  versions: TemplateVersion[];
  categoryIds: string[];
  assets: TemplateAsset[];
}

const INPUT =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

export default function AdminVideoEffectTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();
  const alert = useAlert();
  const confirm = useConfirm();
  const canEdit = useAdminAuthStore((s) => s.hasPermission('effects.template.edit'));
  const canPublish = useAdminAuthStore((s) => s.hasPermission('effects.template.publish'));

  const [meta, setMeta] = useState({
    featured: false,
    newBadge: false,
    sortOrder: 0,
    status: 'draft',
    coverPrompt: '',
  });
  const [draftEdit, setDraftEdit] = useState<Partial<TemplateVersion> | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<TemplateDetail>({
    queryKey: ['admin', 'video-effects', 'templates', id],
    queryFn: () => apiClient.get(`/admin/video-effects/templates/${id}`) as any,
  });

  useEffect(() => {
    if (!data) return;
    setMeta({
      featured: data.featured,
      newBadge: data.newBadge,
      sortOrder: data.sortOrder,
      status: data.status,
      coverPrompt: data.coverPrompt ?? '',
    });
  }, [data]);

  const saveMeta = useMutation({
    mutationFn: () =>
      apiClient.patch(`/admin/video-effects/templates/${id}`, {
        featured: meta.featured,
        newBadge: meta.newBadge,
        sortOrder: meta.sortOrder,
        status: meta.status,
        coverPrompt: meta.coverPrompt,
      }) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: '模板信息已保存。' });
      qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'templates', id] });
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '保存失败' }),
  });

  const saveVersion = useMutation({
    mutationFn: () => {
      if (!draftEdit?.id) throw new Error('无草稿版本');
      return apiClient.patch(`/admin/video-effects/template-versions/${draftEdit.id}`, {
        nameZh: draftEdit.nameZh,
        nameEn: draftEdit.nameEn,
        shortDescZh: draftEdit.shortDescZh,
        shortDescEn: draftEdit.shortDescEn,
        isPremium: draftEdit.isPremium,
        allowUserPrompt: draftEdit.allowUserPrompt,
        allowRemoveWatermark: draftEdit.allowRemoveWatermark,
        publishNotes: draftEdit.publishNotes,
      }) as any;
    },
    onSuccess: () => {
      setMsg({ ok: true, text: '草稿版本已保存。' });
      setDraftEdit(null);
      qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'templates', id] });
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '保存失败' }),
  });

  const publish = useMutation({
    mutationFn: (versionId: string) =>
      apiClient.post(`/admin/video-effects/template-versions/${versionId}/publish`, {}) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: '版本已发布。' });
      qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'templates', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'templates'] });
    },
    onError: async (err: any) => {
      await alert({ title: '发布失败', description: err?.message ?? String(err), variant: 'danger' });
    },
  });

  const handlePublish = async (v: TemplateVersion) => {
    const ok = await confirm({
      title: `发布版本 v${v.versionNo}？`,
      description: '发布后该版本将被锁定，不可再修改。模板状态将变为已发布。',
      confirmText: '发布',
    });
    if (ok) publish.mutate(v.id);
  };

  const regenerateCover = useMutation({
    mutationFn: () =>
      apiClient.post(`/admin/video-effects/templates/${id}/regenerate-cover`) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: '封面已用 Nano Banana 重新生成。' });
      qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'templates', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'templates'] });
    },
    onError: async (err: any) => {
      await alert({
        title: '封面生成失败',
        description: err?.message ?? String(err),
        variant: 'danger',
      });
    },
  });

  const versions = data?.versions ?? [];
  const coverUrl = resolveCoverUrl(
    data?.coverUrl ?? data?.assets?.find((a) => a.assetType === 'cover')?.url ?? null,
  );

  return (
    <div className="admin-page">
      <div className="space-y-5 p-6">
        <div>
          <Link
            href="/admin/video-effects/templates"
            className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回模板库
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Wand2 className="h-5 w-5 text-blue-600" />
            {data?.slug ?? '模板详情'}
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-400">{data?.internalCode ?? id}</p>
        </div>

        {msg && (
          <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>{msg.text}</p>
        )}

        <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
          {data && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 text-sm font-semibold text-slate-800">模板信息</h2>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={meta.featured}
                      disabled={!canEdit}
                      onChange={(e) => setMeta((m) => ({ ...m, featured: e.target.checked }))}
                      className="accent-blue-600"
                    />
                    精选
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={meta.newBadge}
                      disabled={!canEdit}
                      onChange={(e) => setMeta((m) => ({ ...m, newBadge: e.target.checked }))}
                      className="accent-blue-600"
                    />
                    New 角标
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">排序</span>
                    <input
                      type="number"
                      className={INPUT}
                      disabled={!canEdit}
                      value={meta.sortOrder}
                      onChange={(e) => setMeta((m) => ({ ...m, sortOrder: Number(e.target.value) || 0 }))}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">状态</span>
                    <select
                      className={INPUT}
                      disabled={!canEdit}
                      value={meta.status}
                      onChange={(e) => setMeta((m) => ({ ...m, status: e.target.value }))}
                    >
                      {['draft', 'reviewing', 'paused', 'archived', 'published'].map((s) => (
                        <option key={s} value={s} disabled={s === 'published'}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {canEdit && (
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => saveMeta.mutate()}
                      disabled={saveMeta.isPending}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                    >
                      <Save className="h-3.5 w-3.5" />
                      保存模板
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">封面（Nano Banana）</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      走 AI Routing 的 imageNanoBanana，与 MV 风格库同一套生成链路。
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      disabled={regenerateCover.isPending}
                      onClick={async () => {
                        // 先保存 Prompt，再生成，避免未保存的编辑被忽略
                        if (meta.coverPrompt !== (data.coverPrompt ?? '')) {
                          await saveMeta.mutateAsync();
                        }
                        regenerateCover.mutate();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {regenerateCover.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      {regenerateCover.isPending ? '生成中…' : '重新生成封面'}
                    </button>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                  <div className="aspect-[4/5] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    {coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverUrl} alt={data.slug} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-300">
                        <ImageOff className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">
                      封面 Prompt
                    </span>
                    <textarea
                      className={cn(INPUT, 'min-h-[180px] font-mono text-xs leading-5')}
                      disabled={!canEdit}
                      value={meta.coverPrompt}
                      onChange={(e) => setMeta((m) => ({ ...m, coverPrompt: e.target.value }))}
                      placeholder="留空则按模板名称/描述自动拼装英文 Prompt"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      建议英文描述画面主体、镜头感、光线；不要写可读文字/水印。保存模板后再点「重新生成封面」。
                    </p>
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 text-sm font-semibold text-slate-800">版本列表</h2>
                {!versions.length ? (
                  <p className="text-sm text-slate-500">暂无版本。请通过 API 或后续创建流程添加版本。</p>
                ) : (
                  <div className="space-y-3">
                    {versions.map((v) => {
                      const isCurrent = data.currentPublishedVersionId === v.id;
                      const editing = draftEdit?.id === v.id;
                      return (
                        <div
                          key={v.id}
                          className={cn(
                            'rounded-xl border px-4 py-3',
                            isCurrent ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200',
                          )}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-800">
                                v{v.versionNo} · {v.nameZh || v.nameEn}
                                {isCurrent && (
                                  <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    当前发布
                                  </span>
                                )}
                                {v.locked && (
                                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                                    已锁定
                                  </span>
                                )}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {v.publishedAt ? `发布于 ${formatDate(v.publishedAt)}` : '未发布'}
                                {v.publishNotes ? ` · ${v.publishNotes}` : ''}
                              </p>
                              <p className="mt-1 font-mono text-[10px] text-slate-400">{v.id}</p>
                            </div>
                            <div className="flex gap-2">
                              {canEdit && !v.locked && (
                                <button
                                  type="button"
                                  onClick={() => setDraftEdit({ ...v })}
                                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                                >
                                  编辑草稿
                                </button>
                              )}
                              {canPublish && !v.publishedAt && (
                                <button
                                  type="button"
                                  onClick={() => handlePublish(v)}
                                  disabled={publish.isPending}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                                >
                                  <Rocket className="h-3 w-3" />
                                  发布
                                </button>
                              )}
                            </div>
                          </div>

                          {editing && draftEdit && (
                            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3">
                              <label className="block">
                                <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">中文名</span>
                                <input
                                  className={INPUT}
                                  value={draftEdit.nameZh ?? ''}
                                  onChange={(e) => setDraftEdit((d) => ({ ...d!, nameZh: e.target.value }))}
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">英文名</span>
                                <input
                                  className={INPUT}
                                  value={draftEdit.nameEn ?? ''}
                                  onChange={(e) => setDraftEdit((d) => ({ ...d!, nameEn: e.target.value }))}
                                />
                              </label>
                              <label className="col-span-2 block">
                                <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">短描述（中）</span>
                                <textarea
                                  className={cn(INPUT, 'min-h-[60px]')}
                                  value={draftEdit.shortDescZh ?? ''}
                                  onChange={(e) => setDraftEdit((d) => ({ ...d!, shortDescZh: e.target.value }))}
                                />
                              </label>
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={!!draftEdit.isPremium}
                                  onChange={(e) => setDraftEdit((d) => ({ ...d!, isPremium: e.target.checked }))}
                                  className="accent-blue-600"
                                />
                                会员
                              </label>
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={!!draftEdit.allowUserPrompt}
                                  onChange={(e) =>
                                    setDraftEdit((d) => ({ ...d!, allowUserPrompt: e.target.checked }))
                                  }
                                  className="accent-blue-600"
                                />
                                允许用户 Prompt
                              </label>
                              <div className="col-span-2 flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setDraftEdit(null)}
                                  className="rounded-lg px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                                >
                                  取消
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveVersion.mutate()}
                                  disabled={saveVersion.isPending}
                                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                                >
                                  <Save className="h-3 w-3" />
                                  保存草稿
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </QueryState>
      </div>
    </div>
  );
}
