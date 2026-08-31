'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Eye, ImageOff, Loader2, Palette, Pencil, Plus, RefreshCw, Save, Send, Trash2, X } from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { useConfirm } from '@/components/ui/dialog-provider';
import { AdminDataTransferActions } from '@/components/admin-data-transfer-actions';

const PAGE_SLUG = 'ai-music-video-generator';
const PUBLIC_WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || 'https://aimv.video';
const STYLE_NAMES = ['Retro-Future Synth', 'Midnight Gloss', 'Y2K Illusion', 'Urban Rumble', 'Velvet Snow', 'Sugar Rush Pink', 'Forest Waltz', 'Interstellar Fissure', 'Digital Persona', 'Cyberpunk Neon', 'Cinematic Drama', 'Anime Fantasy', 'Reality Blend', 'Pixar Warmth', 'Dark Ambient', 'Neon Cathedral', 'Dreamcore Bloom', 'Analog Fever', 'Liquid Chrome', 'Desert Mirage', 'Monochrome Noir', 'Celestial Opera', 'Street Documentary', 'Kinetic Collage', 'Soft Focus Romance'];

type Localized = { zh: string; en: string };
type StyleItem = {
  id: string;
  title: Localized;
  description: Localized;
  mediaUrl: string;
  previewPrompt: string;
  enabled: boolean;
  sortOrder: number;
};
type MarketingPage = {
  id: string;
  status: string;
  draftContent?: Record<string, any>;
  publishedVersion: number;
};

const defaultStyles = (): StyleItem[] => STYLE_NAMES.map((name, index) => ({
  id: `style-${index}`,
  title: { zh: name, en: name },
  description: { zh: '', en: '' },
  mediaUrl: '',
  previewPrompt: '',
  enabled: true,
  sortOrder: index,
}));

function createStyleId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

function normalizeStyles(page?: MarketingPage): StyleItem[] {
  const rows = page?.draftContent?.styles?.items;
  if (!Array.isArray(rows) || !rows.length) return defaultStyles();
  return rows.map((row: Partial<StyleItem>, index: number) => ({
    id: row.id || `style-${createStyleId()}`,
    title: { zh: row.title?.zh || '', en: row.title?.en || '' },
    description: { zh: row.description?.zh || '', en: row.description?.en || '' },
    mediaUrl: row.mediaUrl || '',
    previewPrompt: row.previewPrompt || '',
    enabled: row.enabled !== false,
    sortOrder: Number.isFinite(row.sortOrder) ? Number(row.sortOrder) : index,
  })).sort((a, b) => a.sortOrder - b.sortOrder);
}

export default function AiMusicVideoStylesAdminPage() {
  const qc = useQueryClient();
  const canManage = useAdminAuthStore((state) => state.hasPermission('marketing.manage'));
  const confirm = useConfirm();
  const [draft, setDraft] = useState<StyleItem[] | null>(null);
  const [editing, setEditing] = useState<StyleItem | null>(null);
  const [message, setMessage] = useState('');
  const [generatingIds, setGeneratingIds] = useState<string[]>([]);

  const query = useQuery<MarketingPage>({
    queryKey: ['admin', 'marketing-page', PAGE_SLUG],
    queryFn: async () => {
      try {
        return (await apiClient.get(`/admin/marketing/pages/${PAGE_SLUG}`)) as any;
      } catch (error: any) {
        const status = error?.response?.status ?? error?.statusCode;
        if (status !== 404) throw error;
        return (await apiClient.post('/admin/marketing/pages', {
          slug: PAGE_SLUG,
          nameI18n: { zh: 'AI Music Video 页面', en: 'AI Music Video Page' },
          // 落地页 Banner 由 C 端写死，风格库只维护 styles；hero 给空对象即可通过通用校验
          content: { hero: {}, styles: { items: defaultStyles() } },
        })) as any;
      }
    },
  });

  const styles = draft ?? normalizeStyles(query.data);
  const setStyles = (next: StyleItem[]) => setDraft(next.map((row, index) => ({ ...row, sortOrder: index })));
  const contentForSave = () => ({ ...(query.data?.draftContent ?? {}), styles: { items: styles } });
  const persistStyles = async (next: StyleItem[]) => {
    if (!query.data?.id) throw new Error('页面配置尚未加载完成');
    await apiClient.patch(`/admin/marketing/pages/${query.data.id}/draft`, {
      content: { ...(query.data.draftContent ?? {}), styles: { items: next } },
    });
    setDraft(next);
  };
  const generateAssetCover = async (style: StyleItem) => {
    const prompt = style.previewPrompt.trim() || [
      `${style.title.en || style.title.zh} AI music video visual style`,
      style.description.en || style.description.zh,
      'cinematic music video frame, strong art direction, rich atmosphere, wide composition, no text, no logo, no watermark',
    ].filter(Boolean).join(', ');
    const asset = await apiClient.post('/admin/marketing/assets/generate-image', {
      category: 'ai-music-video-style',
      prompt,
      titleZh: style.title.zh,
      titleEn: style.title.en,
      tags: ['ai-music-video-style', style.id],
      aspectRatio: '4:3',
    }) as any;
    const mediaUrl = asset?.thumbnailUrl || asset?.posterUrl;
    if (!mediaUrl) throw new Error('图片生成成功，但没有返回封面地址');
    return mediaUrl as string;
  };
  const regenerateOne = async (style: StyleItem) => {
    const ok = await confirm({
      title: style.mediaUrl ? '重新生成封面图？' : '生成封面图？',
      description: `将使用「${style.title.zh || style.title.en}」的风格提示词生成 4:3 封面，生成完成后自动保存到草稿。`,
      confirmText: style.mediaUrl ? '重新生成' : '开始生成',
    });
    if (!ok) return;
    setGeneratingIds((current) => [...current, style.id]);
    setMessage('');
    try {
      const mediaUrl = await generateAssetCover(style);
      const next = styles.map((row) => row.id === style.id ? { ...row, mediaUrl } : row);
      await persistStyles(next);
      setMessage(`「${style.title.zh || style.title.en}」封面已生成并保存到草稿`);
    } catch (error: any) {
      setMessage(error?.message || '封面生成失败');
    } finally {
      setGeneratingIds((current) => current.filter((id) => id !== style.id));
    }
  };
  const generateMissing = async () => {
    const targets = styles.filter((style) => !style.mediaUrl);
    if (!targets.length) {
      setMessage('所有风格都已有封面');
      return;
    }
    const ok = await confirm({
      title: `补齐 ${targets.length} 张缺失封面？`,
      description: '将逐张调用图片模型，耗时较长并会消耗对应模型额度；每张成功后都会保存到草稿。',
      variant: 'warning',
      confirmText: '开始生成',
    });
    if (!ok) return;
    let next = [...styles];
    for (const style of targets) {
      setGeneratingIds((current) => [...current, style.id]);
      try {
        const mediaUrl = await generateAssetCover(style);
        next = next.map((row) => row.id === style.id ? { ...row, mediaUrl } : row);
        await persistStyles(next);
      } catch (error: any) {
        setMessage(`「${style.title.zh || style.title.en}」生成失败：${error?.message || '未知错误'}`);
        setGeneratingIds((current) => current.filter((id) => id !== style.id));
        return;
      }
      setGeneratingIds((current) => current.filter((id) => id !== style.id));
    }
    setMessage(`已补齐 ${targets.length} 张封面并保存到草稿`);
  };
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= styles.length) return;
    const next = [...styles];
    [next[index], next[target]] = [next[target], next[index]];
    setStyles(next);
  };
  const addStyle = () => {
    const next: StyleItem = {
      id: `style-${createStyleId()}`,
      title: { zh: '新风格', en: 'New Style' },
      description: { zh: '', en: '' },
      mediaUrl: '',
      previewPrompt: '',
      enabled: true,
      sortOrder: styles.length,
    };
    setStyles([...styles, next]);
    setEditing(next);
  };

  const save = useMutation({
    mutationFn: () => apiClient.patch(`/admin/marketing/pages/${query.data?.id}/draft`, { content: contentForSave() }),
    onSuccess: () => {
      setMessage('风格库草稿已保存');
      setDraft(null);
      qc.invalidateQueries({ queryKey: ['admin', 'marketing-page', PAGE_SLUG] });
    },
    onError: (error: any) => setMessage(error?.message || '保存失败'),
  });
  const publish = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/admin/marketing/pages/${query.data?.id}/draft`, { content: contentForSave() });
      return apiClient.post(`/admin/marketing/pages/${query.data?.id}/publish`);
    },
    onSuccess: () => {
      setMessage('风格库已发布到前台');
      setDraft(null);
      qc.invalidateQueries({ queryKey: ['admin', 'marketing-page', PAGE_SLUG] });
    },
    onError: (error: any) => setMessage(error?.message || '发布失败'),
  });

  return <div className="admin-page p-6 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Palette className="h-5 w-5 text-violet-600" />AI Music Video 风格库</h1>
        <p className="mt-1 text-sm text-slate-500">管理落地页的风格卡片、封面、排序与启停；结构独立于舞蹈风格，不影响舞蹈生成策略。</p>
        {query.data && <p className="mt-2 text-xs text-slate-400">状态：{query.data.status} · 已发布版本 v{query.data.publishedVersion} · 共 {styles.length} 个风格</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <AdminDataTransferActions exportUrl={`/admin/marketing/pages/${PAGE_SLUG}/styles/export`} importUrl={`/admin/marketing/pages/${PAGE_SLUG}/styles/import`} filename="ai-music-video-styles" resourceLabel="AI Music Video 风格库" canImport={canManage} onImported={() => { setDraft(null); qc.invalidateQueries({ queryKey: ['admin', 'marketing-page', PAGE_SLUG] }); }} />
        <a href={`${PUBLIC_WEB_URL}/ai-music-video-generator`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><Eye className="h-4 w-4" />预览页面</a>
        <button disabled={!canManage || generatingIds.length > 0} onClick={() => void generateMissing()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${generatingIds.length ? 'animate-spin' : ''}`} />补齐缺失封面</button>
        <button type="button" onClick={addStyle} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><Plus className="h-4 w-4" />新增风格</button>
        <button disabled={!canManage || save.isPending || !query.data?.id} onClick={() => save.mutate()} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 disabled:opacity-50"><Save className="h-4 w-4" />保存草稿</button>
        <button disabled={!canManage || publish.isPending || !query.data?.id} onClick={() => publish.mutate()} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}发布风格库</button>
      </div>
    </div>

    {message && <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-700">{message}</div>}
    <QueryState isLoading={query.isLoading} isError={query.isError} error={query.error} isEmpty={!styles.length} emptyMessage="暂无风格">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {styles.map((style, index) => <article key={style.id} className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${style.enabled ? '' : 'opacity-55'}`}>
          <div className="relative aspect-[4/3] bg-slate-100">
            {style.mediaUrl ? <img src={style.mediaUrl} alt={style.title.zh || style.title.en} className={`h-full w-full object-cover ${generatingIds.includes(style.id) ? 'opacity-30' : ''}`} onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : <div className="flex h-full items-center justify-center text-slate-300"><ImageOff className="h-8 w-8" /></div>}
            {generatingIds.includes(style.id) && <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-900/30 text-xs text-white"><Loader2 className="h-4 w-4 animate-spin" />生成中…</div>}
            {!style.enabled && <span className="absolute right-2 top-2 rounded-md bg-slate-800/90 px-2 py-1 text-[10px] font-medium text-white">已禁用</span>}
            <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-3 pt-8 text-sm font-bold text-[#8cff43]">{style.title.zh || style.title.en || '未命名风格'}</span>
          </div>
          <div className="space-y-1 p-3"><p className="truncate text-[10px] uppercase tracking-wider text-slate-400">{style.id}</p><p className="line-clamp-2 min-h-8 text-xs text-slate-500">{style.description.zh || style.description.en || '暂无描述'}</p></div>
          <div className="flex items-center gap-1 border-t border-slate-100 px-3 py-2">
            <button disabled={generatingIds.includes(style.id)} onClick={() => setEditing(style)} className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"><Pencil className="h-3 w-3" />编辑</button>
            <button disabled={!canManage || generatingIds.includes(style.id)} onClick={() => void regenerateOne(style)} className="mr-auto inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">{generatingIds.includes(style.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}{style.mediaUrl ? '重新生成' : '生成封面'}</button>
            <IconButton title="上移" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-3.5 w-3.5" /></IconButton>
            <IconButton title="下移" disabled={index === styles.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-3.5 w-3.5" /></IconButton>
            <IconButton title="删除" danger onClick={() => setStyles(styles.filter((row) => row.id !== style.id))}><Trash2 className="h-3.5 w-3.5" /></IconButton>
          </div>
        </article>)}
      </div>
    </QueryState>

    <StyleEditor style={editing} onClose={() => setEditing(null)} onSave={(next) => { setStyles(styles.map((row) => row.id === next.id ? next : row)); setEditing(null); }} />
  </div>;
}

function StyleEditor({ style, onClose, onSave }: { style: StyleItem | null; onClose: () => void; onSave: (style: StyleItem) => void }) {
  const [form, setForm] = useState<StyleItem | null>(style);
  useEffect(() => setForm(style), [style]);
  if (!form) return null;
  const fieldClass = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onClick={onClose}><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
    <div className="flex items-start justify-between"><div><h2 className="text-lg font-bold text-slate-900">编辑风格</h2><p className="mt-1 text-xs text-slate-400">{form.id}</p></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <Field label="中文名称" value={form.title.zh} onChange={(value) => setForm({ ...form, title: { ...form.title, zh: value } })} className={fieldClass} />
      <Field label="English name" value={form.title.en} onChange={(value) => setForm({ ...form, title: { ...form.title, en: value } })} className={fieldClass} />
      <Field label="封面图 URL" value={form.mediaUrl} onChange={(mediaUrl) => setForm({ ...form, mediaUrl })} className={fieldClass} />
      <label className="flex items-end gap-2 pb-2 text-sm text-slate-600"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} className="h-4 w-4 accent-blue-600" />前台启用</label>
      <TextField label="中文描述" value={form.description.zh} onChange={(value) => setForm({ ...form, description: { ...form.description, zh: value } })} className={fieldClass} />
      <TextField label="English description" value={form.description.en} onChange={(value) => setForm({ ...form, description: { ...form.description, en: value } })} className={fieldClass} />
      <div className="md:col-span-2"><TextField label="封面生成提示词（预留，当前用于记录风格视觉定义）" value={form.previewPrompt} onChange={(previewPrompt) => setForm({ ...form, previewPrompt })} className={fieldClass} /></div>
    </div>
    <div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">取消</button><button onClick={() => onSave(form)} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white">保存修改</button></div>
  </div></div>;
}

function Field({ label, value, onChange, className }: { label: string; value: string; onChange: (value: string) => void; className: string }) {
  return <label className="block text-xs font-medium text-slate-600">{label}<input className={className} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
function TextField({ label, value, onChange, className }: { label: string; value: string; onChange: (value: string) => void; className: string }) {
  return <label className="block text-xs font-medium text-slate-600">{label}<textarea rows={3} className={className} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
function IconButton({ title, disabled, danger, onClick, children }: { title: string; disabled?: boolean; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button title={title} disabled={disabled} onClick={onClick} className={`rounded-lg border p-1.5 disabled:opacity-30 ${danger ? 'border-red-100 text-red-500' : 'border-slate-200 text-slate-500'}`}>{children}</button>;
}
