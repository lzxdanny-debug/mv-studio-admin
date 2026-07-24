'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import type { KaraokeSceneTemplate } from '../page';

const ALL_MODES: Array<{ value: string; label: string }> = [
  { value: 'solo', label: 'Solo' },
  { value: 'pet', label: 'Pet' },
  { value: 'duet', label: 'Duet' },
];

interface SceneFormState {
  code: string;
  nameZh: string;
  nameEn: string;
  descriptionZh: string;
  descriptionEn: string;
  previewImageUrl: string;
  soloPrompt: string;
  petPrompt: string;
  duetPrompt: string;
  negativePrompt: string;
  allowedModes: string[];
  isActive: boolean;
  isPremium: boolean;
  sortOrder: number;
}

const EMPTY_FORM: SceneFormState = {
  code: '',
  nameZh: '',
  nameEn: '',
  descriptionZh: '',
  descriptionEn: '',
  previewImageUrl: '',
  soloPrompt: '',
  petPrompt: '',
  duetPrompt: '',
  negativePrompt: '',
  allowedModes: ['solo'],
  isActive: true,
  isPremium: false,
  sortOrder: 0,
};

export function SceneEditor({
  open,
  mode,
  scene,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  scene?: KaraokeSceneTemplate;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<SceneFormState>(EMPTY_FORM);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrMsg(null);
    if (mode === 'edit' && scene) {
      setForm({
        code: scene.code,
        nameZh: scene.nameI18n?.zh ?? '',
        nameEn: scene.nameI18n?.en ?? '',
        descriptionZh: scene.descriptionI18n?.zh ?? '',
        descriptionEn: scene.descriptionI18n?.en ?? '',
        previewImageUrl: scene.previewImageUrl ?? '',
        soloPrompt: scene.soloPrompt ?? '',
        petPrompt: scene.petPrompt ?? '',
        duetPrompt: scene.duetPrompt ?? '',
        negativePrompt: scene.negativePrompt ?? '',
        allowedModes: scene.allowedModes ?? ['solo'],
        isActive: scene.isActive,
        isPremium: scene.isPremium,
        sortOrder: scene.sortOrder,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, mode, scene]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        code: form.code.trim(),
        nameI18n: { zh: form.nameZh.trim(), en: form.nameEn.trim() },
        descriptionI18n: { zh: form.descriptionZh.trim(), en: form.descriptionEn.trim() },
        previewImageUrl: form.previewImageUrl.trim(),
        soloPrompt: form.soloPrompt.trim(),
        petPrompt: form.petPrompt.trim() || null,
        duetPrompt: form.duetPrompt.trim() || null,
        negativePrompt: form.negativePrompt.trim() || null,
        allowedModes: form.allowedModes,
        isActive: form.isActive,
        isPremium: form.isPremium,
        sortOrder: form.sortOrder,
      };
      if (mode === 'create') {
        return apiClient.post('/admin/karaoke/scenes', payload) as any;
      }
      return apiClient.patch(`/admin/karaoke/scenes/${scene?.id}`, payload) as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'karaoke', 'scenes'] });
      onSaved();
    },
    onError: (err: any) => setErrMsg(err?.message || '保存失败'),
  });

  const toggleMode = (value: string) => {
    setForm((prev) => ({
      ...prev,
      allowedModes: prev.allowedModes.includes(value)
        ? prev.allowedModes.filter((m) => m !== value)
        : [...prev.allowedModes, value],
    }));
  };

  if (!open) return null;

  const canSubmit =
    form.code.trim().length > 0 && form.nameZh.trim().length > 0 && form.soloPrompt.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-semibold text-slate-900">
            {mode === 'create' ? '新建演唱场景' : '编辑演唱场景'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="唯一标识（code）"
              value={form.code}
              onChange={(v) => setForm((p) => ({ ...p, code: v }))}
              placeholder="studio"
              disabled={mode === 'edit'}
              mono
            />
            <Field
              label="预览图 URL"
              value={form.previewImageUrl}
              onChange={(v) => setForm((p) => ({ ...p, previewImageUrl: v }))}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="中文名称"
              value={form.nameZh}
              onChange={(v) => setForm((p) => ({ ...p, nameZh: v }))}
              placeholder="录音室"
            />
            <Field
              label="English name"
              value={form.nameEn}
              onChange={(v) => setForm((p) => ({ ...p, nameEn: v }))}
              placeholder="Studio"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextArea
              label="中文描述"
              value={form.descriptionZh}
              onChange={(v) => setForm((p) => ({ ...p, descriptionZh: v }))}
              rows={2}
            />
            <TextArea
              label="English description"
              value={form.descriptionEn}
              onChange={(v) => setForm((p) => ({ ...p, descriptionEn: v }))}
              rows={2}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 mb-1.5 block">适用模式</label>
            <div className="flex items-center gap-3">
              {ALL_MODES.map((m) => (
                <label key={m.value} className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.allowedModes.includes(m.value)}
                    onChange={() => toggleMode(m.value)}
                    className="rounded border-slate-300"
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>

          <TextArea
            label="Solo 场景 Prompt（必填）"
            value={form.soloPrompt}
            onChange={(v) => setForm((p) => ({ ...p, soloPrompt: v }))}
            rows={4}
            mono
          />
          <TextArea
            label="Pet 场景 Prompt（可选，Pet 模式启用后生效）"
            value={form.petPrompt}
            onChange={(v) => setForm((p) => ({ ...p, petPrompt: v }))}
            rows={3}
            mono
          />
          <TextArea
            label="Duet 场景 Prompt（可选，Duet 模式启用后生效）"
            value={form.duetPrompt}
            onChange={(v) => setForm((p) => ({ ...p, duetPrompt: v }))}
            rows={3}
            mono
          />
          <TextArea
            label="负面 Prompt（可选）"
            value={form.negativePrompt}
            onChange={(v) => setForm((p) => ({ ...p, negativePrompt: v }))}
            rows={2}
            mono
          />

          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                启用
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isPremium}
                  onChange={(e) => setForm((p) => ({ ...p, isPremium: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                会员专属
              </label>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1.5 block">排序</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none text-sm"
              />
            </div>
          </div>

          {errMsg && (
            <div className="rounded-xl border border-red-100 bg-red-50 text-xs text-red-700 px-3 py-2">
              {errMsg}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !canSubmit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-700 mb-1.5 block">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none text-sm disabled:opacity-60 disabled:bg-slate-50',
          mono && 'font-mono text-xs',
        )}
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-700 mb-1.5 block">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={cn(
          'w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none resize-y text-xs',
          mono && 'font-mono',
        )}
      />
    </div>
  );
}
