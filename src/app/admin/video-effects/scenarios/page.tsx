'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, Plus, Save, X } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { useAdminAuthStore } from '@/stores/admin-auth.store';

interface ScenarioRow {
  id: string;
  code: string;
  nameZh: string;
  nameEn: string;
  subjectType: string;
  minSubjects: number;
  maxSubjects: number;
  minImages: number;
  maxImages: number;
  sameImageRequired: boolean;
  allowRealPerson: boolean;
  minResolution: number;
  maxFileSizeMb: number;
  safetyLevel: string;
  enabled: boolean;
}

type FormState = {
  code: string;
  nameZh: string;
  nameEn: string;
  subjectType: string;
  minSubjects: number;
  maxSubjects: number;
  minImages: number;
  maxImages: number;
  sameImageRequired: boolean;
  allowRealPerson: boolean;
  minResolution: number;
  maxFileSizeMb: number;
  safetyLevel: string;
  enabled: boolean;
};

const emptyForm = (): FormState => ({
  code: '',
  nameZh: '',
  nameEn: '',
  subjectType: 'person',
  minSubjects: 1,
  maxSubjects: 1,
  minImages: 1,
  maxImages: 1,
  sameImageRequired: false,
  allowRealPerson: true,
  minResolution: 512,
  maxFileSizeMb: 20,
  safetyLevel: 'standard',
  enabled: true,
});

const INPUT =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

export default function AdminVideoEffectScenariosPage() {
  const qc = useQueryClient();
  const canEdit = useAdminAuthStore((s) => s.hasPermission('effects.scenario.edit'));
  const [editing, setEditing] = useState<ScenarioRow | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<ScenarioRow[]>({
    queryKey: ['admin', 'video-effects', 'scenarios'],
    queryFn: () => apiClient.get('/admin/video-effects/scenarios') as any,
  });

  const rows = [...(data ?? [])].sort((a, b) => a.code.localeCompare(b.code));

  const openNew = () => {
    setForm(emptyForm());
    setEditing('new');
    setMsg(null);
  };

  const openEdit = (row: ScenarioRow) => {
    setForm({
      code: row.code,
      nameZh: row.nameZh ?? '',
      nameEn: row.nameEn ?? '',
      subjectType: row.subjectType ?? 'person',
      minSubjects: row.minSubjects ?? 1,
      maxSubjects: row.maxSubjects ?? 1,
      minImages: row.minImages ?? 1,
      maxImages: row.maxImages ?? 1,
      sameImageRequired: row.sameImageRequired ?? false,
      allowRealPerson: row.allowRealPerson ?? true,
      minResolution: row.minResolution ?? 512,
      maxFileSizeMb: row.maxFileSizeMb ?? 20,
      safetyLevel: row.safetyLevel ?? 'standard',
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
        subjectType: form.subjectType,
        minSubjects: form.minSubjects,
        maxSubjects: form.maxSubjects,
        minImages: form.minImages,
        maxImages: form.maxImages,
        sameImageRequired: form.sameImageRequired,
        allowRealPerson: form.allowRealPerson,
        minResolution: form.minResolution,
        maxFileSizeMb: form.maxFileSizeMb,
        safetyLevel: form.safetyLevel,
        enabled: form.enabled,
      };
      if (editing === 'new') {
        return apiClient.post('/admin/video-effects/scenarios', {
          ...payload,
          code: form.code.trim(),
        }) as any;
      }
      return apiClient.patch(`/admin/video-effects/scenarios/${(editing as ScenarioRow).id}`, payload) as any;
    },
    onSuccess: () => {
      setMsg({ ok: true, text: '场景已保存。' });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'scenarios'] });
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '保存失败' }),
  });

  return (
    <div className="admin-page">
      <div className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <ImageIcon className="h-5 w-5 text-blue-600" />
              输入场景
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              定义模板可用的输入约束：主体类型、图片数量、分辨率与安全等级。
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              新建场景
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
          emptyMessage="暂无场景"
          height="h-48"
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-2.5 text-left font-medium">场景</th>
                  <th className="w-28 px-3 py-2.5 text-left font-medium">主体</th>
                  <th className="w-28 px-3 py-2.5 text-left font-medium">图片数</th>
                  <th className="w-24 px-3 py-2.5 text-left font-medium">安全</th>
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
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {row.subjectType} · {row.minSubjects}-{row.maxSubjects}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {row.minImages}-{row.maxImages}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">{row.safetyLevel}</td>
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
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  {editing === 'new' ? '新建场景' : '编辑场景'}
                </h2>
                <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {editing === 'new' && (
                  <label className="col-span-2 block">
                    <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">Code</span>
                    <input
                      className={INPUT}
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
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
                  <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">主体类型</span>
                  <input
                    className={INPUT}
                    value={form.subjectType}
                    onChange={(e) => setForm((f) => ({ ...f, subjectType: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">安全等级</span>
                  <input
                    className={INPUT}
                    value={form.safetyLevel}
                    onChange={(e) => setForm((f) => ({ ...f, safetyLevel: e.target.value }))}
                  />
                </label>
                {(
                  [
                    ['minSubjects', '最少主体'],
                    ['maxSubjects', '最多主体'],
                    ['minImages', '最少图片'],
                    ['maxImages', '最多图片'],
                    ['minResolution', '最低分辨率'],
                    ['maxFileSizeMb', '最大文件(MB)'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="mb-1 block text-[11px] font-medium uppercase text-slate-400">{label}</span>
                    <input
                      type="number"
                      className={INPUT}
                      value={form[key]}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [key]: Number(e.target.value) || 0 }))
                      }
                    />
                  </label>
                ))}
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.sameImageRequired}
                    onChange={(e) => setForm((f) => ({ ...f, sameImageRequired: e.target.checked }))}
                    className="accent-blue-600"
                  />
                  要求同图
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.allowRealPerson}
                    onChange={(e) => setForm((f) => ({ ...f, allowRealPerson: e.target.checked }))}
                    className="accent-blue-600"
                  />
                  允许真人
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                    className="accent-blue-600"
                  />
                  启用
                </label>
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
