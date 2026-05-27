'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText, RefreshCw } from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { StatusBadge } from '@/components/status-badge';
import { formatDate } from '@/lib/utils';

interface LrcJob {
  jobId: string;
  status: 'pending' | 'done' | 'error';
  filename?: string;
  error?: string;
  createdAt: number;
}

interface ListResponse {
  items: LrcJob[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'pending',
  done: 'completed',
  error: 'failed',
};

export default function AdminLrcToolsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ListResponse>({
    queryKey: ['admin', 'tools', 'lrc'],
    queryFn: () => apiClient.get('/admin/tools/lrc') as any,
    refetchInterval: 10_000,
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              LRC 任务
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              当前 API 实例内存中的 LRC 转写任务（30 分钟 TTL 自动清理）
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-xs text-amber-700">
          注意：LRC 当前以内存 Job Store 实现，进程重启后所有未持久化任务会丢失。本视图仅用于实时排障。
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!data?.items.length}
          emptyMessage="当前没有进行中的 LRC 任务"
          height="h-48"
        >
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-xs text-slate-500">
                  <th className="px-4 py-3 text-left">Job ID</th>
                  <th className="px-4 py-3 text-left">状态</th>
                  <th className="px-4 py-3 text-left">音乐文件名</th>
                  <th className="px-4 py-3 text-left">创建时间</th>
                  <th className="px-4 py-3 text-left">错误</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.items.map((job) => (
                  <tr key={job.jobId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 break-all">
                      {job.jobId}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={STATUS_LABEL[job.status]} kind="generic" />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 truncate max-w-xs">
                      {job.filename || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDate(new Date(job.createdAt))}
                    </td>
                    <td className="px-4 py-3 text-xs text-red-500 max-w-xs truncate">
                      {job.error || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueryState>
      </div>
    </div>
  );
}
