'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Download, ExternalLink, RefreshCw, Search, type LucideIcon } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { QueryState } from '@/components/query-state';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge } from '@/components/status-badge';
import { formatDate } from '@/lib/utils';
import { useAlert } from '@/components/ui/dialog-provider';
import { cn } from '@/lib/utils';
import { labelMvFailureReason } from '@/lib/mv-failure-reasons';

export type AnomalyListKind = 'failed-shots' | 'storyboards';

export interface AnomalyShotItem {
  id: string;
  projectId: string;
  shotIndex: number;
  status: string;
  anomalyKind: 'failed' | 'stuck';
  failureReason: string | null;
  genType: string;
  shotType: string;
  lipsync: boolean;
  lipsyncStatus: string | null;
  storyboardImageUrl: string | null;
  videoUrl: string | null;
  storyboardPrompt: string | null;
  prompt: string | null;
  metadata: Record<string, unknown> | null;
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
    errorReason: string;
    failureReason: string;
    genType: string;
    shotType: string;
    dateFrom: string;
    dateTo: string;
  },
) {
  return {
    page,
    pageSize,
    search: filters.search || undefined,
    errorReason: filters.errorReason || undefined,
    failureReason: filters.failureReason || undefined,
    genType: filters.genType || undefined,
    shotType: filters.shotType || undefined,
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
  const [errorReason, setErrorReason] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [genType, setGenType] = useState('');
  const [shotType, setShotType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(
    () => ({ search, errorReason, failureReason, genType, shotType, dateFrom, dateTo }),
    [search, errorReason, failureReason, genType, shotType, dateFrom, dateTo],
  );

  const { data: reasonOptions } = useQuery<{ items: Array<{ code: string; count: number }> }>({
    queryKey: ['admin', 'mv', 'anomalies', 'failure-reasons', config.kind],
    queryFn: () =>
      apiClient.get('/admin/mv/anomalies/failure-reasons', {
        params: { kind: config.kind },
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
      downloadJson(`mv-${config.kind}-${date}.json`, payload);
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
    <div className="flex-1 overflow-y-auto bg-slate-100">
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
              <table className="w-full text-sm min-w-[960px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-xs text-slate-500">
                    <th className="px-4 py-3 text-left">项目</th>
                    <th className="px-4 py-3 text-left">用户</th>
                    <th className="px-4 py-3 text-left">镜头</th>
                    <th className="px-4 py-3 text-left">异常</th>
                    <th className="px-4 py-3 text-left">失败原因</th>
                    {config.showStoryboardCol && (
                      <th className="px-4 py-3 text-left">故事板</th>
                    )}
                    {config.showVideoCol && <th className="px-4 py-3 text-left">视频</th>}
                    <th className="px-4 py-3 text-left">更新时间</th>
                    <th className="px-4 py-3 text-left">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.items.map((row) => {
                    const lastVideoError = getLastVideoError(row.metadata);
                    return (
                      <tr key={row.id} className="hover:bg-slate-50 align-top">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/mv/projects/${row.projectId}`}
                            className="text-teal-700 hover:underline font-medium truncate block max-w-[180px]"
                          >
                            {row.projectTitle || row.projectId.slice(0, 8)}
                          </Link>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {row.projectId.slice(0, 8)}…
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {row.resolution} · {row.quality}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <div>{row.userDisplayName || '—'}</div>
                          <div className="text-slate-400">
                            {row.userEmail || row.userId.slice(0, 8)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <div className="font-medium">#{row.shotIndex}</div>
                          <div className="text-slate-400">
                            {row.genType} · {row.shotType}
                          </div>
                          <StatusBadge status={row.status} kind="generic" />
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
                                className="text-xs text-teal-600 hover:underline"
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
                          <Link
                            href={`/admin/mv/projects/${row.projectId}`}
                            className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            项目详情
                          </Link>
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
