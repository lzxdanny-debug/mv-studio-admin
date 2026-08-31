'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, CheckCircle2, CircleHelp, Languages, Loader2, Pencil, Plus, RefreshCw, Save, Sparkles, Trash2, Upload, X } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { CapacityTab, PricingTab, QueueTab } from '@/components/aimv-runtime-tabs';
import { AimvAssetsTab, AimvResolversTab, AimvRetentionTab } from '@/components/aimv-content-tabs';
import { AimvCreationStylesTab } from '@/components/aimv-creation-styles-tab';
import { Switch } from '@/components/ui/switch';
import { AdminDataTransferActions } from '@/components/admin-data-transfer-actions';

type TabKey =
  | 'settings'
  | 'templates'
  | 'singers'
  | 'creation-styles'
  | 'assets'
  | 'resolvers'
  | 'capacity'
  | 'queue'
  | 'retention'
  | 'pricing';

type TemplateEditorTab = 'basic' | 'creation' | 'storyboard';

const TABS: Array<{ key: TabKey; label: string; permission: string }> = [
  { key: 'settings', label: '基础设置', permission: 'aimv.settings.view' },
  { key: 'templates', label: '模板与类型', permission: 'aimv.content.view' },
  { key: 'singers', label: '歌手配置', permission: 'aimv.content.view' },
  { key: 'creation-styles', label: '创建风格库', permission: 'aimv.content.view' },
  { key: 'assets', label: '素材库', permission: 'aimv.content.view' },
  { key: 'resolvers', label: '歌曲链接识别', permission: 'aimv.settings.view' },
  { key: 'capacity', label: '并发与速率', permission: 'aimv.routing.view' },
  { key: 'queue', label: '排队管理池', permission: 'aimv.queue.view' },
  { key: 'retention', label: '存储清理', permission: 'aimv.queue.view' },
  { key: 'pricing', label: '计费与会员', permission: 'aimv.pricing.view' },
];

interface AimvSettings {
  enabled: boolean;
  minDurationSec: number;
  maxDurationSec: number;
  defaultDurationSec: number;
  minMusicDurationSec: number;
  maxMusicDurationSec: number;
  musicMaxFileSizeMb: number;
  musicExtensions: string[];
  musicMimeTypes: string[];
  imageMaxFileSizeMb: number;
  imageExtensions: string[];
  imageMimeTypes: string[];
  imageMinWidth: number;
  imageMinHeight: number;
  imageMaxWidth: number;
  imageMaxHeight: number;
  allowedAspectRatios: string[];
  defaultAspectRatio: string;
  allowedResolutions: string[];
  defaultResolution: string;
  allowedVideoFormats: string[];
  defaultVideoFormat: string;
  creativeDescriptionMaxLength: number;
  storyboardConcurrency: number;
  shotConcurrency: number;
  storyboardTimeoutSec: number;
  shotTimeoutSec: number;
  storyboardPollIntervalMs: number;
  shotPollIntervalMs: number;
  storageRetentionDays: number;
  expiryReminderDays: number[];
  deleteExpiredAssets: boolean;
  singerPhotoRequired: true;
}

interface SettingsResponse {
  settings: AimvSettings;
  version: number;
  updatedAt: string | null;
}

interface AimvTemplate {
  id: string;
  code: string;
  nameEn: string;
  descriptionEn: string;
  category: string;
  coverUrl: string;
  previewVideoUrl: string;
  defaultPrompt: string;
  defaults: Record<string, unknown>;
  createSimilarConfig: TemplateCreationConfig;
  enabled: boolean;
  sortOrder: number;
  featured: boolean;
  hot: boolean;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  translationStatus: 'pending' | 'ready' | 'failed';
  translationError: string | null;
  translatedAt: string | null;
  segments: TemplateSegment[];
}

type PreviewGenerationState = {
  status?: 'generating' | 'ready' | 'failed';
  error?: string | null;
  startedAt?: string;
  completedAt?: string;
};

interface TemplateSegment {
  id?: string;
  index?: number;
  startSecond?: number;
  durationSeconds: number;
  event: string;
  prompt: string;
  referenceBindings: Array<'main' | 'partner'>;
  sceneImageUrl: string;
  sceneStatus?: 'pending' | 'generating' | 'ready' | 'failed';
  sceneError?: string | null;
}

interface TemplateCreationConfig {
  title?: string;
  creativeDescription?: string;
  productModelCode?: string;
  musicAssetId?: string;
  singerPhotoAssetId?: string;
  styleCode?: string;
  durationSec?: number;
  aspectRatio?: string;
  resolution?: string;
}

interface TemplateLibraryAsset {
  id: string;
  kind: 'singer_photo' | 'hot_music' | 'mv_style';
  nameEn: string;
  code: string;
  enabled: boolean;
  assetUrl: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
}
interface TemplateModel { code: string; name: string; supportedDurations: number[]; supportedAspectRatios: string[]; supportedResolutions: string[] }
interface TemplateDraft {
  code: string; nameEn: string; descriptionEn: string; category: 'landscape' | 'portrait';
  coverUrl: string; previewVideoUrl: string; defaultPrompt: string; title: string;
  productModelCode: string; musicAssetId: string; singerPhotoAssetId: string;
  styleCode: string;
  durationSec: number; aspectRatio: string; resolution: string; sortOrder: number;
  featured: boolean; hot: boolean; enabled: boolean; effectiveFrom: string; effectiveUntil: string;
  segments: TemplateSegment[];
}

const EMPTY_SEGMENT = (): TemplateSegment => ({
  durationSeconds: 15, event: '', prompt: '', referenceBindings: ['main'], sceneImageUrl: '',
});

const EMPTY_TEMPLATE: TemplateDraft = {
  code: '', nameEn: '', descriptionEn: '', category: 'landscape', coverUrl: '', previewVideoUrl: '',
  defaultPrompt: '', title: '', productModelCode: '', musicAssetId: '', singerPhotoAssetId: '',
  styleCode: '',
  durationSec: 30, aspectRatio: '16:9', resolution: '720p', sortOrder: 0,
  featured: false, hot: false, enabled: true, effectiveFrom: '', effectiveUntil: '', segments: [EMPTY_SEGMENT()],
};

// 模板素材保存在主站 public 目录；后台与主站端口/域名不同，需把相对地址
// 解析为主站地址，避免浏览器错误地向后台自身请求 `/images/...`。
const MAIN_APP_ORIGIN =
  process.env.NEXT_PUBLIC_MAIN_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';

function resolvePublicAssetUrl(url: string | null | undefined): string {
  if (!url || /^https?:\/\//i.test(url)) return url || '';
  return url.startsWith('/') ? `${MAIN_APP_ORIGIN}${url}` : url;
}

const NUMBER_FIELDS: Array<{ key: keyof AimvSettings; label: string; unit: string }> = [
  { key: 'minDurationSec', label: 'MV 最短时长', unit: '秒' },
  { key: 'defaultDurationSec', label: 'MV 默认时长', unit: '秒' },
  { key: 'maxDurationSec', label: 'MV 最长时长', unit: '秒' },
  { key: 'minMusicDurationSec', label: '音乐最短时长', unit: '秒' },
  { key: 'maxMusicDurationSec', label: '音乐最长时长', unit: '秒' },
  { key: 'musicMaxFileSizeMb', label: '音乐最大文件', unit: 'MB' },
  { key: 'imageMaxFileSizeMb', label: '图片最大文件', unit: 'MB' },
  { key: 'creativeDescriptionMaxLength', label: '创意描述上限', unit: '字符' },
  { key: 'storyboardConcurrency', label: '项目内故事板并发（0 不限制）', unit: '个' },
  { key: 'shotConcurrency', label: '项目内镜头并发（0 不限制）', unit: '个' },
  { key: 'storyboardTimeoutSec', label: '故事板超时（0 不限制）', unit: '秒' },
  { key: 'shotTimeoutSec', label: '镜头超时（0 不限制）', unit: '秒' },
  { key: 'storyboardPollIntervalMs', label: '故事板轮询间隔', unit: 'ms' },
  { key: 'shotPollIntervalMs', label: '镜头轮询间隔', unit: 'ms' },
  { key: 'storageRetentionDays', label: '存储有效期', unit: '天' },
];

const LIST_FIELDS: Array<{ key: keyof AimvSettings; label: string; hint: string }> = [
  { key: 'musicExtensions', label: '音乐扩展名', hint: 'mp3, wav, m4a' },
  { key: 'musicMimeTypes', label: '音乐 MIME', hint: 'audio/mpeg, audio/wav' },
  { key: 'imageExtensions', label: '图片扩展名', hint: 'jpg, png, webp' },
  { key: 'imageMimeTypes', label: '图片 MIME', hint: 'image/jpeg, image/png' },
  { key: 'allowedAspectRatios', label: '允许画面比例', hint: '16:9, 9:16, 1:1' },
  { key: 'allowedResolutions', label: '允许分辨率', hint: '720p, 1080p' },
  { key: 'allowedVideoFormats', label: '允许视频格式', hint: 'mp4' },
];

function splitList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export default function AimvGeneratorConfigPage() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const permissions = useAdminAuthStore((state) => state.permissions);
  const hasPermission = useAdminAuthStore((state) => state.hasPermission);
  const visibleTabs = useMemo(
    () => TABS.filter((tab) => permissions.includes('*') || hasPermission(tab.permission)),
    [hasPermission, permissions],
  );
  const routeTab = pathname.split('/').filter(Boolean).at(-1);
  const [tab, setTab] = useState<TabKey>(
    TABS.some((item) => item.key === routeTab) ? routeTab as TabKey : 'settings',
  );

  useEffect(() => {
    if (TABS.some((item) => item.key === routeTab)) setTab(routeTab as TabKey);
  }, [routeTab]);

  useEffect(() => {
    if (!visibleTabs.some((item) => item.key === tab) && visibleTabs[0]) setTab(visibleTabs[0].key);
  }, [tab, visibleTabs]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-slate-200 bg-white px-6 pt-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Sparkles className="h-5 w-5 text-violet-600" />AI MV Generator 配置中心
            </h1>
            <p className="mt-1 text-sm text-slate-500">配置只作用于新产品，不影响现有 MV、Dance、Karaoke 和 Video Effects。</p>
          </div>
          <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            运营只填写英语，其他语言保存时自动生成
          </div>
        </div>
        <nav className="mt-5 flex gap-1 overflow-x-auto">
          {visibleTabs.map((item) => (
            <button
              key={item.key}
              onClick={() => router.push(`/admin/aimv-generator/${item.key}`)}
              className={cn(
                'whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors',
                tab === item.key
                  ? 'border-violet-600 font-medium text-violet-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="w-full [&>div]:!mx-0 [&>div]:!max-w-none [&>div]:!w-full">
          {tab === 'settings' ? (
            <SettingsTab onSaved={() => queryClient.invalidateQueries({ queryKey: ['aimv-settings'] })} />
          ) : tab === 'templates' ? (
            <TemplatesTab />
          ) : tab === 'singers' ? (
            <AimvAssetsTab lockedKind="singer_photo" />
          ) : tab === 'creation-styles' ? (
            <AimvCreationStylesTab />
          ) : tab === 'assets' ? (
            <AimvAssetsTab />
          ) : tab === 'resolvers' ? (
            <AimvResolversTab />
          ) : tab === 'capacity' ? (
            <CapacityTab />
          ) : tab === 'queue' ? (
            <QueueTab />
          ) : tab === 'retention' ? (
            <AimvRetentionTab />
          ) : tab === 'pricing' ? (
            <PricingTab />
          ) : (
            <PlannedTab tab={TABS.find((item) => item.key === tab)?.label ?? ''} />
          )}
        </div>
      </main>
    </div>
  );
}

function SettingsTab({ onSaved }: { onSaved: () => void }) {
  const canEdit = useAdminAuthStore((state) => state.hasPermission('aimv.settings.edit'));
  const [form, setForm] = useState<AimvSettings | null>(null);
  const [message, setMessage] = useState('');
  const query = useQuery<SettingsResponse>({
    queryKey: ['aimv-settings'],
    queryFn: () => apiClient.get('/admin/aimv-generator/settings') as Promise<SettingsResponse>,
  });
  useEffect(() => { if (query.data) setForm(query.data.settings); }, [query.data]);
  const save = useMutation({
    mutationFn: (payload: AimvSettings) => apiClient.put('/admin/aimv-generator/settings', payload),
    onSuccess: () => { setMessage('基础设置已保存，只对新创建项目生效。'); onSaved(); },
    onError: (error: Error) => setMessage(error.message || '保存失败'),
  });
  if (query.isLoading || !form) return <Loading />;
  if (query.isError) return <ErrorText text={(query.error as Error).message} />;

  const set = <K extends keyof AimvSettings>(key: K, value: AimvSettings[K]) =>
    setForm((current) => current ? { ...current, [key]: value } : current);

  return (
    <div className="w-full space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div><h2 className="font-semibold text-slate-900">产品开关</h2><p className="mt-1 text-sm text-slate-500">关闭后隐藏新产品入口，进行中的项目不受影响。</p></div>
          <Switch checked={form.enabled} onChange={(checked) => set('enabled', checked)} disabled={!canEdit || save.isPending} size="lg" label="产品开关" />
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">时长、上传与存储</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {NUMBER_FIELDS.map((field) => (
            <label key={field.key} className="text-sm text-slate-600">
              <span>{field.label}</span>
              <div className="mt-1 flex rounded-lg border border-slate-200 bg-white focus-within:border-violet-400">
                <input disabled={!canEdit || save.isPending} type="number" min={['storyboardConcurrency', 'shotConcurrency', 'storyboardTimeoutSec', 'shotTimeoutSec'].includes(field.key) ? 0 : 1} value={Number(form[field.key])} onChange={(e) => set(field.key, Number(e.target.value) as never)} className="min-w-0 flex-1 rounded-lg px-3 py-2 outline-none disabled:bg-slate-50" />
                <span className="px-3 py-2 text-slate-400">{field.unit}</span>
              </div>
            </label>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">格式白名单</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {LIST_FIELDS.map((field) => (
            <label key={field.key} className="text-sm text-slate-600">
              <span>{field.label}</span>
              <input disabled={!canEdit || save.isPending} value={(form[field.key] as string[]).join(', ')} placeholder={field.hint} onChange={(e) => set(field.key, splitList(e.target.value) as never)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-violet-400 disabled:bg-slate-50" />
            </label>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">固定产品规则</h2>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" />所有 MV 必须选择歌手照片；充值和会员用户在本产品中平权。</div>
      </section>
      <div className="flex items-center justify-end gap-3">
        {message && <span className="text-sm text-slate-600">{message}</span>}
        <button disabled={!canEdit || save.isPending} onClick={() => save.mutate(form)} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}保存设置
        </button>
      </div>
    </div>
  );
}

function TemplatesTab() {
  const canEdit = useAdminAuthStore((state) => state.hasPermission('aimv.content.edit'));
  const queryClient = useQueryClient();
  const query = useQuery<AimvTemplate[]>({
    queryKey: ['aimv-templates'],
    queryFn: () => apiClient.get('/admin/aimv-generator/templates') as Promise<AimvTemplate[]>,
    // 生成过程在 API 后台运行；列表定时刷新后会自动从“生成中”切换为可播放状态。
    refetchInterval: 5000,
  });
  const assets = useQuery<TemplateLibraryAsset[]>({
    queryKey: ['aimv-library-assets'],
    queryFn: () => apiClient.get('/admin/aimv-generator/library-assets') as Promise<TemplateLibraryAsset[]>,
  });
  const models = useQuery<TemplateModel[]>({
    queryKey: ['aimv-public-models-for-templates'],
    queryFn: () => apiClient.get('/aimv-generator/models?locale=en') as Promise<TemplateModel[]>,
  });
  const settings = useQuery<SettingsResponse>({
    queryKey: ['aimv-settings'],
    queryFn: () => apiClient.get('/admin/aimv-generator/settings') as Promise<SettingsResponse>,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSingerPickerOpen, setIsSingerPickerOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<TemplateEditorTab>('basic');
  const [draft, setDraft] = useState<TemplateDraft>(EMPTY_TEMPLATE);
  const uploadSingerReference = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'singer_photo');
      const uploaded = await apiClient.post('/admin/aimv-generator/library-assets/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }) as { url: string };
      const originalName = file.name.replace(/\.[^.]+$/, '').trim();
      const code = `template-singer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      return apiClient.post('/admin/aimv-generator/library-assets', {
        kind: 'singer_photo',
        code,
        nameEn: originalName ? `Custom reference - ${originalName}` : 'Custom template singer reference',
        descriptionEn: 'Custom singer reference image uploaded for an AI MV template.',
        assetUrl: uploaded.url,
        thumbnailUrl: uploaded.url,
        category: 'template-reference',
        tags: ['template-reference', 'custom-upload'],
        metadata: { source: 'template-custom-upload', privateForTemplate: true, originalFileName: file.name },
        enabled: false,
        hot: false,
      }) as Promise<TemplateLibraryAsset>;
    },
    onSuccess: (created) => {
      setDraft((current) => ({ ...current, singerPhotoAssetId: created.id }));
      queryClient.setQueryData<TemplateLibraryAsset[]>(['aimv-library-assets'], (current = []) => [created, ...current.filter((item) => item.id !== created.id)]);
      queryClient.invalidateQueries({ queryKey: ['aimv-library-assets'] });
    },
  });
  const save = useMutation({
    mutationFn: () => {
      const payload = {
        code: draft.code,
        nameEn: draft.nameEn,
        descriptionEn: draft.descriptionEn,
        category: draft.category,
        coverUrl: draft.coverUrl,
        previewVideoUrl: draft.previewVideoUrl,
        defaultPrompt: draft.defaultPrompt,
        createSimilarConfig: {
          title: draft.title || undefined,
          creativeDescription: draft.defaultPrompt || undefined,
          productModelCode: draft.productModelCode || undefined,
          musicAssetId: draft.musicAssetId || undefined,
          singerPhotoAssetId: draft.singerPhotoAssetId || undefined,
          styleCode: draft.styleCode || undefined,
          durationSec: draft.segments.reduce((total, segment) => total + Number(segment.durationSeconds || 0), 0),
          aspectRatio: draft.aspectRatio,
          resolution: draft.resolution,
        },
        segments: draft.segments.map((segment) => ({
          event: segment.event,
          prompt: segment.prompt,
          durationSeconds: segment.durationSeconds,
          referenceBindings: segment.referenceBindings,
          sceneImageUrl: segment.sceneImageUrl || null,
        })),
        sortOrder: draft.sortOrder,
        featured: draft.featured,
        hot: draft.hot,
        enabled: draft.enabled,
        effectiveFrom: draft.effectiveFrom ? new Date(draft.effectiveFrom).toISOString() : null,
        effectiveUntil: draft.effectiveUntil ? new Date(draft.effectiveUntil).toISOString() : null,
      };
      return editingId
        ? apiClient.patch(`/admin/aimv-generator/templates/${editingId}`, payload)
        : apiClient.post('/admin/aimv-generator/templates', payload);
    },
    onSuccess: () => {
      setDraft(EMPTY_TEMPLATE);
      setEditingId(null);
      setEditorTab('basic');
      setIsEditorOpen(false);
      queryClient.invalidateQueries({ queryKey: ['aimv-templates'] });
    },
  });
  const retry = useMutation({
    mutationFn: (id: string) => apiClient.post(`/admin/aimv-generator/templates/${id}/retry-translation`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aimv-templates'] }),
  });
  const preprocess = useMutation({
    mutationFn: ({ id, force = false }: { id: string; force?: boolean }) => apiClient.post(`/admin/aimv-generator/templates/${id}/preprocess`, { force }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aimv-templates'] }),
  });
  const generatePreview = useMutation({
    mutationFn: ({ id, force = true }: { id: string; force?: boolean }) => apiClient.post(`/admin/aimv-generator/templates/${id}/generate-preview`, { force }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aimv-templates'] }),
  });
  const mutationPending = save.isPending || retry.isPending || preprocess.isPending || generatePreview.isPending || uploadSingerReference.isPending;
  const set = <K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const edit = (row: AimvTemplate) => {
    const config = row.createSimilarConfig || {};
    setEditingId(row.id);
    setEditorTab('basic');
    setIsEditorOpen(true);
    setDraft({
      code: row.code,
      nameEn: row.nameEn,
      descriptionEn: row.descriptionEn || '',
      category: ['youtube', 'landscape'].includes(row.category) ? 'landscape' : 'portrait',
      coverUrl: row.coverUrl || '',
      previewVideoUrl: row.previewVideoUrl || '',
      defaultPrompt: row.defaultPrompt || config.creativeDescription || '',
      title: config.title || '',
      productModelCode: config.productModelCode || '',
      musicAssetId: config.musicAssetId || '',
      singerPhotoAssetId: config.singerPhotoAssetId || '',
      styleCode: config.styleCode || '',
      durationSec: config.durationSec || 30,
      aspectRatio: config.aspectRatio || (['youtube', 'landscape'].includes(row.category) ? '16:9' : '9:16'),
      resolution: config.resolution || '720p',
      sortOrder: row.sortOrder || 0,
      featured: !!row.featured,
      hot: !!row.hot,
      enabled: row.enabled,
      effectiveFrom: row.effectiveFrom ? row.effectiveFrom.slice(0, 16) : '',
      effectiveUntil: row.effectiveUntil ? row.effectiveUntil.slice(0, 16) : '',
      segments: row.segments?.length ? row.segments.map((segment) => ({
        ...segment,
        durationSeconds: Number(segment.durationSeconds || 15),
        event: segment.event || '', prompt: segment.prompt || '',
        referenceBindings: segment.referenceBindings || [], sceneImageUrl: segment.sceneImageUrl || '',
      })) : [EMPTY_SEGMENT()],
    });
  };
  const musicAssets = (assets.data ?? []).filter((item) => item.kind === 'hot_music' && item.enabled);
  const photoAssets = (assets.data ?? []).filter((item) => item.kind === 'singer_photo' && (
    item.enabled || item.metadata?.source === 'template-custom-upload' || item.id === draft.singerPhotoAssetId
  ));
  const selectedPhotoAsset = photoAssets.find((item) => item.id === draft.singerPhotoAssetId);
  const styleAssets = (assets.data ?? []).filter((item) => item.kind === 'mv_style' && item.enabled);
  const templateResolutions = [...new Set([...(settings.data?.settings.allowedResolutions ?? []), draft.resolution].filter(Boolean))];
  const updateSegment = (index: number, patch: Partial<TemplateSegment>) => setDraft((current) => ({
    ...current,
    segments: current.segments.map((segment, currentIndex) => currentIndex === index ? { ...segment, ...patch } : segment),
  }));
  const moveSegment = (index: number, offset: -1 | 1) => setDraft((current) => {
    const target = index + offset;
    if (target < 0 || target >= current.segments.length) return current;
    const segments = [...current.segments];
    [segments[index], segments[target]] = [segments[target], segments[index]];
    return { ...current, segments };
  });
  const totalDuration = draft.segments.reduce((total, segment) => total + Number(segment.durationSeconds || 0), 0);

  return (
    <div className="w-full space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <div className="flex items-start gap-2"><Languages className="mt-0.5 h-4 w-4" /><div><strong>英语为唯一源版本</strong><p className="mt-1 text-blue-700">保存后自动生成 10 种语言。翻译失败不会覆盖上一版成功内容，可在列表中重试。</p></div></div>
        <AdminDataTransferActions exportUrl="/admin/aimv-generator/templates/export" importUrl="/admin/aimv-generator/templates/import" filename="aimv-templates" resourceLabel="模板" canImport={canEdit} onImported={() => queryClient.invalidateQueries({ queryKey: ['aimv-templates'] })} />
      </section>
      {canEdit && (
        <div className="flex justify-end">
          <button type="button" disabled={mutationPending} onClick={() => { setEditingId(null); setDraft(EMPTY_TEMPLATE); setEditorTab('basic'); setIsEditorOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" />新增模板</button>
        </div>
      )}
      {canEdit && isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 py-8 backdrop-blur-sm">
        <section role="dialog" aria-modal="true" aria-label={editingId ? '编辑模板' : '新增模板'} className="flex max-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 pb-5 pt-6"><div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700"><Sparkles className="h-3.5 w-3.5" />模板工作台</div><h2 className="text-xl font-bold text-slate-900">{editingId ? '编辑模板' : '新增模板'}</h2><p className="mt-1 text-sm text-slate-500">按步骤配置模板基础资料、默认创作参数与镜头时间线。</p></div><button type="button" onClick={() => { setEditingId(null); setDraft(EMPTY_TEMPLATE); setEditorTab('basic'); setIsEditorOpen(false); }} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="关闭"><X className="h-5 w-5" /></button></div>
          <div className="flex gap-1 border-b border-slate-200 px-6 pt-3">
            {([
              ['basic', '1. 基础与发布'],
              ['creation', '2. 创作参数'],
              ['storyboard', `3. 镜头时间线 (${draft.segments.length})`],
            ] as Array<[TemplateEditorTab, string]>).map(([key, label]) => <button key={key} type="button" onClick={() => setEditorTab(key)} className={cn('border-b-2 px-4 py-3 text-sm font-medium transition-colors', editorTab === key ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>{label}</button>)}
          </div>
          <fieldset disabled={save.isPending} className="min-h-0 flex-1 overflow-y-auto px-6 py-5 disabled:opacity-60">
          {editorTab === 'basic' && <>
          <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div><h3 className="text-sm font-semibold text-slate-800">发布与展示</h3><p className="mt-1 text-xs text-slate-500">控制模板是否可用，以及它在用户侧的推荐标记。</p></div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"><div><div className="text-sm font-medium text-slate-800">启用模板</div><p className="mt-1 text-xs leading-5 text-slate-500">关闭后从用户侧下架，已有项目不受影响。</p></div><Switch checked={draft.enabled} onChange={(value) => set('enabled', value)} label="启用模板" /></div>
              <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"><div><div className="text-sm font-medium text-slate-800">设为精选</div><p className="mt-1 text-xs leading-5 text-slate-500">用于推荐排序和精选内容区展示。</p></div><Switch checked={draft.featured} onChange={(value) => set('featured', value)} label="设为精选" /></div>
              <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"><div><div className="text-sm font-medium text-slate-800">标记热门</div><p className="mt-1 text-xs leading-5 text-slate-500">在用户侧显示热门标记，便于运营推荐。</p></div><Switch checked={draft.hot} onChange={(value) => set('hot', value)} label="标记热门" /></div>
            </div>
          </section>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <TemplateField label="唯一 code" hint="用于接口和数据关联；发布后请不要随意修改。"><input value={draft.code} onChange={(e) => set('code', e.target.value)} placeholder="例如 neon-concert-landscape" /></TemplateField>
            <TemplateField label="版式类型" hint="横屏对应桌面端和 YouTube；竖屏对应手机端、Shorts、Reels 与 TikTok。"><select value={draft.category} onChange={(e) => { const category = e.target.value as TemplateDraft['category']; setDraft((current) => ({ ...current, category, aspectRatio: category === 'landscape' ? '16:9' : '9:16' })); }}><option value="landscape">横屏（电脑版 / YouTube）</option><option value="portrait">竖屏（手机版 / Shorts、Reels、TikTok）</option></select></TemplateField>
            <TemplateField label="Name (English)"><input value={draft.nameEn} onChange={(e) => set('nameEn', e.target.value)} /></TemplateField>
            <TemplateField label="Description (English)"><input value={draft.descriptionEn} onChange={(e) => set('descriptionEn', e.target.value)} /></TemplateField>
            <TemplateField label="封面图片 URL"><input value={draft.coverUrl} onChange={(e) => set('coverUrl', e.target.value)} placeholder="https://..." /></TemplateField>
            <TemplateField label="示例视频 URL" hint="用于用户端模板预览；建议使用可公开访问的 MP4 地址。"><input value={draft.previewVideoUrl} onChange={(e) => set('previewVideoUrl', e.target.value)} placeholder="https://.../sample.mp4" /></TemplateField>
          </div>
          </>}
          {editorTab === 'creation' && <>
          <h3 className="text-sm font-semibold text-slate-800">一键套用的创作参数</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <TemplateField label="作品标题"><input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="可选" /></TemplateField>
            <TemplateField label="使用模型"><select value={draft.productModelCode} onChange={(e) => set('productModelCode', e.target.value)}><option value="">使用页面默认模型</option>{(models.data ?? []).map((item) => <option key={item.code} value={item.code}>{item.name}（{item.code}）</option>)}</select></TemplateField>
            <TemplateField label="模板音乐" hint="可选。选择后将作为创建页的预设音乐，用户仍可替换。"><select value={draft.musicAssetId} onChange={(e) => set('musicAssetId', e.target.value)}><option value="">不预选</option>{musicAssets.map((item) => <option key={item.id} value={item.id}>{item.nameEn}（{item.code}）</option>)}</select></TemplateField>
            <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/50 p-3 lg:col-span-2">
              <div className="flex items-start justify-between gap-3">
                <div><div className="text-xs font-semibold text-slate-700">歌手参考图</div><p className="mt-1 text-xs leading-5 text-slate-500">从现有歌手库选择，或上传模板专用图片。保存后会使用这张图生成人物锚点及相关镜头。</p></div>
                {selectedPhotoAsset && <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-medium text-violet-700">{selectedPhotoAsset.metadata?.source === 'template-custom-upload' ? '自定义上传' : selectedPhotoAsset.enabled ? '歌手库' : '历史参考图'}</span>}
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  {selectedPhotoAsset ? <img src={resolvePublicAssetUrl(selectedPhotoAsset.thumbnailUrl || selectedPhotoAsset.assetUrl)} alt={selectedPhotoAsset.nameEn} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-slate-400">未选择</div>}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <button type="button" onClick={() => setIsSingerPickerOpen(true)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-violet-300 hover:bg-violet-50/30">
                    <span className={cn('truncate', selectedPhotoAsset ? 'text-slate-800' : 'text-slate-400')}>{selectedPhotoAsset ? selectedPhotoAsset.nameEn : '从缩略图库选择歌手'}</span>
                    <span className="shrink-0 text-xs font-medium text-violet-700">查看缩略图</span>
                  </button>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                    {uploadSingerReference.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploadSingerReference.isPending ? '正在上传…' : '上传自定义参考图'}
                    <input hidden disabled={uploadSingerReference.isPending} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadSingerReference.mutate(file); event.target.value = ''; }} />
                  </label>
                  {selectedPhotoAsset && <p className="truncate text-xs text-slate-500">当前：{selectedPhotoAsset.nameEn}</p>}
                  {uploadSingerReference.isError && <p className="text-xs text-red-600">{(uploadSingerReference.error as Error).message || '参考图上传失败'}</p>}
                </div>
              </div>
            </div>
            <TemplateField label="模板风格" hint="选择后，用户点击“Create Similar”会自动带入此视觉风格；用户仍可在创建页改选。"><select value={draft.styleCode} onChange={(e) => set('styleCode', e.target.value)}><option value="">不预选</option>{styleAssets.map((item) => <option key={item.id} value={item.code}>{item.nameEn}（{item.code}）</option>)}</select></TemplateField>
            <TemplateField label="模板总时长（自动计算）"><input readOnly value={`${totalDuration} 秒`} className="bg-slate-50 text-slate-500" /></TemplateField>
            <TemplateField label="画面比例"><input value={draft.aspectRatio} onChange={(e) => set('aspectRatio', e.target.value)} placeholder="16:9 / 9:16" /></TemplateField>
            <TemplateField label="分辨率" hint="仅显示当前启用的分辨率；请在“计费与会员”中维护可用项。已停用的历史模板值会保留，方便运营迁移。"><select value={draft.resolution} onChange={(e) => set('resolution', e.target.value)}>{templateResolutions.map((resolution) => <option key={resolution} value={resolution}>{resolution}</option>)}</select></TemplateField>
            <TemplateField label="排序"><input type="number" value={draft.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} /></TemplateField>
            <TemplateField label="开始生效"><input type="datetime-local" value={draft.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} /></TemplateField>
            <TemplateField label="结束生效"><input type="datetime-local" value={draft.effectiveUntil} onChange={(e) => set('effectiveUntil', e.target.value)} /></TemplateField>
          </div>
          <TemplateField label="生成提示词" hint="这是所有镜头的全局创作方向；每个镜头的片段提示词会在此基础上补充具体动作与构图。"><textarea value={draft.defaultPrompt} onChange={(e) => set('defaultPrompt', e.target.value)} rows={5} placeholder="描述叙事、人物、场景、镜头、情绪和视觉风格" /></TemplateField>
          </>}
          {editorTab === 'storyboard' && <>
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="text-sm font-semibold text-slate-800">模板镜头时间线</h3><p className="mt-1 text-xs text-slate-500">开始时间自动衔接；单段最长 15 秒。场景图留空时根据提示词和照片自动生成。</p></div>
            <button type="button" onClick={() => setDraft((current) => ({ ...current, segments: [...current.segments, EMPTY_SEGMENT()] }))} className="inline-flex items-center gap-1 rounded-lg border border-violet-200 px-3 py-2 text-sm text-violet-700"><Plus className="h-4 w-4" />添加镜头</button>
          </div>
          <div className="mt-4 space-y-3">
            {draft.segments.map((segment, index) => {
              const startSecond = draft.segments.slice(0, index).reduce((total, item) => total + Number(item.durationSeconds || 0), 0);
              const dependency = segment.referenceBindings.includes('main') && segment.referenceBindings.includes('partner') ? 'both' : segment.referenceBindings[0] || 'none';
              return <section key={`${index}-${segment.id ?? 'new'}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between"><div className="font-medium text-slate-800">镜头 {index + 1}<span className="ml-2 text-xs font-normal text-slate-400">{startSecond}s → {startSecond + Number(segment.durationSeconds || 0)}s</span></div><div className="flex items-center gap-1">
                  <button type="button" disabled={index === 0} onClick={() => moveSegment(index, -1)} className="rounded p-1.5 text-slate-500 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" disabled={index === draft.segments.length - 1} onClick={() => moveSegment(index, 1)} className="rounded p-1.5 text-slate-500 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" disabled={draft.segments.length === 1} onClick={() => setDraft((current) => ({ ...current, segments: current.segments.filter((_, currentIndex) => currentIndex !== index) }))} className="rounded p-1.5 text-red-500 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                </div></div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <TemplateField label="事件 / 剧情"><input value={segment.event} onChange={(event) => updateSegment(index, { event: event.target.value })} placeholder="例如：歌手走上霓虹舞台" /></TemplateField>
                  <TemplateField label="时长（1-15 秒）"><input type="number" min={1} max={15} value={segment.durationSeconds} onChange={(event) => updateSegment(index, { durationSeconds: Math.min(15, Math.max(1, Number(event.target.value))) })} /></TemplateField>
                  <TemplateField label="人物依赖"><select value={dependency} onChange={(event) => updateSegment(index, { referenceBindings: event.target.value === 'both' ? ['main', 'partner'] : event.target.value === 'none' ? [] : [event.target.value as 'main' | 'partner'] })}><option value="none">无人物依赖</option><option value="main">主角照片</option><option value="partner">搭档照片</option><option value="both">主角 + 搭档</option></select></TemplateField>
                  <TemplateField label="可选场景图 URL"><input value={segment.sceneImageUrl} onChange={(event) => updateSegment(index, { sceneImageUrl: event.target.value })} placeholder="https://..." /></TemplateField>
                </div>
                <TemplateField label="片段提示词（必填）"><textarea rows={3} value={segment.prompt} onChange={(event) => updateSegment(index, { prompt: event.target.value })} placeholder="描述场景、构图、动作、镜头运动和风格" /></TemplateField>
              </section>;
            })}
          </div>
          </>}
          </fieldset>
          {isSingerPickerOpen && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsSingerPickerOpen(false); }}>
              <section role="dialog" aria-modal="true" aria-label="选择歌手参考图" className="flex max-h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                  <div><h3 className="text-lg font-bold text-slate-900">选择歌手参考图</h3><p className="mt-1 text-sm text-slate-500">点击缩略图即可选中并返回模板编辑。</p></div>
                  <button type="button" onClick={() => setIsSingerPickerOpen(false)} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="关闭歌手参考图选择"><X className="h-5 w-5" /></button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  <button type="button" onClick={() => { set('singerPhotoAssetId', ''); setIsSingerPickerOpen(false); }} className={cn('mb-5 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition', !draft.singerPhotoAssetId ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-slate-200 text-slate-600 hover:border-violet-300')}><span>不预选歌手参考图</span>{!draft.singerPhotoAssetId && <CheckCircle2 className="h-4 w-4" />}</button>
                  {photoAssets.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {photoAssets.map((item) => {
                      const selected = item.id === draft.singerPhotoAssetId;
                      const custom = item.metadata?.source === 'template-custom-upload';
                      return <button key={item.id} type="button" onClick={() => { set('singerPhotoAssetId', item.id); setIsSingerPickerOpen(false); }} className={cn('group overflow-hidden rounded-xl border bg-white text-left transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md', selected ? 'border-violet-500 ring-2 ring-violet-100' : 'border-slate-200')}>
                        <div className="relative aspect-square overflow-hidden bg-slate-100"><img src={resolvePublicAssetUrl(item.thumbnailUrl || item.assetUrl)} alt={item.nameEn} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />{selected && <span className="absolute right-2 top-2 rounded-full bg-violet-600 p-1 text-white shadow"><CheckCircle2 className="h-4 w-4" /></span>}<span className="absolute bottom-2 left-2 rounded-full bg-slate-950/65 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">{custom ? '自定义' : item.enabled ? '歌手库' : '历史'}</span></div>
                        <div className="p-3"><div className="truncate text-sm font-semibold text-slate-800">{item.nameEn}</div><div className="mt-1 truncate text-[11px] text-slate-400">{item.code}</div></div>
                      </button>;
                    })}
                  </div> : <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">暂无可选歌手图片，请先上传自定义参考图。</div>}
                </div>
              </section>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-6 py-4"><p className="text-xs text-slate-500">必填项：唯一 code、英文名称、每个镜头的片段提示词。</p><button disabled={save.isPending || !draft.code.trim() || !draft.nameEn.trim() || draft.segments.some((segment) => !segment.prompt.trim())} onClick={() => { if (!save.isPending) save.mutate(); }} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm text-white disabled:opacity-50">{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{editingId ? '保存模板' : '保存并自动翻译'}</button></div>
          {save.isError && <ErrorText text={(save.error as Error).message} />}
        </section>
        </div>
      )}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {query.isLoading ? <Loading /> : query.isError ? <ErrorText text={(query.error as Error).message} /> : (
          <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">模板</th><th className="px-4 py-3">版式</th><th className="px-4 py-3">创作参数</th><th className="px-4 py-3">公共场景</th><th className="px-4 py-3">翻译</th><th className="px-4 py-3">状态</th><th className="px-4 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-100">{(query.data ?? []).map((row) => {
            const ready = row.segments.filter((segment) => segment.sceneStatus === 'ready' || !!segment.sceneImageUrl).length;
            const failed = row.segments.filter((segment) => segment.sceneStatus === 'failed').length;
            const processing = row.segments.some((segment) => ['pending', 'generating'].includes(segment.sceneStatus ?? ''));
            const preview = ((row.defaults?.previewGeneration ?? {}) as PreviewGenerationState);
            const previewGenerating = preview.status === 'generating';
            const previewLabel = previewGenerating ? '示例视频生成中' : preview.status === 'failed' ? '示例视频失败' : row.previewVideoUrl ? '有示例视频' : '无示例视频';
            return <tr key={row.id}><td className="px-4 py-3"><div className="flex items-center gap-3">{row.coverUrl ? <img src={resolvePublicAssetUrl(row.coverUrl)} alt="" className="h-12 w-16 rounded-lg object-cover" /> : <div className="h-12 w-16 rounded-lg bg-slate-100" />}<div><div className="font-medium text-slate-900">{row.nameEn}</div><div className="text-xs text-slate-400">{row.code}</div></div></div></td><td className="px-4 py-3 text-slate-600">{['youtube', 'landscape'].includes(row.category) ? '横屏' : '竖屏'}</td><td className="px-4 py-3 text-xs text-slate-500"><div>{row.createSimilarConfig?.aspectRatio || '—'} · {row.createSimilarConfig?.durationSec || '—'}s · {row.createSimilarConfig?.resolution || '—'}</div><div title={preview.error || ''} className={cn('mt-1', preview.status === 'failed' && 'text-red-600')}>{previewLabel} · {row.createSimilarConfig?.productModelCode || '默认模型'}</div></td><td className="px-4 py-3 text-xs"><div className={failed ? 'text-red-600' : processing ? 'text-amber-600' : 'text-emerald-600'}>{ready}/{row.segments.length} 已就绪{failed ? ` · ${failed} 失败` : processing ? ' · 生成中' : ''}</div></td><td className="px-4 py-3"><TranslationBadge row={row} /></td><td className="px-4 py-3">{row.enabled ? '启用' : '停用'}</td><td className="px-4 py-3 text-right"><div className="inline-flex items-center gap-3">{canEdit && <button disabled={mutationPending} onClick={() => edit(row)} className="inline-flex items-center gap-1 text-violet-700 disabled:opacity-50"><Pencil className="h-3.5 w-3.5" />编辑</button>}{canEdit && <button disabled={mutationPending} onClick={() => { if (!mutationPending) preprocess.mutate({ id: row.id, force: true }); }} className="inline-flex items-center gap-1 text-violet-700 disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" />重新生成场景</button>}{canEdit && <button disabled={mutationPending || previewGenerating || !row.segments.length} onClick={() => { if (!mutationPending) generatePreview.mutate({ id: row.id, force: Boolean(row.previewVideoUrl) }); }} className="inline-flex items-center gap-1 text-violet-700 disabled:cursor-not-allowed disabled:opacity-50" title={preview.error || '按模板镜头调用当前已配置的视频模型，完成后自动上传并回填示例视频'}>{previewGenerating || generatePreview.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{row.previewVideoUrl ? '重新生成示例视频' : '生成示例视频'}</button>}{row.translationStatus === 'failed' && canEdit && <button disabled={mutationPending} onClick={() => { if (!mutationPending) retry.mutate(row.id); }} className="inline-flex items-center gap-1 text-violet-700 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" />重新翻译</button>}</div></td></tr>;
          })}</tbody></table>
        )}
      </section>
    </div>
  );
}

function TemplateField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="mt-3 block text-xs font-medium text-slate-600"><span className="mb-1.5 flex items-center gap-1">{label}{hint && <span title={hint} aria-label={hint}><CircleHelp className="h-3.5 w-3.5 text-slate-400" /></span>}</span><span className="block [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-slate-200 [&_input]:px-3 [&_input]:py-2 [&_input]:text-sm [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-slate-200 [&_select]:px-3 [&_select]:py-2 [&_select]:text-sm [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-slate-200 [&_textarea]:px-3 [&_textarea]:py-2 [&_textarea]:text-sm">{children}</span></label>;
}

function TranslationBadge({ row }: { row: AimvTemplate }) {
  const styles = row.translationStatus === 'ready' ? 'bg-emerald-50 text-emerald-700' : row.translationStatus === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700';
  const text = row.translationStatus === 'ready' ? '已生成' : row.translationStatus === 'failed' ? '失败' : '生成中';
  return <span title={row.translationError ?? ''} className={cn('rounded-full px-2 py-1 text-xs', styles)}>{text}</span>;
}

function PlannedTab({ tab }: { tab: string }) {
  return <div className="w-full rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="font-semibold text-slate-900">{tab}</h2><p className="mt-2 text-sm text-slate-500">该区域已纳入独立产品模块，下一批接入对应的数据表和管理操作。</p></div>;
}

function Loading() { return <div className="flex justify-center p-12"><Loader2 className="h-5 w-5 animate-spin text-violet-600" /></div>; }
function ErrorText({ text }: { text: string }) { return <p className="mt-3 text-sm text-red-600">{text || '加载失败'}</p>; }
