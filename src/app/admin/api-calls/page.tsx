'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
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

interface ApiCallItem {
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
}

interface ListResponse {
  items: ApiCallItem[];
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

function productLabel(product: string) {
  if (product === 'karaoke') return 'Karaoke';
  if (product === 'dance') return 'Dance';
  if (product === 'music') return 'Music';
  return 'MV';
}

function productBadgeClass(product: string) {
  if (product === 'karaoke') return 'bg-violet-100 text-violet-700';
  if (product === 'dance') return 'bg-emerald-100 text-emerald-700';
  if (product === 'music') return 'bg-sky-100 text-sky-700';
  return 'bg-slate-100 text-slate-600';
}

function projectHref(row: ApiCallItem): string | null {
  if (!row.projectId) return null;
  if (row.product === 'karaoke') return `/admin/karaoke/projects/${row.projectId}`;
  if (row.product === 'dance') return `/admin/dance/projects`;
  if (row.product === 'music') return `/admin/music/tasks/${row.projectId}`;
  return `/admin/mv/projects/${row.projectId}`;
}

function defaultDateFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 3);
  return d.toISOString().slice(0, 10);
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

function formatCost(amount: string | null, unit: string | null) {
  if (amount == null) return '—';
  const n = Number(amount);
  const text = Number.isFinite(n) ? (Math.abs(n) >= 1 ? n.toFixed(2) : n.toFixed(4)) : amount;
  if (!unit) return text;
  if (unit === 'usd') return `$${text}`;
  return `${text} ${unit}`;
}

export default function ApiCallsPage() {
  const alert = useAlert();
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();

  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [step, setStep] = useState('');
  const [success, setSuccess] = useState('');
  const [taskId, setTaskId] = useState('');
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(
    () => ({
      search,
      product,
      provider,
      model,
      step,
      success,
      taskId,
      dateFrom,
      dateTo,
    }),
    [search, product, provider, model, step, success, taskId, dateFrom, dateTo],
  );

  const queryParams = useMemo(
    () => ({
      page,
      pageSize,
      search: filters.search || undefined,
      product: filters.product || undefined,
      provider: filters.provider || undefined,
      model: filters.model || undefined,
      step: filters.step || undefined,
      success: filters.success || undefined,
      taskId: filters.taskId || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    }),
    [page, pageSize, filters],
  );

  const { data: facets } = useQuery<{
    products: Array<{ product: string; count: number }>;
  }>({
    queryKey: ['admin', 'api-calls', 'facets', filters.dateFrom, filters.dateTo],
    queryFn: () =>
      apiClient.get('/admin/api-calls/facets', {
        params: {
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
        },
      }) as any,
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ListResponse>({
    queryKey: ['admin', 'api-calls', queryParams],
    queryFn: () => apiClient.get('/admin/api-calls', { params: queryParams }) as any,
  });

  const applyQuickRange = (days: number | 'clear') => {
    if (days === 'clear') {
      setDateFrom('');
      setDateTo('');
      setPage(1);
      return;
    }
    const end = new Date();
    const start = new Date();
    if (days === 0) {
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(end.getDate() - days);
    }
    setDateFrom(start.toISOString().slice(0, 10));
    setDateTo(end.toISOString().slice(0, 10));
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const payload = (await apiClient.get('/admin/api-calls/export', {
        params: { ...queryParams, page: undefined, pageSize: undefined },
      })) as any;
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(`api-calls-${date}.json`, payload);
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

  const facetCount = (p: string) =>
    facets?.products?.find((x) => x.product === p)?.count ?? null;

  return (
    <div className="admin-page">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              API 调用记录
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              全站用户上游 AI 调用明细（MV / Karaoke / Dance / Music），可按用户、渠道、模型、项目、Task
              筛选
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
              placeholder="搜索用户 / 项目 / 模型 / Task…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            />
          </div>
          <select
            value={product}
            onChange={(e) => {
              setProduct(e.target.value);
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
            <option value="music">
              Music{facetCount('music') != null ? ` (${facetCount('music')})` : ''}
            </option>
          </select>
          <input
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setPage(1);
            }}
            placeholder="渠道"
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white min-w-[100px]"
          />
          <input
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setPage(1);
            }}
            placeholder="模型"
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white min-w-[140px] font-mono"
          />
          <input
            value={step}
            onChange={(e) => {
              setStep(e.target.value);
              setPage(1);
            }}
            placeholder="步骤 step"
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white min-w-[140px] font-mono"
          />
          <select
            value={success}
            onChange={(e) => {
              setSuccess(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
          >
            <option value="">全部状态</option>
            <option value="true">成功</option>
            <option value="false">失败</option>
          </select>
          <input
            value={taskId}
            onChange={(e) => {
              setTaskId(e.target.value);
              setPage(1);
            }}
            placeholder="Task ID / Trace"
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white min-w-[160px] font-mono"
          />
          <select
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              if (v === 'clear') applyQuickRange('clear');
              else applyQuickRange(Number(v));
              e.target.value = '';
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white text-slate-600"
            defaultValue=""
          >
            <option value="">日期快捷</option>
            <option value="0">今天</option>
            <option value="1">昨天起 1 天</option>
            <option value="3">最近 3 天</option>
            <option value="7">最近 7 天</option>
            <option value="30">最近 30 天</option>
            <option value="clear">清除日期</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            title="起始日期"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            title="截止日期"
          />
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!data?.items.length}
          emptyMessage="暂无调用记录（可调整日期或筛选条件）"
          height="h-48"
        >
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="text-sm w-max min-w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-xs text-slate-500">
                    <th className="px-4 py-3 text-left whitespace-nowrap">时间</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">详情</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">用户</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">产品</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">步骤</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">渠道</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">模型</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">项目</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">关联实体</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">Task ID</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">成功</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">扣费积分</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">上游成本</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">耗时</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.items.map((row) => {
                    const href = projectHref(row);
                    const detailHref = `/admin/api-calls/${row.product}/${encodeURIComponent(row.id)}`;
                    const task = row.providerRequestId || row.mountseaTraceId;
                    return (
                      <tr key={`${row.product}-${row.id}`} className="hover:bg-slate-50 align-top">
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          <Link href={detailHref} className="hover:text-blue-700 hover:underline">
                            {formatDate(new Date(row.createdAt))}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          <Link
                            href={detailHref}
                            className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium"
                          >
                            查看
                            <ExternalLink className="h-3 w-3" />
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
                              'inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold',
                              productBadgeClass(row.product),
                            )}
                          >
                            {productLabel(row.product)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-600 whitespace-nowrap">
                          {row.step}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                          {row.provider || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-600 whitespace-nowrap">
                          {row.model || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {href && row.projectId ? (
                            <Link
                              href={href}
                              className="text-blue-700 hover:underline font-medium inline-flex items-center gap-1 max-w-[200px]"
                            >
                              <span className="truncate">
                                {row.projectTitle || row.projectId.slice(0, 8)}
                              </span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                          {row.entityKind !== 'none' && row.entityId ? (
                            <span className="font-mono" title={row.entityId}>
                              {row.entityKind}:{row.entityId.slice(0, 8)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[11px] font-mono text-slate-600">
                          {task ? (
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span>{task}</span>
                              <CopyIconButton text={task} />
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium',
                              row.success
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700',
                            )}
                          >
                            {row.success ? '成功' : '失败'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap tabular-nums">
                          {row.chargeCredits != null ? row.chargeCredits : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap tabular-nums">
                          {formatCost(row.costNativeAmount, row.costNativeUnit)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {row.elapsedMs != null ? `${row.elapsedMs}ms` : '—'}
                        </td>
                        <td className="px-4 py-3 text-[10px] font-mono text-slate-500 max-w-[180px]">
                          {row.metadata ? (
                            <span
                              className="block truncate"
                              title={JSON.stringify(row.metadata)}
                            >
                              {JSON.stringify(row.metadata).slice(0, 40)}
                              {JSON.stringify(row.metadata).length > 40 ? '…' : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
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
