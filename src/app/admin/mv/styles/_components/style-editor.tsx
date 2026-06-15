'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, RotateCcw, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import type { StyleDef } from '../page';

/**
 * 编辑风格 prompt 的模态框。
 *
 * 设计点：
 *   - 三个字段（veoKeywords / filmPreamble / descriptionZh）都是可空文本，
 *     空字符串保存为"取消覆盖回退到代码常量"
 *   - 每个字段右上角显示"已覆盖 / 默认"badge；如果已覆盖给一个"恢复默认"小按钮
 *     （恢复 = 把 textarea 重置为代码常量值，**保存后**才真正写 DB）
 *   - 底部除"保存"外还有"恢复全部默认 + 保存"按钮（调 DELETE /override）
 *   - 保存只更新 prompt，不重生预览图；保存后用户在列表卡片自行点"重新生成"
 *
 * 视觉风格对齐 character-preset-editor。
 */
export function StyleEditor({
  open,
  style,
  onClose,
}: {
  open: boolean;
  style: StyleDef | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [veoKeywords, setVeoKeywords] = useState('');
  const [filmPreamble, setFilmPreamble] = useState('');
  const [descriptionZh, setDescriptionZh] = useState('');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !style) return;
    setErrMsg(null);
    setVeoKeywords(style.veoKeywords ?? '');
    setFilmPreamble(style.filmPreamble ?? '');
    setDescriptionZh(style.descriptionZh ?? '');
  }, [open, style]);

  const save = useMutation({
    mutationFn: () => {
      if (!style) throw new Error('no style');
      // 字段对比默认值，相等 → 传 null（清除覆盖），否则传字符串
      // 这样 admin 不必专门按"恢复默认"，把内容改回默认值再保存也能清掉覆盖行
      const body: Record<string, string | null> = {};
      const eq = (cur: string, def: string | null) => cur.trim() === (def ?? '').trim();
      body.veoKeywords = eq(veoKeywords, style.defaults.veoKeywords) ? null : veoKeywords;
      body.filmPreamble = eq(filmPreamble, style.defaults.filmPreamble) ? null : filmPreamble;
      body.descriptionZh = eq(descriptionZh, style.defaults.descriptionZh)
        ? null
        : descriptionZh;
      return apiClient.patch(`/admin/mv/styles/${encodeURIComponent(style.tag)}`, body) as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'mv', 'styles'] });
      onClose();
    },
    onError: (err: any) => setErrMsg(err?.message || '保存失败'),
  });

  const resetAll = useMutation({
    mutationFn: () => {
      if (!style) throw new Error('no style');
      return apiClient.delete(`/admin/mv/styles/${encodeURIComponent(style.tag)}/override`) as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'mv', 'styles'] });
      onClose();
    },
    onError: (err: any) => setErrMsg(err?.message || '恢复默认失败'),
  });

  if (!open || !style) return null;

  const isOverridden = (
    field: 'veoKeywords' | 'filmPreamble' | 'descriptionZh',
  ): boolean => {
    return style.overrideFields.includes(field);
  };

  const FieldHeader = ({
    label,
    field,
    onResetToDefault,
  }: {
    label: string;
    field: 'veoKeywords' | 'filmPreamble' | 'descriptionZh';
    onResetToDefault: () => void;
  }) => (
    <div className="flex items-center justify-between mb-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-slate-700">{label}</label>
        {isOverridden(field) ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
            已覆盖
          </span>
        ) : (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
            默认
          </span>
        )}
      </div>
      {isOverridden(field) && (
        <button
          type="button"
          onClick={onResetToDefault}
          className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800"
          title="把本字段重置为代码常量里的默认值（保存后才生效）"
        >
          <RotateCcw className="h-3 w-3" />
          重置为默认
        </button>
      )}
    </div>
  );

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
            <h2 className="text-base font-semibold text-slate-900">编辑风格 prompt</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {style.labelZh} · <code className="text-[11px]">{style.tag}</code>
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
            修改后会**同时影响**：① admin 风格库的预览图 prompt，② 实际 MV
            生成时 Veo prompt 注入的关键词/胶片规格。
            <br />
            把字段改回代码默认值再保存 = 清除该字段的覆盖。保存后请用列表卡片上的"重新生成"按钮看新效果。
          </div>

          <div>
            <FieldHeader
              label="Veo 关键词（veoKeywords）"
              field="veoKeywords"
              onResetToDefault={() => setVeoKeywords(style.defaults.veoKeywords)}
            />
            <textarea
              value={veoKeywords}
              onChange={(e) => setVeoKeywords(e.target.value)}
              className="w-full min-h-[80px] text-xs font-mono px-3 py-2 rounded-lg border border-slate-200 focus:border-teal-400 focus:ring-1 focus:ring-teal-200 outline-none resize-y"
              placeholder="cinematic, vivid colors, ..."
            />
          </div>

          <div>
            <FieldHeader
              label="胶片/镜头前缀（filmPreamble，可空）"
              field="filmPreamble"
              onResetToDefault={() => setFilmPreamble(style.defaults.filmPreamble ?? '')}
            />
            <textarea
              value={filmPreamble}
              onChange={(e) => setFilmPreamble(e.target.value)}
              className="w-full min-h-[80px] text-xs font-mono px-3 py-2 rounded-lg border border-slate-200 focus:border-teal-400 focus:ring-1 focus:ring-teal-200 outline-none resize-y"
              placeholder="(masterpiece), best quality, shot on Kodak ..."
            />
          </div>

          <div>
            <FieldHeader
              label="中文描述（descriptionZh，admin 与 LLM 风格选择 prompt 共用）"
              field="descriptionZh"
              onResetToDefault={() => setDescriptionZh(style.defaults.descriptionZh)}
            />
            <textarea
              value={descriptionZh}
              onChange={(e) => setDescriptionZh(e.target.value)}
              className="w-full min-h-[60px] text-xs px-3 py-2 rounded-lg border border-slate-200 focus:border-teal-400 focus:ring-1 focus:ring-teal-200 outline-none resize-y"
              placeholder="风格说明…"
            />
          </div>

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
            title="一键删除该 tag 的所有 admin 覆盖字段"
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50"
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
