'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useState } from 'react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { formatDate, cn } from '@/lib/utils';
import { labelMvFailureReason } from '@/lib/mv-failure-reasons';

interface LlmAnomalyDetail {
  kind: string;
  product: 'mv' | 'karaoke' | 'dance';
  id: string;
  stepKey: string;
  stepLabel: string;
  planningStep?: number | null;
  stage?: string | null;
  revision?: number | null;
  anomalyKind: 'failed' | 'stuck';
  status: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  projectId: string;
  projectTitle: string;
  userId: string;
  userDisplayName?: string | null;
  userEmail?: string | null;
  provider?: string | null;
  model?: string | null;
  taskId?: string | null;
  retryCount?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  inputContext?: Record<string, unknown> | null;
  inputSnapshot?: Record<string, unknown> | null;
  outputData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  segmentId?: string | null;
  segmentFailureReason?: string | null;
  segmentFailureDetail?: string | null;
  lrcStatus?: string | null;
  projectErrorCode?: string | null;
  projectErrorMessage?: string | null;
  coreErrorLogs?: Array<{
    label: string;
    model: string;
    provider: string;
    ok: boolean;
    elapsedMs: number;
    errorMessage?: string;
  }>;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  recentCosts?: Array<{
    id: string;
    step: string;
    provider: string;
    model: string;
    success: boolean;
    elapsedMs: number | null;
    providerRequestId: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
}

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
      </div>
      <div className="divide-y divide-slate-100 px-5 py-2">{children}</div>
    </div>
  );
}

function projectHref(product: string, projectId: string) {
  if (product === 'karaoke') return `/admin/karaoke/projects/${projectId}`;
  if (product === 'dance') return `/admin/dance/projects`;
  return `/admin/mv/projects/${projectId}`;
}

function productLabel(product: string) {
  if (product === 'karaoke') return 'Karaoke';
  if (product === 'dance') return 'Dance';
  return 'MV';
}

function JsonBlock({ value }: { value: unknown }) {
  if (value == null) return <span className="text-slate-400">—</span>;
  const text = JSON.stringify(value, null, 2);
  const truncated = text.length > 8000 ? `${text.slice(0, 8000)}\n… (truncated)` : text;
  return (
    <pre className="max-h-80 overflow-auto rounded-xl bg-slate-50 p-3 text-left text-[11px] font-mono text-slate-700 whitespace-pre-wrap break-all">
      {truncated}
    </pre>
  );
}

export default function LlmAnomalyDetailPage() {
  const params = useParams<{ product: string; id: string }>();
  const product =
    params.product === 'karaoke' || params.product === 'dance' ? params.product : 'mv';
  const id = decodeURIComponent(params.id || '');

  const { data, isLoading, isError, error } = useQuery<LlmAnomalyDetail>({
    queryKey: ['admin', 'mv', 'anomalies', 'llm', 'detail', product, id],
    queryFn: () =>
      apiClient.get(
        `/admin/mv/anomalies/llm/${product}/${encodeURIComponent(id)}`,
      ) as Promise<LlmAnomalyDetail>,
    enabled: !!id,
  });

  const listHref = '/admin/mv/anomalies/llm';
  const pHref = projectHref(product, data?.projectId || '');

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
              返回语言大模型异常
            </Link>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <BrainCircuit className="h-5 w-5 text-amber-600" />
              LLM 错误详情
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {productLabel(product)} · 步骤分类、渠道模型与完整错误信息
            </p>
          </div>
          {data && (
            <Link
              href={pHref}
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
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                        data.anomalyKind === 'stuck'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-red-100 text-red-700',
                      )}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {data.anomalyKind === 'stuck' ? '卡住 ≥30min' : '失败'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{data.stepLabel}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Section title="基本信息">
                  <Field label="产品">{productLabel(data.product)}</Field>
                  <Field label="步骤">
                    <div className="space-y-1">
                      <div>{data.stepLabel}</div>
                      <div className="font-mono text-[11px] text-slate-400">{data.stepKey}</div>
                    </div>
                  </Field>
                  {data.planningStep != null && (
                    <Field label="规划 Step">{data.planningStep}</Field>
                  )}
                  {data.stage && <Field label="Dance Stage">{data.stage}</Field>}
                  {data.revision != null && <Field label="Revision">{data.revision}</Field>}
                  <Field label="状态">{data.status || '—'}</Field>
                  <Field label="记录 ID" mono>
                    <div className="flex items-center justify-end gap-2">
                      <span>{data.id}</span>
                      <CopyButton text={data.id} />
                    </div>
                  </Field>
                  <Field label="项目 ID" mono>
                    <div className="flex items-center justify-end gap-2">
                      <span>{data.projectId}</span>
                      <CopyButton text={data.projectId} />
                    </div>
                  </Field>
                  <Field label="用户">
                    {data.userDisplayName || data.userEmail || data.userId.slice(0, 8)}
                  </Field>
                  <Field label="更新时间">
                    {formatDate(new Date(data.updatedAt))}
                  </Field>
                </Section>

                <Section title="模型与任务">
                  <Field label="渠道">{data.provider || '—'}</Field>
                  <Field label="模型" mono>
                    {data.model || '—'}
                  </Field>
                  <Field label="Task ID" mono>
                    {data.taskId ? (
                      <div className="flex items-center justify-end gap-2">
                        <span>{data.taskId}</span>
                        <CopyButton text={data.taskId} />
                      </div>
                    ) : (
                      '—'
                    )}
                  </Field>
                  {data.retryCount != null && (
                    <Field label="重试次数">{data.retryCount}</Field>
                  )}
                  {data.promptTokens != null && (
                    <Field label="Prompt tokens">{data.promptTokens}</Field>
                  )}
                  {data.completionTokens != null && (
                    <Field label="Completion tokens">{data.completionTokens}</Field>
                  )}
                </Section>
              </div>

              <Section title="错误信息">
                <Field label="错误码">
                  {data.errorCode ? labelMvFailureReason(data.errorCode) : '—'}
                </Field>
                {data.errorCode && (
                  <Field label="错误码原文" mono>
                    {data.errorCode}
                  </Field>
                )}
                <div className="py-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">错误详情</p>
                    {data.errorMessage && <CopyButton text={data.errorMessage} />}
                  </div>
                  <p className="whitespace-pre-wrap break-all text-sm text-slate-700">
                    {data.errorMessage || '—'}
                  </p>
                </div>
                {data.projectErrorMessage &&
                  data.projectErrorMessage !== data.errorMessage && (
                    <div className="py-3">
                      <p className="mb-2 text-sm font-medium text-slate-800">项目级错误</p>
                      <p className="whitespace-pre-wrap break-all text-sm text-slate-700">
                        {data.projectErrorMessage}
                      </p>
                    </div>
                  )}
                {data.segmentFailureDetail && (
                  <div className="py-3">
                    <p className="mb-2 text-sm font-medium text-slate-800">片段失败详情</p>
                    <p className="whitespace-pre-wrap break-all text-sm text-slate-700">
                      {data.segmentFailureDetail}
                    </p>
                  </div>
                )}
              </Section>

              {data.coreErrorLogs && data.coreErrorLogs.length > 0 && (
                <Section title="核心错误日志（模型尝试轨迹）">
                  <div className="py-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs text-slate-500">
                        与控制台 CharacterVision / Router 失败日志对应，便于排查上游渠道问题
                      </p>
                      <CopyButton
                        text={data.coreErrorLogs
                          .map(
                            (l) =>
                              `[${l.label}] ${l.provider}/${l.model} ok=${l.ok} ${l.elapsedMs}ms${
                                l.errorMessage ? ` | ${l.errorMessage}` : ''
                              }`,
                          )
                          .join('\n')}
                      />
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-400">
                          <tr>
                            <th className="px-3 py-2 text-left whitespace-nowrap">Attempt</th>
                            <th className="px-3 py-2 text-left whitespace-nowrap">渠道</th>
                            <th className="px-3 py-2 text-left whitespace-nowrap">模型</th>
                            <th className="px-3 py-2 text-left whitespace-nowrap">结果</th>
                            <th className="px-3 py-2 text-left whitespace-nowrap">耗时</th>
                            <th className="px-3 py-2 text-left">错误详情</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.coreErrorLogs.map((log, idx) => (
                            <tr key={`${log.label}-${idx}`} className="align-top">
                              <td className="px-3 py-2 font-mono text-slate-600 whitespace-nowrap">
                                {log.label}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">{log.provider}</td>
                              <td className="px-3 py-2 font-mono whitespace-nowrap">{log.model}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {log.ok ? (
                                  <span className="text-emerald-600">成功</span>
                                ) : (
                                  <span className="text-red-600">失败</span>
                                )}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                                {log.elapsedMs}ms
                              </td>
                              <td className="px-3 py-2 text-slate-700 break-all max-w-[480px]">
                                {log.errorMessage || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Section>
              )}

              {(data.inputContext || data.inputSnapshot) && (
                <Section title="输入摘要">
                  <div className="py-3">
                    <JsonBlock value={data.inputContext || data.inputSnapshot} />
                  </div>
                </Section>
              )}

              {data.outputData && (
                <Section title="输出摘要">
                  <div className="py-3">
                    <JsonBlock value={data.outputData} />
                  </div>
                </Section>
              )}

              {data.recentCosts && data.recentCosts.length > 0 && (
                <Section title="相关成本记录">
                  <div className="overflow-x-auto py-2">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400">
                          <th className="px-2 py-1.5 text-left">时间</th>
                          <th className="px-2 py-1.5 text-left">渠道</th>
                          <th className="px-2 py-1.5 text-left">模型</th>
                          <th className="px-2 py-1.5 text-left">成功</th>
                          <th className="px-2 py-1.5 text-left">耗时</th>
                          <th className="px-2 py-1.5 text-left">Task ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.recentCosts.map((c) => (
                          <tr key={c.id}>
                            <td className="px-2 py-1.5 whitespace-nowrap text-slate-500">
                              {formatDate(new Date(c.createdAt))}
                            </td>
                            <td className="px-2 py-1.5">{c.provider}</td>
                            <td className="px-2 py-1.5 font-mono">{c.model}</td>
                            <td className="px-2 py-1.5">
                              {c.success ? (
                                <span className="text-emerald-600">是</span>
                              ) : (
                                <span className="text-red-600">否</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              {c.elapsedMs != null ? `${c.elapsedMs}ms` : '—'}
                            </td>
                            <td className="px-2 py-1.5 font-mono">
                              {c.providerRequestId || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
