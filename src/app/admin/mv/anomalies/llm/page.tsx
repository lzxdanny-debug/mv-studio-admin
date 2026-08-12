'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BrainCircuit,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { QueryState } from '@/components/query-state';
import { PaginationBar } from '@/components/pagination-bar';
import { formatDate, cn } from '@/lib/utils';
import { useAlert } from '@/components/ui/dialog-provider';
import { labelMvFailureReason } from '@/lib/mv-failure-reasons';

interface LlmAnomalyItem {
  id: string;
  product: 'mv' | 'karaoke' | 'dance';
  stepKey: string;
  stepLabel: string;
  planningStep: number | null;
  anomalyKind: 'failed' | 'stuck';
  status: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  projectId: string;
  projectTitle: string;
  userId: string;
  userDisplayName: string | null;
  userEmail: string | null;
  provider: string | null;
  model: string | null;
  taskId: string | null;
  retryCount: number | null;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  items: LlmAnomalyItem[];
  total: number;
  page: number;
  pageSize: number;
}

function CopyIconButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      title={ok ? '已复制' : '复制'}
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

function projectHref(product: string, projectId: string) {
  if (product === 'karaoke') return `/admin/karaoke/projects/${projectId}`;
  if (product === 'dance') return `/admin/dance/projects`;
  return `/admin/mv/projects/${projectId}`;
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

export default function LlmAnomaliesPage() {
  const alert = useAlert();
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();

  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('');
  const [stepKey, setStepKey] = useState('');
  const [errorReason, setErrorReason] = useState('');
  const [failureReason, setFailureReason] = useState('');
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
      stepKey,
      errorReason,
      failureReason,
      taskId,
      provider,
      model,
      dateFrom,
      dateTo,
    }),
    [
      search,
      product,
      stepKey,
      errorReason,
      failureReason,
      taskId,
      provider,
      model,
      dateFrom,
      dateTo,
    ],
  );

  const queryParams = useMemo(
    () => ({
      page,
      pageSize,
      search: filters.search || undefined,
      product: filters.product || undefined,
      stepKey: filters.stepKey || undefined,
      errorReason: filters.errorReason || undefined,
      failureReason: filters.failureReason || undefined,
      taskId: filters.taskId || undefined,
      provider: filters.provider || undefined,
      model: filters.model || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    }),
    [page, pageSize, filters],
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
      'llm',
      'facets',
      filters.dateFrom,
      filters.dateTo,
      filters.search,
      filters.errorReason,
      filters.failureReason,
      filters.taskId,
      filters.stepKey,
      filters.product,
    ],
    queryFn: () =>
      apiClient.get('/admin/mv/anomalies/llm/facets', {
        params: {
          search: filters.search || undefined,
          product: filters.product || undefined,
          stepKey: filters.stepKey || undefined,
          errorReason: filters.errorReason || undefined,
          failureReason: filters.failureReason || undefined,
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

  const { data: stepOptions } = useQuery<{
    items: Array<{ stepKey: string; product: string; label: string; count: number }>;
  }>({
    queryKey: ['admin', 'mv', 'anomalies', 'llm', 'steps', filters.product],
    queryFn: () =>
      apiClient.get('/admin/mv/anomalies/llm/steps', {
        params: { product: filters.product || undefined },
      }) as any,
  });

  const { data: reasonOptions } = useQuery<{ items: Array<{ code: string; count: number }> }>({
    queryKey: ['admin', 'mv', 'anomalies', 'llm', 'failure-reasons', filters],
    queryFn: () =>
      apiClient.get('/admin/mv/anomalies/llm/failure-reasons', {
        params: {
          product: filters.product || undefined,
          stepKey: filters.stepKey || undefined,
        },
      }) as any,
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ListResponse>({
    queryKey: ['admin', 'mv', 'anomalies', 'llm', queryParams],
    queryFn: () => apiClient.get('/admin/mv/anomalies/llm', { params: queryParams }) as any,
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const payload = (await apiClient.get('/admin/mv/anomalies/llm/export', {
        params: { ...queryParams, page: undefined, pageSize: undefined },
      })) as any;
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(`anomalies-llm-${date}.json`, payload);
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
              <BrainCircuit className="h-5 w-5 text-amber-600" />
              语言大模型异常
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              MV 规划 LLM、Karaoke LRC/身份校验、Dance 分析阶段失败或卡住（≥30 分钟）
            </p>
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
              placeholder="搜索项目 / 用户…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            />
          </div>
          <select
            value={product}
            onChange={(e) => {
              setProduct(e.target.value);
              setStepKey('');
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white min-w-[120px]"
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
            value={stepKey}
            onChange={(e) => {
              setStepKey(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white min-w-[200px]"
            title="按步骤筛选"
          >
            <option value="">全部步骤</option>
            {(stepOptions?.items ?? []).map((item) => (
              <option key={item.stepKey} value={item.stepKey}>
                {item.label} ({item.count})
              </option>
            ))}
          </select>
          <select
            value={errorReason}
            onChange={(e) => {
              setErrorReason(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white min-w-[160px]"
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
          <input
            value={taskId}
            onChange={(e) => {
              setTaskId(e.target.value);
              setPage(1);
            }}
            placeholder="Task ID"
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white min-w-[160px] font-mono"
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
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
          />
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!data?.items.length}
          emptyMessage="暂无语言大模型异常"
          height="h-48"
        >
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="text-sm w-max min-w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-xs text-slate-500">
                    <th className="px-4 py-3 text-left whitespace-nowrap">产品</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">步骤</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">项目</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">用户</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">异常</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">失败原因</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">渠道</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">模型</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">Task ID</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">更新时间</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.items.map((row) => {
                    const detailHref = `/admin/mv/anomalies/llm/${row.product}/${encodeURIComponent(row.id)}`;
                    const pHref = projectHref(row.product, row.projectId);
                    return (
                      <tr key={`${row.product}-${row.id}`} className="hover:bg-slate-50 align-top">
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold',
                              productBadgeClass(row.product),
                            )}
                          >
                            {productLabel(row.product)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                          <div className="font-medium">{row.stepLabel}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {row.stepKey}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={pHref}
                            className="text-blue-700 hover:underline font-medium truncate block max-w-[180px]"
                          >
                            {row.projectTitle || row.projectId.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                          <div className="font-medium text-slate-800">
                            {row.userDisplayName || '—'}
                          </div>
                          {row.userEmail && (
                            <div className="text-[10px] text-slate-400 mt-0.5">{row.userEmail}</div>
                          )}
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
                          {row.status && (
                            <div className="text-[10px] text-slate-400 mt-0.5">{row.status}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 max-w-[280px]">
                          <div className="font-medium text-slate-700">
                            {row.errorCode
                              ? labelMvFailureReason(row.errorCode)
                              : row.anomalyKind === 'stuck'
                                ? labelMvFailureReason('__STUCK__')
                                : labelMvFailureReason('__NONE__')}
                          </div>
                          {row.errorMessage && (
                            <div className="line-clamp-2 mt-1 text-slate-500">{row.errorMessage}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                          {row.provider || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-600 whitespace-nowrap">
                          {row.model || <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-[11px] font-mono text-slate-600">
                          {row.taskId ? (
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span>{row.taskId}</span>
                              <CopyIconButton text={row.taskId} />
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
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
                              href={pHref}
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
