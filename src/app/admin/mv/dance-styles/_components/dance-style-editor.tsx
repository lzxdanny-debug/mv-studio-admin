'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, RotateCcw, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import type { DanceStyleDef } from '../page';

function linesToArray(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function arrayToLines(arr: string[]): string {
  return arr.join('\n');
}

export function DanceStyleEditor({
  open,
  style,
  onClose,
}: {
  open: boolean;
  style: DanceStyleDef | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [descriptionZh, setDescriptionZh] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [styleRationale, setStyleRationale] = useState('');
  const [bodyQuality, setBodyQuality] = useState('');
  const [hookDesignRule, setHookDesignRule] = useState('');
  const [movementVocabulary, setMovementVocabulary] = useState('');
  const [avoidMoves, setAvoidMoves] = useState('');
  const [previewPrompt, setPreviewPrompt] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !style) return;
    setErrMsg(null);
    setDescriptionZh(style.descriptionZh ?? '');
    setDescriptionEn(style.descriptionEn ?? '');
    setStyleRationale(style.styleRationale ?? '');
    setBodyQuality(style.bodyQuality ?? '');
    setHookDesignRule(style.hookDesignRule ?? '');
    setMovementVocabulary(arrayToLines(style.movementVocabulary ?? []));
    setAvoidMoves(arrayToLines(style.avoidMoves ?? []));
    setPreviewPrompt(style.previewPrompt ?? '');
    setEnabled(style.enabled);
  }, [open, style]);

  const save = useMutation({
    mutationFn: () => {
      if (!style) throw new Error('no style');
      const d = style.defaults;
      const eq = (a: string, b: string) => a.trim() === b.trim();
      const eqArr = (a: string[], b: string[]) =>
        a.join('\n').trim() === b.join('\n').trim();

      const mv = linesToArray(movementVocabulary);
      const av = linesToArray(avoidMoves);

      return apiClient.patch(`/admin/mv/dance-styles/${encodeURIComponent(style.value)}`, {
        descriptionZh: eq(descriptionZh, d.descriptionZh) ? null : descriptionZh,
        descriptionEn: eq(descriptionEn, d.descriptionEn) ? null : descriptionEn,
        styleRationale: eq(styleRationale, d.styleRationale) ? null : styleRationale,
        bodyQuality: eq(bodyQuality, d.bodyQuality) ? null : bodyQuality,
        hookDesignRule: eq(hookDesignRule, d.hookDesignRule) ? null : hookDesignRule,
        movementVocabulary: eqArr(mv, d.movementVocabulary) ? null : mv,
        avoidMoves: eqArr(av, d.avoidMoves) ? null : av,
        previewPrompt: eq(previewPrompt, d.previewPrompt) ? null : previewPrompt,
        enabled: enabled === d.enabled ? null : enabled,
      }) as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'mv', 'dance-styles'] });
      onClose();
    },
    onError: (err: any) => setErrMsg(err?.message || '保存失败'),
  });

  const resetAll = useMutation({
    mutationFn: () => {
      if (!style) throw new Error('no style');
      return apiClient.delete(
        `/admin/mv/dance-styles/${encodeURIComponent(style.value)}/override`,
      ) as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'mv', 'dance-styles'] });
      onClose();
    },
    onError: (err: any) => setErrMsg(err?.message || '恢复默认失败'),
  });

  if (!open || !style) return null;

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
          <div>
            <h2 className="text-base font-semibold text-slate-900">编辑舞种 profile</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {style.labelZh} · <code className="text-[11px]">{style.value}</code>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700 leading-relaxed">
            修改 profile 字段会同时影响 MV 创意简报与分镜编舞约束；修改 preview prompt 只影响封面图生成。
            字段改回代码默认值再保存 = 清除覆盖。
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-slate-300"
            />
            在前台创建页展示此舞种
          </label>

          <Field label="中文描述（descriptionZh）" value={descriptionZh} onChange={setDescriptionZh} rows={2} />
          <Field label="英文描述（descriptionEn）" value={descriptionEn} onChange={setDescriptionEn} rows={2} mono />
          <Field label="风格 rationale" value={styleRationale} onChange={setStyleRationale} rows={2} />
          <Field label="身体质感（bodyQuality）" value={bodyQuality} onChange={setBodyQuality} rows={2} />
          <Field label="Hook 设计规则" value={hookDesignRule} onChange={setHookDesignRule} rows={2} />
          <Field
            label="动作词库（每行一个）"
            value={movementVocabulary}
            onChange={setMovementVocabulary}
            rows={5}
            mono
          />
          <Field label="禁用动作（每行一个）" value={avoidMoves} onChange={setAvoidMoves} rows={4} mono />
          <Field
            label="封面图 prompt（previewPrompt）"
            value={previewPrompt}
            onChange={setPreviewPrompt}
            rows={4}
            mono
          />

          {errMsg && (
            <div className="rounded-xl border border-red-100 bg-red-50 text-xs text-red-700 px-3 py-2">
              {errMsg}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-2 flex-shrink-0">
          <button
            onClick={() => resetAll.mutate()}
            disabled={resetAll.isPending || save.isPending || !style.hasOverride}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border',
              style.hasOverride
                ? 'border-red-200 text-red-600 hover:bg-red-50'
                : 'border-slate-200 text-slate-400 cursor-not-allowed',
              (resetAll.isPending || save.isPending) && 'opacity-50',
            )}
          >
            {resetAll.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            恢复全部默认
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending || resetAll.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
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
