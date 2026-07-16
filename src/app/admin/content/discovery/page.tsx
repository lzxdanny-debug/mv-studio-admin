'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Compass, Plus, Save, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';

type DiscoveryBadge = 'NEW' | 'TOP' | 'FREE';
type CatalogSource = 'registry' | 'mv_project' | 'music_task' | 'custom';
type PopularGradient = 'cyan' | 'emerald' | 'violet';

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

function reindex<T extends { sortOrder: number }>(items: T[]): T[] {
  return items.map((item, i) => ({ ...item, sortOrder: i }));
}

function SectionBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <p className="mt-1 text-xs text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function CatalogEntryEditor({
  entry,
  registry,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  entry: CatalogEntry;
  registry: RegistryItem[];
  onChange: (entry: CatalogEntry) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">#{entry.sortOrder + 1}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onMoveUp} className="rounded p-1 hover:bg-slate-100" aria-label="上移">
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" onClick={onMoveDown} className="rounded p-1 hover:bg-slate-100" aria-label="下移">
            <ArrowDown className="h-4 w-4" />
          </button>
          <button type="button" onClick={onRemove} className="rounded p-1 text-red-500 hover:bg-red-50" aria-label="删除">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs text-slate-600">来源</span>
          <select
            value={entry.source}
            onChange={(e) => onChange({ ...entry, source: e.target.value as CatalogSource })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="registry">Registry</option>
            <option value="mv_project">MV 项目 ID</option>
            <option value="music_task">音乐任务 ID</option>
            <option value="custom">自定义</option>
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-slate-600">徽章</span>
          <select
            value={entry.badge ?? ''}
            onChange={(e) => onChange({ ...entry, badge: (e.target.value || undefined) as DiscoveryBadge | undefined })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">无</option>
            <option value="NEW">NEW</option>
            <option value="TOP">TOP</option>
            <option value="FREE">FREE</option>
          </select>
        </label>
      </div>

      {entry.source === 'registry' && (
        <label className="block space-y-1">
          <span className="text-xs text-slate-600">Registry 项</span>
          <select
            value={entry.refId ?? ''}
            onChange={(e) => onChange({ ...entry, refId: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
        <label className="block space-y-1">
          <span className="text-xs text-slate-600">实体 ID</span>
          <input
            value={entry.refId ?? ''}
            onChange={(e) => onChange({ ...entry, refId: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
          />
        </label>
      )}

      {entry.source === 'custom' && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs text-slate-600">中文标题</span>
            <input
              value={entry.title?.zh ?? ''}
              onChange={(e) => onChange({ ...entry, title: { zh: e.target.value, en: entry.title?.en ?? '' } })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-slate-600">英文标题</span>
            <input
              value={entry.title?.en ?? ''}
              onChange={(e) => onChange({ ...entry, title: { zh: entry.title?.zh ?? '', en: e.target.value } })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1 md:col-span-2">
            <span className="text-xs text-slate-600">链接 href</span>
            <input
              value={entry.href ?? ''}
              onChange={(e) => onChange({ ...entry, href: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-slate-600">图标 key</span>
            <input
              value={entry.icon ?? 'Sparkles'}
              onChange={(e) => onChange({ ...entry, icon: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
            />
          </label>
        </div>
      )}
    </div>
  );
}

export default function DiscoveryAdminPage() {
  const queryClient = useQueryClient();
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

  const dirty =
    draft && data?.effective
      ? JSON.stringify(draft) !== JSON.stringify(data.effective)
      : false;

  const saveMutation = useMutation({
    mutationFn: (payload: DiscoveryCatalogConfig) =>
      apiClient.patch('/admin/discovery/catalog', payload) as Promise<DiscoveryCatalogResp>,
    onSuccess: (resp) => {
      queryClient.setQueryData(['admin', 'discovery', 'catalog'], resp);
      setDraft(structuredClone(resp.effective));
    },
  });

  const updateList = (
    key: 'featured' | 'trending',
    updater: (items: CatalogEntry[]) => CatalogEntry[],
  ) => {
    if (!draft) return;
    setDraft({ ...draft, [key]: reindex(updater(draft[key])) });
  };

  const updatePopular = (updater: (items: PopularCardEntry[]) => PopularCardEntry[]) => {
    if (!draft) return;
    setDraft({ ...draft, popular: reindex(updater(draft.popular)) });
  };

  if (isLoading || !draft) {
    return (
      <QueryState isLoading={isLoading} isError={isError} error={error}>
        <div />
      </QueryState>
    );
  }

  const registry = data?.registry ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Discovery 搜索运营</h1>
            <p className="mt-1 text-sm text-slate-500">
              配置全站搜索浮层的精选、热门产品与趋势位。留空数据库时使用内置默认。
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => data?.effective && setDraft(structuredClone(data.effective))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 disabled:opacity-40"
          >
            撤销
          </button>
          <button
            type="button"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate(draft)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            <Save className="h-4 w-4" />
            保存
          </button>
        </div>
      </div>

      <SectionBlock title="总开关" description="关闭后 Web 端 catalog 返回空列表（搜索仍可用）">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
          />
          启用 Discovery 运营位
        </label>
      </SectionBlock>

      <SectionBlock title="精选" description="空查询态顶部纵向列表">
        <div className="space-y-3">
          {draft.featured.map((entry, index) => (
            <CatalogEntryEditor
              key={`featured-${index}`}
              entry={entry}
              registry={registry}
              onChange={(next) =>
                updateList('featured', (items) => items.map((it, i) => (i === index ? next : it)))
              }
              onRemove={() => updateList('featured', (items) => items.filter((_, i) => i !== index))}
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
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            updateList('featured', (items) => [
              ...items,
              { sortOrder: items.length, source: 'registry', refId: 'mv-create' },
            ])
          }
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600"
        >
          <Plus className="h-4 w-4" /> 添加精选
        </button>
      </SectionBlock>

      <SectionBlock title="热门产品" description="三列渐变大卡（文案直接配置）">
        <div className="space-y-3">
          {draft.popular.map((card, index) => (
            <div key={`popular-${index}`} className="rounded-xl border border-slate-200 p-3 space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block space-y-1">
                  <span className="text-xs text-slate-600">渐变</span>
                  <select
                    value={card.gradient}
                    onChange={(e) =>
                      updatePopular((items) =>
                        items.map((it, i) =>
                          i === index ? { ...it, gradient: e.target.value as PopularGradient } : it,
                        ),
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="cyan">Cyan</option>
                    <option value="emerald">Emerald</option>
                    <option value="violet">Violet</option>
                  </select>
                </label>
                <label className="block space-y-1 md:col-span-2">
                  <span className="text-xs text-slate-600">链接</span>
                  <input
                    value={card.href}
                    onChange={(e) =>
                      updatePopular((items) =>
                        items.map((it, i) => (i === index ? { ...it, href: e.target.value } : it)),
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                  />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(['categoryLabel', 'title', 'description'] as const).map((field) => (
                  <div key={field} className="grid gap-2 md:col-span-2 md:grid-cols-2">
                    <input
                      placeholder={`${field} 中文`}
                      value={card[field].zh}
                      onChange={(e) =>
                        updatePopular((items) =>
                          items.map((it, i) =>
                            i === index
                              ? { ...it, [field]: { ...it[field], zh: e.target.value } }
                              : it,
                          ),
                        )
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <input
                      placeholder={`${field} EN`}
                      value={card[field].en}
                      onChange={(e) =>
                        updatePopular((items) =>
                          items.map((it, i) =>
                            i === index
                              ? { ...it, [field]: { ...it[field], en: e.target.value } }
                              : it,
                          ),
                        )
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
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
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600"
        >
          <Plus className="h-4 w-4" /> 添加热门卡
        </button>
      </SectionBlock>

      <SectionBlock title="趋势" description="两列小卡网格">
        <div className="space-y-3">
          {draft.trending.map((entry, index) => (
            <CatalogEntryEditor
              key={`trending-${index}`}
              entry={entry}
              registry={registry}
              onChange={(next) =>
                updateList('trending', (items) => items.map((it, i) => (i === index ? next : it)))
              }
              onRemove={() => updateList('trending', (items) => items.filter((_, i) => i !== index))}
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
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            updateList('trending', (items) => [
              ...items,
              { sortOrder: items.length, source: 'registry', refId: 'lrc' },
            ])
          }
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600"
        >
          <Plus className="h-4 w-4" /> 添加趋势
        </button>
      </SectionBlock>
    </div>
  );
}
