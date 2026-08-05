'use client';

/**
 * Dance 内容配置的通用列表页：舞种、编舞模板、场景模板结构相同（i18n 名称 + 启用/会员/排序），
 * 因此共用一个列表壳，只用 extraColumns 表达各自的差异字段。
 *
 * Phase 0 只开放启用状态、会员标记与排序的编辑；提示词、动作词库、段落蓝图等
 * 深度字段的编辑器随对应能力上线后再补。
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Save, type LucideIcon } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { useAdminAuthStore } from '@/stores/admin-auth.store';

export interface DanceTemplateRow {
  id: string;
  code: string;
  nameI18n: Record<string, string> | null;
  descriptionI18n: Record<string, string> | null;
  isActive: boolean;
  isPremium: boolean;
  sortOrder: number;
}

interface RowEdit {
  isActive: boolean;
  isPremium: boolean;
  sortOrder: number;
}

export function pickName(row: DanceTemplateRow): string {
  return row.nameI18n?.zh || row.nameI18n?.en || row.code;
}

export function pickDescription(row: DanceTemplateRow): string {
  return row.descriptionI18n?.zh || row.descriptionI18n?.en || '';
}

export function DanceTemplateList<T extends DanceTemplateRow>({
  title,
  description,
  icon: Icon,
  endpoint,
  queryKey,
  editPermission,
  extraColumns = [],
  onEdit,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  endpoint: string;
  queryKey: string[];
  editPermission: string;
  extraColumns?: Array<{ key: string; header: string; width?: string; render: (row: T) => ReactNode }>;
  onEdit?: (row: T) => void;
}) {
  const qc = useQueryClient();
  const canEdit = useAdminAuthStore((s) => s.hasPermission(editPermission));
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<T[]>({
    queryKey,
    queryFn: () => apiClient.get(endpoint) as any,
  });

  const rows = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [data],
  );

  const current = (row: T): RowEdit =>
    edits[row.id] ?? {
      isActive: row.isActive,
      isPremium: row.isPremium,
      sortOrder: row.sortOrder,
    };

  const isDirty = (row: T): boolean => {
    const e = edits[row.id];
    if (!e) return false;
    return (
      e.isActive !== row.isActive ||
      e.isPremium !== row.isPremium ||
      e.sortOrder !== row.sortOrder
    );
  };

  const save = useMutation({
    mutationFn: (row: T) => {
      const e = current(row);
      return apiClient.patch(`${endpoint}/${row.id}`, {
        isActive: e.isActive,
        isPremium: e.isPremium,
        sortOrder: e.sortOrder,
      }) as any;
    },
    onSuccess: (_res, row) => {
      setMsg({ ok: true, text: `${pickName(row)} 已保存。` });
      setEdits((m) => {
        const next = { ...m };
        delete next[row.id];
        return next;
      });
      qc.invalidateQueries({ queryKey });
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '保存失败，请重试。' }),
  });

  return (
    <div className="admin-page">
      <div className="space-y-5 p-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Icon className="h-5 w-5 text-blue-600" />
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!isLoading && !rows.length}
          emptyMessage="暂无数据"
          height="h-48"
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-2.5 text-left font-medium">名称</th>
                  {extraColumns.map((c) => (
                    <th key={c.key} className={cn('px-3 py-2.5 text-left font-medium', c.width)}>
                      {c.header}
                    </th>
                  ))}
                  <th className="w-20 px-3 py-2.5 text-center font-medium">启用</th>
                  <th className="w-20 px-3 py-2.5 text-center font-medium">会员</th>
                  <th className="w-24 px-3 py-2.5 text-right font-medium">排序</th>
                  <th
                    className={cn(
                      'px-3 py-2.5 text-center font-medium',
                      onEdit ? 'w-40' : 'w-24',
                    )}
                  >
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const e = current(row);
                  const dirty = isDirty(row);
                  return (
                    <tr key={row.id} className={cn(!e.isActive && 'bg-slate-50/60')}>
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium text-slate-700">{pickName(row)}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-400">{row.code}</p>
                        {pickDescription(row) && (
                          <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">
                            {pickDescription(row)}
                          </p>
                        )}
                      </td>
                      {extraColumns.map((c) => (
                        <td key={c.key} className="px-3 py-3 align-top text-xs text-slate-500">
                          {c.render(row)}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center align-top">
                        <input
                          type="checkbox"
                          checked={e.isActive}
                          disabled={!canEdit}
                          onChange={(ev) =>
                            setEdits((m) => ({ ...m, [row.id]: { ...e, isActive: ev.target.checked } }))
                          }
                          className="accent-blue-600 disabled:opacity-60"
                        />
                      </td>
                      <td className="px-3 py-3 text-center align-top">
                        <input
                          type="checkbox"
                          checked={e.isPremium}
                          disabled={!canEdit}
                          onChange={(ev) =>
                            setEdits((m) => ({ ...m, [row.id]: { ...e, isPremium: ev.target.checked } }))
                          }
                          className="accent-blue-600 disabled:opacity-60"
                        />
                      </td>
                      <td className="px-3 py-3 text-right align-top">
                        <input
                          type="number"
                          min={0}
                          value={e.sortOrder}
                          disabled={!canEdit}
                          onChange={(ev) =>
                            setEdits((m) => ({
                              ...m,
                              [row.id]: {
                                ...e,
                                sortOrder: Math.max(0, Math.round(Number(ev.target.value))),
                              },
                            }))
                          }
                          className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                        />
                      </td>
                      <td className="px-3 py-3 text-center align-top">
                        <div className="flex items-center justify-center gap-1.5">
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() => onEdit(row)}
                              disabled={!canEdit}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-30"
                            >
                              <Pencil className="h-3 w-3" />
                              编辑
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setMsg(null);
                              save.mutate(row);
                            }}
                            disabled={!canEdit || !dirty || save.isPending}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-30"
                          >
                            <Save className="h-3 w-3" />
                            保存
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </QueryState>

        {msg && (
          <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
            {msg.text}
          </p>
        )}

        {!canEdit && (
          <p className="text-xs text-amber-600">
            当前账号无 {editPermission}，只能查看。
          </p>
        )}
      </div>
    </div>
  );
}
