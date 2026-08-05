'use client';

import { use } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, ListOrdered, Loader2, RotateCcw } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { useAlert, useConfirm } from '@/components/ui/dialog-provider';

interface TaskStep {
  id: string;
  stepIndex: number;
  nodeType: string;
  nodeKey: string;
  status: string;
  attemptCount: number;
  providerTaskId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

interface TaskAttempt {
  id: string;
  stepId: string | null;
  provider: string;
  model: string;
  capability: string;
  success: boolean;
  elapsedMs: number | null;
  errorKind: string | null;
  errorMessage: string | null;
  resultUrl: string | null;
  createdAt: string;
}

interface TaskDetail {
  id: string;
  userId: string;
  templateId: string;
  templateVersionId: string;
  status: string;
  currentStep: string | null;
  progressPercent: number;
  inputParams: Record<string, unknown>;
  outputParams: Record<string, unknown>;
  configSnapshot: Record<string, unknown>;
  estimatedCredits: number;
  chargedCredits: number;
  refundedCredits: number;
  resultUrl: string | null;
  coverUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  cancelRequestedAt: string | null;
  createdAt: string;
  updatedAt: string;
  steps: TaskStep[];
  attempts: TaskAttempt[];
}

const ACTIVE = new Set([
  'CREATED',
  'VALIDATING',
  'RESERVED',
  'QUEUED',
  'VIDEO_GENERATING',
  'UPLOADING',
]);

const STATUS_CLASS: Record<string, string> = {
  SUCCEEDED: 'bg-emerald-50 text-emerald-600',
  FAILED: 'bg-red-50 text-red-600',
  CANCELED: 'bg-slate-100 text-slate-400',
  VIDEO_GENERATING: 'bg-blue-50 text-blue-600',
  QUEUED: 'bg-amber-50 text-amber-600',
};

export default function AdminVideoEffectTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const alert = useAlert();
  const canRetry = useAdminAuthStore((s) => s.hasPermission('effects.task.retry'));
  const canCancel = useAdminAuthStore((s) => s.hasPermission('effects.task.cancel'));

  const { data, isLoading, isError, error } = useQuery<TaskDetail>({
    queryKey: ['admin', 'video-effects', 'tasks', id],
    queryFn: () => apiClient.get(`/admin/video-effects/tasks/${id}`) as any,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status && ACTIVE.has(status) ? 5_000 : false;
    },
  });

  const retry = useMutation({
    mutationFn: () => apiClient.post(`/admin/video-effects/tasks/${id}/retry`, {}) as any,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'tasks', id] });
    },
    onError: async (err: any) => {
      await alert({ title: '重试失败', description: err?.message ?? String(err), variant: 'danger' });
    },
  });

  const cancel = useMutation({
    mutationFn: () => apiClient.post(`/admin/video-effects/tasks/${id}/cancel`, {}) as any,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'tasks', id] });
    },
    onError: async (err: any) => {
      await alert({ title: '取消失败', description: err?.message ?? String(err), variant: 'danger' });
    },
  });

  const handleRetry = async () => {
    const ok = await confirm({
      title: '重试该任务？',
      description: '任务将重置为 CREATED 并重新进入编排。',
      confirmText: '重试',
    });
    if (ok) retry.mutate();
  };

  const handleCancel = async () => {
    const ok = await confirm({
      title: '取消该任务？',
      description: '进行中的任务将被终止，并按策略退还积分。',
      variant: 'danger',
      confirmText: '取消任务',
    });
    if (ok) cancel.mutate();
  };

  return (
    <div className="admin-page">
      <div className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href="/admin/video-effects/tasks"
              className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回任务列表
            </Link>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <ListOrdered className="h-5 w-5 text-blue-600" />
              任务详情
            </h1>
            <p className="mt-1 font-mono text-xs text-slate-400">{id}</p>
          </div>
          {data && (
            <div className="flex gap-2">
              {canRetry && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={retry.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                >
                  {retry.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  重试
                </button>
              )}
              {canCancel && data.status && ACTIVE.has(data.status) && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={cancel.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  {cancel.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Ban className="h-3.5 w-3.5" />
                  )}
                  取消
                </button>
              )}
            </div>
          )}
        </div>

        <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
          {data && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={cn(
                      'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold',
                      STATUS_CLASS[data.status] ?? 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {data.status}
                  </span>
                  <span className="text-sm text-slate-600">{data.progressPercent}%</span>
                  {data.currentStep && (
                    <span className="text-xs text-slate-500">步骤：{data.currentStep}</span>
                  )}
                </div>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-3">
                  <Info label="用户" value={data.userId} mono />
                  <Info label="模板" value={data.templateId} mono />
                  <Info label="版本" value={data.templateVersionId} mono />
                  <Info label="预估积分" value={String(data.estimatedCredits)} />
                  <Info label="已扣积分" value={String(data.chargedCredits)} />
                  <Info label="已退积分" value={String(data.refundedCredits)} />
                  <Info label="重试次数" value={String(data.retryCount)} />
                  <Info label="创建时间" value={formatDate(data.createdAt)} />
                  <Info label="更新时间" value={formatDate(data.updatedAt)} />
                </div>
                {(data.errorCode || data.errorMessage) && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <p className="font-medium">{data.errorCode}</p>
                    {data.errorMessage && <p className="mt-0.5 text-xs">{data.errorMessage}</p>}
                  </div>
                )}
                {data.resultUrl && (
                  <p className="mt-3 text-sm">
                    <a
                      href={data.resultUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-blue-600 hover:text-blue-700"
                    >
                      查看结果
                    </a>
                  </p>
                )}
                {data.cancelRequestedAt && (
                  <p className="mt-2 text-xs text-amber-600">
                    取消请求于 {formatDate(data.cancelRequestedAt)}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 text-sm font-semibold text-slate-800">Config Snapshot</h2>
                <pre className="max-h-64 overflow-auto rounded-xl bg-slate-50 p-3 font-mono text-[11px] text-slate-600">
                  {JSON.stringify(data.configSnapshot ?? {}, null, 2)}
                </pre>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 text-sm font-semibold text-slate-800">步骤</h2>
                {!data.steps?.length ? (
                  <p className="text-sm text-slate-500">暂无步骤记录</p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                          <th className="px-3 py-2 text-left font-medium">#</th>
                          <th className="px-3 py-2 text-left font-medium">节点</th>
                          <th className="px-3 py-2 text-left font-medium">状态</th>
                          <th className="px-3 py-2 text-right font-medium">尝试</th>
                          <th className="px-3 py-2 text-left font-medium">错误</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.steps.map((s) => (
                          <tr key={s.id}>
                            <td className="px-3 py-2 text-xs text-slate-500">{s.stepIndex}</td>
                            <td className="px-3 py-2">
                              <p className="text-xs font-medium text-slate-700">{s.nodeType}</p>
                              <p className="font-mono text-[10px] text-slate-400">{s.nodeKey}</p>
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-600">{s.status}</td>
                            <td className="px-3 py-2 text-right text-xs text-slate-500">{s.attemptCount}</td>
                            <td className="px-3 py-2 text-xs text-red-500">
                              {s.errorCode || s.errorMessage || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="mb-3 text-sm font-semibold text-slate-800">Attempts</h2>
                {!data.attempts?.length ? (
                  <p className="text-sm text-slate-500">暂无 attempt 记录</p>
                ) : (
                  <div className="space-y-2">
                    {data.attempts.map((a) => (
                      <div key={a.id} className="rounded-xl border border-slate-100 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span className="font-mono text-slate-400">{a.id.slice(0, 8)}</span>
                          <span className={a.success ? 'text-emerald-600' : 'text-red-500'}>
                            {a.success ? '成功' : '失败'}
                          </span>
                          <span>{a.provider}</span>
                          <span>{a.model}</span>
                          <span className="text-slate-400">{a.capability}</span>
                          {a.elapsedMs != null && <span>{a.elapsedMs}ms</span>}
                          <span className="text-slate-400">{formatDate(a.createdAt)}</span>
                        </div>
                        {(a.errorKind || a.errorMessage) && (
                          <p className="mt-1 text-xs text-red-500">
                            {a.errorKind ?? ''} {a.errorMessage ?? ''}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="mb-3 text-sm font-semibold text-slate-800">Input Params</h2>
                  <pre className="max-h-56 overflow-auto rounded-xl bg-slate-50 p-3 font-mono text-[11px] text-slate-600">
                    {JSON.stringify(data.inputParams ?? {}, null, 2)}
                  </pre>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="mb-3 text-sm font-semibold text-slate-800">Output Params</h2>
                  <pre className="max-h-56 overflow-auto rounded-xl bg-slate-50 p-3 font-mono text-[11px] text-slate-600">
                    {JSON.stringify(data.outputParams ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </QueryState>
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn('mt-0.5 break-all text-slate-700', mono && 'font-mono text-xs')}>{value}</p>
    </div>
  );
}
