'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Search,
} from 'lucide-react';
import { useState } from 'react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { formatDate, cn } from '@/lib/utils';

interface ApiCallDetail {
  id: string;
  product: 'mv' | 'karaoke' | 'dance' | 'music';
  step: string;
  provider: string;
  model: string;
  success: boolean;
  elapsedMs: number | null;
  quantity: string | null;
  quantityUnit: string | null;
  chargeCredits: number | null;
  costNativeAmount: string | null;
  costNativeUnit: string | null;
  providerRequestId: string | null;
  mountseaTraceId: string | null;
  projectId: string | null;
  projectTitle: string | null;
  entityId: string | null;
  entityKind: string;
  userId: string | null;
  userDisplayName: string | null;
  userEmail: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  reconciledAt?: string | null;
  reconciledAmount?: string | null;
  reconciledSource?: string | null;
  request: unknown;
  response: unknown;
  requestSource: string | null;
  responseSource: string | null;
  promptLookup?: {
    available: boolean;
    source?: string;
    lookupId?: string;
    label?: string;
    reason?: string;
  };
}

interface PromptLookupResult {
  product: string;
  costRecordId: string;
  source: string;
  lookupId: string;
  projectId?: string;
  shotId?: string;
  shotIndex?: number;
  planningStep?: number;
  prompt: string | null;
  storyboardPrompt: string | null;
  inputContext?: Record<string, unknown> | null;
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
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </h2>
      </div>
      <div className="divide-y divide-slate-100 px-5 py-2">{children}</div>
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  if (value == null) {
    return (
      <p className="text-sm text-slate-400 py-2">
        暂无数据（历史记录可能未持久化参数/响应；新产生的调用会尽量写入）
      </p>
    );
  }
  const text = JSON.stringify(value, null, 2);
  const truncated = text.length > 16000 ? `${text.slice(0, 16000)}\n… (truncated)` : text;
  return (
    <pre className="max-h-[28rem] overflow-auto rounded-xl bg-slate-50 p-3 text-left text-[11px] font-mono text-slate-700 whitespace-pre-wrap break-all">
      {truncated}
    </pre>
  );
}

function RequestParameterSummary({ value }: { value: unknown }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const request = value as Record<string, unknown>;
  const fields = [
    ['Capability', request.capability],
    ['Shot ID', request.shotId],
    ['比例', request.aspectRatio],
    ['分辨率', request.resolution],
    ['时长', request.duration ?? request.durationSec],
    ['参考图', request.referenceImageCount],
    ['消息数', request.messageCount],
    ['JSON 模式', typeof request.jsonMode === 'boolean' ? (request.jsonMode ? '是' : '否') : null],
    ['最大 Tokens', request.maxTokens],
    ['超时', typeof request.timeoutMs === 'number' ? `${request.timeoutMs}ms` : null],
    ['Prompt 字符数', request.promptChars ?? request.storyboardPromptChars],
  ].filter(([, fieldValue]) => fieldValue !== null && fieldValue !== undefined && fieldValue !== '');
  if (!fields.length) return null;
  return (
    <Section title="调用参数概览">
      {fields.map(([label, fieldValue]) => (
        <Field key={String(label)} label={String(label)} mono>
          {String(fieldValue)}
        </Field>
      ))}
    </Section>
  );
}

function PromptLookupPanel({
  product,
  costId,
  lookup,
}: {
  product: string;
  costId: string;
  lookup?: ApiCallDetail['promptLookup'];
}) {
  const [enabled, setEnabled] = useState(false);
  const { data, isFetching, isError, error, refetch } = useQuery<PromptLookupResult>({
    queryKey: ['admin', 'api-calls', 'prompt', product, costId],
    queryFn: () =>
      apiClient.get(
        `/admin/api-calls/${product}/${encodeURIComponent(costId)}/prompt`,
      ) as Promise<PromptLookupResult>,
    enabled: enabled && !!costId && product === 'mv',
    retry: false,
  });

  if (product !== 'mv') {
    return (
      <Section title="Prompt">
        <p className="py-3 text-sm text-slate-400">
          目前仅 MV 支持按业务 ID 按需查询 Prompt（不写入成本表）。
        </p>
      </Section>
    );
  }

  return (
    <Section title="Prompt（按需查询）">
      <div className="py-3 space-y-3">
        <p className="text-xs text-slate-500">
          Prompt 不落库到成本记录。点击后通过{' '}
          <span className="font-mono">
            {lookup?.source === 'mv_shots' ? 'shotId' : 'projectId'}
          </span>{' '}
          查询业务表
          {lookup?.label ? `（${lookup.label}）` : ''}。
        </p>
        {!lookup?.available ? (
          <p className="text-sm text-slate-400">{lookup?.reason || '不可查询'}</p>
        ) : (
          <button
            type="button"
            disabled={isFetching}
            onClick={() => {
              if (!enabled) setEnabled(true);
              else void refetch();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Search className={cn('h-3.5 w-3.5', isFetching && 'animate-pulse')} />
            {isFetching ? '查询中…' : data ? '重新查询 Prompt' : '查询 Prompt'}
          </button>
        )}
        {isError && (
          <p className="text-sm text-red-600">
            {(error as any)?.response?.data?.message ||
              (error as Error)?.message ||
              '查询失败'}
          </p>
        )}
        {data && (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-400">
              来源：{data.source}
              {data.shotId ? ` · shot ${data.shotId}` : ''}
              {data.planningStep != null ? ` · planning step ${data.planningStep}` : ''}
            </p>
            {data.prompt != null && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-600">prompt</p>
                  <CopyButton text={data.prompt} />
                </div>
                <JsonBlock value={data.prompt} />
              </div>
            )}
            {data.storyboardPrompt != null && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-600">storyboardPrompt</p>
                  <CopyButton text={data.storyboardPrompt} />
                </div>
                <JsonBlock value={data.storyboardPrompt} />
              </div>
            )}
            {data.inputContext != null && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-600">inputContext</p>
                  <CopyButton text={JSON.stringify(data.inputContext, null, 2)} />
                </div>
                <JsonBlock value={data.inputContext} />
              </div>
            )}
            {data.prompt == null &&
              data.storyboardPrompt == null &&
              data.inputContext == null && (
                <p className="text-sm text-slate-400">业务表中暂无 Prompt 内容</p>
              )}
          </div>
        )}
      </div>
    </Section>
  );
}

function productLabel(product: string) {
  if (product === 'karaoke') return 'Karaoke';
  if (product === 'dance') return 'Dance';
  if (product === 'music') return 'Music';
  return 'MV';
}

function projectHref(product: string, projectId: string) {
  if (product === 'karaoke') return `/admin/karaoke/projects/${projectId}`;
  if (product === 'dance') return `/admin/dance/projects`;
  if (product === 'music') return `/admin/music/tasks/${projectId}`;
  return `/admin/mv/projects/${projectId}`;
}

function formatCost(amount: string | null, unit: string | null) {
  if (amount == null) return '—';
  const n = Number(amount);
  const text = Number.isFinite(n) ? (Math.abs(n) >= 1 ? n.toFixed(2) : n.toFixed(4)) : amount;
  if (!unit) return text;
  if (unit === 'usd') return `$${text}`;
  return `${text} ${unit}`;
}

export default function ApiCallDetailPage() {
  const params = useParams<{ product: string; id: string }>();
  const product =
    params.product === 'karaoke' ||
    params.product === 'dance' ||
    params.product === 'music'
      ? params.product
      : 'mv';
  const id = decodeURIComponent(params.id || '');

  const { data, isLoading, isError, error } = useQuery<ApiCallDetail>({
    queryKey: ['admin', 'api-calls', 'detail', product, id],
    queryFn: () =>
      apiClient.get(
        `/admin/api-calls/${product}/${encodeURIComponent(id)}`,
      ) as Promise<ApiCallDetail>,
    enabled: !!id,
  });

  const listHref = '/admin/api-calls';
  const pHref =
    data?.projectId != null ? projectHref(product, data.projectId) : null;
  const taskId = data?.providerRequestId || data?.mountseaTraceId;

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
              返回调用记录
            </Link>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Activity className="h-5 w-5 text-blue-600" />
              调用详情
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {productLabel(product)} · 参数与响应结果（能拿到则展示）
            </p>
          </div>
          {data && pHref && (
            <Link
              href={pHref}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              打开{product === 'music' ? '任务' : '项目'}
            </Link>
          )}
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!data}
          emptyMessage="未找到该调用记录"
          height="h-48"
        >
          {data && (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Section title="基本信息">
                  <Field label="时间">{formatDate(new Date(data.createdAt))}</Field>
                  <Field label="产品">{productLabel(data.product)}</Field>
                  <Field label="步骤" mono>
                    {data.step}
                  </Field>
                  <Field label="渠道">{data.provider || '—'}</Field>
                  <Field label="模型" mono>
                    {data.model || '—'}
                  </Field>
                  <Field label="成功">
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium',
                        data.success
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700',
                      )}
                    >
                      {data.success ? '成功' : '失败'}
                    </span>
                  </Field>
                  <Field label="耗时">
                    {data.elapsedMs != null ? `${data.elapsedMs}ms` : '—'}
                  </Field>
                  <Field label="数量">
                    {data.quantity != null
                      ? `${data.quantity}${data.quantityUnit ? ` ${data.quantityUnit}` : ''}`
                      : '—'}
                  </Field>
                </Section>

                <Section title="用户 / 项目 / 计费">
                  <Field label="用户">
                    {data.userDisplayName || '—'}
                    {data.userEmail ? (
                      <div className="text-[11px] text-slate-400 mt-0.5">{data.userEmail}</div>
                    ) : null}
                  </Field>
                  <Field label={product === 'music' ? '任务' : '项目'}>
                    {pHref && data.projectId ? (
                      <Link href={pHref} className="text-blue-700 hover:underline">
                        {data.projectTitle || data.projectId}
                      </Link>
                    ) : (
                      data.projectTitle || data.projectId || '—'
                    )}
                  </Field>
                  <Field label="关联实体" mono>
                    {data.entityKind !== 'none' && data.entityId
                      ? `${data.entityKind}:${data.entityId}`
                      : '—'}
                  </Field>
                  <Field label="扣费积分">
                    {data.chargeCredits != null ? data.chargeCredits : '—'}
                  </Field>
                  <Field label="上游成本">
                    {formatCost(data.costNativeAmount, data.costNativeUnit)}
                  </Field>
                  <Field label="Task ID" mono>
                    {taskId ? (
                      <span className="inline-flex items-center gap-2">
                        <span>{taskId}</span>
                        <CopyButton text={taskId} />
                      </span>
                    ) : (
                      '—'
                    )}
                  </Field>
                  <Field label="记录 ID" mono>
                    <span className="inline-flex items-center gap-2">
                      <span>{data.id}</span>
                      <CopyButton text={data.id} />
                    </span>
                  </Field>
                </Section>
              </div>

              <RequestParameterSummary value={data.request} />

              <PromptLookupPanel
                product={product}
                costId={data.id}
                lookup={data.promptLookup}
              />

              <Section title="请求参数（不含 Prompt）">
                <div className="py-3">
                  {data.requestSource && (
                    <p className="mb-2 text-[11px] text-slate-400">
                      来源：{data.requestSource}
                    </p>
                  )}
                  <JsonBlock value={data.request} />
                  {data.request != null && (
                    <div className="mt-2">
                      <CopyButton text={JSON.stringify(data.request, null, 2)} />
                    </div>
                  )}
                </div>
              </Section>

              <Section title="响应结果">
                <div className="py-3">
                  {data.responseSource && (
                    <p className="mb-2 text-[11px] text-slate-400">
                      来源：{data.responseSource}
                    </p>
                  )}
                  <JsonBlock value={data.response} />
                  {data.response != null && (
                    <div className="mt-2">
                      <CopyButton text={JSON.stringify(data.response, null, 2)} />
                    </div>
                  )}
                </div>
              </Section>

              <Section title="完整 metadata">
                <div className="py-3">
                  <JsonBlock value={data.metadata} />
                </div>
              </Section>
            </div>
          )}
        </QueryState>
      </div>
    </div>
  );
}
