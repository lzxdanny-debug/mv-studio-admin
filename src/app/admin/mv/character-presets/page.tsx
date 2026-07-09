'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  ImageOff,
  AlertTriangle,
  Loader2,
  Sprout,
  Repeat,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/dialog-provider';
import { CharacterPresetEditor } from './_components/character-preset-editor';

/**
 * 默认角色图（character preset）管理页面。
 *
 * 功能：
 *   - 网格卡片展示所有预设（含 pending / failed / disabled）
 *   - Tab 按 category 筛选；下拉按 status 过滤
 *   - "新建预设"按钮打开 CharacterPresetEditor（AI 生成 / 直传 两 tab）
 *   - 每张卡上有快捷操作：启用/停用、重新生成、编辑、删除
 *   - 列表有 pending 时每 6s 自动轮询，等生成结果回来
 *
 * 与风格库页面（/admin/mv/styles）的差异：
 *   - 这里支持完整 CRUD（风格库是内置定义不可改）
 *   - 这里有"状态"概念（pending → done / failed），风格库只有"有没有图"
 */

export interface CharacterPreset {
  id: string;
  name: string;
  category: string | null;
  subjectType: 'human' | 'animal_anthropomorphic' | 'puppet_doll' | 'object_anthropomorphic';
  prompt: string | null;
  imageUrl: string | null;
  appearanceSummary: string | null;
  consistencyPrompt: string | null;
  status: 'pending' | 'done' | 'failed';
  generationTaskId: string | null;
  errorMsg: string | null;
  enabled: boolean;
  sortOrder: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES: Array<{ value: string | null; label: string }> = [
  { value: null, label: '全部' },
  { value: 'human', label: '真人' },
  { value: 'animal', label: '动物' },
  { value: 'cartoon', label: '卡通' },
  { value: 'fantasy', label: '奇幻' },
  { value: 'character', label: 'IP 角色' },
  { value: 'other', label: '其他' },
];

const STATUS_LABEL: Record<CharacterPreset['status'], { label: string; cls: string }> = {
  pending: { label: '生成中', cls: 'bg-amber-100 text-amber-700' },
  done: { label: '已就绪', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: '失败', cls: 'bg-red-100 text-red-700' },
};

const SUBJECT_LABEL: Record<CharacterPreset['subjectType'], string> = {
  human: '真人',
  animal_anthropomorphic: '动物·拟人',
  puppet_doll: '玩偶',
  object_anthropomorphic: '物件·拟人',
};

export default function AdminCharacterPresetsPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    preset?: CharacterPreset;
  }>({ open: false, mode: 'create' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ─── 列表查询：有 pending 时 6s 自动轮询 ─────────────────────
  const queryKey = useMemo(
    () => ['admin', 'mv', 'character-presets', activeCategory],
    [activeCategory],
  );

  const { data, isLoading, isError, error } = useQuery<CharacterPreset[]>({
    queryKey,
    queryFn: () =>
      apiClient.get('/admin/mv/character-presets', {
        params: activeCategory ? { category: activeCategory } : {},
      }) as any,
    refetchInterval: (q) => {
      const list = (q.state.data as CharacterPreset[] | undefined) ?? [];
      const hasPending = list.some((p) => p.status === 'pending');
      return hasPending ? 6_000 : false;
    },
    // 即使 tab 在后台也继续轮询 —— admin 后台 tab 常被切走（去看终端 / 查问题），
    // 这时也要持续推进 pending → done 的状态同步，否则切回来看到一堆"生成中"会以为卡了。
    refetchIntervalInBackground: true,
    // tab 切回前台时立刻拉一次（react-query 默认行为，显式写出方便阅读）
    refetchOnWindowFocus: true,
  });

  const list = data ?? [];
  const hasPending = list.some((p) => p.status === 'pending');
  const failedCount = list.filter((p) => p.status === 'failed').length;

  // ─── 启用 / 停用 ──────────────────────────────────────────
  const toggleEnabled = useMutation({
    mutationFn: (p: CharacterPreset) =>
      apiClient.patch(`/admin/mv/character-presets/${p.id}`, { enabled: !p.enabled }) as any,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'mv', 'character-presets'] }),
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '操作失败' }),
  });

  // ─── 重新生成（仅 AI 生成模式） ────────────────────────────
  const regenerate = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/admin/mv/character-presets/${id}/regenerate`, {}) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: '已触发重新生成，请稍候' });
      qc.invalidateQueries({ queryKey: ['admin', 'mv', 'character-presets'] });
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '操作失败' }),
  });

  // ─── 删除 ────────────────────────────────────────────────
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/admin/mv/character-presets/${id}`) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: '已删除' });
      qc.invalidateQueries({ queryKey: ['admin', 'mv', 'character-presets'] });
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '删除失败' }),
  });

  const handleDelete = async (p: CharacterPreset) => {
    const ok = await confirm({
      title: `删除「${p.name}」？`,
      description: '此操作不可撤销。',
      variant: 'danger',
      confirmText: '删除',
    });
    if (ok) remove.mutate(p.id);
  };

  // ─── 一键灌入种子（首次部署用） ─────────────────────────────
  //
  // 反复点击防护链：
  //   1) Mutation 飞行中：seed.isPending=true，按钮禁用
  //   2) 飞行完成、还没拿到第一批 pending 卡片之前的间隙：用 seedJustTriggered 状态护住
  //      （8s 后由列表 invalidate 接管 —— 那时 hasPending 已经 true）
  //   3) 列表里有 pending 卡片：hasPending=true，按钮禁用（自然防重，跟生成进度同步）
  //   4) 后端单进程锁：service.seedRunning，二次 POST 会被 409 拒绝
  const [seedJustTriggered, setSeedJustTriggered] = useState(false);
  const seed = useMutation({
    mutationFn: () => apiClient.post('/admin/mv/character-presets/seed', {}) as any,
    onSuccess: (res: any) => {
      setMsg({ ok: true, text: res?.message || '已开始批量创建' });
      setSeedJustTriggered(true);
      // 8s 后刷新列表，那时 30 条 pending 应该已经全部入库 → hasPending=true 接管按钮锁
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['admin', 'mv', 'character-presets'] });
        setSeedJustTriggered(false);
      }, 8_000);
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '触发失败' }),
  });
  const seedDisabled = seed.isPending || seedJustTriggered || hasPending;

  // ─── 批量重试 failed ────────────────────────────────────
  const retryAllFailed = useMutation({
    mutationFn: () =>
      apiClient.post('/admin/mv/character-presets/retry-all-failed', {}) as any,
    onSuccess: (res: any) => {
      const retried = res?.retried ?? 0;
      const skipped = res?.skipped ?? 0;
      setMsg({
        ok: true,
        text: `已重试 ${retried} 个失败预设${skipped ? `（${skipped} 个直传预设无 prompt 已跳过）` : ''}`,
      });
      qc.invalidateQueries({ queryKey: ['admin', 'mv', 'character-presets'] });
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '重试失败' }),
  });

  // ─── 全部重新生成（换分辨率 / 调模板后刷存量） ─────────────
  //
  // 危险操作 —— 触发后所有 done/failed 的 AI 模式预设都会重新跑一遍 Nano Banana：
  //   · 用户体感：30 张预设全部回到"生成中"状态，2-4 分钟才陆续就绪
  //   · 计费成本：每张图都是一次新生成
  //   · 直传创建的（无 prompt）会跳过
  //   · 已经在 pending 的会跳过，不打断正在跑的任务
  const regenerateAll = useMutation({
    mutationFn: () =>
      apiClient.post('/admin/mv/character-presets/regenerate-all', {}) as any,
    onSuccess: (res: any) => {
      const regenerated = res?.regenerated ?? 0;
      const skipped = res?.skipped ?? 0;
      setMsg({
        ok: true,
        text: `已触发 ${regenerated} 个预设重新生成${skipped ? `（${skipped} 个跳过）` : ''}`,
      });
      qc.invalidateQueries({ queryKey: ['admin', 'mv', 'character-presets'] });
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '触发失败' }),
  });

  // 列表为空时（未灌入种子的全新环境）才展示"一键灌入种子"按钮
  const showSeedButton = !isLoading && list.length === 0;
  // 列表里至少有一个有 prompt 的预设才显示"全部重新生成"
  const regenerableCount = list.filter((p) => !!p.prompt && p.status !== 'pending').length;

  return (
    <div className="admin-page">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <UserSquare className="h-5 w-5 text-blue-600" />
              默认角色图库
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              管理用户在 /create 第二步选用的预生成角色形象，由 Nano Banana 生图或后台直传
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 生成中徽章：仅信息展示（自动轮询会推进进度，不需要手动刷新按钮） */}
            {hasPending && (
              <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-amber-50 border border-amber-200 text-amber-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                生成中 {list.filter((p) => p.status === 'pending').length} 个
              </div>
            )}
            {failedCount > 0 && (
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: `重试 ${failedCount} 个失败的预设？`,
                    description:
                      '直传创建（无 prompt）的预设会被跳过，需要单独用「替换图片」修复。',
                    variant: 'warning',
                    confirmText: '重试',
                  });
                  if (ok) retryAllFailed.mutate();
                }}
                disabled={retryAllFailed.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
              >
                <RotateCcw
                  className={cn('h-4 w-4', retryAllFailed.isPending && 'animate-spin')}
                />
                重试失败（{failedCount}）
              </button>
            )}
            {regenerableCount > 0 && (
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: `全部重新生成 ${regenerableCount} 个预设？`,
                    description: (
                      <div className="space-y-2">
                        <p className="text-slate-700">主要用于换分辨率（如 2K→1K）或调整模板后刷新存量。</p>
                        <ul className="space-y-1 text-xs text-slate-500 list-disc list-inside">
                          <li>所有 AI 模式预设会重新调用 Nano Banana（含 done 和 failed）</li>
                          <li>直传创建（无 prompt）的会跳过</li>
                          <li>当前 pending 中的会跳过</li>
                          <li>预计 2-4 分钟全部就绪</li>
                        </ul>
                      </div>
                    ),
                    confirmText: `重新生成 ${regenerableCount} 个`,
                    cancelText: '取消',
                    variant: 'warning',
                  });
                  if (ok) regenerateAll.mutate();
                }}
                disabled={regenerateAll.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Repeat
                  className={cn('h-4 w-4 text-blue-500', regenerateAll.isPending && 'animate-spin')}
                />
                全部重新生成
              </button>
            )}
            {showSeedButton && (
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: '灌入 30 个预设角色？',
                    description: (
                      <div className="space-y-1">
                        <p>对齐 freebeat 的 30 个英文 prompt，重名会跳过。</p>
                        <p className="text-xs text-slate-500">
                          提交后异步触发 Nano Banana 生图，约 2-4 分钟全部就绪。
                        </p>
                      </div>
                    ),
                    variant: 'default',
                    confirmText: '开始灌入',
                  });
                  if (ok) seed.mutate();
                }}
                disabled={seedDisabled}
                title={
                  seedJustTriggered ? '已触发，等待第一批 pending 卡片入库…' : undefined
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sprout
                  className={cn(
                    'h-4 w-4 text-emerald-500',
                    (seed.isPending || seedJustTriggered) && 'animate-pulse',
                  )}
                />
                {seedJustTriggered ? '已触发…' : '一键灌入种子'}
              </button>
            )}
            <button
              onClick={() => setEditor({ open: true, mode: 'create' })}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <Plus className="h-4 w-4" />
              新建预设
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1 bg-white rounded-2xl p-1 border border-slate-200 w-fit">
          {CATEGORIES.map((c) => (
            <button
              key={c.value ?? 'all'}
              onClick={() => setActiveCategory(c.value)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs transition-all',
                activeCategory === c.value
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {msg && (
          <div
            className={cn(
              'rounded-xl border px-3 py-2 text-xs',
              msg.ok
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                : 'bg-red-50 border-red-100 text-red-700',
            )}
          >
            {msg.text}
          </div>
        )}

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!list.length}
          emptyMessage="还没有预设角色，点击右上角「新建预设」开始添加"
          height="h-64"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {list.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                onEdit={() => setEditor({ open: true, mode: 'edit', preset })}
                onToggleEnabled={() => toggleEnabled.mutate(preset)}
                onRegenerate={() => regenerate.mutate(preset.id)}
                onDelete={() => handleDelete(preset)}
                disabled={
                  toggleEnabled.isPending || regenerate.isPending || remove.isPending
                }
              />
            ))}
          </div>
        </QueryState>
      </div>

      <CharacterPresetEditor
        open={editor.open}
        mode={editor.mode}
        preset={editor.preset}
        onClose={() => setEditor({ open: false, mode: 'create' })}
        onSaved={() => {
          setEditor({ open: false, mode: 'create' });
          setMsg({ ok: true, text: editor.mode === 'create' ? '已创建' : '已保存' });
          qc.invalidateQueries({ queryKey: ['admin', 'mv', 'character-presets'] });
        }}
      />
    </div>
  );
}

// ─── 卡片组件 ────────────────────────────────────────────

function PresetCard({
  preset,
  onEdit,
  onToggleEnabled,
  onRegenerate,
  onDelete,
  disabled,
}: {
  preset: CharacterPreset;
  onEdit: () => void;
  onToggleEnabled: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const statusInfo = STATUS_LABEL[preset.status];

  return (
    <div
      className={cn(
        'bg-white border rounded-2xl overflow-hidden flex flex-col transition-all',
        preset.enabled ? 'border-slate-200' : 'border-slate-200 opacity-60',
      )}
    >
      {/* 缩略图区 */}
      <div className="aspect-square bg-slate-100 relative">
        {preset.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            // COS 数据万象缩略：网格卡片宽 ~300px，要 600px @2x 即可；JPEG 质量 75 已经够看
            src={`${preset.imageUrl}?imageMogr2/thumbnail/600x/quality/75/format/jpg`}
            alt={preset.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // 数据万象偶发不可用时，降级到原图
              const img = e.currentTarget as HTMLImageElement;
              if (img.src.includes('imageMogr2') && preset.imageUrl) {
                img.src = preset.imageUrl;
                return;
              }
              img.style.display = 'none';
            }}
          />
        ) : preset.status === 'pending' ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-blue-400 gap-1">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-[10px]">生成中…</span>
          </div>
        ) : preset.status === 'failed' ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-red-300 gap-1 px-3 text-center">
            <AlertTriangle className="h-6 w-6" />
            <span className="text-[10px] line-clamp-2">{preset.errorMsg ?? '生成失败'}</span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageOff className="h-8 w-8" />
          </div>
        )}

        {/* 角标：状态 */}
        <div
          className={cn(
            'absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[10px] font-medium',
            statusInfo.cls,
          )}
        >
          {statusInfo.label}
        </div>
        {/* 角标：禁用 */}
        {!preset.enabled && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-700/80 text-white">
            已停用
          </div>
        )}
      </div>

      {/* 信息区 */}
      <div className="p-2.5 flex-1 flex flex-col gap-1">
        <p className="text-sm font-medium text-slate-800 truncate" title={preset.name}>
          {preset.name}
        </p>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span>{SUBJECT_LABEL[preset.subjectType]}</span>
          {preset.category && (
            <>
              <span>·</span>
              <span>{preset.category}</span>
            </>
          )}
          {preset.usageCount > 0 && (
            <>
              <span>·</span>
              <span>使用 {preset.usageCount}</span>
            </>
          )}
        </div>
      </div>

      {/* 操作区 */}
      <div className="px-2 py-1.5 border-t border-slate-100 flex items-center gap-0.5">
        <IconBtn
          title={preset.enabled ? '停用' : '启用'}
          onClick={onToggleEnabled}
          disabled={disabled || preset.status === 'pending'}
        >
          {preset.enabled ? (
            <Power className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <PowerOff className="h-3.5 w-3.5 text-slate-400" />
          )}
        </IconBtn>
        <IconBtn
          title="重新生成"
          onClick={onRegenerate}
          disabled={disabled || !preset.prompt || preset.status === 'pending'}
        >
          <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
        </IconBtn>
        <IconBtn title="编辑" onClick={onEdit} disabled={disabled}>
          <Pencil className="h-3.5 w-3.5 text-slate-500" />
        </IconBtn>
        <div className="flex-1" />
        <IconBtn title="删除" onClick={onDelete} disabled={disabled}>
          <Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}
