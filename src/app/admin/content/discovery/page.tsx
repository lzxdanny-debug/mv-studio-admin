'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Compass,
  Flame,
  LayoutGrid,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { Switch } from '@/components/ui/switch';

type DiscoveryBadge = 'NEW' | 'TOP' | 'FREE';
type CatalogSource = 'registry' | 'mv_project' | 'music_task' | 'custom';
type PopularGradient = 'cyan' | 'emerald' | 'violet';
type SectionTab = 'featured' | 'popular' | 'trending';

interface LocalizedText {
  zh: string;
  en: string;
}

interface CatalogEntry {
  sortOrder: number;
  source: CatalogSource;
  refId?: string;
  badge?: DiscoveryBadge;
  title?: LocalizedText;
  description?: LocalizedText;
  href?: string;
  icon?: string;
  category?: string;
}

interface PopularCardEntry {
  sortOrder: number;
  gradient: PopularGradient;
  categoryLabel: LocalizedText;
  title: LocalizedText;
  description: LocalizedText;
  href: string;
  badge?: 'TOP';
  external?: boolean;
}

interface DiscoveryCatalogConfig {
  enabled: boolean;
  featured: CatalogEntry[];
  popular: PopularCardEntry[];
  trending: CatalogEntry[];
}

interface RegistryItem {
  id: string;
  titles: LocalizedText;
}

interface DiscoveryCatalogResp {
  saved: DiscoveryCatalogConfig | null;
  effective: DiscoveryCatalogConfig;
  registry: RegistryItem[];
}

const FIELD =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';
const LABEL = 'mb-1 block text-xs font-medium text-slate-500';

const GRADIENT_PREVIEW: Record<PopularGradient, string> = {
  cyan: 'from-cyan-400 to-blue-500',
  emerald: 'from-emerald-400 to-teal-500',
  violet: 'from-violet-400 to-fuchsia-500',
};

const SOURCE_LABEL: Record<CatalogSource, string> = {
  registry: '内置 Registry',
  mv_project: 'MV 项目',
  music_task: '音乐任务',
  custom: '自定义链接',
};

const TABS: Array<{
  key: SectionTab;
  label: string;
  icon: typeof Star;
  hint: string;
}> = [
  { key: 'featured', label: '精选', icon: Star, hint: '空查询态顶部纵向列表' },
  { key: 'popular', label: '热门产品', icon: Flame, hint: '三列渐变大卡' },
  { key: 'trending', label: '趋势', icon: LayoutGrid, hint: '两列小卡网格' },
];

function reindex<T extends { sortOrder: number }>(items: T[]): T[] {
  return items.map((item, i) => ({ ...item, sortOrder: i }));
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className={LABEL}>{children}</span>;
}

function MoveControls({
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      <button
        type="button"
        onClick={onMoveUp}
        className="rounded-md p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-800"
        aria-label="上移"
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        className="rounded-md p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-800"
        aria-label="下移"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
        aria-label="删除"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
        <Sparkles className="h-4 w-4" />
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-400">{description}</p>
    </div>
  );
}

function CatalogEntryEditor({
  entry,
  index,
  registry,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  entry: CatalogEntry;
  index: number;
  registry: RegistryItem[];
  onChange: (entry: CatalogEntry) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const registryTitle = registry.find((r) => r.id === entry.refId)?.titles.zh;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-slate-100 px-1.5 text-xs font-semibold text-slate-600">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">
              {entry.source === 'registry'
                ? registryTitle || entry.refId || '未选择 Registry'
                : entry.source === 'custom'
                  ? entry.title?.zh || '自定义条目'
                  : entry.refId || SOURCE_LABEL[entry.source]}
            </p>
            <p className="text-[11px] text-slate-400">{SOURCE_LABEL[entry.source]}</p>
          </div>
          {entry.badge && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-blue-700">
              {entry.badge}
            </span>
          )}
        </div>
        <MoveControls onMoveUp={onMoveUp} onMoveDown={onMoveDown} onRemove={onRemove} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <FieldLabel>来源</FieldLabel>
          <select
            value={entry.source}
            onChange={(e) => onChange({ ...entry, source: e.target.value as CatalogSource })}
            className={FIELD}
          >
            <option value="registry">内置 Registry</option>
            <option value="mv_project">MV 项目 ID</option>
            <option value="music_task">音乐任务 ID</option>
            <option value="custom">自定义链接</option>
          </select>
        </label>

        <label className="block">
          <FieldLabel>徽章</FieldLabel>
          <select
            value={entry.badge ?? ''}
            onChange={(e) =>
              onChange({
                ...entry,
                badge: (e.target.value || undefined) as DiscoveryBadge | undefined,
              })
            }
            className={FIELD}
          >
            <option value="">无</option>
            <option value="NEW">NEW</option>
            <option value="TOP">TOP</option>
            <option value="FREE">FREE</option>
          </select>
        </label>
      </div>

      {entry.source === 'registry' && (
        <label className="mt-3 block">
          <FieldLabel>Registry 项</FieldLabel>
          <select
            value={entry.refId ?? ''}
            onChange={(e) => onChange({ ...entry, refId: e.target.value })}
            className={FIELD}
          >
            <option value="">选择…</option>
            {registry.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} — {r.titles.zh}
              </option>
            ))}
          </select>
        </label>
      )}

      {(entry.source === 'mv_project' || entry.source === 'music_task') && (
        <label className="mt-3 block">
          <FieldLabel>实体 ID</FieldLabel>
          <input
            value={entry.refId ?? ''}
            onChange={(e) => onChange({ ...entry, refId: e.target.value })}
            placeholder="uuid…"
            className={cn(FIELD, 'font-mono text-xs')}
          />
        </label>
      )}

      {entry.source === 'custom' && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block">
            <FieldLabel>中文标题</FieldLabel>
            <input
              value={entry.title?.zh ?? ''}
              onChange={(e) =>
                onChange({ ...entry, title: { zh: e.target.value, en: entry.title?.en ?? '' } })
              }
              className={FIELD}
            />
          </label>
          <label className="block">
            <FieldLabel>英文标题</FieldLabel>
            <input
              value={entry.title?.en ?? ''}
              onChange={(e) =>
                onChange({ ...entry, title: { zh: entry.title?.zh ?? '', en: e.target.value } })
              }
              className={FIELD}
            />
          </label>
          <label className="block md:col-span-2">
            <FieldLabel>链接 href</FieldLabel>
            <input
              value={entry.href ?? ''}
              onChange={(e) => onChange({ ...entry, href: e.target.value })}
              placeholder="/video-generator"
              className={cn(FIELD, 'font-mono text-xs')}
            />
          </label>
          <label className="block">
            <FieldLabel>图标 key</FieldLabel>
            <input
              value={entry.icon ?? 'Sparkles'}
              onChange={(e) => onChange({ ...entry, icon: e.target.value })}
              className={cn(FIELD, 'font-mono text-xs')}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function PopularCardEditor({
  card,
  index,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  card: PopularCardEntry;
  index: number;
  onChange: (card: PopularCardEntry) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={cn('h-1.5 bg-gradient-to-r', GRADIENT_PREVIEW[card.gradient])} />
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-slate-100 px-1.5 text-xs font-semibold text-slate-600">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">
                {card.title.zh || '未命名热门卡'}
              </p>
              <p className="truncate text-[11px] text-slate-400">{card.categoryLabel.zh || '未分类'}</p>
            </div>
          </div>
          <MoveControls onMoveUp={onMoveUp} onMoveDown={onMoveDown} onRemove={onRemove} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <FieldLabel>渐变主题</FieldLabel>
            <div className="flex gap-2">
              {(Object.keys(GRADIENT_PREVIEW) as PopularGradient[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onChange({ ...card, gradient: g })}
                  className={cn(
                    'h-9 flex-1 rounded-lg bg-gradient-to-r transition ring-offset-1',
                    GRADIENT_PREVIEW[g],
                    card.gradient === g
                      ? 'ring-2 ring-blue-500'
                      : 'opacity-70 hover:opacity-100',
                  )}
                  title={g}
                  aria-label={g}
                />
              ))}
            </div>
          </label>
          <label className="block md:col-span-2">
            <FieldLabel>跳转链接</FieldLabel>
            <input
              value={card.href}
              onChange={(e) => onChange({ ...card, href: e.target.value })}
              className={cn(FIELD, 'font-mono text-xs')}
            />
          </label>
        </div>

        <div className="mt-3 space-y-3">
          {(
            [
              ['categoryLabel', '分类标签'],
              ['title', '标题'],
              ['description', '描述'],
            ] as const
          ).map(([field, label]) => (
            <div key={field} className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <FieldLabel>{label}（中文）</FieldLabel>
                <input
                  value={card[field].zh}
                  onChange={(e) =>
                    onChange({ ...card, [field]: { ...card[field], zh: e.target.value } })
                  }
                  className={FIELD}
                />
              </label>
              <label className="block">
                <FieldLabel>{label}（English）</FieldLabel>
                <input
                  value={card[field].en}
                  onChange={(e) =>
                    onChange({ ...card, [field]: { ...card[field], en: e.target.value } })
                  }
                  className={FIELD}
                />
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DiscoveryAdminPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<SectionTab>('featured');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'discovery', 'catalog'],
    queryFn: () =>
      apiClient.get('/admin/discovery/catalog') as Promise<DiscoveryCatalogResp>,
  });

  const [draft, setDraft] = useState<DiscoveryCatalogConfig | null>(null);

  useEffect(() => {
    if (data?.effective) {
      setDraft(structuredClone(data.effective));
    }
  }, [data?.effective]);

  const dirty = useMemo(
    () =>
      draft && data?.effective
        ? JSON.stringify(draft) !== JSON.stringify(data.effective)
        : false,
    [draft, data?.effective],
  );

  const saveMutation = useMutation({
    mutationFn: (payload: DiscoveryCatalogConfig) =>
      apiClient.patch('/admin/discovery/catalog', payload) as Promise<DiscoveryCatalogResp>,
    onSuccess: (resp) => {
      queryClient.setQueryData(['admin', 'discovery', 'catalog'], resp);
      setDraft(structuredClone(resp.effective));
      setMsg({ ok: true, text: 'Discovery 配置已保存，前台立即生效。' });
    },
    onError: (err: any) => {
      setMsg({ ok: false, text: err?.message || '保存失败，请重试。' });
    },
  });

  const updateList = (
    key: 'featured' | 'trending',
    updater: (items: CatalogEntry[]) => CatalogEntry[],
  ) => {
    if (!draft) return;
    setDraft({ ...draft, [key]: reindex(updater(draft[key])) });
    setMsg(null);
  };

  const updatePopular = (updater: (items: PopularCardEntry[]) => PopularCardEntry[]) => {
    if (!draft) return;
    setDraft({ ...draft, popular: reindex(updater(draft.popular)) });
    setMsg(null);
  };

  const counts = useMemo(
    () => ({
      featured: draft?.featured.length ?? 0,
      popular: draft?.popular.length ?? 0,
      trending: draft?.trending.length ?? 0,
    }),
    [draft],
  );

  return (
    <div className="admin-page">
      <div className="admin-page-inner w-full space-y-5 p-6 pb-28">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 ring-1 ring-blue-100">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Discovery 搜索运营
              </h1>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">
                配置全站搜索浮层的精选、热门产品与趋势位。未保存时使用内置默认配置。
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {data?.saved ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
                    <CheckCircle2 className="h-3 w-3" />
                    已写入数据库
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-100">
                    当前为内置默认
                  </span>
                )}
                {dirty && (
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-100">
                    有未保存更改
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <QueryState isLoading={isLoading || !draft} isError={isError} error={error} height="h-64">
          {draft && (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">运营位总开关</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      关闭后 Web 端 catalog 返回空列表，搜索本身仍可用
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={draft.enabled}
                      onChange={(next) => {
                        setDraft({ ...draft, enabled: next });
                        setMsg(null);
                      }}
                      label="运营位总开关"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      {draft.enabled ? '已启用' : '已关闭'}
                    </span>
                  </div>
                </div>
              </section>

              <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                {TABS.map((item) => {
                  const Icon = item.icon;
                  const active = tab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setTab(item.key)}
                      className={cn(
                        'inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                        active
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                          active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {counts[item.key]}
                      </span>
                    </button>
                  );
                })}
              </div>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">
                      {TABS.find((t) => t.key === tab)?.label}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {TABS.find((t) => t.key === tab)?.hint}
                    </p>
                  </div>
                </div>

                {tab === 'featured' && (
                  <div className="space-y-3">
                    {draft.featured.length === 0 ? (
                      <EmptyState
                        title="暂无精选条目"
                        description="添加 Registry 工具、MV/音乐实体或自定义链接，展示在搜索空态顶部。"
                      />
                    ) : (
                      draft.featured.map((entry, index) => (
                        <CatalogEntryEditor
                          key={`featured-${index}`}
                          entry={entry}
                          index={index}
                          registry={data?.registry ?? []}
                          onChange={(next) =>
                            updateList('featured', (items) =>
                              items.map((it, i) => (i === index ? next : it)),
                            )
                          }
                          onRemove={() =>
                            updateList('featured', (items) =>
                              items.filter((_, i) => i !== index),
                            )
                          }
                          onMoveUp={() =>
                            index > 0 &&
                            updateList('featured', (items) => {
                              const next = [...items];
                              [next[index - 1], next[index]] = [next[index], next[index - 1]];
                              return next;
                            })
                          }
                          onMoveDown={() =>
                            index < draft.featured.length - 1 &&
                            updateList('featured', (items) => {
                              const next = [...items];
                              [next[index], next[index + 1]] = [next[index + 1], next[index]];
                              return next;
                            })
                          }
                        />
                      ))
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        updateList('featured', (items) => [
                          ...items,
                          { sortOrder: items.length, source: 'registry', refId: 'mv-create' },
                        ])
                      }
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      添加精选
                    </button>
                  </div>
                )}

                {tab === 'popular' && (
                  <div className="space-y-3">
                    {draft.popular.length === 0 ? (
                      <EmptyState
                        title="暂无热门产品卡"
                        description="配置渐变大卡的中英文案与跳转链接，展示在搜索浮层中部。"
                      />
                    ) : (
                      draft.popular.map((card, index) => (
                        <PopularCardEditor
                          key={`popular-${index}`}
                          card={card}
                          index={index}
                          onChange={(next) =>
                            updatePopular((items) =>
                              items.map((it, i) => (i === index ? next : it)),
                            )
                          }
                          onRemove={() =>
                            updatePopular((items) => items.filter((_, i) => i !== index))
                          }
                          onMoveUp={() =>
                            index > 0 &&
                            updatePopular((items) => {
                              const next = [...items];
                              [next[index - 1], next[index]] = [next[index], next[index - 1]];
                              return next;
                            })
                          }
                          onMoveDown={() =>
                            index < draft.popular.length - 1 &&
                            updatePopular((items) => {
                              const next = [...items];
                              [next[index], next[index + 1]] = [next[index + 1], next[index]];
                              return next;
                            })
                          }
                        />
                      ))
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        updatePopular((items) => [
                          ...items,
                          {
                            sortOrder: items.length,
                            gradient: 'cyan',
                            categoryLabel: { zh: '视频', en: 'Video' },
                            title: { zh: '新功能', en: 'New Feature' },
                            description: { zh: '描述', en: 'Description' },
                            href: '/video-generator',
                          },
                        ])
                      }
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      添加热门卡
                    </button>
                  </div>
                )}

                {tab === 'trending' && (
                  <div className="space-y-3">
                    {draft.trending.length === 0 ? (
                      <EmptyState
                        title="暂无趋势条目"
                        description="添加趋势位小卡，展示在搜索浮层底部网格。"
                      />
                    ) : (
                      draft.trending.map((entry, index) => (
                        <CatalogEntryEditor
                          key={`trending-${index}`}
                          entry={entry}
                          index={index}
                          registry={data?.registry ?? []}
                          onChange={(next) =>
                            updateList('trending', (items) =>
                              items.map((it, i) => (i === index ? next : it)),
                            )
                          }
                          onRemove={() =>
                            updateList('trending', (items) =>
                              items.filter((_, i) => i !== index),
                            )
                          }
                          onMoveUp={() =>
                            index > 0 &&
                            updateList('trending', (items) => {
                              const next = [...items];
                              [next[index - 1], next[index]] = [next[index], next[index - 1]];
                              return next;
                            })
                          }
                          onMoveDown={() =>
                            index < draft.trending.length - 1 &&
                            updateList('trending', (items) => {
                              const next = [...items];
                              [next[index], next[index + 1]] = [next[index + 1], next[index]];
                              return next;
                            })
                          }
                        />
                      ))
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        updateList('trending', (items) => [
                          ...items,
                          { sortOrder: items.length, source: 'registry', refId: 'lrc' },
                        ])
                      }
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      添加趋势
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </QueryState>
      </div>

      {draft && (
        <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-[1.25rem]">
              {msg ? (
                <p
                  className={cn(
                    'text-xs font-medium',
                    msg.ok ? 'text-emerald-600' : 'text-red-500',
                  )}
                >
                  {msg.text}
                </p>
              ) : (
                <p className="text-xs text-slate-400">
                  {dirty ? '修改尚未保存' : '配置与当前生效内容一致'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!dirty || saveMutation.isPending}
                onClick={() => {
                  if (data?.effective) setDraft(structuredClone(data.effective));
                  setMsg(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                撤销
              </button>
              <button
                type="button"
                disabled={!dirty || saveMutation.isPending}
                onClick={() => {
                  setMsg(null);
                  saveMutation.mutate(draft);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" />
                {saveMutation.isPending ? '保存中…' : '保存配置'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
