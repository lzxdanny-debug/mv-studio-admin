'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Route, Save, X } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { useAdminAuthStore } from '@/stores/admin-auth.store';

interface WorkflowRow {
  id: string;
  code: string;
  name: string;
  executionMode: string;
  nodes: Array<Record<string, unknown>>;
  enabled: boolean;
  version: number;
}

const INPUT =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

export default function AdminVideoEffectWorkflowsPage() {
  const qc = useQueryClient();
  const canEdit = useAdminAuthStore((s) => s.hasPermission('effects.workflow.edit'));
  const [editing, setEditing] = useState<WorkflowRow | null>(null);
  const [form, setForm] = useState({ name: '', executionMode: '', enabled: true, nodesJson: '[]' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<WorkflowRow[]>({
    queryKey: ['admin', 'video-effects', 'workflows'],
    queryFn: () => apiClient.get('/admin/video-effects/workflows') as any,
  });

  const rows = [...(data ?? [])].sort((a, b) => a.code.localeCompare(b.code));

  const openEdit = (row: WorkflowRow) => {
    setEditing(row);
    setForm({
      name: row.name,
      executionMode: row.executionMode,
      enabled: row.enabled,
      nodesJson: JSON.stringify(row.nodes ?? [], null, 2),
    });
    setMsg(null);
  };

  const save = useMutation({
    mutationFn: () => {
      let nodes: Array<Record<string, unknown>>;
      try {
        nodes = JSON.parse(form.nodesJson);
        if (!Array.isArray(nodes)) throw new Error('nodes 须为数组');
      } catch (e: any) {
        throw new Error(e?.message || 'nodes JSON 无效');
      }
      return apiClient.patch(`/admin/video-effects/workflows/${editing!.id}`, {
        name: form.name.trim(),
        executionMode: form.executionMode,
        enabled: form.enabled,
        nodes,
      }) as any;
    },
    onSuccess: () => {
      setMsg({ ok: true, text: '工作流已保存。' });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'workflows'] });
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '保存失败' }),
  });

  return (
    <div className="admin-page">
      <div className="space-y-5 p-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Route className="h-5 w-5 text-blue-600" />
            工作流配置
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            查看执行模式与节点定义；有编辑权限时可修改名称、启用状态与 nodes JSON。
          </p>
        </div>

        {msg && (
          <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>{msg.text}</p>
        )}

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!isLoading && !rows.length}
          emptyMessage="暂无工作流"
          height="h-48"
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-2.5 text-left font-medium">工作流</th>
                  <th className="w-40 px-3 py-2.5 text-left font-medium">执行模式</th>
                  <th className="w-20 px-3 py-2.5 text-right font-medium">节点</th>
                  <th className="w-16 px-3 py-2.5 text-right font-medium">版本</th>
                  <th className="w-20 px-3 py-2.5 text-center font-medium">启用</th>
                  <th className="w-24 px-3 py-2.5 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className={cn(!row.enabled && 'bg-slate-50/60')}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-700">{row.name}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">{row.code}</p>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-500">{row.executionMode}</td>
                    <td className="px-3 py-3 text-right text-xs text-slate-500">
                      {(row.nodes ?? []).length}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-slate-500">v{row.version}</td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                          row.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {row.enabled ? '启用' : '停用'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        {canEdit ? '编辑' : '查看'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueryState>

        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  {canEdit ? '编辑工作流' : '查看工作流'} · {editing.code}
                </h2>
                <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">名称</span>
                  <input
                    className={INPUT}
                    disabled={!canEdit}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">执行模式</span>
                  <input
                    className={INPUT}
                    disabled={!canEdit}
                    value={form.executionMode}
                    onChange={(e) => setForm((f) => ({ ...f, executionMode: e.target.value }))}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={form.enabled}
                    onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                    className="accent-blue-600"
                  />
                  启用
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">Nodes JSON</span>
                  <textarea
                    className={cn(INPUT, 'min-h-[220px] font-mono text-xs')}
                    disabled={!canEdit}
                    value={form.nodesJson}
                    onChange={(e) => setForm((f) => ({ ...f, nodesJson: e.target.value }))}
                  />
                </label>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-xl px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                >
                  关闭
                </button>
                {canEdit && (
                  <button
                    type="button"
                    disabled={save.isPending || !form.name.trim()}
                    onClick={() => save.mutate()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {save.isPending ? '保存中…' : '保存'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
