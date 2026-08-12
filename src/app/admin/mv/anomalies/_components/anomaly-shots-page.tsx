'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  type LucideIcon,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { QueryState } from '@/components/query-state';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge } from '@/components/status-badge';
import { formatDate } from '@/lib/utils';
import { useAlert } from '@/components/ui/dialog-provider';
import { cn } from '@/lib/utils';
import { labelMvFailureReason } from '@/lib/mv-failure-reasons';

function CopyIconButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      title={ok ? '已复制' : '复制 Task ID'}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          /* ignore */
        }
      }}
      className="inline-flex shrink-0 items-center justify-center rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
    >
      {ok ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export type AnomalyListKind = 'failed-shots' | 'storyboards';

export interface AnomalyShotItem {
  id: string;
  projectId: string;
  shotIndex: number;
  status: string;
  anomalyKind: 'failed' | 'stuck';
  failureReason: string | null;
  failureDetail?: string | null;
  genType: string;
  shotType: string;
  lipsync: boolean;
  lipsyncStatus: string | null;
  lipsyncTaskId?: string | null;
  storyboardImageUrl: string | null;
  videoUrl: string | null;
  storyboardPrompt: string | null;
  prompt: string | null;
  metadata: Record<string, unknown> | null;
  duration?: number | null;
  startTime?: number | null;
  taskId?: string | null;
  provider?: string | null;
  model?: string | null;
  projectVideoProvider?: string | null;
  attemptCount?: number | null;
  costStep?: string | null;
  createdAt: string;
  updatedAt: string;
  projectTitle: string;
  projectStatus: string;
  styleTag: string;
  resolution: string;
  quality: string;
  aspectRatio: string;
  userId: string;
  userDisplayName: string | null;
  userEmail: string | null;
  /** mv | karaoke | dance；旧数据缺省按 mv */
  product?: 'mv' | 'karaoke' | 'dance' | string | null;
}

export function resolveAnomalyProduct(
  row: Pick<AnomalyShotItem, 'product' | 'metadata'>,
): 'mv' | 'karaoke' | 'dance' {
  if (row.product === 'karaoke' || row.metadata?.product === 'karaoke') return 'karaoke';
  if (row.product === 'dance' || row.metadata?.product === 'dance') return 'dance';
  return 'mv';
}

function productBadgeClass(product: string) {
  if (product === 'karaoke') return 'bg-violet-100 text-violet-700';
  if (product === 'dance') return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
}

function productLabel(product: string) {
  if (product === 'karaoke') return 'Karaoke';
  if (product === 'dance') return 'Dance';
  return 'MV';
}

function projectHrefFor(product: string, projectId: string) {
  if (product === 'karaoke') return `/admin/karaoke/projects/${projectId}`;
  if (product === 'dance') return `/admin/dance/projects`;
  return `/admin/mv/projects/${projectId}`;
}

interface ListResponse {
  items: AnomalyShotItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AnomalyShotsPageConfig {
  kind: AnomalyListKind;
  title: string;
  description: string;
  icon: LucideIcon;
  emptyMessage: string;
  showStoryboardCol: boolean;
  showVideoCol: boolean;
}

function buildQueryParams(
  page: number,
  pageSize: number,
  filters: {
    search: string;
    product: string;
    errorReason: string;
    failureReason: string;
    genType: string;
    shotType: string;
    taskId: string;
    provider: string;
    model: string;
    dateFrom: string;
    dateTo: string;
  },
) {
  return {
    page,
    pageSize,
    search: filters.search || undefined,
    product: filters.product || undefined,
    errorReason: filters.errorReason || undefined,
    failureReason: filters.failureReason || undefined,
    genType: filters.genType || undefined,
    shotType: filters.shotType || undefined,
    taskId: filters.taskId || undefined,
    provider: filters.provider || undefined,
    model: filters.model || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  };
}

function getLastVideoError(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const err = metadata.lastVideoError;
  return typeof err === 'string' && err.trim() ? err.trim() : null;
}

function downloadJson(filename: string, data: unknown) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AnomalyShotsPageView({ config }: { config: AnomalyShotsPageConfig }) {
  const alert = useAlert();
  const Icon = config.icon;
  const apiBase = `/admin/mv/anomalies/${config.kind}`;
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();

  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('');
  const [errorReason, setErrorReason] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [genType, setGenType] = useState('');
  const [shotType, setShotType] = useState('');
  const [taskId, setTaskId] = useState('');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(
    () => ({
      search,
      product,
      errorReason,
      failureReason,
      genType,
      shotType,
      taskId,
      provider,
      model,
      dateFrom,
      dateTo,
    }),
    [
      search,
      product,
      errorReason,
      failureReason,
      genType,
      shotType,
      taskId,
      provider,
      model,
      dateFrom,
      dateTo,
    ],
  );

  const { data: facets } = useQuery<{
    products: Array<{ product: string; count: number }>;
    providers: Array<{ provider: string; count: number }>;
    models: Array<{ model: string; count: number }>;
  }>({
    // facets 不含当前 provider/model，避免下拉选项被自身筛选滤没
    queryKey: [
      'admin',
      'mv',
      'anomalies',
      'facets',
      config.kind,
      filters.dateFrom,
      filters.dateTo,
      filters.search,
      filters.errorReason,
      filters.failureReason,
      filters.genType,
      filters.shotType,
      filters.taskId,
      filters.product,
    ],
    queryFn: () =>
      apiClient.get(`/admin/mv/anomalies/${config.kind}/facets`, {
        params: {
          search: filters.search || undefined,
          product: filters.product || undefined,
          errorReason: filters.errorReason || undefined,
          failureReason: filters.failureReason || undefined,
          genType: filters.genType || undefined,
          shotType: filters.shotType || undefined,
          taskId: filters.taskId || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
        },
      }) as any,
  });

  const providerOptions = useMemo(() => {
    const items = facets?.providers ?? [];
    if (provider && !items.some((p) => p.provider === provider)) {
      return [{ provider, count: 0 }, ...items];
    }
    return items;
  }, [facets?.providers, provider]);

  const modelOptions = useMemo(() => {
    const items = facets?.models ?? [];
    if (model && !items.some((m) => m.model === model)) {
      return [{ model, count: 0 }, ...items];
    }
    return items;
  }, [facets?.models, model]);

  const facetCount = (key: string) =>
    facets?.products?.find((p) => p.product === key)?.count;

  const { data: reasonOptions } = useQuery<{ items: Array<{ code: string; count: number }> }>({
    queryKey: ['admin', 'mv', 'anomalies', 'failure-reasons', config.kind, filters.product],
    queryFn: () =>
      apiClient.get('/admin/mv/anomalies/failure-reasons', {
        params: { kind: config.kind, product: filters.product || undefined },
      }) as any,
  });

  const queryParams = useMemo(
    () => buildQueryParams(page, pageSize, filters),
    [page, pageSize, filters],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ListResponse>({
    queryKey: ['admin', 'mv', 'anomalies', config.kind, queryParams],
    queryFn: () => apiClient.get(apiBase, { params: queryParams }) as any,
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const payload = (await apiClient.get(`${apiBase}/export`, {
        params: buildQueryParams(1, 1, filters),
      })) as any;
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(`anomalies-${config.kind}-${date}.json`, payload);
    } catch (err: any) {
      await alert({
        title: '导出失败',
        description: err?.response?.data?.message || err?.message || '未知错误',
        variant: 'danger',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Icon className="h-5 w-5 text-amber-600" />
              {config.title}
            </h1>
            <p className="text-sm text-slate-500 mt-1">{config.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting || isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? '导出中…' : '导出 JSON'}
            </button>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              刷新
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="搜索项目 / 用户 / 镜头 ID…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            />
          </div>
          <select
            value={product}
            onChange={(e) => {
              setProduct(e.target.value);
              setErrorReason('');
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white min-w-[120px]"
            title="产品"
          >
            <option value="">全部产品</option>
            <option value="mv">MV{facetCount('mv') != null ? ` (${facetCount('mv')})` : ''}</option>
            <option value="karaoke">
              Karaoke{facetCount('karaoke') != null ? ` (${facetCount('karaoke')})` : ''}
            </option>
            <option value="dance">
              Dance{facetCount('dance') != null ? ` (${facetCount('dance')})` : ''}
            </option>
          </select>
          <select
            value={errorReason}
            onChange={(e) => {
              setErrorReason(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white min-w-[160px]"
            title="错误原因"
          >
            <option value="">全部错误原因</option>
            {(reasonOptions?.items ?? []).map((item) => (
              <option key={item.code} value={item.code}>
                {labelMvFailureReason(item.code)} ({item.count})
              </option>
            ))}
          </select>
          <input
            value={failureReason}
            onChange={(e) => {
              setFailureReason(e.target.value);
              setPage(1);
            }}
            placeholder="错误详情关键词"
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white min-w-[140px]"
          />
          <select
            value={genType}
            onChange={(e) => {
              setGenType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
          >
            <option value="">全部 genType</option>
            <option value="i2v">i2v</option>
            <option value="start_end">start_end</option>
            <option value="text2video">text2video</option>
            <option value="karaoke">karaoke</option>
            <option value="dance">dance</option>
          </select>
          <select
            value={shotType}
            onChange={(e) => {
              setShotType(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
          >
            <option value="">全部 shotType</option>
            <option value="avatar">avatar</option>
            <option value="normal">normal</option>
            <option value="solo">solo（Karaoke）</option>
            <option value="pet">pet（Karaoke）</option>
            <option value="duet">duet（Karaoke）</option>
          </select>
          <input
            value={taskId}
            onChange={(e) => {
              setTaskId(e.target.value);
              setPage(1);
            }}
            placeholder="Task ID"
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white min-w-[160px] font-mono"
            title="按 Task ID 筛选"
          />
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white min-w-[120px]"
            title="按渠道筛选"
          >
            <option value="">全部渠道</option>
            {providerOptions.map((item) => (
              <option key={item.provider} value={item.provider}>
                {item.provider}
                {item.count > 0 ? ` (${item.count})` : ''}
              </option>
            ))}
          </select>
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white min-w-[160px] font-mono max-w-[240px]"
            title="按模型筛选"
          >
            <option value="">全部模型</option>
            {modelOptions.map((item) => (
              <option key={item.model} value={item.model}>
                {item.model}
                {item.count > 0 ? ` (${item.count})` : ''}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            title="更新起始日期"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            title="更新截止日期"
          />
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!data?.items.length}
          emptyMessage={config.emptyMessage}
          height="h-48"
        >
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="text-sm w-max min-w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-xs text-slate-500">
                    <th className="px-4 py-3 text-left whitespace-nowrap">项目</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">用户</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">镜头</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">Task ID</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">渠道</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">模型</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">异常</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">失败原因</th>
                    {config.showStoryboardCol && (
                      <th className="px-4 py-3 text-left whitespace-nowrap">故事板</th>
                    )}
                    {config.showVideoCol && (
                      <th className="px-4 py-3 text-left whitespace-nowrap">视频</th>
                    )}
                    <th className="px-4 py-3 text-left whitespace-nowrap">更新时间</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.items.map((row) => {
                    const lastVideoError =
                      row.failureDetail?.trim() || getLastVideoError(row.metadata);
                    const rowProduct = resolveAnomalyProduct(row);
                    const projectHref = projectHrefFor(rowProduct, row.projectId);
                    const detailHref = `/admin/mv/anomalies/${rowProduct}/${row.id}?kind=${config.kind}`;
                    return (
                      <tr key={`${rowProduct}-${row.id}`} className="hover:bg-slate-50 align-top">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className={cn(
                                'inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold',
                                productBadgeClass(rowProduct),
                              )}
                            >
                              {productLabel(rowProduct)}
                            </span>
                          </div>
                          <Link
                            href={projectHref}
                            className="text-blue-700 hover:underline font-medium truncate block max-w-[160px]"
                          >
                            {row.projectTitle || row.projectId.slice(0, 8)}
                          </Link>
                          <span className="text-[10px] text-slate-400">
                            {row.resolution} · {row.quality}
                            {row.projectVideoProvider ? ` · ${row.projectVideoProvider}` : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                          <div className="font-medium text-slate-800">
                            {row.userDisplayName || '—'}
                          </div>
                          {row.userEmail && (
                            <div className="text-[10px] text-slate-400 mt-0.5">{row.userEmail}</div>
                          )}
                          {!row.userDisplayName && !row.userEmail && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {row.userId.slice(0, 8)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <div className="font-medium">#{row.shotIndex}</div>
                          <div className="text-slate-400">
                            {row.genType} · {row.shotType}
                          </div>
                          <StatusBadge status={row.status} kind="generic" />
                          {typeof row.duration === 'number' && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {row.duration.toFixed(1)}s
                              {typeof row.attemptCount === 'number' && row.attemptCount > 0
                                ? ` · 尝试 ${row.attemptCount}`
                                : ''}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[11px] font-mono text-slate-600">
                          {row.taskId ? (
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span>{row.taskId}</span>
                              <CopyIconButton text={row.taskId} />
                            </div>
                          ) : (
                            <span className="text-slate-400" title="未提交上游任务或未落库">
                              —
                            </span>
                          )}
                          {row.costStep && (
                            <span className="block whitespace-nowrap text-[10px] text-slate-400 mt-0.5">
                              {row.costStep}
                            </span>
                          )}
                          {row.lipsyncTaskId && (
                            <div className="flex items-center gap-1.5 mt-0.5 whitespace-nowrap text-[10px] text-slate-400">
                              <span title={row.lipsyncTaskId}>lipsync: {row.lipsyncTaskId}</span>
                              <CopyIconButton text={row.lipsyncTaskId} />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                          {row.provider || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-600 whitespace-nowrap">
                          {row.model || <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium',
                              row.anomalyKind === 'stuck'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-red-100 text-red-700',
                            )}
                          >
                            {row.anomalyKind === 'stuck' ? '卡住 ≥30min' : '失败'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 max-w-[220px]">
                          <div className="font-medium text-slate-700">
                            {row.failureReason
                              ? labelMvFailureReason(row.failureReason)
                              : row.anomalyKind === 'stuck'
                                ? labelMvFailureReason('__STUCK__')
                                : labelMvFailureReason('__NONE__')}
                          </div>
                          {row.failureReason && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {row.failureReason}
                            </div>
                          )}
                          {lastVideoError && (
                            <div className="line-clamp-2 mt-1 text-slate-500">{lastVideoError}</div>
                          )}
                        </td>
                        {config.showStoryboardCol && (
                          <td className="px-4 py-3">
                            {row.storyboardImageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={row.storyboardImageUrl}
                                alt=""
                                className="h-12 w-8 object-cover rounded border border-slate-200"
                              />
                            ) : (
                              <span className="text-xs text-slate-400">无</span>
                            )}
                          </td>
                        )}
                        {config.showVideoCol && (
                          <td className="px-4 py-3">
                            {row.videoUrl ? (
                              <a
                                href={row.videoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                查看
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">无</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(new Date(row.updatedAt))}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5">
                            <Link
                              href={detailHref}
                              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                            >
                              错误详情
                            </Link>
                            <Link
                              href={projectHref}
                              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              项目
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data && (
              <PaginationBar
                page={page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={setPage}
                onPageSizeChange={onPageSizeChange}
              />
            )}
          </div>
        </QueryState>
      </div>
    </div>
  );
}
