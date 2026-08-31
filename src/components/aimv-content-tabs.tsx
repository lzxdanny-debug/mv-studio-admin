'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Sparkles, Trash2, Upload } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { AdminDataTransferActions } from '@/components/admin-data-transfer-actions';

type AssetKind = 'singer_photo' | 'hot_music' | 'mv_style';
interface LibraryAsset { id: string; kind: AssetKind; code: string; nameEn: string; descriptionEn: string; assetUrl: string; thumbnailUrl: string; category: string; enabled: boolean; hot: boolean; sortOrder: number; translationStatus: string; metadata?: Record<string, unknown> }

export function AimvAssetsTab({ lockedKind }: { lockedKind?: AssetKind }) {
  const qc = useQueryClient();
  const canEdit = useAdminAuthStore((s) => s.hasPermission('aimv.content.edit'));
  const isSingerConfig = lockedKind === 'singer_photo';
  const [seedMessage, setSeedMessage] = useState('');
  const query = useQuery<LibraryAsset[]>({
    queryKey: ['aimv-library-assets', lockedKind ?? 'all'],
    queryFn: () => apiClient.get('/admin/aimv-generator/library-assets', {
      params: lockedKind ? { kind: lockedKind } : undefined,
    }) as Promise<LibraryAsset[]>,
    refetchInterval: isSingerConfig ? 5000 : false,
  });
  const emptyDraft = { code: '', nameEn: '', descriptionEn: '', category: '', stylePrompt: '', hot: true, enabled: true, sortOrder: 0 };
  const [kind, setKind] = useState<AssetKind>(lockedKind ?? 'singer_photo');
  const [file, setFile] = useState<File>();
  const [draft, setDraft] = useState(emptyDraft);
  const create = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('请选择文件');
      const form = new FormData(); form.append('file', file); form.append('kind', kind);
      const uploaded = await apiClient.post('/admin/aimv-generator/library-assets/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }) as { url: string };
      const isImage = file.type.startsWith('image/');
      return apiClient.post('/admin/aimv-generator/library-assets', {
        code: draft.code, nameEn: draft.nameEn, descriptionEn: draft.descriptionEn,
        category: draft.category, hot: draft.hot, enabled: draft.enabled, sortOrder: draft.sortOrder,
        kind, assetUrl: uploaded.url,
        thumbnailUrl: kind === 'singer_photo' || (kind === 'mv_style' && isImage) ? uploaded.url : '',
        metadata: kind === 'mv_style' ? { prompt: draft.stylePrompt, mediaType: isImage ? 'image' : 'video' } : {},
      });
    },
    onSuccess: () => { setFile(undefined); setDraft(emptyDraft); qc.invalidateQueries({ queryKey: ['aimv-library-assets'] }); },
  });
  const seedDefaultSingers = useMutation({
    mutationFn: (force: boolean) => apiClient.post('/admin/aimv-generator/library-assets/seed-default-singers', { force }),
    onSuccess: (result: unknown) => {
      const data = result as { queued?: number; retried?: number; ready?: number; forced?: number; retired?: number };
      const scheduled = (data.queued ?? 0) + (data.retried ?? 0);
      setSeedMessage(scheduled
        ? data.forced
          ? `已下线 ${data.retired ?? 0} 个同质化角色，并开始重新生成 ${data.forced} 个年轻人物/动物参考图；新图片成功前会继续保留旧图片。`
          : `已开始生成 ${data.queued ?? 0} 个默认人物，并重试 ${data.retried ?? 0} 个未完成项；完成后会自动显示。`
        : `默认歌手库已就绪（${data.ready ?? 0} 个）。`);
      qc.invalidateQueries({ queryKey: ['aimv-library-assets'] });
    },
  });
  const update = useMutation({ mutationFn: ({ id, body }: { id: string; body: object }) => apiClient.patch(`/admin/aimv-generator/library-assets/${id}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: ['aimv-library-assets'] }) });
  const remove = useMutation({ mutationFn: (id: string) => apiClient.delete(`/admin/aimv-generator/library-assets/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['aimv-library-assets'] }) });
  const assetActionPending = update.isPending || remove.isPending;
  const toggleAsset = (row: LibraryAsset) => {
    if (!assetActionPending) update.mutate({ id: row.id, body: { enabled: !row.enabled } });
  };
  const deleteAsset = (id: string) => {
    if (!assetActionPending) remove.mutate(id);
  };
  const switchKind = (value: AssetKind) => {
    if (lockedKind) return;
    setKind(value);
    setFile(undefined);
  };
  const accept = kind === 'singer_photo' ? 'image/jpeg,image/png,image/gif' : kind === 'hot_music' ? 'audio/*' : 'image/*,video/*';
  const fileLabel = kind === 'singer_photo' ? '选择图片' : kind === 'hot_music' ? '选择音乐文件' : '选择风格图片或示例视频';
  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
      <p className="max-w-3xl">{isSingerConfig
        ? '在这里维护 C 端 Create MV 的默认歌手。启用的歌手会直接出现在 Singer Photo 选择器中；停用后不再提供给新项目选择，已创建项目不受影响。'
        : '歌手照片、Hot 音乐和 MV 视觉风格属于独立素材库。风格不会替换模板、音乐、比例或时长，只会约束人物锚点、故事板和镜头画面。'}</p>
      {!lockedKind && <AdminDataTransferActions exportUrl="/admin/aimv-generator/library-assets/export" importUrl="/admin/aimv-generator/library-assets/import" filename="aimv-library-assets" resourceLabel="素材库" canImport={canEdit} onImported={() => qc.invalidateQueries({ queryKey: ['aimv-library-assets'] })} />}
    </div>
    {canEdit && <section className="rounded-xl border border-slate-200 bg-white p-5">
      {isSingerConfig ? <><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">歌手库</h2><p className="mt-1 text-sm text-slate-500">人物参考图采用正面证件照/选角照标准：自然闭嘴、纯色背景、无话筒、无乐器、无舞台和其他道具。</p></div><div className="flex flex-wrap gap-2"><button disabled={seedDefaultSingers.isPending} onClick={() => seedDefaultSingers.mutate(false)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">{seedDefaultSingers.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}补齐缺失人物</button><button disabled={seedDefaultSingers.isPending} onClick={() => seedDefaultSingers.mutate(true)} className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 disabled:opacity-50">{seedDefaultSingers.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{seedDefaultSingers.isPending ? '正在提交…' : '重新生成全部证件照'}</button></div></div>{seedMessage && <p className="mb-3 text-sm text-emerald-700">{seedMessage}</p>}{seedDefaultSingers.isError && <p className="mb-3 text-sm text-red-600">{(seedDefaultSingers.error as Error).message || '默认人物生成任务提交失败'}</p>}</> : <div className="flex flex-wrap gap-2">
        {([['singer_photo', '内置歌手照片'], ['hot_music', 'Hot 音乐'], ['mv_style', 'MV 视觉风格']] as Array<[AssetKind, string]>).map(([value, label]) => <button key={value} disabled={create.isPending} onClick={() => switchKind(value)} className={`rounded-lg px-3 py-2 text-sm disabled:opacity-50 ${kind === value ? 'bg-violet-600 text-white' : 'bg-slate-100'}`}>{label}</button>)}
      </div>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input disabled={create.isPending} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder={isSingerConfig ? '唯一 code，例如 neon-vocalist' : '唯一 code'} className="rounded-lg border px-3 py-2 text-sm disabled:bg-slate-50" />
        <input disabled={create.isPending} value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} placeholder={isSingerConfig ? '歌手名称（English）' : 'Name (English)'} className="rounded-lg border px-3 py-2 text-sm disabled:bg-slate-50" />
        <input disabled={create.isPending} value={draft.descriptionEn} onChange={(e) => setDraft({ ...draft, descriptionEn: e.target.value })} placeholder={isSingerConfig ? '人物特征 / 使用说明（English）' : 'Description (English)'} className="rounded-lg border px-3 py-2 text-sm disabled:bg-slate-50" />
        <input disabled={create.isPending} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder={isSingerConfig ? '分类，例如 female-vocal' : 'Category'} className="rounded-lg border px-3 py-2 text-sm disabled:bg-slate-50" />
        {kind === 'mv_style' && <textarea disabled={create.isPending} value={draft.stylePrompt} onChange={(e) => setDraft({ ...draft, stylePrompt: e.target.value })} placeholder="Style prompt (English)：描述色彩、材质、灯光、镜头语言和艺术风格" className="min-h-24 rounded-lg border px-3 py-2 text-sm disabled:bg-slate-50 md:col-span-2" />}
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:bg-slate-50"><Upload className="h-4 w-4" /><span className="truncate">{file?.name || fileLabel}</span><input disabled={create.isPending} hidden type="file" accept={accept} onChange={(e) => setFile(e.target.files?.[0])} /></label>
        <label className="text-xs text-slate-500">排序<input disabled={create.isPending} type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} className="ml-2 rounded border px-2 py-1.5 disabled:bg-slate-50" /></label>
      </div>
      <div className="mt-4 flex justify-end"><button disabled={create.isPending || !file || !draft.code || !draft.nameEn || (kind === 'mv_style' && !draft.stylePrompt.trim())} onClick={() => { if (!create.isPending) create.mutate(); }} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm text-white disabled:opacity-50">{create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}上传并保存</button></div>
      {create.isError && <p className="mt-2 text-sm text-red-600">{(create.error as Error).message}</p>}
    </section>}
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">{query.isLoading ? <Loading /> : <table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">素材</th><th className="p-3">{isSingerConfig ? '歌手分类' : '类型 / 分类'}</th><th className="p-3">风格提示词</th><th className="p-3">翻译</th><th className="p-3">排序</th><th className="p-3 text-right">操作</th></tr></thead><tbody className="divide-y">{query.data?.map((row) => <tr key={row.id}><td className="p-3"><div className="flex items-center gap-3">{row.kind === 'singer_photo' ? <img src={row.thumbnailUrl || row.assetUrl} alt="" className="h-12 w-12 rounded-lg object-cover" /> : row.kind === 'hot_music' ? <audio src={row.assetUrl} controls className="h-8 w-56" /> : row.metadata?.mediaType === 'video' ? <video src={row.assetUrl} muted controls className="h-16 w-28 rounded-lg object-cover" /> : <img src={row.thumbnailUrl || row.assetUrl} alt="" className="h-16 w-28 rounded-lg object-cover" />}<div><b>{row.nameEn}</b><p className="font-mono text-xs text-slate-400">{row.code}</p></div></div></td><td className="p-3">{isSingerConfig ? (row.category || '-') : <>{row.kind}<p className="text-xs text-slate-400">{row.category || '-'}</p></>}</td><td className="max-w-xs p-3 text-xs text-slate-500">{row.kind === 'mv_style' && typeof row.metadata?.prompt === 'string' ? row.metadata.prompt : '—'}</td><td className="p-3">{row.translationStatus}</td><td className="p-3">{row.sortOrder}</td><td className="p-3 text-right">{canEdit && <><button disabled={assetActionPending} onClick={() => toggleAsset(row)} className="mr-4 text-violet-700 disabled:opacity-50">{row.enabled ? '停用' : '启用'}</button><button disabled={assetActionPending} onClick={() => deleteAsset(row.id)} className="text-red-600 disabled:opacity-50"><Trash2 className="inline h-4 w-4" /> 删除</button></>}</td></tr>)}</tbody></table>}</section>
  </div>;
}

type ResolverProvider = 'suno' | 'spotify' | 'youtube';
interface Resolver { id: string; provider: ResolverProvider; priority: number; enabled: boolean; endpointUrl: string; apiKeyEnv: string; timeoutSec: number }
export function AimvResolversTab() {
  const qc = useQueryClient(); const canEdit = useAdminAuthStore((s) => s.hasPermission('aimv.settings.edit'));
  const query = useQuery<Resolver[]>({ queryKey: ['aimv-music-resolvers'], queryFn: () => apiClient.get('/admin/aimv-generator/music-resolvers') as Promise<Resolver[]> });
  const save = useMutation({ mutationFn: (row: Resolver) => apiClient.put('/admin/aimv-generator/music-resolvers', row), onSuccess: () => qc.invalidateQueries({ queryKey: ['aimv-music-resolvers'] }) });
  const patch = (id: string, body: Partial<Resolver>) => qc.setQueryData<Resolver[]>(['aimv-music-resolvers'], (rows) => rows?.map((row) => row.id === id ? { ...row, ...body } : row));
  return <div className="mx-auto max-w-5xl space-y-5"><div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">识别优先级固定默认为 Suno → Spotify → YouTube。公开元数据可以直接识别；Spotify/YouTube 要取得可用于生成的音频，必须配置合规的解析服务端点。密钥只填写环境变量名，不在数据库保存明文。</div>{query.isLoading ? <Loading /> : query.data?.map((row) => <section key={row.id} className="rounded-xl border border-slate-200 bg-white p-5"><fieldset disabled={save.isPending} className="disabled:opacity-60"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold capitalize">{row.provider}</h2><label className="text-sm"><input type="checkbox" checked={row.enabled} onChange={(e) => patch(row.id, { enabled: e.target.checked })} /> 启用</label></div><div className="mt-4 grid gap-3 md:grid-cols-4"><Field label="优先级"><input type="number" value={row.priority} onChange={(e) => patch(row.id, { priority: Number(e.target.value) })} /></Field><Field label="超时（秒）"><input type="number" value={row.timeoutSec} onChange={(e) => patch(row.id, { timeoutSec: Number(e.target.value) })} /></Field><Field label="解析服务 URL"><input value={row.endpointUrl} onChange={(e) => patch(row.id, { endpointUrl: e.target.value })} placeholder="https://..." /></Field><Field label="API Key 环境变量"><input value={row.apiKeyEnv} onChange={(e) => patch(row.id, { apiKeyEnv: e.target.value })} placeholder="AIMV_..._API_KEY" /></Field></div>{canEdit && <div className="mt-4 flex justify-end"><button disabled={save.isPending} onClick={() => { if (!save.isPending) save.mutate(row); }} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm text-white disabled:opacity-50">{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存</button></div>}</fieldset></section>)}</div>;
}

interface CleanupJob { id: string; projectId: string; status: string; attempts: number; runAfter: string; deletedObjects: Array<{ provider: string; key: string }>; skippedUrls: string[]; errorMessage?: string | null }
export function AimvRetentionTab() {
  const qc = useQueryClient(); const canManage = useAdminAuthStore((s) => s.hasPermission('aimv.queue.manage'));
  const query = useQuery<{ items: CleanupJob[]; total: number }>({ queryKey: ['aimv-cleanup-jobs'], queryFn: () => apiClient.get('/admin/aimv-generator/cleanup-jobs?page=1&pageSize=100') as Promise<{ items: CleanupJob[]; total: number }>, refetchInterval: 15000 });
  const retry = useMutation({ mutationFn: (id: string) => apiClient.post(`/admin/aimv-generator/cleanup-jobs/${id}/retry`, {}), onSuccess: () => qc.invalidateQueries({ queryKey: ['aimv-cleanup-jobs'] }) });
  return <div className="mx-auto max-w-6xl space-y-5"><div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">每天 03:10（上海时区）发送到期提醒；每小时第 17 分钟分批投递到期清理任务。Worker 独立限流执行，失败自动退避重试，8 次失败后进入 dead_letter。</div><section className="overflow-hidden rounded-xl border border-slate-200 bg-white">{query.isLoading ? <Loading /> : <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">项目</th><th className="p-3">状态</th><th className="p-3">尝试</th><th className="p-3">删除 / 跳过</th><th className="p-3">下次执行 / 错误</th><th className="p-3 text-right">操作</th></tr></thead><tbody className="divide-y">{query.data?.items.map((row) => <tr key={row.id}><td className="p-3 font-mono text-xs">{row.projectId}</td><td className="p-3">{row.status}</td><td className="p-3">{row.attempts}</td><td className="p-3">{row.deletedObjects.length} / {row.skippedUrls.length}</td><td className="max-w-sm p-3"><p className="text-xs text-slate-500">{new Date(row.runAfter).toLocaleString()}</p>{row.errorMessage && <p className="truncate text-xs text-red-600" title={row.errorMessage}>{row.errorMessage}</p>}</td><td className="p-3 text-right">{canManage && ['failed','dead_letter'].includes(row.status) && <button disabled={retry.isPending} onClick={() => { if (!retry.isPending) retry.mutate(row.id); }} className="text-violet-700 disabled:opacity-50">{retry.isPending ? '重试中…' : '人工重试'}</button>}</td></tr>)}</tbody></table>}</section></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-xs text-slate-500 [&_input]:mt-1 [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-slate-200 [&_input]:px-3 [&_input]:py-2 [&_input]:text-sm">{label}{children}</label>; }
function Loading() { return <div className="flex justify-center p-12"><Loader2 className="h-5 w-5 animate-spin text-violet-600" /></div>; }
