'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, Pencil, Plus, Save, X } from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { cn } from '@/lib/utils';

interface DanceVisualStyle {
  id: string;
  code: string;
  nameI18n: Record<string, string>;
  descriptionI18n: Record<string, string>;
  coverUrl: string;
  promptTemplate: string;
  negativePrompt: string | null;
  palette: string[];
  lighting: string;
  cameraLanguage: string;
  moodTags: string[];
  compatibleDanceStyles: string[];
  bpmRange: { min: number; max: number } | null;
  recommendedModels: string[];
  isActive: boolean;
  isPremium: boolean;
  sortOrder: number;
}

type EditorValue = Omit<DanceVisualStyle, 'id'> & { id?: string };

const WEB_ORIGIN =
  process.env.NEXT_PUBLIC_MAIN_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';

function resolveCoverUrl(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith('/') ? `${WEB_ORIGIN}${url}` : url;
}

function emptyValue(): EditorValue {
  return {
    code: '',
    nameI18n: { zh: '', en: '' },
    descriptionI18n: { zh: '', en: '' },
    coverUrl: '',
    promptTemplate: '',
    negativePrompt: '',
    palette: [],
    lighting: '',
    cameraLanguage: '',
    moodTags: [],
    compatibleDanceStyles: [],
    bpmRange: null,
    recommendedModels: [],
    isActive: true,
    isPremium: false,
    sortOrder: 0,
  };
}

function csv(value: string): string[] {
  return value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
}

export default function AdminDanceVisualStylesPage() {
  const queryClient = useQueryClient();
  const canEdit = useAdminAuthStore((state) => state.hasPermission('dance.styles.edit'));
  const [editing, setEditing] = useState<EditorValue | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const queryKey = ['admin', 'dance', 'visual-styles'];

  const { data, isLoading, isError, error } = useQuery<DanceVisualStyle[]>({
    queryKey,
    queryFn: () => apiClient.get('/admin/dance/visual-styles') as any,
  });
  const rows = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [data],
  );

  const save = useMutation({
    mutationFn: (value: EditorValue) => {
      const payload = {
        ...value,
        id: undefined,
        negativePrompt: value.negativePrompt || null,
        bpmRange:
          value.bpmRange &&
          Number.isFinite(value.bpmRange.min) &&
          Number.isFinite(value.bpmRange.max)
            ? value.bpmRange
            : null,
      };
      return value.id
        ? apiClient.patch(`/admin/dance/visual-styles/${value.id}`, payload)
        : apiClient.post('/admin/dance/visual-styles', payload);
    },
    onSuccess: () => {
      setMessage({ ok: true, text: '视觉风格已保存，并会进入后续 Agent 推荐目录。' });
      setEditing(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (saveError: any) =>
      setMessage({ ok: false, text: saveError?.message || '保存失败，请检查必填项。' }),
  });

  return (
    <div className="admin-page">
      <div className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <ImageIcon className="h-5 w-5 text-violet-600" />
              Dance 视觉风格
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              维护 Agent 可推荐的画面世界。启用项必须有真实封面，名称、封面与 Prompt
              会共同进入用户方案和最终生成链路。
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setEditing(emptyValue());
            }}
            disabled={!canEdit}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            新增视觉风格
          </button>
        </div>

        {message && (
          <p className={cn('rounded-xl px-4 py-3 text-sm font-medium', message.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
            {message.text}
          </p>
        )}

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!isLoading && !rows.length}
          emptyMessage="暂无视觉风格"
          height="h-56"
        >
          <div className="grid gap-4 xl:grid-cols-2">
            {rows.map((row) => (
              <article
                key={row.id}
                className={cn(
                  'overflow-hidden rounded-2xl border bg-white shadow-sm',
                  row.isActive ? 'border-slate-200' : 'border-slate-200 opacity-60',
                )}
              >
                <div className="flex min-h-48">
                  <div className="relative w-48 shrink-0 bg-slate-100">
                    {row.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveCoverUrl(row.coverUrl)}
                        alt={row.nameI18n?.zh || row.code}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-300">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <p className="font-mono text-[10px] text-white/75">{row.code}</p>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-bold text-slate-900">
                          {row.nameI18n?.zh || row.nameI18n?.en || row.code}
                        </h2>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                          {row.descriptionI18n?.zh || row.descriptionI18n?.en}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMessage(null);
                          setEditing({ ...row });
                        }}
                        disabled={!canEdit}
                        className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                        aria-label={`编辑 ${row.nameI18n?.zh || row.code}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {row.palette.slice(0, 3).map((item) => (
                        <span key={item} className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-medium text-violet-700">
                          {item}
                        </span>
                      ))}
                      {row.moodTags.slice(0, 3).map((item) => (
                        <span key={item} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
                          {item}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] text-slate-500">
                      <div><span className="block text-slate-400">状态</span>{row.isActive ? '已启用' : '已停用'}</div>
                      <div><span className="block text-slate-400">BPM</span>{row.bpmRange ? `${row.bpmRange.min}-${row.bpmRange.max}` : '不限'}</div>
                      <div><span className="block text-slate-400">排序</span>{row.sortOrder}</div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </QueryState>
      </div>

      {editing && (
        <VisualStyleEditor
          value={editing}
          saving={save.isPending}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={() => save.mutate(editing)}
        />
      )}
    </div>
  );
}

function VisualStyleEditor({
  value,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  value: EditorValue;
  saving: boolean;
  onChange: (value: EditorValue) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const update = <K extends keyof EditorValue>(key: K, next: EditorValue[K]) =>
    onChange({ ...value, [key]: next });
  const inputClass =
    'mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-5 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {value.id ? '编辑视觉风格' : '新增视觉风格'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">封面、名称和 Prompt 必须表达同一个画面世界。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[260px_1fr]">
          <div>
            <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
              {value.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveCoverUrl(value.coverUrl)} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-300"><ImageIcon className="h-10 w-10" /></div>
              )}
            </div>
            <label className="mt-4 block text-xs font-medium text-slate-600">
              封面地址
              <input className={inputClass} value={value.coverUrl} onChange={(event) => update('coverUrl', event.target.value)} placeholder="/images/..." />
            </label>
            <p className="mt-2 text-[11px] leading-5 text-slate-400">启用项必须配置真实封面。支持站内相对路径或 HTTPS 地址。</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="唯一代码">
              <input className={inputClass} value={value.code} disabled={!!value.id} onChange={(event) => update('code', event.target.value)} placeholder="urban-rebel-indie" />
            </Field>
            <Field label="排序">
              <input type="number" min={0} className={inputClass} value={value.sortOrder} onChange={(event) => update('sortOrder', Math.max(0, Number(event.target.value) || 0))} />
            </Field>
            <Field label="中文名称">
              <input className={inputClass} value={value.nameI18n.zh || ''} onChange={(event) => update('nameI18n', { ...value.nameI18n, zh: event.target.value })} />
            </Field>
            <Field label="英文名称">
              <input className={inputClass} value={value.nameI18n.en || ''} onChange={(event) => update('nameI18n', { ...value.nameI18n, en: event.target.value })} />
            </Field>
            <Field label="中文说明" wide>
              <textarea rows={2} className={inputClass} value={value.descriptionI18n.zh || ''} onChange={(event) => update('descriptionI18n', { ...value.descriptionI18n, zh: event.target.value })} />
            </Field>
            <Field label="视觉 Prompt" wide>
              <textarea rows={4} className={inputClass} value={value.promptTemplate} onChange={(event) => update('promptTemplate', event.target.value)} />
            </Field>
            <Field label="Negative Prompt" wide>
              <textarea rows={2} className={inputClass} value={value.negativePrompt || ''} onChange={(event) => update('negativePrompt', event.target.value)} />
            </Field>
            <Field label="色板（逗号分隔）">
              <input className={inputClass} value={value.palette.join(', ')} onChange={(event) => update('palette', csv(event.target.value))} />
            </Field>
            <Field label="情绪标签（逗号分隔）">
              <input className={inputClass} value={value.moodTags.join(', ')} onChange={(event) => update('moodTags', csv(event.target.value))} />
            </Field>
            <Field label="适配舞种代码">
              <input className={inputClass} value={value.compatibleDanceStyles.join(', ')} onChange={(event) => update('compatibleDanceStyles', csv(event.target.value))} />
            </Field>
            <Field label="推荐模型">
              <input className={inputClass} value={value.recommendedModels.join(', ')} onChange={(event) => update('recommendedModels', csv(event.target.value))} />
            </Field>
            <Field label="灯光语言">
              <textarea rows={2} className={inputClass} value={value.lighting} onChange={(event) => update('lighting', event.target.value)} />
            </Field>
            <Field label="摄影语言">
              <textarea rows={2} className={inputClass} value={value.cameraLanguage} onChange={(event) => update('cameraLanguage', event.target.value)} />
            </Field>
            <Field label="BPM 最小值">
              <input type="number" className={inputClass} value={value.bpmRange?.min ?? ''} onChange={(event) => update('bpmRange', { min: Number(event.target.value) || 0, max: value.bpmRange?.max ?? 180 })} />
            </Field>
            <Field label="BPM 最大值">
              <input type="number" className={inputClass} value={value.bpmRange?.max ?? ''} onChange={(event) => update('bpmRange', { min: value.bpmRange?.min ?? 0, max: Number(event.target.value) || 180 })} />
            </Field>
            <div className="flex items-center gap-6 md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={value.isActive} onChange={(event) => update('isActive', event.target.checked)} className="accent-violet-600" />
                启用
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={value.isPremium} onChange={(event) => update('isPremium', event.target.checked)} className="accent-violet-600" />
                会员风格
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">取消</button>
          <button type="button" onClick={onSave} disabled={saving || !value.code || !value.nameI18n.zh || !value.coverUrl || !value.promptTemplate} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40">
            <Save className="h-4 w-4" />
            {saving ? '保存中…' : '保存视觉风格'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={cn('block text-xs font-medium text-slate-600', wide && 'md:col-span-2')}>
      {label}
      {children}
    </label>
  );
}
