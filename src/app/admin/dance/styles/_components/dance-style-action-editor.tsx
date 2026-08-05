'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';

const PHRASE_FIELDS = [
  ['introPrep', '开场准备'],
  ['moveA', '基础动作 A'],
  ['moveB', '基础动作 B'],
  ['moveC', '发展动作 C'],
  ['hookMove', '副歌 Hook'],
  ['detailAccent', '单拍点缀'],
  ['freezePose', '结束定格'],
  ['crowdUpgrade', '伴舞升级'],
] as const;

export interface DanceStyleActionRow {
  id: string;
  code: string;
  nameI18n: Record<string, string> | null;
  styleRationale: string;
  bodyQuality: string;
  movementVocabulary: string[] | null;
  avoidMoves: string[] | null;
  hookDesignRule: string;
  phraseBank: Record<string, string> | null;
  version: number;
}

function arrayToLines(value: string[] | null | undefined): string {
  return (value ?? []).join('\n');
}

function linesToArray(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function DanceStyleActionEditor({
  style,
  onClose,
}: {
  style: DanceStyleActionRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [styleRationale, setStyleRationale] = useState('');
  const [bodyQuality, setBodyQuality] = useState('');
  const [movementVocabulary, setMovementVocabulary] = useState('');
  const [avoidMoves, setAvoidMoves] = useState('');
  const [hookDesignRule, setHookDesignRule] = useState('');
  const [phraseBank, setPhraseBank] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!style) return;
    setStyleRationale(style.styleRationale ?? '');
    setBodyQuality(style.bodyQuality ?? '');
    setMovementVocabulary(arrayToLines(style.movementVocabulary));
    setAvoidMoves(arrayToLines(style.avoidMoves));
    setHookDesignRule(style.hookDesignRule ?? '');
    setPhraseBank(style.phraseBank ?? {});
    setErrorMessage(null);
  }, [style]);

  const save = useMutation({
    mutationFn: () => {
      if (!style) throw new Error('舞种不存在');
      const normalizedPhraseBank = Object.fromEntries(
        PHRASE_FIELDS.map(([key]) => [key, String(phraseBank[key] ?? '').trim()]),
      );
      return apiClient.patch(`/admin/dance/styles/${style.id}`, {
        styleRationale: styleRationale.trim(),
        bodyQuality: bodyQuality.trim(),
        movementVocabulary: linesToArray(movementVocabulary),
        avoidMoves: linesToArray(avoidMoves),
        hookDesignRule: hookDesignRule.trim(),
        phraseBank: normalizedPhraseBank,
      }) as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dance', 'styles'] });
      onClose();
    },
    onError: (error: any) => {
      setErrorMessage(error?.message || '动作库保存失败，请重试。');
    },
  });

  if (!style) return null;

  const styleName = style.nameI18n?.zh || style.nameI18n?.en || style.code;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">编辑舞种动作库</h2>
            <p className="mt-1 text-xs text-slate-500">
              {styleName} · <span className="font-mono">{style.code}</span> · 版本 {style.version}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-6 text-blue-700">
            这些字段会直接进入 Dance 总编舞、段落规划和逐片段动作提示。动作应使用清楚的脚步、重心、
            上身动作和稳定落点；避免微小首饰操作、连续高频转头、身体抖动和无过渡地面动作。
            模型仍由 AI Router 配置，本页面不配置任何模型。
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <TextField
              label="风格定位"
              value={styleRationale}
              onChange={setStyleRationale}
              rows={3}
            />
            <TextField
              label="身体质感"
              value={bodyQuality}
              onChange={setBodyQuality}
              rows={3}
            />
            <TextField
              label="动作词库（每行一个）"
              value={movementVocabulary}
              onChange={setMovementVocabulary}
              rows={8}
              mono
            />
            <TextField
              label="禁用动作（每行一个）"
              value={avoidMoves}
              onChange={setAvoidMoves}
              rows={8}
              mono
            />
          </div>

          <TextField
            label="Hook 设计规则"
            value={hookDesignRule}
            onChange={setHookDesignRule}
            rows={3}
          />

          <div>
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Phrase Bank</h3>
              <p className="mt-1 text-xs text-slate-500">
                每条短语写成一个可完成的动作过程，并包含准备、主动作和结束姿势。
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {PHRASE_FIELDS.map(([key, label]) => (
                <TextField
                  key={key}
                  label={`${label} · ${key}`}
                  value={phraseBank[key] ?? ''}
                  onChange={(value) =>
                    setPhraseBank((current) => ({ ...current, [key]: value }))
                  }
                  rows={5}
                  mono
                />
              ))}
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={save.isPending}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            保存动作库
          </button>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  rows,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className={cn(
          'w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100',
          mono && 'font-mono',
        )}
      />
    </label>
  );
}
