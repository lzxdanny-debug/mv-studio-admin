'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Music2, RefreshCw, Save, Video } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { Switch } from '@/components/ui/switch';
import { AdminDataTransferActions } from '@/components/admin-data-transfer-actions';

type CreationStyle = {
  id: string;
  code: string;
  legacyTag: string;
  nameEn: string;
  nameZh: string;
  descriptionZh: string;
  veoKeywords: string;
  filmPreamble: string | null;
  previewImageUrl: string;
  exampleVideoUrl: string;
  previewGenerationStatus: 'idle' | 'generating' | 'ready' | 'failed';
  previewGenerationError: string | null;
  enabled: boolean;
  sortOrder: number;
};

type Draft = Partial<Pick<CreationStyle, 'nameEn' | 'nameZh' | 'descriptionZh' | 'veoKeywords' | 'filmPreamble' | 'previewImageUrl' | 'exampleVideoUrl' | 'enabled' | 'sortOrder'>>;

export function AimvCreationStylesTab() {
  const queryClient = useQueryClient();
  const canEdit = useAdminAuthStore((state) => state.hasPermission('aimv.content.edit'));
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [notice, setNotice] = useState('');
  const query = useQuery<CreationStyle[]>({
    queryKey: ['aimv-creation-styles'],
    queryFn: () => apiClient.get('/admin/aimv-generator/creation-styles') as Promise<CreationStyle[]>,
    refetchInterval: 5000,
  });
  const importLegacy = useMutation({
    mutationFn: () => apiClient.post('/admin/aimv-generator/creation-styles/import-legacy', {}),
    onSuccess: (result: unknown) => {
      const imported = Number((result as { imported?: number })?.imported ?? 0);
      setNotice(imported ? `已从旧 MV 风格复制 ${imported} 条记录。` : '创建风格库已与旧 MV 风格同步，无需新增。');
      queryClient.invalidateQueries({ queryKey: ['aimv-creation-styles'] });
    },
  });
  const save = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Draft }) => apiClient.patch(`/admin/aimv-generator/creation-styles/${id}`, body),
    onSuccess: (_result, variables) => {
      setDrafts((current) => { const next = { ...current }; delete next[variables.id]; return next; });
      setNotice('风格配置已保存，C 端将使用这套独立的创建风格库。');
      queryClient.invalidateQueries({ queryKey: ['aimv-creation-styles'] });
    },
  });
  const generatePreview = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Draft }) => apiClient.post(`/admin/aimv-generator/creation-styles/${id}/generate-preview`, body),
    onSuccess: (_result, variables) => {
      setDrafts((current) => { const next = { ...current }; delete next[variables.id]; return next; });
      setNotice('已按“模型配置”中的 AI MV 全局优先级开始生成示例视频。');
      queryClient.invalidateQueries({ queryKey: ['aimv-creation-styles'] });
    },
  });
  const generateMusic = useMutation({
    mutationFn: ({ id }: { id: string }) => apiClient.post(`/admin/aimv-generator/creation-styles/${id}/generate-music`, {}),
    onSuccess: () => {
      setNotice('已开始生成与该风格匹配的 Suno 纯音乐，并自动合入示例视频。');
      queryClient.invalidateQueries({ queryKey: ['aimv-creation-styles'] });
    },
  });
  const generateAllMusic = useMutation({
    mutationFn: () => apiClient.post('/admin/aimv-generator/creation-styles/generate-music', {}),
    onSuccess: (result: unknown) => {
      const queued = Number((result as { queued?: number })?.queued ?? 0);
      const queuedVideo = Number((result as { queuedVideo?: number })?.queuedVideo ?? 0);
      const skipped = Number((result as { skippedWithoutSource?: number })?.skippedWithoutSource ?? 0);
      setNotice(`已将 ${queued} 个风格加入处理队列${queuedVideo ? `；其中 ${queuedVideo} 个会先生成示例视频` : ''}${skipped ? `；${skipped} 个因视频和封面均为空而跳过` : ''}。`);
      queryClient.invalidateQueries({ queryKey: ['aimv-creation-styles'] });
    },
  });
  const setDraft = <K extends keyof Draft>(id: string, key: K, value: Draft[K]) => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));
  };
  const value = <K extends keyof CreationStyle>(row: CreationStyle, key: K) => (drafts[row.id]?.[key as keyof Draft] ?? row[key]) as CreationStyle[K];

  return <div className="mx-auto max-w-7xl space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-violet-100 bg-violet-50 p-5">
      <div><h2 className="text-lg font-semibold text-slate-900">创建风格库</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">首次打开会从旧 MV 风格复制一份到新表；此后两套数据互不影响。C 端创建页只读取此处启用的风格，示例视频用于风格预览。</p></div>
      <div className="flex flex-wrap items-start justify-end gap-2">
        <AdminDataTransferActions exportUrl="/admin/aimv-generator/creation-styles/export" importUrl="/admin/aimv-generator/creation-styles/import" filename="aimv-creation-styles" resourceLabel="创建风格库" canImport={canEdit} onImported={() => queryClient.invalidateQueries({ queryKey: ['aimv-creation-styles'] })} />
        {canEdit && <button disabled={generateAllMusic.isPending} onClick={() => generateAllMusic.mutate()} className="inline-flex items-center gap-2 rounded-lg border border-fuchsia-200 bg-white px-3 py-2 text-sm font-medium text-fuchsia-700 disabled:opacity-50"><Music2 className={`h-4 w-4 ${generateAllMusic.isPending ? 'animate-pulse' : ''}`} />{generateAllMusic.isPending ? '正在加入队列…' : '为全部风格配乐'}</button>}
        {canEdit && <button disabled={importLegacy.isPending} onClick={() => importLegacy.mutate()} className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-medium text-violet-700 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${importLegacy.isPending ? 'animate-spin' : ''}`} />{importLegacy.isPending ? '正在同步…' : '从旧 MV 风格补充'}</button>}
      </div>
    </div>
    {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
    {importLegacy.isError && <p className="text-sm text-red-600">{(importLegacy.error as Error).message || '同步旧 MV 风格失败'}</p>}
    {query.isLoading ? <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /></div> : <div className="grid gap-5 xl:grid-cols-2">{query.data?.map((row) => {
      const dirty = Boolean(drafts[row.id]);
      const previewImageUrl = value(row, 'previewImageUrl') as string;
      const exampleVideoUrl = value(row, 'exampleVideoUrl') as string;
      const generating = row.previewGenerationStatus === 'generating';
      const submittingGeneration = generatePreview.isPending && generatePreview.variables?.id === row.id;
      const submittingMusic = generateMusic.isPending && generateMusic.variables?.id === row.id;
      return <section key={row.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="font-semibold text-slate-900">{row.nameEn}</h3><p className="mt-1 font-mono text-xs text-slate-400">{row.code} · 旧库标识：{row.legacyTag}</p></div>{canEdit && <div className="flex items-center gap-2 text-sm text-slate-600"><span>{value(row, 'enabled') ? '已启用' : '已停用'}</span><Switch checked={Boolean(value(row, 'enabled'))} onChange={(checked) => setDraft(row.id, 'enabled', checked)} /></div>}</div>
        <div className="grid gap-4 p-5 sm:grid-cols-[150px_1fr]">
          <div className="space-y-3"><div className="aspect-video overflow-hidden rounded-lg bg-slate-100">{exampleVideoUrl ? <video src={exampleVideoUrl} controls preload="metadata" poster={previewImageUrl || undefined} className="h-full w-full object-cover" /> : previewImageUrl ? <img src={previewImageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-slate-400">暂无预览</div>}</div><p className="flex items-center gap-1 text-xs text-slate-400"><Video className="h-3.5 w-3.5" />示例视频优先于封面图</p></div>
          <div className="grid gap-3"><label className="text-xs font-medium text-slate-600">英文名称<input disabled={!canEdit || save.isPending} value={String(value(row, 'nameEn') ?? '')} onChange={(event) => setDraft(row.id, 'nameEn', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50" /></label><label className="text-xs font-medium text-slate-600">中文名称<input disabled={!canEdit || save.isPending} value={String(value(row, 'nameZh') ?? '')} onChange={(event) => setDraft(row.id, 'nameZh', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50" /></label><label className="text-xs font-medium text-slate-600">封面图片 URL<input disabled={!canEdit || save.isPending} value={String(value(row, 'previewImageUrl') ?? '')} onChange={(event) => setDraft(row.id, 'previewImageUrl', event.target.value)} placeholder="https://..." className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50" /></label><div className="text-xs font-medium text-slate-600"><span>示例视频 URL</span><div className="mt-1 flex flex-wrap gap-2"><input disabled={!canEdit || save.isPending || generating} value={String(value(row, 'exampleVideoUrl') ?? '')} onChange={(event) => setDraft(row.id, 'exampleVideoUrl', event.target.value)} placeholder="https://.../style-preview.mp4" className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50" />{canEdit && <button type="button" disabled={generatePreview.isPending || generating || !previewImageUrl.trim()} onClick={() => generatePreview.mutate({ id: row.id, body: drafts[row.id] ?? {} })} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50">{submittingGeneration || generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}{generating ? '处理中' : exampleVideoUrl ? '重新生成' : '生成'}</button>}{canEdit && <button type="button" disabled={generateMusic.isPending || generating || !exampleVideoUrl.trim()} onClick={() => generateMusic.mutate({ id: row.id })} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-3 py-2 text-sm font-medium text-fuchsia-700 transition hover:bg-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-50">{submittingMusic ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music2 className="h-4 w-4" />}生成配乐</button>}</div>{row.previewGenerationStatus === 'failed' && <p title={row.previewGenerationError || ''} className="mt-1.5 line-clamp-2 text-xs font-normal text-red-600">处理失败：{row.previewGenerationError || '请稍后重试'}</p>}{generating && <p className="mt-1.5 text-xs font-normal text-violet-600">正在生成资源并保存，请稍后刷新查看结果。</p>}</div></div>
        </div>
        <div className="grid gap-3 border-t border-slate-100 p-5"><label className="text-xs font-medium text-slate-600">风格关键词（原 MV 提示词）<textarea disabled={!canEdit || save.isPending} value={String(value(row, 'veoKeywords') ?? '')} onChange={(event) => setDraft(row.id, 'veoKeywords', event.target.value)} className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50" /></label><div className="grid gap-3 sm:grid-cols-[1fr_110px]"><label className="text-xs font-medium text-slate-600">镜头前置词<textarea disabled={!canEdit || save.isPending} value={String(value(row, 'filmPreamble') ?? '')} onChange={(event) => setDraft(row.id, 'filmPreamble', event.target.value)} className="mt-1 min-h-16 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50" /></label><label className="text-xs font-medium text-slate-600">排序<input disabled={!canEdit || save.isPending} type="number" value={Number(value(row, 'sortOrder') ?? 0)} onChange={(event) => setDraft(row.id, 'sortOrder', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50" /></label></div></div>
        {canEdit && <div className="flex justify-end border-t border-slate-100 px-5 py-4"><button disabled={!dirty || save.isPending} onClick={() => save.mutate({ id: row.id, body: drafts[row.id] })} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{save.isPending ? '保存中…' : '保存风格'}</button></div>}
      </section>;
    })}</div>}
    {save.isError && <p className="text-sm text-red-600">{(save.error as Error).message || '保存失败，请稍后重试'}</p>}
    {generatePreview.isError && <p className="text-sm text-red-600">{(generatePreview.error as Error).message || '示例视频生成任务提交失败'}</p>}
    {generateMusic.isError && <p className="text-sm text-red-600">{(generateMusic.error as Error).message || '风格配乐任务提交失败'}</p>}
    {generateAllMusic.isError && <p className="text-sm text-red-600">{(generateAllMusic.error as Error).message || '批量配乐任务提交失败'}</p>}
  </div>;
}
