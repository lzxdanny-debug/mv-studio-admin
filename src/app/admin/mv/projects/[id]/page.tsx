'use client';

import { use, useMemo, useState } from 'react';
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
import { StatusBadge } from '@/components/status-badge';
import { ShotCard, ShotCardData } from '@/components/shot-card';
import { QueryState } from '@/components/query-state';
import { formatDate, cn } from '@/lib/utils';
import {
  DEFAULT_CNY_PER_USD,
  fetchCnyPerUsd,
  formatUsdAmount,
  mountseaCreditsToUsd,
} from '@/lib/mountsea-pricing';
import { exportMvProject } from '@/lib/mv-import-export';
import { useConfirm, useAlert } from '@/components/ui/dialog-provider';

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

type TabKey = 'costs' | 'assets' | 'shots' | 'planning' | 'history';

function MountseaAmount({
  credits,
  align = 'right',
  usdClassName = 'text-purple-700 font-medium',
  cnyPerUsd = DEFAULT_CNY_PER_USD,
}: {
  credits: number;
  align?: 'left' | 'right';
  usdClassName?: string;
  cnyPerUsd?: number;
}) {
  if (credits <= 0) return <span className="text-slate-300">—</span>;
  return (
    <div className={cn('tabular-nums', align === 'right' && 'text-right')}>
      <div className={usdClassName}>{formatUsdAmount(mountseaCreditsToUsd(credits, cnyPerUsd))}</div>
      <div className="text-[10px] text-slate-400 font-normal">
        {credits.toLocaleString(undefined, { maximumFractionDigits: 2 })} credits
      </div>
    </div>
  );
}

/** 未对账记录：失败且大概率未产生上游账单 vs 仍可能对账/同步 */
function classifyUnreconciledRecord(
  r: ProjectCosts['records'][number],
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
 *   - totals.mountsea_credits / fal_usd / cloudflare_usd 三种计费单位并存，
 *     Cloudflare 无本地价格表估算，cloudflare_usd 来自 cf_aig_logs 真实账单
 *   - priceTableMatched=false 时，DB 记录的 cost 与当前价格表不一致（说明价格表更新了
 *     但历史记录没回填），前端可以显眼标注让运维知道"这条数据该刷一下"
 */
interface CostBucket {
  calls: number;
  success: number;
  failure: number;
  mountsea_credits: number;
  fal_usd: number;
  cloudflare_usd: number;
  elapsed_ms_sum: number;
}

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
  records: Array<{
    id: string;
    shotId: string | null;
    step: string;
    provider: 'mountsea' | 'fal' | 'cloudflare';
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
  }>;
}

interface ReconcileSummary {
  mountsea: number;
  fal: number;
  cloudflare: number;
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
  fal_usd: 0,
  cloudflare_usd: 0,
  elapsed_ms_sum: 0,
};

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
  const [tab, setTab] = useState<TabKey>('costs');
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery<MvProjectDetail>({
    queryKey: ['admin', 'mv', 'project', id],
    queryFn: () => apiClient.get(`/admin/mv/projects/${id}`) as any,
    refetchInterval: 15_000,
  });

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
    <div className="flex-1 overflow-y-auto bg-slate-100">
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
                  <div className="flex items-start gap-2 p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-700">
                    <Download className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-medium">该项目从其它环境导入，与本地真实数据区分</p>
                      <p className="text-purple-600/80">
                        源用户：{project.importSource.sourceUserDisplayName ?? '—'}
                        {project.importSource.sourceUserEmail && (
                          <span> ({project.importSource.sourceUserEmail})</span>
                        )}
                      </p>
                      <p className="text-purple-600/80 break-all">
                        源项目 ID：{project.importSource.sourceProjectId}
                      </p>
                      <p className="text-purple-600/80">
                        原创建：{formatDate(project.importSource.originalCreatedAt)}
                        <span className="mx-1.5 text-purple-300">·</span>
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
                  {(
                    [
                      ['costs', '成本明细'],
                      ['assets', '素材'],
                      ['shots', `镜头 (${shots.length})`],
                      ['planning', `规划步骤 (${planning.length})`],
                      ['history', `成片历史 (${(project.compositionHistory?.length ?? 0) + (project.resultUrl ? 1 : 0)})`],
                    ] as [TabKey, string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={cn(
                        'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                        tab === key
                          ? 'text-purple-600 border-purple-600'
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
                  className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 shrink-0"
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
                    className="text-[11px] text-purple-600 hover:underline truncate block"
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
}: {
  shots: MvProjectDetail['shots'];
  onRetry: (shotId: string, force?: boolean) => void;
  onReset: (shotId: string) => void;
  isMutating: boolean;
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
                className="text-[11px] px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 disabled:opacity-40"
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
                  <span className="ml-2 text-[10px] text-purple-600 font-semibold uppercase">
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
 * 成本明细 Tab —— 阶段 1：内部审计视角
 *
 * 数据特征：
 *   - cost_native_amount 取自 native-pricing.ts 公开价格表，与上游真实账单可能存在 ±20% 偏差
 *   - 三种计费单位（Mountsea credits / Fal USD / Cloudflare USD）并存，不做汇率换算
 *   - 失败记录也会出现：上游"扣了钱没出片"的场景需要可见，运维核账时也要看到这部分损耗
 *
 * UI 分层：
 *   1. 顶部 3 张大卡：三种原生单位的总额（视觉上类似账单首页）
 *   2. 中部双栏：按步骤聚合 + 按 Provider 聚合（横向对比："是哪个步骤在烧钱"和"是哪家在烧钱"）
 *   3. 底部表格：原始记录时间线，可点开 metadata 看 raw payload
 */
function CostsTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
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
  });

  const reconcileMutation = useMutation<ReconcileSummary>({
    mutationFn: () => apiClient.post(`/admin/mv/projects/${projectId}/reconcile`, {}) as any,
    onSuccess: (summary) => {
      const msg = `对账完成：成功 ${summary.reconciled}/${summary.total} ` +
        `（mountsea ${summary.mountsea} · fal ${summary.fal} · cf ${summary.cloudflare}）`;
      // 利用 alert 也行，这里用浏览器原生 + console
      // 顺便把成本明细 cache 失效，让 UI 自动刷新
      void queryClient.invalidateQueries({ queryKey: ['admin', 'mv', 'project', projectId, 'costs'] });
      window.alert(msg);
    },
    onError: (err: any) => {
      window.alert('对账失败：' + (err?.message ?? String(err)));
    },
  });

  // 统计已对账 / 失败未计费 / 待同步 + USD 汇总（避免 CF 无估算时产生误导百分比）
  const reconStats = useMemo(() => {
    if (!data) return null;

    let reconciled = 0;
    let failedNoBill = 0;
    let pendingSync = 0;

    let falRecUsd = 0;
    let cfRecUsd = 0;
    let mountseaRecUsd = 0;

    let falEstUsd = 0;
    let mountseaEstCredits = 0;

    for (const r of data.records) {
      if (r.reconciledAt) {
        reconciled++;
        if (r.reconciledSource === 'fal_billing_events' && r.reconciledAmount != null) {
          falRecUsd += r.reconciledAmount;
        } else if (r.reconciledSource === 'cf_aig_logs' && r.reconciledAmount != null) {
          cfRecUsd += r.reconciledAmount;
        } else if (r.reconciledSource === 'mountsea_usage' && r.reconciledAmount != null) {
          mountseaRecUsd += mountseaCreditsToUsd(r.reconciledAmount, cnyPerUsd);
        }
      } else if (classifyUnreconciledRecord(r) === 'failed_no_bill') {
        failedNoBill++;
      } else {
        pendingSync++;
      }

      if (r.costNativeUnit === 'usd' && r.costNativeAmount != null) {
        falEstUsd += r.costNativeAmount;
      }
      if (r.costNativeUnit === 'credits' && r.costNativeAmount != null) {
        mountseaEstCredits += r.costNativeAmount;
      }
    }

    const mountseaEstUsd = mountseaCreditsToUsd(mountseaEstCredits, cnyPerUsd);
    const mountseaUsd = mountseaRecUsd > 0 ? mountseaRecUsd : mountseaEstUsd;
    const totalCostUsd = falRecUsd + cfRecUsd + mountseaUsd;

    return {
      reconciled,
      failedNoBill,
      pendingSync,
      falRecUsd,
      cfRecUsd,
      mountseaRecUsd,
      mountseaUsd,
      mountseaEstUsd,
      totalCostUsd,
      falEstUsd,
      mountseaEstCredits,
    };
  }, [data, cnyPerUsd]);

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      error={error}
      isEmpty={!data || data.records.length === 0}
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
                    onClick={() => reconcileMutation.mutate()}
                    disabled={reconcileMutation.isPending}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-medium transition"
                  >
                    {reconcileMutation.isPending ? '对账中…' : '立即对账'}
                  </button>
                </div>

                {reconStats.totalCostUsd > 0 && (
                  <div className="rounded-xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800/70 mb-1">
                      成本 USD 合计
                    </p>
                    <p className="text-3xl font-bold tabular-nums text-emerald-900 leading-none">
                      {formatUsdAmount(reconStats.totalCostUsd)}
                    </p>
                    <p className="text-sm text-emerald-800/85 mt-2 tabular-nums">
                      Fal {formatUsdAmount(reconStats.falRecUsd)}
                      {' + '}
                      CF {formatUsdAmount(reconStats.cfRecUsd)}
                      {' + '}
                      Mountsea {formatUsdAmount(reconStats.mountseaUsd)}
                      {reconStats.mountseaRecUsd <= 0 && reconStats.mountseaEstCredits > 0 && (
                        <span className="text-emerald-700/60 text-xs ml-1">（价格表折算）</span>
                      )}
                    </p>
                    <p className="text-[10px] text-emerald-700/60 mt-1.5">
                      Mountsea 按 100 credits = 1 CNY · 汇率 {cnyPerUsd.toFixed(4)} CNY/USD
                      {Math.abs(cnyPerUsd - DEFAULT_CNY_PER_USD) > 0.01 ? '（Frankfurter 实时）' : '（默认兜底）'}
                    </p>
                  </div>
                )}

                {reconStats.falEstUsd > 0 && reconStats.falRecUsd > 0 && (
                  <span className="text-[11px] text-slate-500">
                    Fal 价格表估算 {formatUsdAmount(reconStats.falEstUsd)}，已对账 {formatUsdAmount(reconStats.falRecUsd)}
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
          <CostRecordsTable records={data.records} cnyPerUsd={cnyPerUsd} />
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
  const cards: Array<{
    key: string;
    label: string;
    value: number;
    suffix: string;
    color: string;
    decimals: number;
  }> = [
    {
      key: 'mountsea',
      label: 'Mountsea',
      value: totals.mountsea_credits,
      suffix: 'credits',
      color: 'from-purple-50 to-purple-100 text-purple-700 border-purple-200',
      decimals: 2,
    },
    {
      key: 'fal',
      label: 'Fal',
      value: totals.fal_usd,
      suffix: 'USD',
      color: 'from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200',
      decimals: 4,
    },
    {
      key: 'cloudflare',
      label: 'Cloudflare',
      value: totals.cloudflare_usd,
      suffix: 'USD',
      color: 'from-amber-50 to-amber-100 text-amber-700 border-amber-200',
      decimals: 2,
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((c) => {
        const bucket = byProvider[c.key] ?? totals;
        const isMountsea = c.key === 'mountsea';
        return (
          <div
            key={c.label}
            className={cn(
              'rounded-xl border p-4 bg-gradient-to-br',
              c.value > 0 ? c.color : 'from-slate-50 to-slate-100 text-slate-500 border-slate-200',
            )}
          >
            <div className="flex items-center gap-1.5 text-xs font-medium opacity-80">
              <DollarSign className="h-3.5 w-3.5" />
              {c.label}
            </div>
            {isMountsea && c.value > 0 ? (
              <div className="mt-1">
                <div className="text-2xl font-bold tabular-nums">
                  {formatUsdAmount(mountseaCreditsToUsd(c.value, cnyPerUsd))}
                </div>
                <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                  {c.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} credits
                </div>
              </div>
            ) : (
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tabular-nums">
                  {c.value.toLocaleString(undefined, {
                    minimumFractionDigits: c.value > 0 ? Math.min(c.decimals, 2) : 0,
                    maximumFractionDigits: c.decimals,
                  })}
                </span>
                <span className="text-xs opacity-70">{c.suffix}</span>
              </div>
            )}
            <div className="text-[11px] opacity-60 mt-1">
              {bucket.calls} 次调用 · 成功 {bucket.success} / 失败 {bucket.failure}
            </div>
          </div>
        );
      })}
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
              <th className="text-right pb-2 font-medium">Mountsea $</th>
              <th className="text-right pb-2 font-medium">Fal $</th>
              <th className="text-right pb-2 font-medium">CF $</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(({ key, label, placeholder, bucket: b }) => (
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
                  {b.mountsea_credits > 0 ? (
                    <MountseaAmount
                      credits={b.mountsea_credits}
                      usdClassName="text-purple-600 font-medium text-xs"
                      cnyPerUsd={cnyPerUsd}
                    />
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="py-1.5 text-right tabular-nums text-emerald-600">
                  {b.fal_usd > 0 ? b.fal_usd.toFixed(4) : '—'}
                </td>
                <td className="py-1.5 text-right tabular-nums text-amber-600">
                  {b.cloudflare_usd > 0 ? b.cloudflare_usd.toFixed(2) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function resolveCostRecordRequestId(r: ProjectCosts['records'][number]): string | null {
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

function getEstCostSortValue(r: ProjectCosts['records'][number]): number {
  if (r.costNativeAmount == null) return -1;
  if (r.costNativeUnit === 'credits') return mountseaCreditsToUsd(r.costNativeAmount);
  return r.costNativeAmount;
}

function getRecCostSortValue(r: ProjectCosts['records'][number]): number {
  if (r.reconciledAmount == null) return -1;
  if (r.reconciledSource === 'mountsea_usage') return mountseaCreditsToUsd(r.reconciledAmount);
  return r.reconciledAmount;
}

function compareCostRecords(
  a: ProjectCosts['records'][number],
  b: ProjectCosts['records'][number],
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
  r: ProjectCosts['records'][number],
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

  if (r.provider === 'cloudflare') {
    return {
      kind: 'reason',
      label: isRecent ? 'CF 账单同步中' : '待 CF 对账',
      tone: 'info',
    };
  }
  if (r.provider === 'fal') {
    return {
      kind: 'reason',
      label: isRecent ? 'Fal 账单同步中' : '待 Fal 对账',
      tone: 'info',
    };
  }
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
  r: ProjectCosts['records'][number];
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
  records,
  cnyPerUsd = DEFAULT_CNY_PER_USD,
}: {
  records: ProjectCosts['records'];
  cnyPerUsd?: number;
}) {
  const [showFailedCosts, setShowFailedCosts] = useState(false);
  const [providerFilter, setProviderFilter] = useState('');
  const [stepFilter, setStepFilter] = useState('');
  const [reconciledFilter, setReconciledFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<CostRecordSortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const providerOptions = useMemo(
    () => Array.from(new Set(records.map((r) => r.provider))).sort(),
    [records],
  );
  const stepOptions = useMemo(
    () => Array.from(new Set(records.map((r) => r.step))).sort(),
    [records],
  );

  const failedCount = useMemo(
    () => records.filter((r) => !r.success).length,
    [records],
  );

  const handleSort = (key: CostRecordSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'createdAt' ? 'desc' : 'asc');
    }
  };

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let rows = records.filter((r) => {
      if (!showFailedCosts && !r.success) return false;
      if (providerFilter && r.provider !== providerFilter) return false;
      if (stepFilter && r.step !== stepFilter) return false;
      if (reconciledFilter === 'yes' && !r.reconciledAt) return false;
      if (reconciledFilter === 'no' && r.reconciledAt) return false;
      if (!q) return true;
      const requestId = resolveCostRecordRequestId(r) ?? '';
      const haystack = [
        r.model,
        r.provider,
        r.step,
        STEP_TAG_LABELS[r.step] ?? '',
        requestId,
        r.providerRequestId ?? '',
        r.shotId ?? '',
        typeof r.metadata?.errorMessage === 'string' ? r.metadata.errorMessage : '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
    rows = [...rows].sort((a, b) => compareCostRecords(a, b, sortKey, sortDir));
    return rows;
  }, [
    records,
    showFailedCosts,
    providerFilter,
    stepFilter,
    reconciledFilter,
    searchQuery,
    sortKey,
    sortDir,
  ]);

  const hasActiveFilters =
    showFailedCosts ||
    providerFilter !== '' ||
    stepFilter !== '' ||
    reconciledFilter !== 'all' ||
    searchQuery.trim() !== '';

  const resetFilters = () => {
    setShowFailedCosts(false);
    setProviderFilter('');
    setStepFilter('');
    setReconciledFilter('all');
    setSearchQuery('');
    setSortKey('createdAt');
    setSortDir('desc');
  };

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 space-y-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-medium text-slate-800">
            原始记录（{visible.length}
            {visible.length !== records.length ? ` / ${records.length}` : ''} 条）
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
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索 model / requestId / shot…"
            className="h-7 px-2.5 rounded-md border border-slate-200 text-[11px] text-slate-700 min-w-[180px] focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
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
            onChange={(e) => setStepFilter(e.target.value)}
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
            onChange={(e) => setReconciledFilter(e.target.value as 'all' | 'yes' | 'no')}
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
              onChange={(e) => setShowFailedCosts(e.target.checked)}
              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            显示失败计费
            {failedCount > 0 && !showFailedCosts && (
              <span className="text-slate-400">（{failedCount} 隐藏）</span>
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
                  {records.length === 0
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
                          r.provider === 'mountsea' && 'bg-purple-50 text-purple-700',
                          r.provider === 'fal' && 'bg-emerald-50 text-emerald-700',
                          r.provider === 'cloudflare' && 'bg-amber-50 text-amber-700',
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
    </div>
  );
}
