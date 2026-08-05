'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, Save, X } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { useAdminAuthStore } from '@/stores/admin-auth.store';

interface CategoryRow {
  id: string;
  code: string;
  nameZh: string;
  nameEn: string;
  descriptionZh: string | null;
  descriptionEn: string | null;
  coverUrl: string | null;
  icon: string | null;
  sortOrder: number;
  enabled: boolean;
}

type FormState = {
  code: string;
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  sortOrder: number;
  enabled: boolean;
};

const emptyForm = (): FormState => ({
  code: '',
  nameZh: '',
  nameEn: '',
  descriptionZh: '',
  sortOrder: 0,
  enabled: true,
});

const INPUT =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

export default function AdminVideoEffectCategoriesPage() {
  const qc = useQueryClient();
  const canEdit = useAdminAuthStore((s) => s.hasPermission('effects.category.edit'));
  const [editing, setEditing] = useState<CategoryRow | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<CategoryRow[]>({
    queryKey: ['admin', 'video-effects', 'categories'],
    queryFn: () => apiClient.get('/admin/video-effects/categories') as any,
  });

  const rows = [...(data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const openNew = () => {
    setForm(emptyForm());
    setEditing('new');
    setMsg(null);
  };

  const openEdit = (row: CategoryRow) => {
    setForm({
      code: row.code,
      nameZh: row.nameZh ?? '',
      nameEn: row.nameEn ?? '',
      descriptionZh: row.descriptionZh ?? '',
      sortOrder: row.sortOrder ?? 0,
      enabled: row.enabled,
    });
    setEditing(row);
    setMsg(null);
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        nameZh: form.nameZh.trim(),
        nameEn: form.nameEn.trim() || form.nameZh.trim(),
        descriptionZh: form.descriptionZh.trim() || null,
        sortOrder: form.sortOrder,
        enabled: form.enabled,
      };
      if (editing === 'new') {
        return apiClient.post('/admin/video-effects/categories', {
          ...payload,
          code: form.code.trim(),
        }) as any;
      }
      return apiClient.patch(`/admin/video-effects/categories/${(editing as CategoryRow).id}`, payload) as any;
    },
    onSuccess: () => {
      setMsg({ ok: true, text: '分类已保存。' });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'categories'] });
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '保存失败' }),
  });

  return (
    <div className="admin-page">
      <div className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Layers className="h-5 w-5 text-blue-600" />
              特效分类
            </h1>
            <p className="mt-1 text-sm text-slate-500">管理视频特效模板分类的名称、排序与启用状态。</p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              新建分类
            </button>
          )}
        </div>

        {msg && (
          <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>{msg.text}</p>
        )}

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!isLoading && !rows.length}
          emptyMessage="暂无分类"
          height="h-48"
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-2.5 text-left font-medium">名称</th>
                  <th className="w-24 px-3 py-2.5 text-right font-medium">排序</th>
                  <th className="w-20 px-3 py-2.5 text-center font-medium">启用</th>
                  <th className="w-24 px-3 py-2.5 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className={cn(!row.enabled && 'bg-slate-50/60')}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-700">{row.nameZh || row.code}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">{row.code}</p>
                      {row.descriptionZh && (
                        <p className="mt-1 max-w-md text-xs text-slate-500">{row.descriptionZh}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-slate-500">{row.sortOrder}</td>
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
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          编辑
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueryState>

        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  {editing === 'new' ? '新建分类' : '编辑分类'}
                </h2>
                <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                {editing === 'new' && (
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">Code</span>
                    <input
                      className={INPUT}
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                      placeholder="e.g. anime"
                    />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">中文名</span>
                  <input
                    className={INPUT}
                    value={form.nameZh}
                    onChange={(e) => setForm((f) => ({ ...f, nameZh: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">英文名</span>
                  <input
                    className={INPUT}
                    value={form.nameEn}
                    onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">描述</span>
                  <textarea
                    className={cn(INPUT, 'min-h-[72px]')}
                    value={form.descriptionZh}
                    onChange={(e) => setForm((f) => ({ ...f, descriptionZh: e.target.value }))}
                  />
                </label>
                <div className="flex items-center gap-4">
                  <label className="block flex-1">
                    <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">排序</span>
                    <input
                      type="number"
                      className={INPUT}
                      value={form.sortOrder}
                      onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))}
                    />
                  </label>
                  <label className="mt-5 flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                      className="accent-blue-600"
                    />
                    启用
                  </label>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-xl px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={save.isPending || !form.nameZh.trim() || (editing === 'new' && !form.code.trim())}
                  onClick={() => save.mutate()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  <Save className="h-3.5 w-3.5" />
                  {save.isPending ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
