'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Save, X } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { useAdminAuthStore } from '@/stores/admin-auth.store';

interface PromptRow {
  id: string;
  code: string;
  systemPromptZh: string | null;
  systemPromptEn: string | null;
  userPromptTemplateZh: string;
  userPromptTemplateEn: string;
  negativePromptZh: string | null;
  negativePromptEn: string | null;
  maxChars: number;
  enabled: boolean;
  version: number;
}

type FormState = {
  code: string;
  systemPromptZh: string;
  userPromptTemplateZh: string;
  userPromptTemplateEn: string;
  negativePromptZh: string;
  maxChars: number;
  enabled: boolean;
};

const emptyForm = (): FormState => ({
  code: '',
  systemPromptZh: '',
  userPromptTemplateZh: '',
  userPromptTemplateEn: '',
  negativePromptZh: '',
  maxChars: 2000,
  enabled: true,
});

const INPUT =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

export default function AdminVideoEffectPromptsPage() {
  const qc = useQueryClient();
  const canEdit = useAdminAuthStore((s) => s.hasPermission('effects.prompt.edit'));
  const [editing, setEditing] = useState<PromptRow | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<PromptRow[]>({
    queryKey: ['admin', 'video-effects', 'prompts'],
    queryFn: () => apiClient.get('/admin/video-effects/prompts') as any,
  });

  const rows = [...(data ?? [])].sort((a, b) => a.code.localeCompare(b.code));

  const openNew = () => {
    setForm(emptyForm());
    setEditing('new');
    setMsg(null);
  };

  const openEdit = (row: PromptRow) => {
    setForm({
      code: row.code,
      systemPromptZh: row.systemPromptZh ?? '',
      userPromptTemplateZh: row.userPromptTemplateZh ?? '',
      userPromptTemplateEn: row.userPromptTemplateEn ?? '',
      negativePromptZh: row.negativePromptZh ?? '',
      maxChars: row.maxChars ?? 2000,
      enabled: row.enabled,
    });
    setEditing(row);
    setMsg(null);
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        systemPromptZh: form.systemPromptZh.trim() || null,
        userPromptTemplateZh: form.userPromptTemplateZh.trim(),
        userPromptTemplateEn: form.userPromptTemplateEn.trim(),
        negativePromptZh: form.negativePromptZh.trim() || null,
        maxChars: form.maxChars,
        enabled: form.enabled,
      };
      if (editing === 'new') {
        return apiClient.post('/admin/video-effects/prompts', {
          ...payload,
          code: form.code.trim(),
        }) as any;
      }
      return apiClient.patch(`/admin/video-effects/prompts/${(editing as PromptRow).id}`, payload) as any;
    },
    onSuccess: () => {
      setMsg({ ok: true, text: 'Prompt 已保存。' });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'prompts'] });
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '保存失败' }),
  });

  return (
    <div className="admin-page">
      <div className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <FileText className="h-5 w-5 text-blue-600" />
              Prompt 配置
            </h1>
            <p className="mt-1 text-sm text-slate-500">管理特效模板绑定的 Prompt Profile（中英文模板与负向词）。</p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              新建 Prompt
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
          emptyMessage="暂无 Prompt"
          height="h-48"
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-2.5 text-left font-medium">Code</th>
                  <th className="px-3 py-2.5 text-left font-medium">用户模板预览</th>
                  <th className="w-16 px-3 py-2.5 text-right font-medium">版本</th>
                  <th className="w-20 px-3 py-2.5 text-center font-medium">启用</th>
                  <th className="w-24 px-3 py-2.5 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className={cn(!row.enabled && 'bg-slate-50/60')}>
                    <td className="px-4 py-3">
                      <p className="font-mono text-sm font-medium text-slate-700">{row.code}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="line-clamp-2 max-w-xl text-xs text-slate-500">
                        {row.userPromptTemplateZh || row.userPromptTemplateEn}
                      </p>
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
                  {editing === 'new' ? '新建 Prompt' : `编辑 · ${(editing as PromptRow).code}`}
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
                      disabled={!canEdit}
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">System Prompt（中）</span>
                  <textarea
                    className={cn(INPUT, 'min-h-[72px]')}
                    disabled={!canEdit}
                    value={form.systemPromptZh}
                    onChange={(e) => setForm((f) => ({ ...f, systemPromptZh: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">
                    User Prompt 模板（中）*
                  </span>
                  <textarea
                    className={cn(INPUT, 'min-h-[100px]')}
                    disabled={!canEdit}
                    value={form.userPromptTemplateZh}
                    onChange={(e) => setForm((f) => ({ ...f, userPromptTemplateZh: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">
                    User Prompt 模板（英）*
                  </span>
                  <textarea
                    className={cn(INPUT, 'min-h-[100px]')}
                    disabled={!canEdit}
                    value={form.userPromptTemplateEn}
                    onChange={(e) => setForm((f) => ({ ...f, userPromptTemplateEn: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">Negative Prompt（中）</span>
                  <textarea
                    className={cn(INPUT, 'min-h-[60px]')}
                    disabled={!canEdit}
                    value={form.negativePromptZh}
                    onChange={(e) => setForm((f) => ({ ...f, negativePromptZh: e.target.value }))}
                  />
                </label>
                <div className="flex items-center gap-4">
                  <label className="block flex-1">
                    <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">最大字符</span>
                    <input
                      type="number"
                      className={INPUT}
                      disabled={!canEdit}
                      value={form.maxChars}
                      onChange={(e) => setForm((f) => ({ ...f, maxChars: Number(e.target.value) || 100 }))}
                    />
                  </label>
                  <label className="mt-5 flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
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
                  关闭
                </button>
                {canEdit && (
                  <button
                    type="button"
                    disabled={
                      save.isPending ||
                      !form.userPromptTemplateZh.trim() ||
                      !form.userPromptTemplateEn.trim() ||
                      (editing === 'new' && !form.code.trim())
                    }
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
