'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { useState } from 'react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { StatusBadge } from '@/components/status-badge';
import { formatDate, cn } from '@/lib/utils';
import { labelMvFailureReason } from '@/lib/mv-failure-reasons';
import type { AnomalyShotItem } from '../../_components/anomaly-shots-page';

type AnomalyDetail = AnomalyShotItem & {
  kind?: string;
  lipsyncVideoUrl?: string | null;
  negativePrompt?: string | null;
  referenceImageUrl?: string | null;
  continuityFrameUrl?: string | null;
  lastFrameUrl?: string | null;
  primaryImageUrl?: string | null;
  secondaryImageUrl?: string | null;
  sceneId?: string | null;
  frameSize?: string | null;
  cameraAngle?: string | null;
  cameraMotion?: string | null;
  label?: string | null;
  stage?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  absoluteStartTime?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  configSnapshot?: Record<string, unknown> | null;
  segmentMetadata?: Record<string, unknown> | null;
  costStep?: string | null;
  videoTaskIdRaw?: string | null;
};

function Field({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{label}</p>
      </div>
      <div
        className={cn(
          'max-w-[60%] shrink-0 text-right text-sm text-slate-700 break-all',
          mono && 'font-mono text-xs',
        )}
      >
        {children ?? <span className="text-slate-400">—</span>}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          /* ignore */
        }
      }}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
    >
      {ok ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {ok ? '已复制' : '复制'}
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </h2>
      </div>
      <div className="divide-y divide-slate-100 px-5 py-2">{children}</div>
    </div>
  );
}

export default function AnomalyDetailPage() {
  const params = useParams<{ product: string; id: string }>();
  const searchParams = useSearchParams();
  const product = params.product === 'karaoke' ? 'karaoke' : 'mv';
  const id = params.id;
  const kind = searchParams.get('kind') || undefined;

  const { data, isLoading, isError, error } = useQuery<AnomalyDetail>({
    queryKey: ['admin', 'mv', 'anomalies', 'detail', product, id, kind],
    queryFn: () =>
      apiClient.get(`/admin/mv/anomalies/${product}/${id}`, {
        params: kind ? { kind } : undefined,
      }) as Promise<AnomalyDetail>,
    enabled: !!id,
  });

  const listHref =
    (data?.kind || kind) === 'storyboards'
      ? '/admin/mv/anomalies/storyboards'
      : '/admin/mv/anomalies/failed-shots';

  const projectHref =
    product === 'karaoke'
      ? `/admin/karaoke/projects/${data?.projectId || id}`
      : `/admin/mv/projects/${data?.projectId || ''}`;

  const detailText =
    data?.failureDetail?.trim() ||
    (typeof data?.metadata?.lastVideoError === 'string'
      ? data.metadata.lastVideoError
      : null) ||
    data?.errorMessage ||
    null;

  return (
    <div className="admin-page">
      <div className="space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href={listHref}
              className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回异常列表
            </Link>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              错误详情
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {product === 'karaoke' ? 'Karaoke' : 'MV'} · 排查任务 ID、渠道、模型与完整错误信息
            </p>
          </div>
          {data && (
            <Link
              href={projectHref}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              打开项目
            </Link>
          )}
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!data}
          emptyMessage="未找到该异常记录"
          height="h-48"
        >
          {data && (
            <div className="space-y-4">
              <div
                className={cn(
                  'flex items-center justify-between gap-4 rounded-2xl border px-5 py-4',
                  data.anomalyKind === 'stuck'
                    ? 'border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50'
                    : 'border-red-200 bg-gradient-to-r from-red-50 to-rose-50',
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-slate-900">
                      {data.projectTitle || data.projectId}
                    </p>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        product === 'karaoke'
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {product === 'karaoke' ? 'Karaoke' : 'MV'}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        data.anomalyKind === 'stuck'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-red-100 text-red-700',
                      )}
                    >
                      {data.anomalyKind === 'stuck' ? '卡住 ≥30min' : '失败'}
                    </span>
                    <StatusBadge status={data.status} kind="generic" />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {data.failureReason
                      ? labelMvFailureReason(data.failureReason)
                      : data.anomalyKind === 'stuck'
                        ? labelMvFailureReason('__STUCK__')
                        : labelMvFailureReason('__NONE__')}
                    {data.failureReason ? ` · ${data.failureReason}` : ''}
                  </p>
                </div>
              </div>

              <Section title="概览">
                <Field label="记录 ID" mono>
                  <span className="inline-flex items-center gap-2">
                    {data.id}
                    <CopyButton text={data.id} />
                  </span>
                </Field>
                <Field label="项目 ID" mono>
                  <span className="inline-flex items-center gap-2">
                    {data.projectId}
                    <CopyButton text={data.projectId} />
                  </span>
                </Field>
                <Field label="镜头 / 片段">#{data.shotIndex}</Field>
                <Field label="用户">
                  {data.userDisplayName || '—'}
                  <span className="block text-xs text-slate-400">
                    {data.userEmail || data.userId}
                  </span>
                </Field>
                <Field label="项目状态">{data.projectStatus}</Field>
                {data.stage && <Field label="阶段">{data.stage}</Field>}
                <Field label="画质 / 比例">
                  {data.resolution} · {data.quality} · {data.aspectRatio}
                </Field>
                <Field label="更新时间">
                  {formatDate(new Date(data.updatedAt))}
                </Field>
                <Field label="创建时间">
                  {formatDate(new Date(data.createdAt))}
                </Field>
              </Section>

              <Section title="任务与渠道">
                <Field label="Task ID" mono>
                  {data.taskId ? (
                    <span className="inline-flex items-center gap-2">
                      {data.taskId}
                      <CopyButton text={data.taskId} />
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      —（镜头字段未写，且成本表无 provider_request_id；常见于提交前失败）
                    </span>
                  )}
                </Field>
                {data.videoTaskIdRaw != null && (
                  <Field label="镜头 video_task_id" mono>
                    {data.videoTaskIdRaw || '—'}
                  </Field>
                )}
                <Field label="成本步骤">{data.costStep || '—'}</Field>
                <Field label="Lipsync Task ID" mono>
                  {data.lipsyncTaskId || '—'}
                </Field>
                <Field label="渠道 (Provider)">{data.provider || '—'}</Field>
                <Field label="模型 (Model)" mono>
                  {data.model || '—'}
                </Field>
                <Field label="项目视频渠道">
                  {data.projectVideoProvider || '—'}
                </Field>
                <Field label="生成类型">{data.genType}</Field>
                <Field label="镜头类型">{data.shotType}</Field>
                <Field label="时长">
                  {typeof data.duration === 'number' ? `${data.duration}s` : '—'}
                  {typeof data.startTime === 'number' ? ` · start ${data.startTime}s` : ''}
                </Field>
                {typeof data.attemptCount === 'number' && (
                  <Field label="尝试次数">{data.attemptCount}</Field>
                )}
                <Field label="Lipsync">
                  {data.lipsync ? `是 · ${data.lipsyncStatus || '—'}` : '否'}
                </Field>
              </Section>

              <Section title="错误信息">
                <Field label="失败码" mono>
                  {data.failureReason || data.errorCode || '—'}
                </Field>
                <Field label="展示文案">
                  {data.failureReason
                    ? labelMvFailureReason(data.failureReason)
                    : '—'}
                </Field>
                <div className="py-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">错误详情</p>
                    {detailText && <CopyButton text={detailText} />}
                  </div>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-[12px] border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
                    {detailText || '（无详细错误文本）'}
                  </pre>
                </div>
              </Section>

              <Section title="媒体">
                <Field label="故事板 / 场景图">
                  {data.storyboardImageUrl ? (
                    <a
                      href={data.storyboardImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={data.storyboardImageUrl}
                        alt=""
                        className="h-28 w-auto rounded-lg border border-slate-200 object-cover"
                      />
                    </a>
                  ) : (
                    '—'
                  )}
                </Field>
                {data.primaryImageUrl && (
                  <Field label="用户原图">
                    <a href={data.primaryImageUrl} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={data.primaryImageUrl}
                        alt=""
                        className="ml-auto h-20 w-auto rounded-lg border border-slate-200 object-cover"
                      />
                    </a>
                  </Field>
                )}
                <Field label="视频 URL" mono>
                  {data.videoUrl ? (
                    <a
                      href={data.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      打开
                    </a>
                  ) : (
                    '—'
                  )}
                </Field>
                {data.lipsyncVideoUrl && (
                  <Field label="Lipsync 视频">
                    <a
                      href={data.lipsyncVideoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      打开
                    </a>
                  </Field>
                )}
                {data.referenceImageUrl && (
                  <Field label="参考图" mono>
                    <a
                      href={data.referenceImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      打开
                    </a>
                  </Field>
                )}
                {data.continuityFrameUrl && (
                  <Field label="连续性帧" mono>
                    <a
                      href={data.continuityFrameUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      打开
                    </a>
                  </Field>
                )}
              </Section>

              <Section title="Prompt">
                <div className="space-y-3 py-3">
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-500">故事板 Prompt</p>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-[12px] border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      {data.storyboardPrompt || '—'}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-500">视频 Prompt</p>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-[12px] border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      {data.prompt || '—'}
                    </pre>
                  </div>
                  {data.negativePrompt && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-slate-500">Negative Prompt</p>
                      <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-[12px] border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        {data.negativePrompt}
                      </pre>
                    </div>
                  )}
                </div>
              </Section>

              {(data.sceneId || data.frameSize || data.cameraAngle || data.label) && (
                <Section title="镜头元信息">
                  {data.label && <Field label="Label">{data.label}</Field>}
                  {data.sceneId && (
                    <Field label="Scene ID" mono>
                      {data.sceneId}
                    </Field>
                  )}
                  {data.frameSize && <Field label="景别">{data.frameSize}</Field>}
                  {data.cameraAngle && <Field label="机位">{data.cameraAngle}</Field>}
                  {data.cameraMotion && <Field label="运镜">{data.cameraMotion}</Field>}
                </Section>
              )}

              <Section title="原始 Metadata">
                <div className="py-3">
                  <div className="mb-2 flex justify-end">
                    <CopyButton text={JSON.stringify(data.metadata ?? {}, null, 2)} />
                  </div>
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-[12px] border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-700">
                    {JSON.stringify(data.metadata ?? {}, null, 2)}
                  </pre>
                </div>
              </Section>

              {data.configSnapshot && (
                <Section title="Karaoke Config Snapshot">
                  <div className="py-3">
                    <div className="mb-2 flex justify-end">
                      <CopyButton text={JSON.stringify(data.configSnapshot, null, 2)} />
                    </div>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-[12px] border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-700">
                      {JSON.stringify(data.configSnapshot, null, 2)}
                    </pre>
                  </div>
                </Section>
              )}
            </div>
          )}
        </QueryState>
      </div>
    </div>
  );
}
