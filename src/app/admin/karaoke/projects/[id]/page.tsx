'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  RotateCcw,
  Ban,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Play,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { canAccessTab, firstAllowedTab } from '@/lib/admin-permissions';
import { StatusBadge } from '@/components/status-badge';
import { QueryState } from '@/components/query-state';
import { formatDate, cn } from '@/lib/utils';
import { useConfirm, useAlert } from '@/components/ui/dialog-provider';

interface KaraokeProjectDetail {
  project: {
    id: string;
    userId: string;
    title: string;
    mode: 'solo' | 'pet' | 'duet';
    status: string;
    stage: string;
    progressPercent: number;
    musicUrl: string;
    musicFilename: string;
    musicSourceDuration: number;
    musicStartTime: number;
    musicEndTime: number;
    musicDuration: number;
    primaryImageUrl: string;
    secondaryImageUrl: string | null;
    sceneTemplateId: string | null;
    scenePrompt: string;
    sceneImageUrl: string | null;
    aspectRatio: string;
    resolution: string;
    quality: string;
    lrcContent: string | null;
    lrcStatus: string;
    lrcError: string | null;
    watermarkEnabled: boolean;
    isPublic: boolean;
    resultUrl: string | null;
    cleanResultUrl: string | null;
    previewUrl: string | null;
    coverUrl: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    costSummary: Record<string, unknown> | null;
    creditsCost: number;
    promptVersion: string;
    runNumber: number;
    cancelRequestedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  user: {
    id: string;
    email: string | null;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  segments: Array<{
    id: string;
    segmentIndex: number;
    status: string;
    startTime: number;
    absoluteStartTime: number;
    duration: number;
    audioClipUrl: string | null;
    referenceImageUrl: string | null;
    prompt: string;
    negativePrompt: string | null;
    voiceRole: string | null;
    provider: string | null;
    model: string | null;
    attemptCount: number;
    videoUrl: string | null;
    lastFrameUrl: string | null;
    actualDuration: number | null;
    qualityScore: number | null;
    failureReason: string | null;
    failureDetail: string | null;
    startedAt: string | null;
    completedAt: string | null;
  }>;
  costRecords: Array<{
    id: string;
    segmentId: string | null;
    step: string;
    provider: string;
    model: string;
    quantity: string;
    quantityUnit: string;
    costNativeAmount: string | null;
    costNativeUnit: string | null;
    chargeCredits: number | null;
    success: boolean;
    reconciledAt: string | null;
    createdAt: string;
  }>;
}

type TabKey = 'overview' | 'segments' | 'costs' | 'operations';

const MODE_LABEL: Record<string, string> = { solo: 'Solo', pet: 'Pet', duet: 'Duet' };

const ACTIVE_STATUSES = new Set(['queued', 'preparing', 'generating', 'composing', 'cancelling']);

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
      <div className="text-slate-700 font-medium break-all">{children}</div>
    </div>
  );
}

export default function AdminKaraokeProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const alert = useAlert();
  const permissions = useAdminAuthStore((s) => s.permissions);
  const canRetry = useAdminAuthStore((s) => s.hasPermission('karaoke.projects.retry'));
  const canCancel = useAdminAuthStore((s) => s.hasPermission('karaoke.projects.cancel'));
  const [tab, setTab] = useState<TabKey>('overview');
  const [retryingSegmentId, setRetryingSegmentId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<KaraokeProjectDetail>({
    queryKey: ['admin', 'karaoke', 'project', id],
    queryFn: () => apiClient.get(`/admin/karaoke/projects/${id}`) as any,
    refetchInterval: 15_000,
  });

  const tabDefs = useMemo(
    () =>
      (
        [
          ['overview', '概览'],
          ['segments', `片段 (${data?.segments?.length ?? 0})`],
          ['costs', '成本明细'],
          ['operations', '操作'],
        ] as [TabKey, string][]
      ).filter(([key]) => canAccessTab(permissions, 'karaoke.project.detail', key)),
    [permissions, data],
  );

  useEffect(() => {
    if (!tabDefs.length) return;
    if (!tabDefs.some(([k]) => k === tab)) {
      const first = firstAllowedTab(permissions, 'karaoke.project.detail') as TabKey | null;
      if (first) setTab(first);
    }
  }, [tabDefs, tab, permissions]);

  const retryMutation = useMutation({
    mutationFn: () => apiClient.post(`/admin/karaoke/projects/${id}/retry`, {}) as any,
    onSuccess: () => refetch(),
    onError: async (err: any) => {
      await alert({ title: '重试失败', description: err?.message ?? String(err), variant: 'danger' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiClient.post(`/admin/karaoke/projects/${id}/cancel`, {}) as any,
    onSuccess: () => refetch(),
    onError: async (err: any) => {
      await alert({ title: '取消失败', description: err?.message ?? String(err), variant: 'danger' });
    },
  });

  const retrySegmentMutation = useMutation({
    mutationFn: (segmentId: string) =>
      apiClient.post(`/admin/karaoke/projects/${id}/segments/${segmentId}/retry`, {}) as any,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'karaoke', 'project', id] });
      refetch();
    },
    onError: async (err: any) => {
      await alert({ title: '片段重试失败', description: err?.message ?? String(err), variant: 'danger' });
    },
    onSettled: () => setRetryingSegmentId(null),
  });

  const handleRetryProject = async () => {
    if (!data) return;
    const ok = await confirm({
      title: `重试项目「${data.project.title || data.project.id}」？`,
      description: '将重新排队并从上次失败点继续，已完成的片段不会重新生成。',
      confirmText: '重试',
    });
    if (ok) retryMutation.mutate();
  };

  const handleCancelProject = async () => {
    if (!data) return;
    const ok = await confirm({
      title: `取消项目「${data.project.title || data.project.id}」？`,
      description: '将标记为取消中，等待当前调用安全结束后停止。',
      variant: 'danger',
      confirmText: '取消项目',
    });
    if (ok) cancelMutation.mutate();
  };

  const handleRetrySegment = async (segmentId: string, segmentIndex: number) => {
    const ok = await confirm({
      title: `重试片段 #${segmentIndex + 1}？`,
      description: '将重新生成该片段视频，其它片段不受影响。',
      confirmText: '重试片段',
    });
    if (!ok) return;
    setRetryingSegmentId(segmentId);
    retrySegmentMutation.mutate(segmentId);
  };

  const project = data?.project;
  const segments = data?.segments ?? [];
  const costRecords = data?.costRecords ?? [];

  const showRetry = canRetry && project?.status === 'failed';
  const showCancel = canCancel && project && ACTIVE_STATUSES.has(project.status);

  return (
    <div className="admin-page">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/karaoke/projects"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            返回项目列表
          </Link>
          {project && (showRetry || showCancel) && (
            <div className="flex items-center gap-2">
              {showRetry && (
                <button
                  onClick={handleRetryProject}
                  disabled={retryMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {retryMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  重试项目
                </button>
              )}
              {showCancel && (
                <button
                  onClick={handleCancelProject}
                  disabled={cancelMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  {cancelMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Ban className="h-3.5 w-3.5" />
                  )}
                  取消项目
                </button>
              )}
            </div>
          )}
        </div>

        <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={!project} height="h-96">
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
                    <StatusBadge status={project.status} kind="karaokeProject" />
                    <span className="text-xs text-slate-400">
                      {project.progressPercent}% · {project.stage}
                    </span>
                  </div>
                </div>

                {project.errorMessage && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div>
                      {project.errorCode && (
                        <p className="font-mono font-medium mb-0.5">{project.errorCode}</p>
                      )}
                      <p className="break-all">{project.errorMessage}</p>
                    </div>
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
                  <Meta label="模式">{MODE_LABEL[project.mode] ?? project.mode}</Meta>
                  <Meta label="画幅 / 分辨率">
                    {project.aspectRatio} · {project.resolution}
                  </Meta>
                  <Meta label="品质">{project.quality}</Meta>
                  <Meta label="音乐时长">{project.musicDuration?.toFixed?.(1)}s</Meta>
                  <Meta label="LRC 状态">{project.lrcStatus}</Meta>
                  <Meta label="积分消耗">{project.creditsCost}</Meta>
                  <Meta label="创建时间">{formatDate(project.createdAt)}</Meta>
                  <Meta label="公开状态">{project.isPublic ? '已公开' : '未公开'}</Meta>
                  <Meta label="水印">{project.watermarkEnabled ? '保留' : '已移除'}</Meta>
                  <Meta label="Prompt 版本">{project.promptVersion}</Meta>
                  <Meta label="重跑次数">{project.runNumber}</Meta>
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
                  {tab === 'overview' && <OverviewTab project={project} />}
                  {tab === 'segments' && (
                    <SegmentsTab
                      segments={segments}
                      canRetry={canRetry}
                      retryingSegmentId={retryingSegmentId}
                      isRetrying={retrySegmentMutation.isPending}
                      onRetry={handleRetrySegment}
                    />
                  )}
                  {tab === 'costs' && <CostsTab records={costRecords} />}
                  {tab === 'operations' && (
                    <OperationsTab
                      project={project}
                      canRetry={showRetry}
                      canCancel={!!showCancel}
                      isRetrying={retryMutation.isPending}
                      isCancelling={cancelMutation.isPending}
                      onRetry={handleRetryProject}
                      onCancel={handleCancelProject}
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

function MediaLink({ label, url }: { label: string; url: string | null | undefined }) {
  if (!url) {
    return (
      <Meta label={label}>
        <span className="text-slate-300">—</span>
      </Meta>
    );
  }
  return (
    <Meta label={label}>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
      >
        查看
        <ExternalLink className="h-3 w-3" />
      </a>
    </Meta>
  );
}

function OverviewTab({ project }: { project: KaraokeProjectDetail['project'] }) {
  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
          音乐
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <Meta label="文件名">{project.musicFilename}</Meta>
          <Meta label="原始时长">{project.musicSourceDuration?.toFixed?.(1)}s</Meta>
          <Meta label="裁剪区间">
            {project.musicStartTime?.toFixed?.(1)}s ~ {project.musicEndTime?.toFixed?.(1)}s
          </Meta>
          <MediaLink label="音乐文件" url={project.musicUrl} />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
          图像与场景
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <MediaLink label="主体照片" url={project.primaryImageUrl} />
          <MediaLink label="第二主体照片" url={project.secondaryImageUrl} />
          <Meta label="场景模板 ID">{project.sceneTemplateId ?? '—（自定义）'}</Meta>
          <MediaLink label="场景预览图" url={project.sceneImageUrl} />
        </div>
        {project.scenePrompt && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">场景 Prompt</p>
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3 leading-relaxed whitespace-pre-wrap">
              {project.scenePrompt}
            </p>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
          歌词字幕
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <Meta label="LRC 状态">{project.lrcStatus}</Meta>
          <Meta label="LRC 错误">{project.lrcError ?? '—'}</Meta>
        </div>
        {project.lrcContent && (
          <details className="mt-3">
            <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
              查看 LRC 原文
            </summary>
            <pre className="mt-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
              {project.lrcContent}
            </pre>
          </details>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
          成片
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <MediaLink label="成片（带水印）" url={project.resultUrl} />
          <MediaLink label="成片（无水印）" url={project.cleanResultUrl} />
          <MediaLink label="预览片段" url={project.previewUrl} />
          <MediaLink label="封面图" url={project.coverUrl} />
        </div>
        {project.resultUrl && (
          <div className="mt-3 rounded-xl overflow-hidden bg-slate-900 max-w-sm">
            <video src={project.resultUrl} controls className="w-full" poster={project.coverUrl ?? undefined} />
          </div>
        )}
      </section>

      {project.costSummary && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
            成本摘要（快照）
          </h3>
          <pre className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3 leading-relaxed overflow-x-auto">
            {JSON.stringify(project.costSummary, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}

function SegmentsTab({
  segments,
  canRetry,
  retryingSegmentId,
  isRetrying,
  onRetry,
}: {
  segments: KaraokeProjectDetail['segments'];
  canRetry: boolean;
  retryingSegmentId: string | null;
  isRetrying: boolean;
  onRetry: (segmentId: string, segmentIndex: number) => void;
}) {
  if (!segments.length) {
    return <p className="text-center text-sm text-slate-400 py-8">暂无片段数据</p>;
  }
  return (
    <div className="space-y-3">
      {segments
        .slice()
        .sort((a, b) => a.segmentIndex - b.segmentIndex)
        .map((seg) => {
          const isPending = isRetrying && retryingSegmentId === seg.id;
          return (
            <div key={seg.id} className="border border-slate-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">
                    片段 #{seg.segmentIndex + 1}
                  </span>
                  <StatusBadge status={seg.status} kind="karaokeSegment" />
                  {seg.voiceRole && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-100">
                      {seg.voiceRole}
                    </span>
                  )}
                </div>
                {canRetry && seg.status === 'failed' && (
                  <button
                    onClick={() => onRetry(seg.id, seg.segmentIndex)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                  >
                    {isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    重试片段
                  </button>
                )}
              </div>

              <div className="mt-2.5 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <Meta label="时间区间">
                  {seg.startTime.toFixed(1)}s ~ {(seg.startTime + seg.duration).toFixed(1)}s
                  <span className="text-slate-400"> ({seg.duration.toFixed(1)}s)</span>
                </Meta>
                <Meta label="模型">
                  {seg.provider ?? '—'} {seg.model ? `· ${seg.model}` : ''}
                </Meta>
                <Meta label="尝试次数">{seg.attemptCount}</Meta>
                <Meta label="质量分">{seg.qualityScore ?? '—'}</Meta>
                <MediaLink label="片段视频" url={seg.videoUrl} />
                <MediaLink label="末帧图" url={seg.lastFrameUrl} />
                <MediaLink label="参考图" url={seg.referenceImageUrl} />
                <MediaLink label="音频片段" url={seg.audioClipUrl} />
              </div>

              {seg.failureReason && (
                <div className="mt-2.5 flex items-start gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-mono font-medium">{seg.failureReason}</p>
                    {seg.failureDetail && <p className="mt-0.5 text-red-500/80">{seg.failureDetail}</p>}
                  </div>
                </div>
              )}

              <details className="mt-2.5">
                <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
                  查看 Prompt
                </summary>
                <div className="mt-1.5 space-y-1.5">
                  <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2.5 leading-relaxed whitespace-pre-wrap">
                    {seg.prompt}
                  </p>
                  {seg.negativePrompt && (
                    <p className="text-[11px] text-red-500/80 bg-red-50/50 border border-red-100 rounded-lg p-2.5 leading-relaxed whitespace-pre-wrap">
                      负向：{seg.negativePrompt}
                    </p>
                  )}
                </div>
              </details>
            </div>
          );
        })}
    </div>
  );
}

const QUANTITY_UNIT_LABEL: Record<string, string> = {
  second: '秒',
  image: '张',
  minute_audio: '分钟音频',
  token: 'token',
  request: '次',
};

function CostsTab({ records }: { records: KaraokeProjectDetail['costRecords'] }) {
  if (!records.length) {
    return <p className="text-center text-sm text-slate-400 py-8">暂无成本记录</p>;
  }
  const totalCredits = records.reduce((sum, r) => sum + (r.chargeCredits ?? 0), 0);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>
          共 <span className="font-semibold text-slate-800">{records.length}</span> 条记录
        </span>
        <span>
          积分合计 <span className="font-semibold text-slate-800">{totalCredits}</span>
        </span>
      </div>
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-[11px] uppercase tracking-wider text-slate-400">
              <th className="text-left px-3 py-2 font-medium">步骤</th>
              <th className="text-left px-3 py-2 font-medium">渠道 / 模型</th>
              <th className="text-right px-3 py-2 font-medium">用量</th>
              <th className="text-right px-3 py-2 font-medium">原生成本</th>
              <th className="text-right px-3 py-2 font-medium">积分</th>
              <th className="text-center px-3 py-2 font-medium">状态</th>
              <th className="text-left px-3 py-2 font-medium">时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 text-slate-700 font-medium">{r.step}</td>
                <td className="px-3 py-2 text-slate-500 text-xs">
                  {r.provider} · {r.model}
                </td>
                <td className="px-3 py-2 text-right text-slate-600 tabular-nums">
                  {r.quantity} {QUANTITY_UNIT_LABEL[r.quantityUnit] ?? r.quantityUnit}
                </td>
                <td className="px-3 py-2 text-right text-slate-600 tabular-nums">
                  {r.costNativeAmount ?? '—'} {r.costNativeUnit ?? ''}
                </td>
                <td className="px-3 py-2 text-right text-slate-800 font-medium tabular-nums">
                  {r.chargeCredits ?? '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={cn(
                      'inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium',
                      r.success
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700',
                    )}
                  >
                    {r.success ? '成功' : '失败'}
                  </span>
                  {r.reconciledAt && (
                    <span className="block mt-0.5 text-[9px] text-emerald-500">已对账</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-slate-400">{formatDate(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OperationsTab({
  project,
  canRetry,
  canCancel,
  isRetrying,
  isCancelling,
  onRetry,
  onCancel,
}: {
  project: KaraokeProjectDetail['project'];
  canRetry: boolean;
  canCancel: boolean;
  isRetrying: boolean;
  isCancelling: boolean;
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">项目操作</h3>
        <p className="mt-1 text-xs text-slate-500">
          针对当前项目的重试 / 取消操作，作用于整片流程（片段级重试请在「片段」标签中操作）。
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-800">重试项目</p>
          <p className="mt-0.5 text-xs text-slate-500">
            仅当项目状态为「失败」时可用，将重新排队并从上次失败点继续。
          </p>
        </div>
        <button
          onClick={onRetry}
          disabled={!canRetry || isRetrying}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 flex-shrink-0"
        >
          {isRetrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          重试项目
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-800">取消项目</p>
          <p className="mt-0.5 text-xs text-slate-500">
            仅当项目处于运行中状态时可用，将标记为取消中，等待当前调用安全结束后停止。
          </p>
        </div>
        <button
          onClick={onCancel}
          disabled={!canCancel || isCancelling}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 disabled:opacity-40 flex-shrink-0"
        >
          {isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
          取消项目
        </button>
      </div>

      {project.cancelRequestedAt && (
        <p className="text-xs text-amber-600">
          取消请求已于 {formatDate(project.cancelRequestedAt)} 提交。
        </p>
      )}

      {project.resultUrl && (
        <a
          href={project.resultUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
        >
          <Play className="h-3.5 w-3.5" />
          在新标签页打开成片
        </a>
      )}
    </div>
  );
}
