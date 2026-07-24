'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Image as ImageIcon,
  Plus,
  Pencil,
  Trash2,
  ImageOff,
  Loader2,
  X,
  Crown,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Save,
  UserRound,
  Wand2,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { useConfirm, useAlert } from '@/components/ui/dialog-provider';

export interface KaraokeSceneTemplate {
  id: string;
  code: string;
  nameI18n: Record<string, string>;
  descriptionI18n: Record<string, string>;
  previewImageUrl: string;
  soloPrompt: string;
  petPrompt: string | null;
  duetPrompt: string | null;
  negativePrompt: string | null;
  allowedModes: string[];
  isActive: boolean;
  isPremium: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

type ScenePreviewConfig = {
  referenceImageUrl: string;
  effectiveReferenceImageUrl: string;
  source: 'configured' | 'custom_scene' | 'none';
};

type SceneFormState = {
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
};

const MODE_OPTIONS: Array<{ value: 'solo' | 'pet' | 'duet'; label: string }> = [
  { value: 'solo', label: 'Solo' },
  { value: 'pet', label: 'Pet' },
  { value: 'duet', label: 'Duet' },
];

function emptyForm(): SceneFormState {
  return {
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
}

function toForm(s: KaraokeSceneTemplate): SceneFormState {
  return {
    code: s.code,
    nameZh: s.nameI18n?.zh ?? '',
    nameEn: s.nameI18n?.en ?? '',
    descriptionZh: s.descriptionI18n?.zh ?? '',
    descriptionEn: s.descriptionI18n?.en ?? '',
    previewImageUrl: s.previewImageUrl ?? '',
    soloPrompt: s.soloPrompt ?? '',
    petPrompt: s.petPrompt ?? '',
    duetPrompt: s.duetPrompt ?? '',
    negativePrompt: s.negativePrompt ?? '',
    allowedModes: s.allowedModes ?? ['solo'],
    isActive: s.isActive,
    isPremium: s.isPremium,
    sortOrder: s.sortOrder ?? 0,
  };
}

function toPayload(f: SceneFormState) {
  return {
    code: f.code.trim(),
    nameI18n: { zh: f.nameZh.trim(), en: f.nameEn.trim() },
    descriptionI18n: { zh: f.descriptionZh.trim(), en: f.descriptionEn.trim() },
    previewImageUrl: f.previewImageUrl.trim(),
    soloPrompt: f.soloPrompt.trim(),
    petPrompt: f.petPrompt.trim() || null,
    duetPrompt: f.duetPrompt.trim() || null,
    negativePrompt: f.negativePrompt.trim() || null,
    allowedModes: f.allowedModes,
    isActive: f.isActive,
    isPremium: f.isPremium,
    sortOrder: f.sortOrder,
  };
}

const INPUT =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100';
const LABEL = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400';

export default function AdminKaraokeScenesPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const alert = useAlert();
  const canEdit = useAdminAuthStore((s) => s.hasPermission('karaoke.scenes.edit'));
  const [editing, setEditing] = useState<KaraokeSceneTemplate | 'new' | null>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState('');

  const { data, isLoading, isError, error } = useQuery<KaraokeSceneTemplate[]>({
    queryKey: ['admin', 'karaoke', 'scenes'],
    queryFn: () => apiClient.get('/admin/karaoke/scenes') as any,
  });

  const { data: previewConfig } = useQuery<ScenePreviewConfig>({
    queryKey: ['admin', 'karaoke', 'scenes', 'preview-config'],
    queryFn: () => apiClient.get('/admin/karaoke/scenes/preview-config') as any,
  });

  useEffect(() => {
    setReferenceImageUrl(previewConfig?.referenceImageUrl ?? '');
  }, [previewConfig?.referenceImageUrl]);

  const savePreviewConfig = useMutation({
    mutationFn: () =>
      apiClient.put('/admin/karaoke/scenes/preview-config', {
        referenceImageUrl: referenceImageUrl.trim(),
      }) as any,
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['admin', 'karaoke', 'scenes', 'preview-config'],
      });
      await alert({
        title: '示例人物已保存',
        description: '之后重新生成录音棚场景图时，将使用这张人物图保持身份和构图一致。',
      });
    },
    onError: async (err: any) => {
      await alert({
        title: '保存失败',
        description: err?.message ?? String(err),
        variant: 'danger',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/karaoke/scenes/${id}`) as any,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'karaoke', 'scenes'] }),
    onError: async (err: any) => {
      await alert({ title: '删除失败', description: err?.message ?? String(err), variant: 'danger' });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/admin/karaoke/scenes/${id}`, { isActive }) as any,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'karaoke', 'scenes'] }),
    onError: async (err: any) => {
      await alert({ title: '更新失败', description: err?.message ?? String(err), variant: 'danger' });
    },
  });

  const generateAll = useMutation({
    mutationFn: (force: boolean) =>
      apiClient.post('/admin/karaoke/scenes/generate-all', { force }) as any,
    onSuccess: async (res: any) => {
      await alert({
        title: '已启动',
        description: res?.message || '场景预览图生成任务已启动，约 1–3 分钟后刷新查看。',
      });
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['admin', 'karaoke', 'scenes'] });
      }, 5_000);
    },
    onError: async (err: any) => {
      await alert({ title: '启动失败', description: err?.message ?? String(err), variant: 'danger' });
    },
  });

  const handleDelete = async (scene: KaraokeSceneTemplate) => {
    const ok = await confirm({
      title: `删除场景「${scene.nameI18n?.zh || scene.code}」？`,
      description: '此操作不可撤销，已生成的历史项目不受影响。',
      variant: 'danger',
      confirmText: '删除',
    });
    if (ok) deleteMutation.mutate(scene.id);
  };

  const sorted = [...(data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const missingCount = sorted.filter((s) => s.code !== 'custom' && !s.previewImageUrl?.trim()).length;

  return (
    <div className="admin-page">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-blue-600" />
              演唱场景库
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              管理 Photo Karaoke 场景模板。当前先以 Custom 与录音棚试点固定示例人物方案，其他场景保持现状。
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              <button
                onClick={() => generateAll.mutate(false)}
                disabled={generateAll.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                title={missingCount ? `${missingCount} 个场景缺少预览图` : '补齐缺失预览图'}
              >
                {generateAll.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                补齐缺失预览图
                {missingCount > 0 ? ` (${missingCount})` : ''}
              </button>
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: '强制全量重新生成？',
                    description: '将重新生成所有场景预览图（跳过 custom）。录音棚使用固定示例人物，其他场景仍按现有方式生成。',
                    confirmText: '强制重生',
                  });
                  if (ok) generateAll.mutate(true);
                }}
                disabled={generateAll.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                强制全量重生
              </button>
              <button
                onClick={() => setEditing('new')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" />
                新建场景
              </button>
            </div>
          )}
        </div>

        <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center gap-3 lg:w-64">
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-blue-100 bg-white">
                {previewConfig?.effectiveReferenceImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewConfig.effectiveReferenceImageUrl}
                    alt="场景预览示例人物"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-blue-300">
                    <UserRound className="h-7 w-7" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">示例人物 · 录音棚试点</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {previewConfig?.source === 'configured'
                    ? '使用独立配置的参考图'
                    : previewConfig?.source === 'custom_scene'
                      ? '暂时使用 Custom 现有图片'
                      : '尚未配置，无法生成一致的预览图'}
                </p>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
              <input
                value={referenceImageUrl}
                onChange={(e) => setReferenceImageUrl(e.target.value)}
                disabled={!canEdit || savePreviewConfig.isPending}
                placeholder="输入公开可访问的正面人物图片 URL；留空时回退使用 Custom 图片"
                className={cn(INPUT, 'h-10 flex-1 font-mono text-xs')}
              />
              {canEdit && (
                <button
                  type="button"
                  onClick={() => savePreviewConfig.mutate()}
                  disabled={savePreviewConfig.isPending}
                  className="inline-flex h-10 flex-shrink-0 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {savePreviewConfig.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  保存示例人物
                </button>
              )}
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            建议使用已获授权或 AI 生成的单人正面半身照：光线均匀、五官清晰、嘴部无遮挡。当前只用于录音棚预览试点，不会进入用户项目。
          </p>
        </section>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!sorted.length}
          emptyMessage="暂无场景模板"
          height="h-64"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {sorted.map((scene) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                canEdit={canEdit}
                onEdit={() => setEditing(scene)}
                onDelete={() => handleDelete(scene)}
                onToggleActive={(v) => toggleActiveMutation.mutate({ id: scene.id, isActive: v })}
                togglePending={toggleActiveMutation.isPending}
              />
            ))}
          </div>
        </QueryState>
      </div>

      <SceneEditor open={editing !== null} scene={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function SceneCard({
  scene,
  canEdit,
  onEdit,
  onDelete,
  onToggleActive,
  togglePending,
}: {
  scene: KaraokeSceneTemplate;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (v: boolean) => void;
  togglePending: boolean;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  const regenerate = useMutation({
    mutationFn: () =>
      apiClient.post(`/admin/karaoke/scenes/${scene.id}/regenerate-preview`, undefined, {
        timeout: 180_000,
      }) as any,
    onSuccess: () => {
      setLocalMsg(null);
      qc.invalidateQueries({ queryKey: ['admin', 'karaoke', 'scenes'] });
    },
    onError: (err: any) => setLocalMsg(err?.message || '生成场景图失败'),
  });

  const isGenerating = regenerate.isPending;

  return (
    <div
      className={cn(
        'relative bg-white border rounded-2xl overflow-hidden flex flex-col',
        scene.isActive ? 'border-slate-200' : 'border-slate-200/80 bg-slate-50/60 opacity-80',
        isGenerating && 'ring-2 ring-blue-400/60',
      )}
    >
      <div className="aspect-video bg-slate-100 relative">
        {scene.code === 'custom' ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-500 text-white">
            <Wand2 className="h-8 w-8" />
            <span className="text-xs font-semibold">用户自定义场景</span>
          </div>
        ) : scene.previewImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={scene.previewImageUrl}
            alt={scene.nameI18n?.zh ?? scene.code}
            className={cn(
              'w-full h-full object-cover transition-opacity',
              isGenerating && 'opacity-30',
            )}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
        {scene.isPremium && !isGenerating && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/95 text-white shadow">
            <Crown className="h-2.5 w-2.5" />
            会员专享
          </span>
        )}
        {!scene.isActive && !isGenerating && (
          <span className="absolute top-2 right-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-600/90 text-white shadow">
            已下架
          </span>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <p className="text-sm font-medium text-slate-800">{scene.nameI18n?.zh || scene.code}</p>
        <p className="text-[10px] uppercase tracking-wider text-slate-400">{scene.code}</p>
        <p className="text-xs text-slate-500 line-clamp-2">{scene.descriptionI18n?.zh}</p>
        <div className="flex flex-wrap gap-1 mt-0.5">
          {scene.allowedModes?.map((m) => (
            <span
              key={m}
              className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-100"
            >
              {m}
            </span>
          ))}
        </div>
        {localMsg && (
          <div className="mt-1 rounded-lg bg-red-50 border border-red-100 text-[11px] text-red-700 px-2 py-1 flex items-start gap-1">
            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span className="leading-tight">{localMsg}</span>
          </div>
        )}
      </div>
      {canEdit && (
        <div className="px-3 py-2 border-t border-slate-100 flex flex-col gap-2">
          {scene.code !== 'custom' && (
            <button
              onClick={async () => {
                if (isGenerating) return;
                const ok = await confirm({
                  title: scene.previewImageUrl ? '重新生成场景图？' : '生成场景图？',
                  description:
                    scene.code === 'studio'
                      ? `将使用固定示例人物和当前 Solo Prompt 生成「${scene.nameI18n?.zh || scene.code}」预览图，约 30s–2min${scene.previewImageUrl ? '，已有图会被覆盖' : ''}。`
                      : `将按现有方式使用当前 Solo Prompt 生成「${scene.nameI18n?.zh || scene.code}」预览图，约 30s–2min${scene.previewImageUrl ? '，已有图会被覆盖' : ''}。`,
                  confirmText: scene.previewImageUrl ? '重新生成' : '开始生成',
                });
                if (ok) regenerate.mutate();
              }}
              disabled={isGenerating || !scene.soloPrompt?.trim()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 disabled:cursor-wait"
              title={!scene.soloPrompt?.trim() ? '请先填写 Solo Prompt' : undefined}
              aria-busy={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {isGenerating
                ? '生成中，请稍候…'
                : scene.previewImageUrl
                  ? '重新生成场景图'
                  : '生成场景图'}
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              disabled={isGenerating}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-50"
            >
              <Pencil className="h-3 w-3" />
              编辑
            </button>
            <button
              onClick={() => onToggleActive(!scene.isActive)}
              disabled={togglePending || isGenerating}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 disabled:opacity-50"
            >
              {scene.isActive ? '下架' : '上架'}
            </button>
            <button
              onClick={onDelete}
              disabled={isGenerating}
              className="inline-flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-50"
              title="删除"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {isGenerating && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/75 backdrop-blur-[1px]">
          <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-slate-700">正在生成场景图…</p>
          <p className="text-[11px] text-slate-500">Nano Banana · 约 30s–2min</p>
        </div>
      )}
    </div>
  );
}

function SceneEditor({
  open,
  scene,
  onClose,
}: {
  open: boolean;
  scene: KaraokeSceneTemplate | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<SceneFormState>(emptyForm());
  const [msg, setMsg] = useState<string | null>(null);
  const isNew = !scene;

  useEffect(() => {
    if (open) {
      setForm(scene ? toForm(scene) : emptyForm());
      setMsg(null);
    }
  }, [open, scene]);

  const save = useMutation({
    mutationFn: () => {
      const payload = toPayload(form);
      if (isNew) {
        return apiClient.post('/admin/karaoke/scenes', payload) as any;
      }
      return apiClient.patch(`/admin/karaoke/scenes/${scene!.id}`, payload) as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'karaoke', 'scenes'] });
      onClose();
    },
    onError: (err: any) => setMsg(err?.message || '保存失败'),
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      // 若 Solo Prompt 有改动，先保存再生成，确保用最新 prompt
      if (!isNew && scene) {
        await apiClient.patch(`/admin/karaoke/scenes/${scene.id}`, toPayload(form));
      }
      return apiClient.post(`/admin/karaoke/scenes/${scene!.id}/regenerate-preview`, undefined, {
        timeout: 180_000,
      }) as any;
    },
    onSuccess: (res: any) => {
      if (res?.previewImageUrl) {
        setForm((p) => ({ ...p, previewImageUrl: res.previewImageUrl }));
      }
      setMsg(null);
      qc.invalidateQueries({ queryKey: ['admin', 'karaoke', 'scenes'] });
    },
    onError: (err: any) => setMsg(err?.message || '生成场景图失败'),
  });

  const toggleMode = (mode: string) => {
    setForm((prev) => ({
      ...prev,
      allowedModes: prev.allowedModes.includes(mode)
        ? prev.allowedModes.filter((m) => m !== mode)
        : [...prev.allowedModes, mode],
    }));
  };

  if (!open) return null;

  const canSubmit = form.code.trim() && form.nameZh.trim() && form.soloPrompt.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="text-sm font-semibold text-slate-900">
            {isNew ? '新建场景模板' : `编辑场景「${scene?.nameI18n?.zh || scene?.code}」`}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>唯一代码（code）</label>
              <input
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                disabled={!isNew}
                placeholder="stage_neon"
                className={cn(INPUT, 'font-mono text-xs', !isNew && 'bg-slate-50 text-slate-400')}
              />
            </div>
            <div>
              <label className={LABEL}>排序</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) || 0 }))}
                className={INPUT}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>中文名</label>
              <input
                value={form.nameZh}
                onChange={(e) => setForm((p) => ({ ...p, nameZh: e.target.value }))}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>English name</label>
              <input
                value={form.nameEn}
                onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))}
                className={INPUT}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>中文描述</label>
              <textarea
                rows={2}
                value={form.descriptionZh}
                onChange={(e) => setForm((p) => ({ ...p, descriptionZh: e.target.value }))}
                className={cn(INPUT, 'resize-y')}
              />
            </div>
            <div>
              <label className={LABEL}>English description</label>
              <textarea
                rows={2}
                value={form.descriptionEn}
                onChange={(e) => setForm((p) => ({ ...p, descriptionEn: e.target.value }))}
                className={cn(INPUT, 'resize-y')}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className={cn(LABEL, 'mb-0')}>预览图 URL</label>
              {!isNew && scene?.code !== 'custom' && (
                <button
                  type="button"
                  onClick={() => regenerate.mutate()}
                  disabled={regenerate.isPending || save.isPending || !form.soloPrompt.trim()}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60 disabled:cursor-wait"
                  aria-busy={regenerate.isPending}
                >
                  {regenerate.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {regenerate.isPending
                    ? '生成中，请稍候…'
                    : scene?.code === 'studio'
                      ? '用示例人物生成'
                      : '用 Solo Prompt 生成'}
                </button>
              )}
            </div>
            <input
              value={form.previewImageUrl}
              onChange={(e) => setForm((p) => ({ ...p, previewImageUrl: e.target.value }))}
              placeholder="https://... 或点击上方按钮自动生成"
              disabled={regenerate.isPending}
              className={cn(INPUT, 'font-mono text-xs')}
            />
            {(form.previewImageUrl || regenerate.isPending) && (
              <div className="relative mt-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 aspect-video max-w-sm">
                {form.previewImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.previewImageUrl}
                    alt="预览"
                    className={cn(
                      'h-full w-full object-cover transition-opacity',
                      regenerate.isPending && 'opacity-30',
                    )}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : null}
                {regenerate.isPending && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/70">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <span className="text-xs font-medium text-slate-600">正在生成场景图…</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className={LABEL}>Solo Prompt（必填）</label>
            <textarea
              rows={3}
              value={form.soloPrompt}
              onChange={(e) => setForm((p) => ({ ...p, soloPrompt: e.target.value }))}
              className={cn(INPUT, 'resize-y font-mono text-xs')}
            />
          </div>
          <div>
            <label className={LABEL}>Pet Prompt</label>
            <textarea
              rows={2}
              value={form.petPrompt}
              onChange={(e) => setForm((p) => ({ ...p, petPrompt: e.target.value }))}
              className={cn(INPUT, 'resize-y font-mono text-xs')}
            />
          </div>
          <div>
            <label className={LABEL}>Duet Prompt</label>
            <textarea
              rows={2}
              value={form.duetPrompt}
              onChange={(e) => setForm((p) => ({ ...p, duetPrompt: e.target.value }))}
              className={cn(INPUT, 'resize-y font-mono text-xs')}
            />
          </div>
          <div>
            <label className={LABEL}>Negative Prompt</label>
            <textarea
              rows={2}
              value={form.negativePrompt}
              onChange={(e) => setForm((p) => ({ ...p, negativePrompt: e.target.value }))}
              className={cn(INPUT, 'resize-y font-mono text-xs')}
            />
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <label className={LABEL}>允许的模式</label>
              <div className="flex items-center gap-3">
                {MODE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={form.allowedModes.includes(opt.value)}
                      onChange={() => toggleMode(opt.value)}
                      className="accent-blue-600"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="accent-blue-600"
                />
                已上架
              </label>
              <label className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.isPremium}
                  onChange={(e) => setForm((p) => ({ ...p, isPremium: e.target.checked }))}
                  className="accent-blue-600"
                />
                会员专享
              </label>
            </div>
          </div>

          {msg && <p className="text-xs text-red-500">{msg}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            取消
          </button>
          <button
            onClick={() => {
              setMsg(null);
              save.mutate();
            }}
            disabled={!canSubmit || save.isPending || regenerate.isPending}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {(save.isPending || regenerate.isPending) && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            {regenerate.isPending ? '生成中…' : isNew ? '创建' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
