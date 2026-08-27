'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { CheckCircle2, Languages, Loader2, RefreshCw, Save, Sparkles } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { CapacityTab, PricingTab, QueueTab } from '@/components/aimv-runtime-tabs';
import { AimvAssetsTab, AimvResolversTab, AimvRetentionTab } from '@/components/aimv-content-tabs';
import { Switch } from '@/components/ui/switch';

type TabKey =
  | 'settings'
  | 'templates'
  | 'assets'
  | 'resolvers'
  | 'capacity'
  | 'queue'
  | 'retention'
  | 'pricing';

const TABS: Array<{ key: TabKey; label: string; permission: string }> = [
  { key: 'settings', label: '基础设置', permission: 'aimv.settings.view' },
  { key: 'templates', label: '模板与类型', permission: 'aimv.content.view' },
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
  enabled: boolean;
  sortOrder: number;
  translationStatus: 'pending' | 'ready' | 'failed';
  translationError: string | null;
  translatedAt: string | null;
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
          <Switch checked={form.enabled} onChange={(checked) => set('enabled', checked)} disabled={!canEdit} size="lg" label="产品开关" />
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">时长、上传与存储</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {NUMBER_FIELDS.map((field) => (
            <label key={field.key} className="text-sm text-slate-600">
              <span>{field.label}</span>
              <div className="mt-1 flex rounded-lg border border-slate-200 bg-white focus-within:border-violet-400">
                <input type="number" min={1} value={Number(form[field.key])} onChange={(e) => set(field.key, Number(e.target.value) as never)} className="min-w-0 flex-1 rounded-lg px-3 py-2 outline-none" />
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
              <input value={(form[field.key] as string[]).join(', ')} placeholder={field.hint} onChange={(e) => set(field.key, splitList(e.target.value) as never)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-violet-400" />
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
  });
  const [draft, setDraft] = useState({ code: '', nameEn: '', descriptionEn: '', category: 'youtube' });
  const create = useMutation({
    mutationFn: () => apiClient.post('/admin/aimv-generator/templates', draft),
    onSuccess: () => { setDraft({ code: '', nameEn: '', descriptionEn: '', category: 'youtube' }); queryClient.invalidateQueries({ queryKey: ['aimv-templates'] }); },
  });
  const retry = useMutation({
    mutationFn: (id: string) => apiClient.post(`/admin/aimv-generator/templates/${id}/retry-translation`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aimv-templates'] }),
  });

  return (
    <div className="w-full space-y-5">
      <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <div className="flex items-start gap-2"><Languages className="mt-0.5 h-4 w-4" /><div><strong>英语为唯一源版本</strong><p className="mt-1 text-blue-700">保存后自动生成 10 种语言。翻译失败不会覆盖上一版成功内容，可在列表中重试。</p></div></div>
      </section>
      {canEdit && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">新增模板</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="唯一 code，例如 youtube-landscape" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="youtube">For YouTube</option><option value="youtube-shorts">For YouTube Shorts</option><option value="instagram-reels">Instagram Reels</option><option value="tiktok">TikTok</option></select>
            <input value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} placeholder="Name (English)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input value={draft.descriptionEn} onChange={(e) => setDraft({ ...draft, descriptionEn: e.target.value })} placeholder="Description (English)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div className="mt-4 flex justify-end"><button disabled={create.isPending || !draft.code.trim() || !draft.nameEn.trim()} onClick={() => create.mutate()} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm text-white disabled:opacity-50">{create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存并自动翻译</button></div>
          {create.isError && <ErrorText text={(create.error as Error).message} />}
        </section>
      )}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {query.isLoading ? <Loading /> : query.isError ? <ErrorText text={(query.error as Error).message} /> : (
          <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">英语名称</th><th className="px-4 py-3">分类</th><th className="px-4 py-3">翻译状态</th><th className="px-4 py-3">状态</th><th className="px-4 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-100">{(query.data ?? []).map((row) => <tr key={row.id}><td className="px-4 py-3"><div className="font-medium text-slate-900">{row.nameEn}</div><div className="text-xs text-slate-400">{row.code}</div></td><td className="px-4 py-3 text-slate-600">{row.category}</td><td className="px-4 py-3"><TranslationBadge row={row} /></td><td className="px-4 py-3">{row.enabled ? '启用' : '停用'}</td><td className="px-4 py-3 text-right">{row.translationStatus === 'failed' && canEdit && <button disabled={retry.isPending} onClick={() => retry.mutate(row.id)} className="inline-flex items-center gap-1 text-violet-700"><RefreshCw className="h-3.5 w-3.5" />重新生成</button>}</td></tr>)}</tbody></table>
        )}
      </section>
    </div>
  );
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
