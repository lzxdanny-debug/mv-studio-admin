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
} from 'lucide-react';
import apiClient from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { ShotCard, ShotCardData } from '@/components/shot-card';
import { QueryState } from '@/components/query-state';
import { formatDate, cn } from '@/lib/utils';
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

type TabKey = 'overview' | 'shots' | 'planning' | 'history' | 'costs';

/**
 * 项目成本明细接口返回（GET /admin/mv/projects/:id/costs）
 *
 * 设计要点：
 *   - records 是按时间顺序的全量原始记录，前端可以做"时间线视图"
 *   - byStep / byProvider 是聚合桶，给汇总卡片用
 *   - totals.mountsea_credits / fal_usd / cloudflare_neuron 三种**原生**计费单位并存，
 *     不做汇率换算，避免"估算 RMB 把误差放大"的副作用（这是阶段 1 设计共识，
 *     等阶段 2 做面向用户的 charge_credits 时再统一换算）
 *   - priceTableMatched=false 时，DB 记录的 cost 与当前价格表不一致（说明价格表更新了
 *     但历史记录没回填），前端可以显眼标注让运维知道"这条数据该刷一下"
 */
interface CostBucket {
  calls: number;
  success: number;
  failure: number;
  mountsea_credits: number;
  fal_usd: number;
  cloudflare_neuron: number;
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
  lrc_transcribe: 'LRC 转写',
  music_analyze: '音乐分析',
  storyboard_image: '故事板图',
  video_gen: '镜头视频',
  lipsync_post: '口型后处理',
};

export default function AdminMvProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const alert = useAlert();
  const [tab, setTab] = useState<TabKey>('overview');
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
                      ['overview', '概览'],
                      ['shots', `镜头 (${shots.length})`],
                      ['planning', `规划步骤 (${planning.length})`],
                      ['history', `成片历史 (${(project.compositionHistory?.length ?? 0) + (project.resultUrl ? 1 : 0)})`],
                      ['costs', '成本明细'],
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
                  {tab === 'overview' && <OverviewTab project={project} />}
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
                  {tab === 'costs' && <CostsTab projectId={id} />}
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

function OverviewTab({ project }: { project: MvProjectDetail['project'] }) {
  return (
    <div className="space-y-4">
      {project.resultUrl && (
        <div>
          <p className="text-xs text-slate-500 mb-2">最新成片</p>
          <video
            src={project.resultUrl}
            controls
            className="w-full max-w-xl rounded-xl bg-black"
          />
        </div>
      )}
      <div>
        <p className="text-xs text-slate-500 mb-2">原始音乐</p>
        <audio src={project.musicUrl} controls className="w-full max-w-xl" />
        <p className="text-xs text-slate-400 mt-1 truncate">{project.musicFilename}</p>
      </div>
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
 *   - 三种原生计费单位（Mountsea credits / Fal USD / Cloudflare Neuron）并存，不做汇率换算
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

  // 统计已对账 / 未对账 / 误差
  const reconStats = useMemo(() => {
    if (!data) return null;
    let reconciled = 0;
    let unreconciled = 0;
    let totalEstUsd = 0;
    let totalRealUsd = 0;
    for (const r of data.records) {
      if (r.reconciledAt) reconciled++;
      else unreconciled++;
      // 仅 USD 单位的简单累加（mountsea credits/cf neuron 不汇总到这里，避免单位混淆）
      if (r.costNativeUnit === 'usd' && r.costNativeAmount != null) totalEstUsd += r.costNativeAmount;
      if (r.reconciledAmount != null && (r.reconciledSource === 'fal_billing_events' || r.reconciledSource === 'cf_aig_logs')) {
        totalRealUsd += r.reconciledAmount;
      }
    }
    return { reconciled, unreconciled, totalEstUsd, totalRealUsd };
  }, [data]);

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
            <div className="rounded-xl border bg-slate-50 px-4 py-3 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4 flex-wrap text-sm">
                <span className="text-slate-700">
                  对账状态：
                  <span className="font-semibold text-emerald-700 ml-1">{reconStats.reconciled} 已对账</span>
                  <span className="mx-1 text-slate-300">/</span>
                  <span className="font-semibold text-amber-700">{reconStats.unreconciled} 估算中</span>
                </span>
                {reconStats.totalRealUsd > 0 && (
                  <span className="text-slate-600">
                    USD 部分：估算 ${reconStats.totalEstUsd.toFixed(4)} → 真实 ${reconStats.totalRealUsd.toFixed(4)}
                    {reconStats.totalEstUsd > 0 && (
                      <span className={cn(
                        'ml-2 px-1.5 py-0.5 rounded text-xs font-mono',
                        reconStats.totalRealUsd > reconStats.totalEstUsd
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700',
                      )}>
                        {reconStats.totalRealUsd > reconStats.totalEstUsd ? '+' : ''}
                        {(((reconStats.totalRealUsd - reconStats.totalEstUsd) / reconStats.totalEstUsd) * 100).toFixed(1)}%
                      </span>
                    )}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => reconcileMutation.mutate()}
                disabled={reconcileMutation.isPending}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-medium transition"
              >
                {reconcileMutation.isPending ? '对账中…' : '立即对账'}
              </button>
            </div>
          )}

          <CostHeaderCards totals={data.totals} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CostBreakdownCard
              title="按步骤聚合"
              labelMap={STEP_TAG_LABELS}
              buckets={data.byStep}
            />
            <CostBreakdownCard
              title="按 Provider 聚合"
              buckets={data.byProvider}
            />
          </div>
          <CostRecordsTable records={data.records} />
        </div>
      )}
    </QueryState>
  );
}

function CostHeaderCards({ totals }: { totals: CostBucket }) {
  // 三栏并列展示原生单位，按数值大小自动着色（非 0 高亮）
  const cards: Array<{ label: string; value: number; suffix: string; color: string }> = [
    {
      label: 'Mountsea',
      value: totals.mountsea_credits,
      suffix: 'credits',
      color: 'from-purple-50 to-purple-100 text-purple-700 border-purple-200',
    },
    {
      label: 'Fal',
      value: totals.fal_usd,
      suffix: 'USD',
      color: 'from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200',
    },
    {
      label: 'Cloudflare',
      value: totals.cloudflare_neuron,
      suffix: 'Neuron',
      color: 'from-amber-50 to-amber-100 text-amber-700 border-amber-200',
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((c) => (
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
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums">
              {c.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
            <span className="text-xs opacity-70">{c.suffix}</span>
          </div>
          <div className="text-[11px] opacity-60 mt-1">
            {totals.calls} 次调用 · 成功 {totals.success} / 失败 {totals.failure}
          </div>
        </div>
      ))}
    </div>
  );
}

function CostBreakdownCard({
  title,
  buckets,
  labelMap,
}: {
  title: string;
  buckets: Record<string, CostBucket>;
  labelMap?: Record<string, string>;
}) {
  // 按总调用次数倒序，让"最热"维度排最上面
  const rows = Object.entries(buckets).sort((a, b) => b[1].calls - a[1].calls);
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
              <th className="text-right pb-2 font-medium">Mountsea</th>
              <th className="text-right pb-2 font-medium">Fal $</th>
              <th className="text-right pb-2 font-medium">CF Neu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(([k, b]) => (
              <tr key={k}>
                <td className="py-1.5 text-slate-700">
                  <span className="font-medium">{labelMap?.[k] ?? k}</span>
                  <span className="text-slate-400 ml-1.5 text-[11px]">
                    {b.success}✓ {b.failure > 0 ? `${b.failure}✗` : ''}
                  </span>
                </td>
                <td className="py-1.5 text-right tabular-nums text-slate-600">{b.calls}</td>
                <td className="py-1.5 text-right tabular-nums text-purple-600">
                  {b.mountsea_credits > 0 ? b.mountsea_credits.toFixed(2) : '—'}
                </td>
                <td className="py-1.5 text-right tabular-nums text-emerald-600">
                  {b.fal_usd > 0 ? b.fal_usd.toFixed(4) : '—'}
                </td>
                <td className="py-1.5 text-right tabular-nums text-amber-600">
                  {b.cloudflare_neuron > 0 ? b.cloudflare_neuron.toFixed(0) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CostRecordsTable({ records }: { records: ProjectCosts['records'] }) {
  // 时间倒序，最新记录排最上面，方便排查"刚刚那次失败到底烧了多少"
  const sorted = [...records].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-800">原始记录（{records.length} 条）</p>
        <p className="text-[11px] text-slate-400">
          <span className="text-amber-600">⚠️</span> 价格表已变更 ·
          <span className="ml-2 px-1 py-0.5 rounded bg-emerald-50 text-emerald-700">已对账</span>
          <span className="ml-1 px-1 py-0.5 rounded bg-amber-50 text-amber-700">估算中</span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[11px] text-slate-500 bg-slate-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium">时间</th>
              <th className="text-left px-3 py-2 font-medium">步骤</th>
              <th className="text-left px-3 py-2 font-medium">Provider · Model</th>
              <th className="text-right px-3 py-2 font-medium">Quantity</th>
              <th className="text-right px-3 py-2 font-medium">估算 Cost</th>
              <th className="text-right px-3 py-2 font-medium">真实账单</th>
              <th className="text-right px-3 py-2 font-medium">耗时</th>
              <th className="text-center px-3 py-2 font-medium">状态</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sorted.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleTimeString()}
                </td>
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                  <span className="font-medium">{STEP_TAG_LABELS[r.step] ?? r.step}</span>
                  {r.shotId && (
                    <span className="ml-1 text-slate-400 text-[10px]">
                      shot #{r.shotId.slice(0, 4)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                  <span
                    className={cn(
                      'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-1.5',
                      r.provider === 'mountsea' && 'bg-purple-50 text-purple-700',
                      r.provider === 'fal' && 'bg-emerald-50 text-emerald-700',
                      r.provider === 'cloudflare' && 'bg-amber-50 text-amber-700',
                    )}
                  >
                    {r.provider}
                  </span>
                  <span className="font-mono text-[11px]">{r.model}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700 whitespace-nowrap">
                  {r.quantity}
                  <span className="text-slate-400 ml-1">{r.quantityUnit}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                  {r.costNativeAmount != null ? (
                    <span
                      className={cn(
                        'font-medium',
                        r.costNativeUnit === 'credits' && 'text-purple-700',
                        r.costNativeUnit === 'usd' && 'text-emerald-700',
                        r.costNativeUnit === 'neuron' && 'text-amber-700',
                      )}
                    >
                      {r.costNativeAmount.toFixed(r.costNativeUnit === 'usd' ? 4 : 2)}
                      <span className="text-slate-400 text-[10px] ml-0.5">
                        {r.costNativeUnit === 'credits' ? 'C' : r.costNativeUnit === 'usd' ? '$' : 'N'}
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
                  {r.reconciledAmount != null ? (
                    <span title={`来源：${r.reconciledSource}\n对账时间：${r.reconciledAt}`}>
                      <span className="font-semibold text-emerald-700">
                        {r.reconciledAmount.toFixed(r.reconciledSource === 'mountsea_usage' ? 0 : 4)}
                      </span>
                      <span className="text-slate-400 text-[10px] ml-0.5">
                        {r.reconciledSource === 'mountsea_usage' ? 'C' : '$'}
                      </span>
                      {r.reconciledDiffPct != null && Math.abs(r.reconciledDiffPct) >= 5 && (
                        <span
                          className={cn(
                            'ml-1 px-1 py-0.5 rounded text-[9px] font-mono',
                            r.reconciledDiffPct > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700',
                          )}
                          title={`估算 ${r.costNativeAmount} → 实际 ${r.reconciledAmount}`}
                        >
                          {r.reconciledDiffPct > 0 ? '+' : ''}
                          {r.reconciledDiffPct}%
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-amber-500 text-[10px]" title="尚未对账，cron 每小时跑一次，或点上方「立即对账」">
                      估算中
                    </span>
                  )}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
