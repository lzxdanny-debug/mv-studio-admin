'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ListOrdered,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAlert, useConfirm } from '@/components/ui/dialog-provider';

interface ChartItemProject {
  id: string;
  title: string;
  musicFilename: string;
  styleTag: string;
  mvType: string;
  aspectRatio: string;
  resultUrl: string | null;
  remixCount: number;
  isPublic: boolean;
  status: string;
  valid: boolean;
}

interface ChartItem {
  id: string;
  projectId: string;
  rank: number;
  label: string | null;
  project: ChartItemProject | null;
}

interface Chart {
  id: string;
  nameZh: string;
  nameEn: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  items: ChartItem[];
}

interface ProjectSearchRow {
  id: string;
  title: string;
  styleTag: string;
  mvType: string;
  resultUrl: string | null;
  isPublic: boolean;
  status: string;
}

interface ProjectSearchResponse {
  items: ProjectSearchRow[];
  total: number;
}

export default function AdminMvChartsPage() {
  const qc = useQueryClient();
  const alert = useAlert();
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newChartName, setNewChartName] = useState('');

  const { data: charts, isLoading } = useQuery<Chart[]>({
    queryKey: ['admin', 'mv', 'charts'],
    queryFn: () => apiClient.get('/admin/mv/charts') as any,
  });

  const selected = useMemo(
    () => charts?.find((c) => c.id === selectedId) ?? charts?.[0] ?? null,
    [charts, selectedId],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'mv', 'charts'] });

  const createMutation = useMutation({
    mutationFn: (nameZh: string) => apiClient.post('/admin/mv/charts', { nameZh }) as any,
    onSuccess: (chart: Chart) => {
      setNewChartName('');
      setSelectedId(chart.id);
      invalidate();
    },
  });

  const updateChartMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Chart> }) =>
      apiClient.patch(`/admin/mv/charts/${id}`, patch) as any,
    onSuccess: invalidate,
  });

  const deleteChartMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/mv/charts/${id}`) as any,
    onSuccess: () => {
      setSelectedId(null);
      invalidate();
    },
  });

  const addItemMutation = useMutation({
    mutationFn: ({ chartId, projectId }: { chartId: string; projectId: string }) =>
      apiClient.post(`/admin/mv/charts/${chartId}/items`, { projectId }) as any,
    onSuccess: invalidate,
    onError: (err: any) => {
      alert({
        title: '无法加入',
        description: err?.message || '该作品无法加入歌单',
        variant: 'warning',
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({
      chartId,
      itemId,
      patch,
    }: {
      chartId: string;
      itemId: string;
      patch: { label?: string; rank?: number };
    }) => apiClient.patch(`/admin/mv/charts/${chartId}/items/${itemId}`, patch) as any,
    onSuccess: invalidate,
  });

  const removeItemMutation = useMutation({
    mutationFn: ({ chartId, itemId }: { chartId: string; itemId: string }) =>
      apiClient.delete(`/admin/mv/charts/${chartId}/items/${itemId}`) as any,
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: ({ chartId, items }: { chartId: string; items: { id: string; rank: number }[] }) =>
      apiClient.put(`/admin/mv/charts/${chartId}/items/order`, { items }) as any,
    onSuccess: invalidate,
  });

  const handleDeleteChart = async (chart: Chart) => {
    const ok = await confirm({
      title: '删除歌单',
      description: `确认删除歌单「${chart.nameZh}」及其所有条目？`,
      variant: 'danger',
      confirmText: '删除',
    });
    if (ok) deleteChartMutation.mutate(chart.id);
  };

  const moveItem = (chart: Chart, index: number, dir: -1 | 1) => {
    const ordered = [...chart.items].sort((a, b) => a.rank - b.rank);
    const target = index + dir;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const items = ordered.map((it, i) => ({ id: it.id, rank: i + 1 }));
    reorderMutation.mutate({ chartId: chart.id, items });
  };

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center gap-2">
        <ListOrdered className="h-5 w-5 text-blue-600" />
        <h1 className="text-lg font-semibold text-slate-800">首页热门榜单</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        {/* 歌单列表 */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-3">
            <div className="flex gap-2">
              <input
                value={newChartName}
                onChange={(e) => setNewChartName(e.target.value)}
                placeholder="新建歌单名称"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newChartName.trim()) {
                    createMutation.mutate(newChartName.trim());
                  }
                }}
              />
              <button
                type="button"
                disabled={!newChartName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate(newChartName.trim())}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : charts && charts.length > 0 ? (
              charts.map((chart) => (
                <button
                  key={chart.id}
                  type="button"
                  onClick={() => setSelectedId(chart.id)}
                  className={cn(
                    'mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors',
                    selected?.id === chart.id ? 'bg-blue-50' : 'hover:bg-slate-50',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{chart.nameZh}</p>
                    <p className="text-xs text-slate-400">{chart.items.length} 首</p>
                  </div>
                  <span
                    className={cn(
                      'ml-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      chart.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {chart.isActive ? '已上线' : '未上线'}
                  </span>
                </button>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">暂无歌单</p>
            )}
          </div>
        </div>

        {/* 歌单编辑 */}
        {selected ? (
          <ChartEditor
            key={selected.id}
            chart={selected}
            onRename={(nameZh, nameEn) =>
              updateChartMutation.mutate({ id: selected.id, patch: { nameZh, nameEn } })
            }
            onToggleActive={() =>
              updateChartMutation.mutate({ id: selected.id, patch: { isActive: !selected.isActive } })
            }
            onChangeSort={(sortOrder) =>
              updateChartMutation.mutate({ id: selected.id, patch: { sortOrder } })
            }
            onDelete={() => handleDeleteChart(selected)}
            onAddItem={(projectId) => addItemMutation.mutate({ chartId: selected.id, projectId })}
            onRemoveItem={(itemId) => removeItemMutation.mutate({ chartId: selected.id, itemId })}
            onUpdateLabel={(itemId, label) =>
              updateItemMutation.mutate({ chartId: selected.id, itemId, patch: { label } })
            }
            onMove={(index, dir) => moveItem(selected, index, dir)}
            addPending={addItemMutation.isPending}
          />
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-20 text-sm text-slate-400">
            请选择或新建一个歌单
          </div>
        )}
      </div>
    </div>
  );
}

function ChartEditor({
  chart,
  onRename,
  onToggleActive,
  onChangeSort,
  onDelete,
  onAddItem,
  onRemoveItem,
  onUpdateLabel,
  onMove,
  addPending,
}: {
  chart: Chart;
  onRename: (nameZh: string, nameEn: string) => void;
  onToggleActive: () => void;
  onChangeSort: (sortOrder: number) => void;
  onDelete: () => void;
  onAddItem: (projectId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateLabel: (itemId: string, label: string) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  addPending: boolean;
}) {
  const [nameZh, setNameZh] = useState(chart.nameZh);
  const [nameEn, setNameEn] = useState(chart.nameEn);
  const orderedItems = useMemo(
    () => [...chart.items].sort((a, b) => a.rank - b.rank),
    [chart.items],
  );

  const nameChanged = nameZh !== chart.nameZh || nameEn !== chart.nameEn;

  return (
    <div className="space-y-5">
      {/* 歌单元信息 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">中文名</span>
            <input
              value={nameZh}
              onChange={(e) => setNameZh(e.target.value)}
              className="w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">英文名</span>
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className="w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">排序</span>
            <input
              type="number"
              defaultValue={chart.sortOrder}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v !== chart.sortOrder) onChangeSort(v);
              }}
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </label>
          {nameChanged ? (
            <button
              type="button"
              onClick={() => onRename(nameZh.trim(), nameEn.trim())}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"
            >
              <Check className="h-4 w-4" /> 保存
            </button>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleActive}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium',
                chart.isActive
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {chart.isActive ? '已上线（点击下线）' : '未上线（点击上线）'}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" /> 删除
            </button>
          </div>
        </div>
      </div>

      {/* 加入作品 */}
      <ProjectPicker
        existingProjectIds={new Set(chart.items.map((i) => i.projectId))}
        onAdd={onAddItem}
        addPending={addPending}
      />

      {/* 条目列表 */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-700">榜单条目（{orderedItems.length}）</h3>
        </div>
        {orderedItems.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">还没有作品，从上方搜索加入</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {orderedItems.map((item, index) => (
              <ChartItemRow
                key={item.id}
                item={item}
                rank={index + 1}
                isFirst={index === 0}
                isLast={index === orderedItems.length - 1}
                onMoveUp={() => onMove(index, -1)}
                onMoveDown={() => onMove(index, 1)}
                onRemove={() => onRemoveItem(item.id)}
                onSaveLabel={(label) => onUpdateLabel(item.id, label)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ChartItemRow({
  item,
  rank,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
  onSaveLabel,
}: {
  item: ChartItem;
  rank: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onSaveLabel: (label: string) => void;
}) {
  const [label, setLabel] = useState(item.label ?? '');
  const labelChanged = label !== (item.label ?? '');
  const p = item.project;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
        {String(rank).padStart(2, '0')}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-slate-800">
            {p?.title || item.projectId}
          </p>
          {p && !p.valid ? (
            <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
              不可见（非公开/未完成）
            </span>
          ) : null}
        </div>
        <p className="truncate text-xs text-slate-400">
          {p?.styleTag} · {p?.mvType} · {p?.remixCount ?? 0} REMIX
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="副标题 label"
          className="w-40 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
        />
        {labelChanged ? (
          <button
            type="button"
            onClick={() => onSaveLabel(label.trim())}
            className="rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-medium text-white"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        ) : null}

        <div className="flex flex-col">
          <button
            type="button"
            disabled={isFirst}
            onClick={onMoveUp}
            className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={onMoveDown}
            className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="text-slate-400 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

function ProjectPicker({
  existingProjectIds,
  onAdd,
  addPending,
}: {
  existingProjectIds: Set<string>;
  onAdd: (projectId: string) => void;
  addPending: boolean;
}) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  const { data, isFetching } = useQuery<ProjectSearchResponse>({
    queryKey: ['admin', 'mv', 'charts', 'project-search', query],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('pageSize', '20');
      params.set('status', 'done');
      params.set('isPublic', 'true');
      if (query) params.set('search', query);
      return apiClient.get(`/admin/mv/projects?${params.toString()}`) as any;
    },
    enabled: true,
    placeholderData: (prev) => prev,
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQuery(search.trim());
            }}
            placeholder="搜索公开已完成的 MV（标题/文件名/风格）"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setQuery(search.trim())}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white"
        >
          搜索
        </button>
      </div>

      <div className="mt-3 max-h-64 overflow-y-auto">
        {isFetching ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : data && data.items.length > 0 ? (
          <ul className="space-y-1">
            {data.items.map((row) => {
              const added = existingProjectIds.has(row.id);
              return (
                <li
                  key={row.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{row.title}</p>
                    <p className="truncate text-xs text-slate-400">
                      {row.styleTag} · {row.mvType}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={added || addPending}
                    onClick={() => onAdd(row.id)}
                    className={cn(
                      'flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium',
                      added
                        ? 'bg-slate-100 text-slate-400'
                        : 'bg-blue-600 text-white hover:bg-blue-700',
                    )}
                  >
                    {added ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> 已加入
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" /> 加入
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-slate-400">无匹配作品</p>
        )}
      </div>
    </div>
  );
}
