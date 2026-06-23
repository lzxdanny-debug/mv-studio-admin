'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Disc3, RefreshCw, Search, DollarSign } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { QueryState } from '@/components/query-state';
import { PaginationBar } from '@/components/pagination-bar';
import { StatusBadge } from '@/components/status-badge';
import { formatDate } from '@/lib/utils';
import { useAlert } from '@/components/ui/dialog-provider';
import { AdminTagsEditor } from '@/components/admin-tags-editor';

interface MusicTaskItem {
  id: string;
  userId: string;
  model: string;
  status: string;
  prompt: string | null;
  creditsCost: number;
  resultUrls: string[] | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  userDisplayName: string | null;
  userEmail: string | null;
  adminTags: string[] | null;
}

interface ListResponse {
  items: MusicTaskItem[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AdminMusicTasksPage() {
  const alert = useAlert();
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ListResponse>({
    queryKey: ['admin', 'music', 'tasks', page, pageSize, search, status],
    queryFn: () =>
      apiClient.get('/admin/music/tasks', {
        params: {
          page,
          pageSize,
          search: search || undefined,
          status: status || undefined,
        },
      }) as any,
  });

  const reconcileMutation = useMutation({
    mutationFn: () => apiClient.post('/admin/music/cost/reconcile-now?hours=6', {}) as any,
    onSuccess: async (res: any) => {
      const s = res.summary;
      await alert({
        title: '对账完成',
        description: `成功匹配 ${s?.reconciled ?? 0}/${s?.total ?? 0} 条音乐成本记录`,
        variant: 'success',
      });
      refetch();
    },
    onError: async (err: any) => {
      await alert({ title: '对账失败', description: err?.message, variant: 'danger' });
    },
  });


  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Disc3 className="h-5 w-5 text-teal-600" />
              音乐任务
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Suno / Lyria 音乐生成任务管理与成本对账
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => reconcileMutation.mutate()}
              disabled={reconcileMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <DollarSign className="h-3.5 w-3.5" />
              {reconcileMutation.isPending ? '对账中…' : '立即对账（最近 6h）'}
            </button>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="搜索提示词 / 用户邮箱…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
          >
            <option value="">全部状态</option>
            <option value="pending">pending</option>
            <option value="processing">processing</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
          </select>
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!data?.items.length}
          emptyMessage="暂无音乐任务"
          height="h-48"
        >
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-xs text-slate-500">
                  <th className="px-4 py-3 text-left">任务</th>
                  <th className="px-4 py-3 text-left">用户</th>
                  <th className="px-4 py-3 text-left">模型</th>
                  <th className="px-4 py-3 text-left">状态</th>
                  <th className="px-4 py-3 text-left">运营标签</th>
                  <th className="px-4 py-3 text-left">积分</th>
                  <th className="px-4 py-3 text-left">创建时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.items.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/music/tasks/${task.id}`}
                        className="text-teal-700 hover:underline font-medium truncate block max-w-xs"
                      >
                        {task.prompt || task.id.slice(0, 8)}
                      </Link>
                      <span className="text-[10px] text-slate-400 font-mono">{task.id}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div>{task.userDisplayName || '—'}</div>
                      <div className="text-slate-400">{task.userEmail || task.userId.slice(0, 8)}</div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600">{task.model}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={task.status} kind="generic" />
                    </td>
                    <td className="px-4 py-3">
                      <AdminTagsEditor
                        id={task.id}
                        tags={task.adminTags}
                        kind="music"
                        invalidateQueryKey={['admin', 'music', 'tasks']}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs">{task.creditsCost}</td>
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
