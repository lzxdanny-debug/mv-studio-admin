'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FileText, RefreshCw, Search } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { QueryState } from '@/components/query-state';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge } from '@/components/status-badge';
import { formatDate } from '@/lib/utils';

interface LrcTaskItem {
  id: string;
  projectId: string;
  status: string;
  attempts: number;
  errorMsg: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
  projectTitle: string | null;
  userId: string;
  userDisplayName: string | null;
  userEmail: string | null;
}

interface ListResponse {
  items: LrcTaskItem[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AdminLrcTasksPage() {
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ListResponse>({
    queryKey: ['admin', 'lrc', 'tasks', page, pageSize, search, status],
    queryFn: () =>
      apiClient.get('/admin/tools/lrc/tasks', {
        params: {
          page,
          pageSize,
          search: search || undefined,
          status: status || undefined,
        },
      }) as any,
  });


  return (
    <div className="admin-page">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              LRC 任务
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              MV 项目级 Gemini 歌词转写任务（数据库持久化）
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

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="搜索项目名 / 用户邮箱…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
          >
            <option value="">全部状态</option>
            <option value="pending">pending</option>
            <option value="done">done</option>
            <option value="instrumental">instrumental</option>
            <option value="failed">failed</option>
          </select>
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!data?.items.length}
          emptyMessage="暂无 LRC 任务"
          height="h-48"
        >
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-xs text-slate-500">
                  <th className="px-4 py-3 text-left">任务 / 项目</th>
                  <th className="px-4 py-3 text-left">用户</th>
                  <th className="px-4 py-3 text-left">状态</th>
                  <th className="px-4 py-3 text-left">重试</th>
                  <th className="px-4 py-3 text-left">创建时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.items.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/tools/lrc/${task.id}`}
                        className="text-blue-700 hover:underline font-medium truncate block max-w-xs"
                      >
                        {task.projectTitle || task.projectId.slice(0, 8)}
                      </Link>
                      <span className="text-[10px] text-slate-400 font-mono">{task.id}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div>{task.userDisplayName || '—'}</div>
                      <div className="text-slate-400">
                        {task.userEmail || task.userId?.slice(0, 8)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={task.status} kind="generic" />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{task.attempts}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDate(new Date(task.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
