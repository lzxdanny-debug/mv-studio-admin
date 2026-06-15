'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Sparkles, Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { resizeImageFile } from '@/lib/resize-image';
import type { CharacterPreset } from '../page';

/**
 * 新建 / 编辑 默认角色图弹窗。
 *
 * 三种用法：
 *   - mode='create' + 默认 tab='ai'：AI 生成（提交后台 fire-and-forget Nano Banana 任务）
 *   - mode='create' + 默认 tab='upload'：直接上传图片到 COS
 *   - mode='edit'：修改 name/category/subjectType，可选改 prompt（提交后是否触发 regenerate 由按钮决定）
 *
 * 设计选择：
 *   - 创建时返回 pending 行立刻成功，关闭弹窗；列表轮询观察生成结果
 *   - 编辑时不在弹窗内做轮询；让用户回列表卡片上看
 *   - 错误信息以 inline banner 展示，不弹原生 alert
 */

const CATEGORY_OPTIONS = [
  { value: '', label: '不分组' },
  { value: 'human', label: '真人' },
  { value: 'animal', label: '动物' },
  { value: 'cartoon', label: '卡通' },
  { value: 'fantasy', label: '奇幻' },
  { value: 'character', label: 'IP 角色' },
  { value: 'other', label: '其他' },
];

const SUBJECT_OPTIONS: Array<{ value: CharacterPreset['subjectType']; label: string; hint: string }> = [
  { value: 'human', label: '真人', hint: '默认；唱跳真人场景' },
  { value: 'animal_anthropomorphic', label: '动物·拟人', hint: '动物穿衣 / 站立 / 持麦' },
  { value: 'puppet_doll', label: '玩偶', hint: '布偶 / 毛绒 / 木偶' },
  { value: 'object_anthropomorphic', label: '物件·拟人', hint: '食物 / 物品 拟人化' },
];

export function CharacterPresetEditor({
  open,
  mode,
  preset,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  preset?: CharacterPreset;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<'ai' | 'upload'>('ai');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('');
  const [subjectType, setSubjectType] = useState<CharacterPreset['subjectType']>('human');
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // ─── 初始化 / 重置 ────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setErrMsg(null);
    if (mode === 'edit' && preset) {
      setName(preset.name);
      setCategory(preset.category ?? '');
      setSubjectType(preset.subjectType);
      setPrompt(preset.prompt ?? '');
      setFile(null);
      // 编辑模式默认进 ai tab；如果是直传创建的（无 prompt）就只能改 metadata，
      // upload tab 用于"替换图片"
      setTab('ai');
    } else {
      setName('');
      setCategory('');
      setSubjectType('human');
      setPrompt('');
      setFile(null);
      setTab('ai');
    }
  }, [open, mode, preset]);

  // ─── Mutations ───────────────────────────────────────

  const createAI = useMutation({
    mutationFn: () =>
      apiClient.post('/admin/mv/character-presets', {
        name,
        category: category || null,
        subjectType,
        prompt,
      }) as any,
    onSuccess: () => onSaved(),
    onError: (err: any) => setErrMsg(err?.message || '创建失败'),
  });

  const createUpload = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      // 上传前客户端缩到 ≤ 1280px / JPEG q=0.85；原图过大时显著降低 COS 体积和 Vision 调用耗时
      if (file) form.append('file', await resizeImageFile(file));
      form.append('name', name);
      if (category) form.append('category', category);
      form.append('subjectType', subjectType);
      return apiClient.post('/admin/mv/character-presets/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }) as any;
    },
    onSuccess: () => onSaved(),
    onError: (err: any) => setErrMsg(err?.message || '上传失败'),
  });

  const updateMeta = useMutation({
    mutationFn: () =>
      apiClient.patch(`/admin/mv/character-presets/${preset!.id}`, {
        name,
        category: category || null,
        subjectType,
      }) as any,
    onSuccess: () => onSaved(),
    onError: (err: any) => setErrMsg(err?.message || '保存失败'),
  });

  const updateMetaAndRegenerate = useMutation({
    mutationFn: async () => {
      // 先 patch 基础信息，再 regenerate（带新 prompt）
      await apiClient.patch(`/admin/mv/character-presets/${preset!.id}`, {
        name,
        category: category || null,
        subjectType,
      });
      return apiClient.post(`/admin/mv/character-presets/${preset!.id}/regenerate`, {
        prompt,
        subjectType,
      }) as any;
    },
    onSuccess: () => onSaved(),
    onError: (err: any) => setErrMsg(err?.message || '保存并重新生成失败'),
  });

  const replaceImage = useMutation({
    mutationFn: async () => {
      // 先 patch 基础信息，再上传新图替换
      await apiClient.patch(`/admin/mv/character-presets/${preset!.id}`, {
        name,
        category: category || null,
        subjectType,
      });
      const form = new FormData();
      // 同 createUpload：上传前先客户端缩放
      if (file) form.append('file', await resizeImageFile(file));
      return apiClient.post(`/admin/mv/character-presets/${preset!.id}/replace-image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }) as any;
    },
    onSuccess: () => onSaved(),
    onError: (err: any) => setErrMsg(err?.message || '替换图片失败'),
  });

  // ─── 提交校验 ────────────────────────────────────────
  const isBusy =
    createAI.isPending ||
    createUpload.isPending ||
    updateMeta.isPending ||
    updateMetaAndRegenerate.isPending ||
    replaceImage.isPending;

  const trimmedName = name.trim();
  const trimmedPrompt = prompt.trim();

  const aiSubmittable = trimmedName && trimmedPrompt;
  const uploadSubmittable = trimmedName && !!file;

  if (!open) return null;

  // ─── 渲染 ────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
              <ImageIcon className="h-3.5 w-3.5 text-teal-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">
              {mode === 'create' ? '新建默认角色图' : `编辑「${preset?.name}」`}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 flex-shrink-0">
          <div className="inline-flex bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setTab('ai')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all',
                tab === 'ai' ? 'bg-white shadow-sm text-teal-700' : 'text-slate-500',
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI 生成
            </button>
            <button
              onClick={() => setTab('upload')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all',
                tab === 'upload' ? 'bg-white shadow-sm text-teal-700' : 'text-slate-500',
              )}
            >
              <Upload className="h-3.5 w-3.5" />
              {mode === 'edit' ? '替换图片' : '直接上传'}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex-1 overflow-y-auto space-y-4">
          {/* 基础信息（两个 tab 共享） */}
          <div className="space-y-3">
            <FieldRow label="名称 *">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder='例如：Neon Diva'
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
              />
            </FieldRow>

            <FieldRow label="分组">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value || 'none'} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </FieldRow>

            <FieldRow label="主体类型">
              <div className="grid grid-cols-2 gap-2">
                {SUBJECT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSubjectType(opt.value)}
                    className={cn(
                      'px-3 py-2 rounded-xl border text-left text-xs transition-all',
                      subjectType === opt.value
                        ? 'border-teal-400 bg-teal-50'
                        : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <div
                      className={cn(
                        'font-medium',
                        subjectType === opt.value ? 'text-teal-700' : 'text-slate-700',
                      )}
                    >
                      {opt.label}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{opt.hint}</div>
                  </button>
                ))}
              </div>
            </FieldRow>
          </div>

          {/* Tab 内容 */}
          {tab === 'ai' ? (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <FieldRow
                label="生成 Prompt *"
                hint="用英文描述角色形象，越具体越好。建议 50-300 字符，使用 1:1 方形构图。"
              >
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                  maxLength={2000}
                  placeholder="A confident female pop star with neon pink hair, glowing makeup, futuristic stage outfit, looking at camera, studio lighting, high detail, 1:1 portrait"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 font-mono leading-relaxed"
                />
              </FieldRow>
              <div className="text-[11px] text-slate-400 leading-relaxed">
                {mode === 'create'
                  ? '点击「创建」后弹窗关闭，列表中会出现一张「生成中」的卡片；30-90 秒后自动变为「已就绪」。'
                  : '点击「保存并重新生成」会触发 Nano Banana 重新生图（覆盖现有图片）；点击「仅保存元数据」只更新名称/分组/类型。'}
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <FieldRow
                label="图片文件 *"
                hint="PNG / JPG / WEBP，最大 10MB；推荐 1:1 方形，分辨率不低于 1024×1024。"
              >
                <FilePicker file={file} onChange={setFile} />
              </FieldRow>
              {mode === 'edit' && (
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  替换图片会触发新一轮 Vision 反推（异步，约 5-15s）。
                </div>
              )}
            </div>
          )}

          {errMsg && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              {errMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2 flex-shrink-0 bg-slate-50">
          <button
            onClick={onClose}
            disabled={isBusy}
            className="px-3 py-1.5 rounded-xl text-xs text-slate-600 hover:bg-slate-100"
          >
            取消
          </button>

          {mode === 'create' && tab === 'ai' && (
            <button
              onClick={() => createAI.mutate()}
              disabled={!aiSubmittable || isBusy}
              className="px-4 py-1.5 rounded-xl text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 flex items-center gap-1.5"
            >
              {createAI.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              创建（AI 生成）
            </button>
          )}

          {mode === 'create' && tab === 'upload' && (
            <button
              onClick={() => createUpload.mutate()}
              disabled={!uploadSubmittable || isBusy}
              className="px-4 py-1.5 rounded-xl text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 flex items-center gap-1.5"
            >
              {createUpload.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              创建（直传）
            </button>
          )}

          {mode === 'edit' && tab === 'ai' && (
            <>
              <button
                onClick={() => updateMeta.mutate()}
                disabled={!trimmedName || isBusy}
                className="px-3 py-1.5 rounded-xl text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {updateMeta.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                仅保存元数据
              </button>
              <button
                onClick={() => updateMetaAndRegenerate.mutate()}
                disabled={!aiSubmittable || isBusy || !preset?.prompt}
                title={!preset?.prompt ? '该预设是直传创建，无法 AI 重生；请用「替换图片」' : undefined}
                className="px-4 py-1.5 rounded-xl text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 flex items-center gap-1.5"
              >
                {updateMetaAndRegenerate.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                保存并重新生成
              </button>
            </>
          )}

          {mode === 'edit' && tab === 'upload' && (
            <button
              onClick={() => replaceImage.mutate()}
              disabled={!uploadSubmittable || isBusy}
              className="px-4 py-1.5 rounded-xl text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 flex items-center gap-1.5"
            >
              {replaceImage.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              替换图片
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-700">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function FilePicker({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="flex items-start gap-3">
      <label className="flex-1 cursor-pointer">
        <div className="border-2 border-dashed border-slate-200 hover:border-teal-300 rounded-xl px-4 py-6 text-center transition-colors">
          <Upload className="h-5 w-5 text-slate-400 mx-auto mb-1.5" />
          <p className="text-xs text-slate-600">
            {file ? file.name : '点击选择文件'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {file
              ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
              : 'PNG / JPG / WEBP · 最大 10MB'}
          </p>
        </div>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            onChange(f);
            // 清空 value 让同一文件可以重新选
            e.target.value = '';
          }}
        />
      </label>

      {preview && (
        <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="preview" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}
