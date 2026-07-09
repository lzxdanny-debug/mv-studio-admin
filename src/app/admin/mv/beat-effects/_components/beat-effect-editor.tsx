'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, RotateCcw, Loader2, Trash2 } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/dialog-provider';
import type { BeatEffectDef } from '../page';

const ASPECT_OPTIONS = [
  { value: 'portrait', label: '竖版 portrait' },
  { value: 'landscape', label: '横版 landscape' },
  { value: 'square', label: '方形 square' },
] as const;

const ACCENT_OPTIONS = ['cyan', 'green', 'violet', 'rose', 'amber'] as const;

const PATTERN_OPTIONS = ['pulse', 'split', 'flash', 'orbit', 'shake', 'freeze'] as const;

function tagsToLines(tags: string[]): string {
  return tags.join('\n');
}

function linesToTags(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function slugifyId(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function BeatEffectEditor({
  open,
  mode = 'edit',
  template,
  onClose,
}: {
  open: boolean;
  mode?: 'create' | 'edit';
  template: BeatEffectDef | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const isCreate = mode === 'create';

  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [desc, setDesc] = useState('');
  const [descEn, setDescEn] = useState('');
  const [prompt, setPrompt] = useState('');
  const [promptEn, setPromptEn] = useState('');
  const [cover, setCover] = useState('');
  const [coverPrompt, setCoverPrompt] = useState('');
  const [aspect, setAspect] = useState<BeatEffectDef['aspect']>('landscape');
  const [tags, setTags] = useState('effects');
  const [accent, setAccent] = useState<BeatEffectDef['accent']>('cyan');
  const [pattern, setPattern] = useState<BeatEffectDef['pattern']>('pulse');
  const [styleTag, setStyleTag] = useState('highEnergy');
  const [sortOrder, setSortOrder] = useState(110);
  const [enabled, setEnabled] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrMsg(null);
    if (isCreate) {
      setId('');
      setTitle('');
      setTitleEn('');
      setDesc('');
      setDescEn('');
      setPrompt('');
      setPromptEn('');
      setCover('');
      setCoverPrompt('');
      setAspect('landscape');
      setTags('effects');
      setAccent('cyan');
      setPattern('pulse');
      setStyleTag('highEnergy');
      setSortOrder(110);
      setEnabled(true);
      return;
    }
    if (!template) return;
    setId(template.id);
    setTitle(template.title ?? '');
    setTitleEn(template.titleEn ?? '');
    setDesc(template.desc ?? '');
    setDescEn(template.descEn ?? '');
    setPrompt(template.prompt ?? '');
    setPromptEn(template.promptEn ?? '');
    setCover(template.cover ?? '');
    setCoverPrompt(template.coverPrompt ?? '');
    setAspect(template.aspect);
    setTags(tagsToLines(template.tags ?? []));
    setAccent(template.accent);
    setPattern(template.pattern);
    setStyleTag(template.styleTag ?? '');
    setSortOrder(template.sortOrder);
    setEnabled(template.enabled);
  }, [open, template, isCreate]);

  const save = useMutation({
    mutationFn: () => {
      const tagArr = linesToTags(tags);

      if (isCreate) {
        const normalizedId = slugifyId(id || titleEn || title);
        if (!normalizedId) throw new Error('请填写 id 或英文标题');
        return apiClient.post('/admin/mv/beat-effects', {
          id: normalizedId,
          title: title.trim(),
          titleEn: titleEn.trim(),
          desc: desc.trim(),
          descEn: descEn.trim(),
          prompt: prompt.trim(),
          promptEn: promptEn.trim(),
          cover: cover.trim() || undefined,
          coverPrompt: coverPrompt.trim() || undefined,
          aspect,
          tags: tagArr,
          accent,
          pattern,
          styleTag: styleTag.trim() || 'highEnergy',
          sortOrder,
          enabled,
        }) as any;
      }

      if (!template) throw new Error('no template');
      const d = template.defaults;
      const eq = (a: string, b: string) => a.trim() === b.trim();
      const eqArr = (a: string[], b: string[]) =>
        a.join('\n').trim() === b.join('\n').trim();

      if (template.isCustom) {
        return apiClient.patch(`/admin/mv/beat-effects/${encodeURIComponent(template.id)}`, {
          title: title.trim(),
          titleEn: titleEn.trim(),
          desc: desc.trim(),
          descEn: descEn.trim(),
          prompt: prompt.trim(),
          promptEn: promptEn.trim(),
          cover: cover.trim(),
          coverPrompt: coverPrompt.trim(),
          aspect,
          tags: tagArr,
          accent,
          pattern,
          styleTag: styleTag.trim(),
          sortOrder,
          enabled,
        }) as any;
      }

      return apiClient.patch(`/admin/mv/beat-effects/${encodeURIComponent(template.id)}`, {
        title: eq(title, d.title) ? null : title,
        titleEn: eq(titleEn, d.titleEn) ? null : titleEn,
        desc: eq(desc, d.desc) ? null : desc,
        descEn: eq(descEn, d.descEn) ? null : descEn,
        prompt: eq(prompt, d.prompt) ? null : prompt,
        promptEn: eq(promptEn, d.promptEn) ? null : promptEn,
        cover: eq(cover, d.cover) ? null : cover,
        coverPrompt: eq(coverPrompt, d.coverPrompt) ? null : coverPrompt,
        aspect: aspect === d.aspect ? null : aspect,
        tags: eqArr(tagArr, d.tags) ? null : tagArr,
        accent: accent === d.accent ? null : accent,
        pattern: pattern === d.pattern ? null : pattern,
        styleTag: eq(styleTag, d.styleTag) ? null : styleTag,
        sortOrder: sortOrder === d.sortOrder ? null : sortOrder,
        enabled: enabled === d.enabled ? null : enabled,
      }) as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'mv', 'beat-effects'] });
      onClose();
    },
    onError: (err: any) => setErrMsg(err?.message || '保存失败'),
  });

  const resetAll = useMutation({
    mutationFn: () => {
      if (!template) throw new Error('no template');
      return apiClient.delete(
        `/admin/mv/beat-effects/${encodeURIComponent(template.id)}/override`,
      ) as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'mv', 'beat-effects'] });
      onClose();
    },
    onError: (err: any) => setErrMsg(err?.message || '恢复默认失败'),
  });

  const removeCustom = useMutation({
    mutationFn: () => {
      if (!template) throw new Error('no template');
      return apiClient.delete(`/admin/mv/beat-effects/${encodeURIComponent(template.id)}`) as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'mv', 'beat-effects'] });
      onClose();
    },
    onError: (err: any) => setErrMsg(err?.message || '删除失败'),
  });

  if (!open || (!isCreate && !template)) return null;

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
            <h2 className="text-base font-semibold text-slate-900">
              {isCreate ? '添加节拍特效' : '编辑节拍特效模板'}
            </h2>
            {!isCreate && template && (
              <p className="text-xs text-slate-500 mt-0.5">
                {template.title} · <code className="text-[11px]">{template.id}</code>
                {template.isCustom && (
                  <span className="ml-2 text-blue-600 font-medium">自定义</span>
                )}
              </p>
            )}
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
            {isCreate
              ? '新建模板会写入数据库并在 C 端 /beat-effects 展示。id 建议使用小写英文连字符，创建后可「重新生成」封面。'
              : template?.isCustom
                ? '自定义模板修改后直接保存；可删除模板或重新生成封面。'
                : '修改生成 prompt 会影响 video-generator 节拍模式；修改 cover prompt 只影响封面图生成。字段改回代码默认值再保存 = 清除覆盖。'}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-slate-300"
            />
            在 C 端 /beat-effects 展示此模板
          </label>

          {isCreate && (
            <Field
              label="模板 id（小写连字符，如 neon-burst）"
              value={id}
              onChange={setId}
              rows={1}
              mono
              placeholder={slugifyId(titleEn || title) || 'my-beat-effect'}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="排序（sortOrder）" value={String(sortOrder)} onChange={(v) => setSortOrder(Number(v) || 0)} rows={1} />
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1.5 block">styleTag</label>
              <input
                value={styleTag}
                onChange={(e) => setStyleTag(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none text-xs font-mono"
              />
            </div>
          </div>

          <Field label="中文标题" value={title} onChange={setTitle} rows={1} />
          <Field label="英文标题（titleEn）" value={titleEn} onChange={setTitleEn} rows={1} mono />
          <Field label="中文描述" value={desc} onChange={setDesc} rows={2} />
          <Field label="英文描述（descEn）" value={descEn} onChange={setDescEn} rows={2} mono />
          <Field label="生成 prompt（中文）" value={prompt} onChange={setPrompt} rows={3} />
          <Field label="生成 prompt（英文 promptEn）" value={promptEn} onChange={setPromptEn} rows={3} mono />
          <Field label="封面 URL（cover，静态 fallback）" value={cover} onChange={setCover} rows={2} mono />
          <Field
            label="封面图 prompt（coverPrompt，留空则自动生成）"
            value={coverPrompt}
            onChange={setCoverPrompt}
            rows={4}
            mono
          />

          <div className="grid grid-cols-3 gap-3">
            <SelectField
              label="宽高比 aspect"
              value={aspect}
              onChange={(v) => setAspect(v as BeatEffectDef['aspect'])}
              options={ASPECT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <SelectField
              label="accent"
              value={accent}
              onChange={(v) => setAccent(v as BeatEffectDef['accent'])}
              options={ACCENT_OPTIONS.map((o) => ({ value: o, label: o }))}
            />
            <SelectField
              label="pattern"
              value={pattern}
              onChange={(v) => setPattern(v as BeatEffectDef['pattern'])}
              options={PATTERN_OPTIONS.map((o) => ({ value: o, label: o }))}
            />
          </div>

          <Field
            label="标签 tags（每行一个或逗号分隔）"
            value={tags}
            onChange={setTags}
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
          {!isCreate && template?.isCustom ? (
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: '删除此自定义模板？',
                  description: `将永久删除「${template.title}」，不可恢复。`,
                  variant: 'danger',
                  confirmText: '删除',
                });
                if (ok) removeCustom.mutate();
              }}
              disabled={removeCustom.isPending || save.isPending}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50',
                (removeCustom.isPending || save.isPending) && 'opacity-50',
              )}
            >
              {removeCustom.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              删除模板
            </button>
          ) : !isCreate ? (
            <button
              onClick={() => resetAll.mutate()}
              disabled={resetAll.isPending || save.isPending || !template?.hasOverride}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border',
                template?.hasOverride
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
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending || resetAll.isPending || removeCustom.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isCreate ? '创建' : '保存'}
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  mono?: boolean;
  placeholder?: string;
}) {
  const isSingleLine = rows === 1;
  const className = cn(
    'w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none text-xs',
    mono && 'font-mono',
    !isSingleLine && 'resize-y',
  );

  return (
    <div>
      <label className="text-xs font-medium text-slate-700 mb-1.5 block">{label}</label>
      {isSingleLine ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
        />
      ) : (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={className} />
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-700 mb-1.5 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none text-xs bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
