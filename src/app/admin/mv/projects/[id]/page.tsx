'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Trash2,
  RefreshCw,
  Play,
  ExternalLink,
  AlertTriangle,
  Download,
  Loader2,
  DollarSign,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { canAccessTab, firstAllowedTab } from '@/lib/admin-permissions';
import { StatusBadge } from '@/components/status-badge';
import { ShotCard, ShotCardData } from '@/components/shot-card';
import { QueryState } from '@/components/query-state';
import { PaginationBar } from '@/components/pagination-bar';
import { useServerPagination } from '@/lib/use-server-pagination';
import { formatDate, cn } from '@/lib/utils';
import {
  DEFAULT_CNY_PER_USD,
  fetchCnyPerUsd,
  formatUsdAmount,
  mountseaCreditsToUsd,
} from '@/lib/mountsea-pricing';
import { exportMvProject } from '@/lib/mv-import-export';
import { useConfirm, useAlert } from '@/components/ui/dialog-provider';
import { OperationsTab } from '@/components/operations-tab';

interface MvProjectDetail {
  project: {
    id: string;
    title: string;
    userId: string;
    musicUrl: string;
    musicFilename: string;
    musicDuration: number;
    characterImageUrl: string | null;
    secondaryCharacterImageUrl: string | null;
    styleTag: string;
    mvType: string;
    aspectRatio: string;
    videoProvider: string;
    resolution: string;
    status: string;
    currentStep: number;
    resultUrl: string | null;
    resultName: string | null;
    errorMessage: string | null;
    enableLipsync: boolean;
    compositionHistory: Array<{ url: string; createdAt: string; name?: string }> | null;
    /** 非 null 表示该项目来自 admin 跨环境导入，记录上一跳来源 */
    importSource: {
      sourceProjectId: string;
      sourceUserEmail: string | null;
      sourceUserDisplayName: string | null;
      originalCreatedAt: string;
      importedAt: string;
    } | null;
    isPublic: boolean;
    adminTags: string[] | null;
    createdAt: string;
    updatedAt: string;
  };
  user: {
    id: string;
    email: string | null;
    displayName: string;
    avatarUrl: string | null;
    role: string;
  } | null;
  shots: Array<{
    id: string;
    projectId: string;
    shotIndex: number;
    shotType: string;
    genType: string;
    status: string;
    storyboardImageUrl: string | null;
    videoUrl: string | null;
    lipsyncVideoUrl: string | null;
    failureReason: string | null;
    label: string | null;
  }>;
  planning: Array<{
    id: string;
    step: number;
    status: string;
    llmModel: string | null;
    retryCount: number;
    errorMessage: string | null;
    startedAt: string | null;
    completedAt: string | null;
    updatedAt: string;
  }>;
  assets: Array<{
    id: string;
    assetType: string;
    url: string;
    createdAt: string;
  }>;
}

const STEP_LABELS: Record<number, string> = {
  1: '分析输入',
  2: '音乐分析',
  3: '视觉风格',
  4: '创意简报',
  5: '参考图',
  6: '场景规划',
  7: '镜头规划',
  8: '故事板',
  9: '视频片段',
  10: '最终合成',
};

type TabKey = 'costs' | 'assets' | 'shots' | 'planning' | 'history' | 'operations';

function safeCostNumber(value: number | null | undefined): number {
  return Number.isFinite(value) ? (value as number) : 0;
}

function MountseaAmount({
  credits,
  align = 'right',
  usdClassName = 'text-blue-700 font-medium',
  cnyPerUsd = DEFAULT_CNY_PER_USD,
}: {
  credits: number;
  align?: 'left' | 'right';
  usdClassName?: string;
  cnyPerUsd?: number;
}) {
  const safeCredits = safeCostNumber(credits);
  if (safeCredits <= 0) return <span className="text-slate-300">—</span>;
  return (
    <div className={cn('tabular-nums', align === 'right' && 'text-right')}>
      <div className={usdClassName}>{formatUsdAmount(mountseaCreditsToUsd(safeCredits, cnyPerUsd))}</div>
      <div className="text-[10px] text-slate-400 font-normal">
        {safeCredits.toLocaleString(undefined, { maximumFractionDigits: 2 })} credits
      </div>
    </div>
  );
}

/** 未对账记录：失败且大概率未产生上游账单 vs 仍可能对账/同步 */
function classifyUnreconciledRecord(
  r: CostRecordRow,
): 'failed_no_bill' | 'pending_sync' {
  if (r.success) return 'pending_sync';

  const errMsg = typeof r.metadata?.errorMessage === 'string' ? r.metadata.errorMessage : '';
  const errLower = errMsg.toLowerCase();
  const providerKey = typeof r.metadata?.providerKey === 'string' ? r.metadata.providerKey : '';

  if (
    errLower.includes('503') ||
    errLower.includes('no available account') ||
    providerKey === 'fallthrough-final-failure' ||
    errLower.includes('429') ||
    errLower.includes('rate limit') ||
    errLower.includes('too many requests') ||
    errLower.includes('401') ||
    errLower.includes('403') ||
    errLower.includes('unauthorized') ||
    errMsg.includes('PROVIDER_NOT_CONFIGURED') ||
    errLower.includes('sensitive') ||
    errLower.includes('content_policy') ||
    errLower.includes('content policy') ||
    errMsg.includes('451') ||
    errLower.includes('unsafe') ||
    errLower.includes('timeout') ||
    errLower.includes('timed out') ||
    errLower.includes('deadline')
  ) {
    return 'failed_no_bill';
  }

  if (/\b5\d\d\b/.test(errMsg) || errLower.includes('internal server') || errLower.includes('overload')) {
    return 'pending_sync';
  }

  return 'failed_no_bill';
}

/**
 * 项目成本明细接口返回（GET /admin/mv/projects/:id/costs）
 *
 * 设计要点：
 *   - records 是按时间顺序的全量原始记录，前端可以做"时间线视图"
 *   - byStep / byProvider 是聚合桶，给汇总卡片用
 *   - 汇总卡优先展示对账真实消耗；价格表估算单独展示
 *   - mountsea_credits=估算积分，mountsea_rec_credits=实扣积分；
 *     native_usd=美元渠道估算，reconciled_usd=美元渠道实扣
 *   - priceTableMatched=false 时，DB 记录的 cost 与当前价格表不一致
 */
interface CostBucket {
  calls: number;
  success: number;
  failure: number;
  mountsea_credits: number;
  mountsea_rec_credits: number;
  native_usd: number;
  reconciled_usd: number;
  elapsed_ms_sum: number;
}

type CostRecordRow = {
    id: string;
    shotId: string | null;
    step: string;
    provider: string;
    model: string;
    quantity: number;
    quantityUnit: string;
    costNativeAmount: number | null;
    costNativeUnit: 'credits' | 'usd' | 'neuron' | null;
    chargeCredits: number | null;
    chargeCnyFen: number | null;
    elapsedMs: number | null;
    success: boolean;
    priceTableMatched: boolean;
    priceTableEstimate: number | null;
    /** 阶段 2：账单对账字段 */
    providerRequestId: string | null;
    reconciledAt: string | null;
    reconciledAmount: number | null;
    reconciledSource: string | null;
    /** 对账后 vs 估算值偏差百分比；正数=估算偏低 */
    reconciledDiffPct: number | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
};

interface ProjectCosts {
  project: {
    id: string;
    title: string;
    userId: string;
    status: string;
    createdAt: string;
    costSummary: Record<string, number | string | null> | null;
  };
  totals: CostBucket;
  byStep: Record<string, CostBucket>;
  byProvider: Record<string, CostBucket>;
  recordTotal: number;
  reconStats: {
    reconciled: number;
    failedNoBill: number;
    pendingSync: number;
    recUsd: number;
    mountseaRecCredits: number;
    estUsd: number;
    mountseaEstCredits: number;
  };
}

interface ReconcileSummary {
  mountsea: number;
  apisale?: number;
  smartfashion?: number;
  aitokens?: number;
  total: number;
  reconciled: number;
  unmatched: number;
}

const STEP_TAG_LABELS: Record<string, string> = {
  lrc_transcribe: 'Step 1 · 歌词转写',
  music_analyze: 'Step 2 · 音乐分析',
  planning_visual_style: 'Step 3 · 视觉风格',
  planning_creative_brief: 'Step 4 · 创意简报',
  planning_ref_image: 'Step 5 · 参考图',
  planning_scene: 'Step 6 · 场景规划',
  planning_shot: 'Step 7 · 镜头规划',
  storyboard_image: 'Step 8 · 故事板',
  video_gen: 'Step 9 · 视频片段',
  lipsync_post: 'Step 9 · 口型后处理',
  final_compose: 'Step 10 · 最终合成',
};

/** 按 pipeline 顺序展示；placeholder 表示 LLM/合成步骤尚未埋点 */
const COST_STEP_ORDER: Array<{ key: string; label: string; placeholder?: boolean }> = [
  { key: 'lrc_transcribe', label: STEP_TAG_LABELS.lrc_transcribe },
  { key: 'music_analyze', label: STEP_TAG_LABELS.music_analyze },
  { key: 'planning_visual_style', label: STEP_TAG_LABELS.planning_visual_style },
  { key: 'planning_creative_brief', label: STEP_TAG_LABELS.planning_creative_brief },
  { key: 'planning_ref_image', label: STEP_TAG_LABELS.planning_ref_image },
  { key: 'planning_scene', label: STEP_TAG_LABELS.planning_scene },
  { key: 'planning_shot', label: STEP_TAG_LABELS.planning_shot },
  { key: 'storyboard_image', label: STEP_TAG_LABELS.storyboard_image },
  { key: 'video_gen', label: STEP_TAG_LABELS.video_gen },
  { key: 'lipsync_post', label: STEP_TAG_LABELS.lipsync_post },
  { key: 'final_compose', label: STEP_TAG_LABELS.final_compose, placeholder: true },
];

const EMPTY_COST_BUCKET: CostBucket = {
  calls: 0,
  success: 0,
  failure: 0,
  mountsea_credits: 0,
  mountsea_rec_credits: 0,
  native_usd: 0,
  reconciled_usd: 0,
  elapsed_ms_sum: 0,
};

/** 桶内 Mountsea：有实扣用实扣，否则回退估算 */
function bucketMountseaCredits(b: CostBucket): { credits: number; isReal: boolean } {
  const rec = safeCostNumber(b.mountsea_rec_credits);
  if (rec > 0) return { credits: rec, isReal: true };
  return { credits: safeCostNumber(b.mountsea_credits), isReal: false };
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  ref_image: '参考图',
  storyboard: '故事板',
  video_clip: '视频片段',
  final_mv: '成片',
};

export default function AdminMvProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const alert = useAlert();
  const permissions = useAdminAuthStore((s) => s.permissions);
  const canManageGeneration = useAdminAuthStore((s) => s.hasPermission('generation.manage'));
  const [tab, setTab] = useState<TabKey>('costs');
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery<MvProjectDetail>({
    queryKey: ['admin', 'mv', 'project', id],
    queryFn: () => apiClient.get(`/admin/mv/projects/${id}`) as any,
    refetchInterval: 15_000,
  });

  const tabDefs = useMemo(
    () =>
      (
        [
          ['costs', '成本明细'],
          ['assets', '素材'],
          ['shots', `镜头 (${data?.shots?.length ?? 0})`],
          ['planning', `规划步骤 (${data?.planning?.length ?? 0})`],
          [
            'history',
            `成片历史 (${(data?.project?.compositionHistory?.length ?? 0) + (data?.project?.resultUrl ? 1 : 0)})`,
          ],
          ['operations', '操作'],
        ] as [TabKey, string][]
      ).filter(([key]) => canAccessTab(permissions, 'mv.project.detail', key)),
    [permissions, data],
  );

  useEffect(() => {
    if (!tabDefs.length) return;
    if (!tabDefs.some(([k]) => k === tab)) {
      const first = firstAllowedTab(permissions, 'mv.project.detail') as TabKey | null;
      if (first) setTab(first);
    }
  }, [tabDefs, tab, permissions]);

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete(`/admin/mv/projects/${id}`) as any,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'mv', 'projects'] });
      router.push('/admin/mv/projects');
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => apiClient.post(`/admin/mv/projects/${id}/reset-stuck`) as any,
    onSuccess: () => refetch(),
  });

  const retryShotMutation = useMutation({
    mutationFn: ({ shotId, force }: { shotId: string; force?: boolean }) =>
      apiClient.post(`/admin/mv/shots/${id}/${shotId}/retry-video`, { force }) as any,
    onSuccess: () => refetch(),
  });

  const resetShotMutation = useMutation({
    mutationFn: ({ shotId }: { shotId: string }) =>
      apiClient.post(`/admin/mv/shots/${id}/${shotId}/reset`) as any,
    onSuccess: () => refetch(),
  });

  const handleDelete = async () => {
    if (!data) return;
    const ok = await confirm({
      title: `删除项目「${data.project.title || data.project.id}」？`,
      description: '仅删除 DB 记录，COS 文件保留。',
      variant: 'danger',
      confirmText: '删除',
    });
    if (ok) deleteMutation.mutate();
  };

  /** 导出当前项目 JSON：列表页和详情页共用 utility，下载文件名由 utility 决定 */
  const handleExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      await exportMvProject(data.project.id, data.project.title);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await alert({ title: '导出失败', description: msg, variant: 'danger' });
    } finally {
      setExporting(false);
    }
  };

  const project = data?.project;
  const shots = data?.shots ?? [];
  const planning = data?.planning ?? [];
  const assets = data?.assets ?? [];

  return (
    <div className="admin-page">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/mv/projects"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            返回项目列表
          </Link>
          {project && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                title="导出项目 JSON（含全部 shots/planning/assets）"
              >
                {exporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                导出 JSON
              </button>
              <button
                onClick={() => resetMutation.mutate()}
                disabled={resetMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  className={cn('h-3.5 w-3.5', resetMutation.isPending && 'animate-spin')}
                />
                重置卡死镜头
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除项目
              </button>
            </div>
          )}
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!project}
          height="h-96"
        >
          {project && (
            <>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-lg font-bold text-slate-900 truncate">
                      {project.title || '(未命名)'}
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">{project.id}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={project.status} kind="mvProject" />
                    <span className="text-xs text-slate-400">
                      Step {project.currentStep}/10
                    </span>
                  </div>
                </div>

                {project.importSource && (
                  <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
                    <Download className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-medium">该项目从其它环境导入，与本地真实数据区分</p>
                      <p className="text-blue-600/80">
                        源用户：{project.importSource.sourceUserDisplayName ?? '—'}
                        {project.importSource.sourceUserEmail && (
                          <span> ({project.importSource.sourceUserEmail})</span>
                        )}
                      </p>
                      <p className="text-blue-600/80 break-all">
                        源项目 ID：{project.importSource.sourceProjectId}
                      </p>
                      <p className="text-blue-600/80">
                        原创建：{formatDate(project.importSource.originalCreatedAt)}
                        <span className="mx-1.5 text-blue-300">·</span>
                        导入于：{formatDate(project.importSource.importedAt)}
                      </p>
                    </div>
                  </div>
                )}

                {project.errorMessage && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <p className="break-all">{project.errorMessage}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <Meta label="所属用户">
                    {data?.user ? (
                      <span className="text-slate-700">
                        {data.user.displayName}
                        {data.user.email && (
                          <span className="text-slate-400"> · {data.user.email}</span>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </Meta>
                  <Meta label="风格">{project.styleTag || '—'}</Meta>
                  <Meta label="MV 类型">{project.mvType}</Meta>
                  <Meta label="画幅 / 分辨率">
                    {project.aspectRatio} · {project.resolution}
                  </Meta>
                  <Meta label="视频模型">{project.videoProvider}</Meta>
                  <Meta label="口型同步">{project.enableLipsync ? '已开启' : '已关闭'}</Meta>
                  <Meta label="音乐时长">{project.musicDuration.toFixed(1)}s</Meta>
                  <Meta label="创建时间">{formatDate(project.createdAt)}</Meta>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl">
                <div className="flex border-b border-slate-100 px-4">
                  {tabDefs.map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={cn(
                        'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                        tab === key
                          ? 'text-blue-600 border-blue-600'
                          : 'text-slate-500 border-transparent hover:text-slate-800',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  {tab === 'costs' && <CostsTab projectId={id} />}
                  {tab === 'assets' && (
                    <AssetsTab project={project} assets={assets} resultUrl={project.resultUrl} />
                  )}
                  {tab === 'shots' && (
                    <ShotsTab
                      shots={shots}
                      onRetry={(shotId, force) => retryShotMutation.mutate({ shotId, force })}
                      onReset={(shotId) => resetShotMutation.mutate({ shotId })}
                      isMutating={retryShotMutation.isPending || resetShotMutation.isPending}
                      canManage={canManageGeneration}
                    />
                  )}
                  {tab === 'planning' && <PlanningTab planning={planning} />}
                  {tab === 'history' && (
                    <HistoryTab
                      resultUrl={project.resultUrl}
                      resultName={project.resultName}
                      history={project.compositionHistory ?? []}
                    />
                  )}
                  {tab === 'operations' && (
                    <OperationsTab
                      entityId={id}
                      kind="mv"
                      isPublic={project.isPublic ?? false}
                      adminTags={project.adminTags}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </QueryState>
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
      <div className="text-slate-700 font-medium">{children}</div>
    </div>
  );
}

function AssetsTab({
  project,
  assets,
  resultUrl,
}: {
  project: MvProjectDetail['project'];
  assets: MvProjectDetail['assets'];
  resultUrl: string | null;
}) {
  const uploads: Array<{ label: string; url: string; kind: 'audio' | 'image' | 'video' }> = [
    {
      label: project.musicFilename || '上传音乐',
      url: project.musicUrl,
      kind: 'audio',
    },
  ];
  if (project.characterImageUrl) {
    uploads.push({ label: '角色参考图 1', url: project.characterImageUrl, kind: 'image' });
  }
  if (project.secondaryCharacterImageUrl) {
    uploads.push({ label: '角色参考图 2', url: project.secondaryCharacterImageUrl, kind: 'image' });
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">用户上传</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {uploads.map((item) => (
            <div key={item.url} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800 truncate" title={item.label}>
                  {item.label}
                </p>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 shrink-0"
                >
                  打开 <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {item.kind === 'audio' && <audio src={item.url} controls className="w-full" />}
              {item.kind === 'image' && (
                <img
                  src={item.url}
                  alt={item.label}
                  className="w-full max-h-64 object-contain rounded-lg bg-white border border-slate-100"
                />
              )}
              {item.kind === 'video' && (
                <video src={item.url} controls className="w-full rounded-lg bg-black max-h-64" />
              )}
              <p className="text-[11px] text-slate-400 truncate" title={item.url}>
                {item.url}
              </p>
            </div>
          ))}
        </div>
      </section>

      {resultUrl && (
        <section>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">最新成片</h3>
          <video src={resultUrl} controls className="w-full max-w-2xl rounded-xl bg-black" />
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">
          生成素材库
          <span className="text-slate-400 font-normal ml-2 text-xs">共 {assets.length} 项</span>
        </h3>
        {assets.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center rounded-xl border border-dashed border-slate-200">
            尚无生成素材
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-sm transition"
              >
                <div className="aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
                  {asset.assetType === 'video_clip' || asset.assetType === 'final_mv' ? (
                    <video src={asset.url} controls className="w-full h-full object-contain bg-black" />
                  ) : (
                    <img src={asset.url} alt="" className="w-full h-full object-contain" />
                  )}
                </div>
                <div className="px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700">
                      {ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType}
                    </span>
                    <span className="text-[10px] text-slate-400">{formatDate(asset.createdAt)}</span>
                  </div>
                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-600 hover:underline truncate block"
                  >
                    查看原文件
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ShotsTab({
  shots,
  onRetry,
  onReset,
  isMutating,
  canManage = false,
}: {
  shots: MvProjectDetail['shots'];
  onRetry: (shotId: string, force?: boolean) => void;
  onReset: (shotId: string) => void;
  isMutating: boolean;
  canManage?: boolean;
}) {
  if (shots.length === 0) {
    return (
      <p className="text-sm text-slate-400 py-6 text-center">尚未生成镜头</p>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {shots.map((shot) => (
        <ShotCard
          key={shot.id}
          shot={shot as ShotCardData}
          actions={
            canManage ? (
            <>
              <button
                onClick={() => onRetry(shot.id, false)}
                disabled={isMutating}
                className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40"
              >
                重试
              </button>
              <button
                onClick={() => onRetry(shot.id, true)}
                disabled={isMutating}
                className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-40"
              >
                强制重生
              </button>
              <button
                onClick={() => onReset(shot.id)}
                disabled={isMutating}
                className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 disabled:opacity-40"
              >
                重置状态
              </button>
            </>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}

function PlanningTab({ planning }: { planning: MvProjectDetail['planning'] }) {
  if (planning.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">尚无规划记录</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500">
          <tr className="border-b border-slate-100">
            <th className="px-3 py-2 text-left">Step</th>
            <th className="px-3 py-2 text-left">状态</th>
            <th className="px-3 py-2 text-left">LLM</th>
            <th className="px-3 py-2 text-right">重试</th>
            <th className="px-3 py-2 text-left">完成时间</th>
            <th className="px-3 py-2 text-left">错误</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {planning.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-3 py-2">
                <span className="font-mono text-xs text-slate-700">{p.step}</span>
                <span className="text-slate-400 text-xs ml-1">
                  {STEP_LABELS[p.step] ?? ''}
                </span>
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={p.status} kind="generic" />
              </td>
              <td className="px-3 py-2 text-xs text-slate-500">{p.llmModel || '—'}</td>
              <td className="px-3 py-2 text-right text-xs text-slate-500">{p.retryCount}</td>
              <td className="px-3 py-2 text-xs text-slate-500">
                {p.completedAt ? formatDate(p.completedAt) : '—'}
              </td>
              <td className="px-3 py-2 text-xs text-red-500 max-w-xs truncate">
                {p.errorMessage || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTab({
  resultUrl,
  resultName,
  history,
}: {
  resultUrl: string | null;
  resultName: string | null;
  history: Array<{ url: string; createdAt: string; name?: string }>;
}) {
  const items: Array<{ url: string; createdAt: string; name?: string; current?: boolean }> = [];
  if (resultUrl) {
    items.push({
      url: resultUrl,
      createdAt: new Date().toISOString(),
      name: resultName ?? undefined,
      current: true,
    });
  }
  items.push(...history.slice().reverse());

  if (items.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">尚未合成成片</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((item, idx) => (
        <div
          key={item.url + idx}
          className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50"
        >
          <div className="aspect-video bg-black">
            <video
              src={item.url}
              controls
              poster={undefined}
              className="w-full h-full"
              preload="metadata"
            />
          </div>
          <div className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">
                {item.name || (item.current ? '最新版本' : `历史版本 ${formatDate(item.createdAt)}`)}
                {item.current && (
                  <span className="ml-2 text-[10px] text-blue-600 font-semibold uppercase">
                    current
                  </span>
                )}
              </p>
              {!item.current && (
                <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(item.createdAt)}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-md text-slate-500 hover:bg-white"
                title="新窗口打开"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href={item.url}
                download
                className="p-1.5 rounded-md text-slate-500 hover:bg-white"
                title="下载"
              >
                <Play className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 成本明细 Tab —— 内部审计视角
 *
 * 数据特征：
 *   - 汇总优先累加对账真实消耗；价格表估算单独展示（Mountsea / apisale 同一口径）
 *   - Mountsea credits 按 100 credits=1 CNY + Frankfurter 汇率折 USD
 *   - 失败记录也会出现：上游"扣了钱没出片"的场景需要可见
 *
 * UI 分层：
 *   1. 顶部：对账状态 + 真实 USD 合计；三张卡（Mountsea / 美元渠道 / 估算对照）
 *   2. 中部双栏：按步骤 / Provider 聚合（真实优先）
 *   3. 底部表格：原始记录时间线
 */
function CostsTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const alert = useAlert();
  const confirm = useConfirm();

  const { data, isLoading, isError, error } = useQuery<ProjectCosts>({
    queryKey: ['admin', 'mv', 'project', projectId, 'costs'],
    queryFn: () => apiClient.get(`/admin/mv/projects/${projectId}/costs`) as any,
    refetchInterval: 30_000,
  });

  const { data: cnyPerUsd = DEFAULT_CNY_PER_USD } = useQuery({
    queryKey: ['admin', 'exchange-rate', 'cny-per-usd'],
    queryFn: fetchCnyPerUsd,
    staleTime: 60 * 60 * 1000,
    retry: 1,
    placeholderData: DEFAULT_CNY_PER_USD,
  });

  const reconcileMutation = useMutation<ReconcileSummary>({
    mutationFn: () => apiClient.post(`/admin/mv/projects/${projectId}/reconcile`, {}) as any,
    onSuccess: async (summary) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'mv', 'project', projectId, 'costs'] });
      const allMatched = summary.total > 0 && summary.reconciled === summary.total;
      await alert({
        title: summary.total === 0 ? '暂无待对账记录' : allMatched ? '对账完成' : '对账完成（部分未匹配）',
        description:
          summary.total === 0
            ? '本项目没有 reconciled_at 为空的成本记录。'
            : `待对账记录：${summary.total} 条\n` +
              `成功匹配：${summary.reconciled} 条（mountsea ${summary.mountsea}` +
              ` / apisale ${summary.apisale ?? 0} / smartfashion ${summary.smartfashion ?? 0} / aitokens ${summary.aitokens ?? 0}）\n` +
              `未匹配：${summary.unmatched} 条`,
        variant: summary.total === 0 ? 'info' : allMatched ? 'success' : 'warning',
      });
    },
    onError: async (err: any) => {
      await alert({
        title: '对账失败',
        description: err?.message ?? String(err),
        variant: 'danger',
      });
    },
  });

  const handleReconcileClick = async () => {
    const pending = data?.reconStats.pendingSync ?? 0;
    const ok = await confirm({
      title: '立即对账',
      description:
        pending > 0
          ? `将对本项目的 ${pending} 条待同步记录拉取上游真实账单并回填 reconciled_amount。`
          : '将对本项目所有未对账记录拉取上游真实账单并回填 reconciled_amount。',
      confirmText: '开始对账',
    });
    if (!ok) return;
    reconcileMutation.mutate();
  };

  const reconStats = useMemo(() => {
    if (!data) return null;
    const rs = data.reconStats;
    const mountseaEstUsd = mountseaCreditsToUsd(rs.mountseaEstCredits, cnyPerUsd);
    const mountseaRecUsd = mountseaCreditsToUsd(rs.mountseaRecCredits, cnyPerUsd);
    const mountseaUsd = mountseaRecUsd > 0 ? mountseaRecUsd : mountseaEstUsd;
    const totalCostUsd = rs.recUsd + mountseaUsd;
    return {
      ...rs,
      mountseaRecUsd,
      mountseaEstUsd,
      mountseaUsd,
      totalCostUsd,
    };
  }, [data, cnyPerUsd]);

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      error={error}
      isEmpty={!data || data.recordTotal === 0}
      emptyMessage="该项目尚未产生任何成本记录"
      height="h-64"
    >
      {data && (
        <div className="space-y-5">
          {/* 对账状态横幅 */}
          {reconStats && (
            <div className="rounded-xl border bg-slate-50 px-4 py-3">
              <div className="flex flex-col gap-3 text-sm min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-700 min-w-0">
                    对账状态：
                    <span className="font-semibold text-emerald-700 ml-1">{reconStats.reconciled} 已对账</span>
                    {reconStats.failedNoBill > 0 && (
                      <>
                        <span className="mx-1 text-slate-300">·</span>
                        <span className="font-medium text-slate-500">{reconStats.failedNoBill} 失败未计费</span>
                      </>
                    )}
                    {reconStats.pendingSync > 0 && (
                      <>
                        <span className="mx-1 text-slate-300">·</span>
                        <span className="font-semibold text-amber-700">{reconStats.pendingSync} 待同步</span>
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleReconcileClick()}
                    disabled={reconcileMutation.isPending}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-medium transition"
                  >
                    {reconcileMutation.isPending ? '对账中…' : '立即对账'}
                  </button>
                </div>

                {reconStats.totalCostUsd > 0 && (
                  <div className="rounded-xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-blue-50 px-5 py-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800/70 mb-1">
                      成本 USD 合计
                    </p>
                    <p className="text-3xl font-bold tabular-nums text-emerald-900 leading-none">
                      {formatUsdAmount(reconStats.totalCostUsd)}
                    </p>
                    <p className="text-sm text-emerald-800/85 mt-2 tabular-nums">
                      美元账单 {formatUsdAmount(reconStats.recUsd)}
                      {' + '}
                      Mountsea {formatUsdAmount(reconStats.mountseaUsd)}
                      {reconStats.mountseaRecUsd <= 0 && reconStats.mountseaEstCredits > 0 && (
                        <span className="text-emerald-700/60 text-xs ml-1">（价格表折算）</span>
                      )}
                    </p>
                    <p className="text-[10px] text-emerald-700/60 mt-1.5">
                      以上金额均为美元 USD。Mountsea 折算：100 credits = 1 CNY ÷ 汇率{' '}
                      {cnyPerUsd.toFixed(4)} CNY/USD
                      {Math.abs(cnyPerUsd - DEFAULT_CNY_PER_USD) > 0.01 ? '（Frankfurter 实时）' : '（默认兜底）'}
                    </p>
                  </div>
                )}

                {reconStats.estUsd > 0 && reconStats.recUsd > 0 && (
                  <span className="text-[11px] text-slate-500">
                    价格表估算 {formatUsdAmount(reconStats.estUsd)}，已对账 {formatUsdAmount(reconStats.recUsd)}
                  </span>
                )}
              </div>
            </div>
          )}

          <CostHeaderCards totals={data.totals} byProvider={data.byProvider} cnyPerUsd={cnyPerUsd} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CostBreakdownCard
              title="按步骤聚合"
              buckets={data.byStep}
              stepOrder={COST_STEP_ORDER}
              cnyPerUsd={cnyPerUsd}
            />
            <CostBreakdownCard
              title="按 Provider 聚合"
              buckets={data.byProvider}
              cnyPerUsd={cnyPerUsd}
            />
          </div>
          <CostRecordsTable
            projectId={projectId}
            recordTotal={data.recordTotal}
            providerOptions={Object.keys(data.byProvider).sort()}
            stepOptions={Object.keys(data.byStep).sort()}
            failureTotal={data.totals.failure}
            cnyPerUsd={cnyPerUsd}
          />
        </div>
      )}
    </QueryState>
  );
}

function CostHeaderCards({
  totals,
  byProvider,
  cnyPerUsd = DEFAULT_CNY_PER_USD,
}: {
  totals: CostBucket;
  byProvider: Record<string, CostBucket>;
  cnyPerUsd?: number;
}) {
  const msRecCredits = safeCostNumber(totals.mountsea_rec_credits);
  const msEstCredits = safeCostNumber(totals.mountsea_credits);
  const msRealUsd = mountseaCreditsToUsd(msRecCredits, cnyPerUsd);
  const msEstUsd = mountseaCreditsToUsd(msEstCredits, cnyPerUsd);
  const usdReal = safeCostNumber(totals.reconciled_usd);
  const usdEst = safeCostNumber(totals.native_usd);
  const totalRealUsd = msRealUsd + usdReal;
  const totalEstUsd = msEstUsd + usdEst;
  const mountseaBucket = byProvider.mountsea;
  const usdChannelCalls = Math.max(
    0,
    totals.calls - (mountseaBucket?.calls ?? 0),
  );
  const usdChannelSuccess = Math.max(
    0,
    totals.success - (mountseaBucket?.success ?? 0),
  );
  const usdChannelFailure = Math.max(
    0,
    totals.failure - (mountseaBucket?.failure ?? 0),
  );

  const cards: Array<{
    key: string;
    label: string;
    primary: string;
    secondary: string;
    footer: string;
    color: string;
    active: boolean;
  }> = [
    {
      key: 'mountsea',
      label: 'Mountsea 真实消耗',
      primary: msRecCredits > 0 ? formatUsdAmount(msRealUsd) : msEstCredits > 0 ? formatUsdAmount(msEstUsd) : '$0.00',
      secondary:
        msRecCredits > 0
          ? `${msRecCredits.toLocaleString(undefined, { maximumFractionDigits: 2 })} credits 实扣` +
            (msEstCredits > 0
              ? ` · 估算 ${formatUsdAmount(msEstUsd)}（${msEstCredits.toLocaleString(undefined, { maximumFractionDigits: 0 })} credits）`
              : '')
          : msEstCredits > 0
            ? `${msEstCredits.toLocaleString(undefined, { maximumFractionDigits: 2 })} credits（尚未对账，显示估算）`
            : '无 Mountsea 记录',
      footer: mountseaBucket
        ? `${mountseaBucket.calls} 次 · 成功 ${mountseaBucket.success} / 失败 ${mountseaBucket.failure}`
        : '0 次调用',
      color: 'from-blue-50 to-blue-100 text-blue-700 border-blue-200',
      active: msRecCredits > 0 || msEstCredits > 0,
    },
    {
      key: 'usdChannels',
      label: '美元渠道真实消耗',
      primary: usdReal > 0 ? formatUsdAmount(usdReal) : usdEst > 0 ? formatUsdAmount(usdEst) : '$0.00',
      secondary:
        usdReal > 0
          ? `apisale 等实扣` + (usdEst > 0 ? ` · 估算 ${formatUsdAmount(usdEst)}` : '')
          : usdEst > 0
            ? `估算 ${formatUsdAmount(usdEst)}（尚未对账）`
            : '无美元渠道记录',
      footer: `${usdChannelCalls} 次 · 成功 ${usdChannelSuccess} / 失败 ${usdChannelFailure}`,
      color: 'from-amber-50 to-amber-100 text-amber-700 border-amber-200',
      active: usdReal > 0 || usdEst > 0,
    },
    {
      key: 'estimate',
      label: '价格表估算合计',
      primary: totalEstUsd > 0 ? formatUsdAmount(totalEstUsd) : '$0.00',
      secondary:
        totalRealUsd > 0 && totalEstUsd > 0
          ? `真实合计 ${formatUsdAmount(totalRealUsd)} · 偏差 ${(((totalEstUsd - totalRealUsd) / totalRealUsd) * 100).toFixed(1)}%`
          : 'Mountsea + 美元渠道价格表估算',
      footer: `${totals.calls} 次调用 · 成功 ${totals.success} / 失败 ${totals.failure}`,
      color: 'from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200',
      active: totalEstUsd > 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((c) => (
        <div
          key={c.key}
          className={cn(
            'rounded-xl border p-4 bg-gradient-to-br',
            c.active ? c.color : 'from-slate-50 to-slate-100 text-slate-500 border-slate-200',
          )}
        >
          <div className="flex items-center gap-1.5 text-xs font-medium opacity-80">
            <DollarSign className="h-3.5 w-3.5" />
            {c.label}
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{c.primary}</div>
          <div className="text-[11px] text-slate-500 font-normal mt-1 leading-snug">{c.secondary}</div>
          <div className="text-[11px] opacity-60 mt-1.5">{c.footer}</div>
        </div>
      ))}
    </div>
  );
}

function CostBreakdownCard({
  title,
  buckets,
  labelMap,
  stepOrder,
  cnyPerUsd = DEFAULT_CNY_PER_USD,
}: {
  title: string;
  buckets: Record<string, CostBucket>;
  labelMap?: Record<string, string>;
  stepOrder?: Array<{ key: string; label: string; placeholder?: boolean }>;
  cnyPerUsd?: number;
}) {
  const rows = stepOrder
    ? stepOrder.map(({ key, label, placeholder }) => ({
        key,
        label,
        placeholder: !!placeholder,
        bucket: buckets[key] ?? EMPTY_COST_BUCKET,
      }))
    : Object.entries(buckets)
        .sort((a, b) => b[1].calls - a[1].calls)
        .map(([key, bucket]) => ({
          key,
          label: labelMap?.[key] ?? key,
          placeholder: false,
          bucket,
        }));

  if (rows.length === 0) {
    return (
      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
        <p className="text-sm font-medium text-slate-700 mb-2">{title}</p>
        <p className="text-xs text-slate-400">暂无数据</p>
      </div>
    );
  }
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white">
      <p className="text-sm font-medium text-slate-800 mb-3">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[11px] text-slate-400 uppercase tracking-wide">
            <tr>
              <th className="text-left pb-2 font-medium">Key</th>
              <th className="text-right pb-2 font-medium">调用</th>
              <th className="text-right pb-2 font-medium">Mountsea 真实$</th>
              <th className="text-right pb-2 font-medium">美元渠道真实$</th>
              <th className="text-right pb-2 font-medium">估算$</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(({ key, label, placeholder, bucket: b }) => {
              const ms = bucketMountseaCredits(b);
              const usdReal = safeCostNumber(b.reconciled_usd);
              const usdEst = safeCostNumber(b.native_usd);
              const msEstUsd = mountseaCreditsToUsd(safeCostNumber(b.mountsea_credits), cnyPerUsd);
              const rowEstUsd = msEstUsd + usdEst;
              return (
              <tr key={key} className={placeholder && b.calls === 0 ? 'opacity-60' : undefined}>
                <td className="py-1.5 text-slate-700">
                  <span className="font-medium">{label}</span>
                  {placeholder && b.calls === 0 && (
                    <span className="text-slate-400 ml-1.5 text-[10px]">暂未埋点</span>
                  )}
                  {b.calls > 0 && (
                    <span className="text-slate-400 ml-1.5 text-[11px]">
                      {b.success}✓ {b.failure > 0 ? `${b.failure}✗` : ''}
                    </span>
                  )}
                </td>
                <td className="py-1.5 text-right tabular-nums text-slate-600">
                  {b.calls > 0 ? b.calls : '—'}
                </td>
                <td className="py-1.5 text-right">
                  {ms.credits > 0 ? (
                    <div>
                      <MountseaAmount
                        credits={ms.credits}
                        usdClassName="text-blue-600 font-medium text-xs"
                        cnyPerUsd={cnyPerUsd}
                      />
                      {!ms.isReal && (
                        <div className="text-[10px] text-amber-600">估算</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="py-1.5 text-right tabular-nums text-amber-600">
                  {usdReal > 0 ? usdReal.toFixed(4) : '—'}
                </td>
                <td className="py-1.5 text-right tabular-nums text-emerald-600">
                  {rowEstUsd > 0 ? rowEstUsd.toFixed(4) : '—'}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function resolveCostRecordRequestId(r: CostRecordRow): string | null {
  if (r.providerRequestId) return r.providerRequestId;
  const err = typeof r.metadata?.errorMessage === 'string' ? r.metadata.errorMessage : '';
  const hubMatch = err.match(/hub-[0-9a-f-]{36}/i);
  if (hubMatch) return hubMatch[0];
  const reqMatch = err.match(/requestId=([0-9a-f-]{36})/i);
  if (reqMatch) return reqMatch[1];
  return null;
}

type CostRecordSortKey =
  | 'createdAt'
  | 'provider'
  | 'model'
  | 'quantity'
  | 'estCost'
  | 'recCost'
  | 'elapsedMs'
  | 'success';

type SortDir = 'asc' | 'desc';

function getEstCostSortValue(r: CostRecordRow): number {
  if (r.costNativeAmount == null) return -1;
  if (r.costNativeUnit === 'credits') return mountseaCreditsToUsd(r.costNativeAmount);
  return r.costNativeAmount;
}

function getRecCostSortValue(r: CostRecordRow): number {
  if (r.reconciledAmount == null) return -1;
  if (r.reconciledSource === 'mountsea_usage') return mountseaCreditsToUsd(r.reconciledAmount);
  return r.reconciledAmount;
}

function compareCostRecords(
  a: CostRecordRow,
  b: CostRecordRow,
  key: CostRecordSortKey,
  dir: SortDir,
): number {
  let cmp = 0;
  switch (key) {
    case 'createdAt':
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      break;
    case 'provider':
      cmp = a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model);
      break;
    case 'model':
      cmp = a.model.localeCompare(b.model) || a.provider.localeCompare(b.provider);
      break;
    case 'quantity':
      cmp = a.quantity - b.quantity;
      break;
    case 'estCost':
      cmp = getEstCostSortValue(a) - getEstCostSortValue(b);
      break;
    case 'recCost':
      cmp = getRecCostSortValue(a) - getRecCostSortValue(b);
      break;
    case 'elapsedMs':
      cmp = (a.elapsedMs ?? -1) - (b.elapsedMs ?? -1);
      break;
    case 'success':
      cmp = Number(a.success) - Number(b.success);
      break;
  }
  return dir === 'asc' ? cmp : -cmp;
}

function SortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: CostRecordSortKey;
  activeKey: CostRecordSortKey;
  dir: SortDir;
  onSort: (key: CostRecordSortKey) => void;
  align?: 'left' | 'right' | 'center';
}) {
  const active = activeKey === sortKey;
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <th className={cn('px-3 py-2 font-medium whitespace-nowrap', alignClass)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-0.5 hover:text-slate-800 transition',
          active ? 'text-slate-800' : 'text-slate-500',
          align === 'right' && 'ml-auto',
          align === 'center' && 'mx-auto',
        )}
      >
        {label}
        {active ? (
          dir === 'asc' ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

function IdCell({ id, copyTitle }: { id: string | null; copyTitle: string }) {
  if (!id) return <span className="text-slate-300">—</span>;
  return (
    <div className="flex items-center gap-1 min-w-0 flex-1">
      <span className="font-mono text-[10px] truncate" title={id}>
        {id}
      </span>
      <CopyIdButton value={id} title={copyTitle} />
    </div>
  );
}

function TaskRequestIdCell({
  taskId,
  requestId,
}: {
  taskId: string | null;
  requestId: string | null;
}) {
  if (!taskId && !requestId) {
    return <span className="text-slate-300">—</span>;
  }

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[9px] text-slate-400 w-[52px] shrink-0">taskId</span>
        <IdCell id={taskId} copyTitle="复制 taskId" />
      </div>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[9px] text-slate-400 w-[52px] shrink-0">requestId</span>
        <IdCell id={requestId} copyTitle="复制 requestId" />
      </div>
    </div>
  );
}

function CopyIdButton({ value, title = '复制' }: { value: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.alert('复制失败，请手动选择复制');
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition shrink-0"
      title={copied ? '已复制' : title}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function resolveReconciledCellDisplay(
  r: CostRecordRow,
): {
  kind: 'amount' | 'reason';
  label?: string;
  detail?: string;
  tone?: 'neutral' | 'muted' | 'info';
  amount?: number;
  unit?: 'usd' | 'credits';
  source?: string;
  diffPct?: number | null;
} {
  const errMsg = typeof r.metadata?.errorMessage === 'string' ? r.metadata.errorMessage : '';
  const errLower = errMsg.toLowerCase();
  const providerKey = typeof r.metadata?.providerKey === 'string' ? r.metadata.providerKey : '';

  const isContentBlocked =
    errLower.includes('sensitive') ||
    errLower.includes('content_policy') ||
    errLower.includes('content policy') ||
    errMsg.includes('451') ||
    errLower.includes('unsafe');

  // 已对账（含 reconciled_amount = 0）
  if (r.reconciledAmount != null && r.reconciledAt) {
    if (r.reconciledAmount === 0) {
      if (isContentBlocked) {
        return {
          kind: 'reason',
          label: '内容审核拦截，渠道未计费',
          detail: `来源：${r.reconciledSource ?? '—'}`,
          tone: 'muted',
        };
      }
      return {
        kind: 'reason',
        label: '渠道确认未计费',
        detail: `来源：${r.reconciledSource ?? '—'}`,
        tone: 'muted',
      };
    }
    return {
      kind: 'amount',
      amount: r.reconciledAmount,
      unit: r.reconciledSource === 'mountsea_usage' ? 'credits' : 'usd',
      source: r.reconciledSource ?? '',
      diffPct: r.reconciledDiffPct,
    };
  }

  // 未对账 + 失败：按错误类型推断是否产生费用
  if (!r.success) {
    if (errLower.includes('503') || errLower.includes('no available account')) {
      return {
        kind: 'reason',
        label: '上游无可用账号，未产生费用',
        detail: errMsg || undefined,
        tone: 'neutral',
      };
    }
    if (providerKey === 'fallthrough-final-failure') {
      return {
        kind: 'reason',
        label: 'Hub 调用失败，未产生费用',
        detail: errMsg || undefined,
        tone: 'neutral',
      };
    }
    if (errLower.includes('429') || errLower.includes('rate limit') || errLower.includes('too many requests')) {
      return {
        kind: 'reason',
        label: '限流拒绝，未产生费用',
        detail: errMsg || undefined,
        tone: 'neutral',
      };
    }
    if (errLower.includes('401') || errLower.includes('403') || errLower.includes('unauthorized')) {
      return {
        kind: 'reason',
        label: '鉴权失败，未产生费用',
        detail: errMsg || undefined,
        tone: 'neutral',
      };
    }
    if (errMsg.includes('PROVIDER_NOT_CONFIGURED')) {
      return {
        kind: 'reason',
        label: '渠道未配置，未调用',
        tone: 'neutral',
      };
    }
    if (isContentBlocked) {
      return {
        kind: 'reason',
        label: '内容审核拦截，预计未计费',
        detail: errMsg || undefined,
        tone: 'muted',
      };
    }
    if (errLower.includes('timeout') || errLower.includes('timed out') || errLower.includes('deadline')) {
      return {
        kind: 'reason',
        label: '任务超时，通常未计费',
        detail: errMsg || undefined,
        tone: 'info',
      };
    }
    if (/\b5\d\d\b/.test(errMsg) || errLower.includes('internal server') || errLower.includes('overload')) {
      return {
        kind: 'reason',
        label: '服务器错误，待对账确认',
        detail: errMsg || undefined,
        tone: 'info',
      };
    }
    return {
      kind: 'reason',
      label: '调用失败，预计未产生费用',
      detail: errMsg || undefined,
      tone: 'neutral',
    };
  }

  // 未对账 + 成功：等待渠道账单同步
  const ageMs = Date.now() - new Date(r.createdAt).getTime();
  const isRecent = ageMs < 2 * 60 * 60 * 1000;

  if (r.provider === 'mountsea') {
    return {
      kind: 'reason',
      label: isRecent ? 'Mountsea 账单同步中' : '待 Mountsea 对账',
      tone: 'info',
    };
  }
  return { kind: 'reason', label: '待对账', tone: 'info' };
}

function ReconciledBillCell({
  r,
  cnyPerUsd = DEFAULT_CNY_PER_USD,
}: {
  r: CostRecordRow;
  cnyPerUsd?: number;
}) {
  const display = resolveReconciledCellDisplay(r);

  if (display.kind === 'amount' && display.amount != null) {
    if (display.unit === 'credits') {
      return (
        <span title={`来源：${display.source}\n对账时间：${r.reconciledAt}\n${display.amount} credits`}>
          <MountseaAmount
            credits={display.amount}
            usdClassName="font-semibold text-emerald-700 text-[11px]"
            cnyPerUsd={cnyPerUsd}
          />
          {display.diffPct != null && Math.abs(display.diffPct) >= 5 && (
            <span
              className={cn(
                'ml-1 px-1 py-0.5 rounded text-[9px] font-mono align-top inline-block',
                display.diffPct > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700',
              )}
              title={`估算 ${r.costNativeAmount} credits → 实际 ${display.amount} credits`}
            >
              {display.diffPct > 0 ? '+' : ''}
              {display.diffPct}%
            </span>
          )}
        </span>
      );
    }

    return (
      <span title={`来源：${display.source}\n对账时间：${r.reconciledAt}`}>
        <span className="font-semibold text-emerald-700">
          {display.amount.toFixed(4)}
        </span>
        <span className="text-slate-400 text-[10px] ml-0.5">$</span>
        {display.diffPct != null && Math.abs(display.diffPct) >= 5 && (
          <span
            className={cn(
              'ml-1 px-1 py-0.5 rounded text-[9px] font-mono',
              display.diffPct > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700',
            )}
            title={`估算 ${r.costNativeAmount} → 实际 ${display.amount}`}
          >
            {display.diffPct > 0 ? '+' : ''}
            {display.diffPct}%
          </span>
        )}
      </span>
    );
  }

  const toneClass =
    display.tone === 'muted'
      ? 'text-slate-400'
      : display.tone === 'info'
        ? 'text-blue-600'
        : 'text-slate-500';

  return (
    <span
      className={cn('text-[10px] whitespace-nowrap max-w-[140px] inline-block text-right', toneClass)}
      title={display.detail}
    >
      {display.label}
    </span>
  );
}

function CostRecordsTable({
  projectId,
  recordTotal,
  providerOptions,
  stepOptions,
  failureTotal,
  cnyPerUsd = DEFAULT_CNY_PER_USD,
}: {
  projectId: string;
  recordTotal: number;
  providerOptions: string[];
  stepOptions: string[];
  failureTotal: number;
  cnyPerUsd?: number;
}) {
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [showFailedCosts, setShowFailedCosts] = useState(false);
  const [providerFilter, setProviderFilter] = useState('');
  const [stepFilter, setStepFilter] = useState('');
  const [reconciledFilter, setReconciledFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortKey, setSortKey] = useState<CostRecordSortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const recordsQ = useQuery<{
    items: CostRecordRow[];
    total: number;
    page: number;
    pageSize: number;
  }>({
    queryKey: [
      'admin',
      'mv',
      'project',
      projectId,
      'cost-records',
      page,
      providerFilter,
      stepFilter,
      reconciledFilter,
      showFailedCosts,
      debouncedSearch,
      sortKey,
      sortDir,
    ],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortKey,
        sortDir,
      });
      if (providerFilter) qs.set('provider', providerFilter);
      if (stepFilter) qs.set('step', stepFilter);
      if (reconciledFilter !== 'all') qs.set('reconciled', reconciledFilter);
      if (!showFailedCosts) qs.set('success', 'true');
      if (debouncedSearch) qs.set('search', debouncedSearch);
      return apiClient.get(
        `/admin/mv/projects/${projectId}/cost-records?${qs}`,
      ) as any;
    },
  });

  const visible = recordsQ.data?.items ?? [];

  const handleSort = (key: CostRecordSortKey) => {
    setPage(1);
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'createdAt' ? 'desc' : 'asc');
    }
  };

  const hasActiveFilters =
    showFailedCosts ||
    providerFilter !== '' ||
    stepFilter !== '' ||
    reconciledFilter !== 'all' ||
    searchQuery.trim() !== '';

  const resetFilters = () => {
    setPage(1);
    setShowFailedCosts(false);
    setProviderFilter('');
    setStepFilter('');
    setReconciledFilter('all');
    setSearchQuery('');
    setSortKey('createdAt');
    setSortDir('desc');
  };

  const filterChange = <T,>(setter: (v: T) => void, value: T) => {
    setPage(1);
    setter(value);
  };

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 space-y-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-medium text-slate-800">
            原始记录（{recordsQ.data?.total ?? recordTotal} 条
            {recordsQ.isFetching && ' · 加载中…'}）
          </p>
          <p className="text-[11px] text-slate-400">
            <span className="text-amber-600">⚠️</span> 价格表已变更 ·
            <span className="ml-2 px-1 py-0.5 rounded bg-emerald-50 text-emerald-700">已对账</span>
            <span className="ml-1 px-1 py-0.5 rounded bg-slate-100 text-slate-500">未计费/待对账</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => filterChange(setSearchQuery, e.target.value)}
            placeholder="搜索 model / requestId / shot…"
            className="h-7 px-2.5 rounded-md border border-slate-200 text-[11px] text-slate-700 min-w-[180px] focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <select
            value={providerFilter}
            onChange={(e) => filterChange(setProviderFilter, e.target.value)}
            className="h-7 px-2 rounded-md border border-slate-200 text-[11px] text-slate-700 bg-white"
          >
            <option value="">全部 Provider</option>
            {providerOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={stepFilter}
            onChange={(e) => filterChange(setStepFilter, e.target.value)}
            className="h-7 px-2 rounded-md border border-slate-200 text-[11px] text-slate-700 bg-white"
          >
            <option value="">全部步骤</option>
            {stepOptions.map((s) => (
              <option key={s} value={s}>
                {STEP_TAG_LABELS[s] ?? s}
              </option>
            ))}
          </select>
          <select
            value={reconciledFilter}
            onChange={(e) =>
              filterChange(setReconciledFilter, e.target.value as 'all' | 'yes' | 'no')
            }
            className="h-7 px-2 rounded-md border border-slate-200 text-[11px] text-slate-700 bg-white"
          >
            <option value="all">全部对账状态</option>
            <option value="yes">已对账</option>
            <option value="no">未对账</option>
          </select>
          <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer select-none h-7 px-2 rounded-md border border-slate-200 bg-slate-50">
            <input
              type="checkbox"
              checked={showFailedCosts}
              onChange={(e) => filterChange(setShowFailedCosts, e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            显示失败计费
            {failureTotal > 0 && !showFailedCosts && (
              <span className="text-slate-400">（{failureTotal} 隐藏）</span>
            )}
          </label>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="h-7 px-2 rounded-md text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
            >
              重置筛选
            </button>
          )}
        </div>
      </div>

      <div className="overflow-y-auto max-h-[520px]">
        <table className="w-full text-xs table-fixed">
          <thead className="text-[11px] text-slate-500 bg-slate-50 sticky top-0 z-10">
            <tr>
              <SortableTh
                label="时间"
                sortKey="createdAt"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap">步骤</th>
              <SortableTh
                label="Provider · Model"
                sortKey="provider"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortableTh
                label="Quantity"
                sortKey="quantity"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="估算 Cost"
                sortKey="estCost"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="真实账单"
                sortKey="recCost"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="耗时"
                sortKey="elapsedMs"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortableTh
                label="状态"
                sortKey="success"
                activeKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="center"
              />
              <th className="text-left px-3 py-2 font-medium w-[22%]">
                taskId / requestId
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                  {recordTotal === 0
                    ? '暂无成本记录'
                    : '当前筛选下无记录，可调整筛选或勾选「显示失败计费」'}
                </td>
              </tr>
            ) : (
              visible.map((r) => {
                const taskId = resolveCostRecordRequestId(r);
                const requestId = r.providerRequestId;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString(undefined, {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                      <span className="font-medium">{STEP_TAG_LABELS[r.step] ?? r.step}</span>
                      {r.shotId && (
                        <span className="ml-1 text-slate-400 text-[10px]">
                          shot #{r.shotId.slice(0, 4)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 min-w-0 overflow-hidden">
                      <span
                        className={cn(
                          'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-1.5 shrink-0',
                          r.provider === 'mountsea' && 'bg-blue-50 text-blue-700',
                          r.provider === 'apisale' && 'bg-emerald-50 text-emerald-700',
                          r.provider === 'mountseaMs' && 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {r.provider}
                      </span>
                      <span className="font-mono text-[11px] truncate" title={r.model}>
                        {r.model}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700 whitespace-nowrap">
                      {r.quantity}
                      <span className="text-slate-400 ml-1">{r.quantityUnit}</span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {r.costNativeAmount != null && r.costNativeUnit === 'credits' ? (
                        <span title={!r.priceTableMatched ? '价格表已变更，DB 记录值与当前估算不一致' : undefined}>
                          <MountseaAmount credits={r.costNativeAmount} cnyPerUsd={cnyPerUsd} />
                          {!r.priceTableMatched && (
                            <span className="ml-1 text-amber-500" title="价格表已变更，DB 记录值与当前估算不一致">
                              ⚠️
                            </span>
                          )}
                        </span>
                      ) : r.costNativeAmount != null ? (
                        <span
                          className={cn(
                            'font-medium tabular-nums',
                            r.costNativeUnit === 'usd' && 'text-emerald-700',
                            r.costNativeUnit === 'neuron' && 'text-amber-700',
                          )}
                        >
                          {r.costNativeAmount.toFixed(r.costNativeUnit === 'usd' ? 4 : 2)}
                          <span className="text-slate-400 text-[10px] ml-0.5">
                            {r.costNativeUnit === 'usd' ? '$' : 'N'}
                          </span>
                          {!r.priceTableMatched && (
                            <span className="ml-1 text-amber-500" title="价格表已变更，DB 记录值与当前估算不一致">
                              ⚠️
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      <ReconciledBillCell r={r} cnyPerUsd={cnyPerUsd} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500 whitespace-nowrap">
                      {r.elapsedMs != null ? `${(r.elapsedMs / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.success ? (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                          OK
                        </span>
                      ) : (
                        <span
                          className="inline-block px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-medium"
                          title={(r.metadata?.errorMessage as string) ?? ''}
                        >
                          FAIL
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 align-top min-w-0 overflow-hidden">
                      <TaskRequestIdCell taskId={taskId} requestId={requestId} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {recordsQ.data && (
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={recordsQ.data.total}
          onPageChange={setPage}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}
