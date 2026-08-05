'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListOrdered } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { DataTable, DataTableColumn } from '@/components/data-table';
import { SearchBar } from '@/components/search-bar';
import { formatDate, cn } from '@/lib/utils';

interface TaskRow {
  id: string;
  userId: string;
  templateId: string;
  templateVersionId: string;
  status: string;
  currentStep: string | null;
  progressPercent: number;
  estimatedCredits: number;
  chargedCredits: number;
  refundedCredits: number;
  resultUrl: string | null;
  errorCode: string | null;
  retryCount: number;
  createdAt: string;
}

interface ListResponse {
  items: TaskRow[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_OPTIONS = [
  ['', '全部状态'],
  ['CREATED', '已创建'],
  ['VALIDATING', '校验中'],
  ['RESERVED', '已预留'],
  ['QUEUED', '排队中'],
  ['VIDEO_GENERATING', '生成中'],
  ['UPLOADING', '上传中'],
  ['SUCCEEDED', '成功'],
  ['FAILED', '失败'],
  ['CANCELED', '已取消'],
  ['EXPIRED', '已过期'],
] as const;

const STATUS_CLASS: Record<string, string> = {
  SUCCEEDED: 'bg-emerald-50 text-emerald-600',
  FAILED: 'bg-red-50 text-red-600',
  CANCELED: 'bg-slate-100 text-slate-400',
  EXPIRED: 'bg-slate-100 text-slate-400',
  VIDEO_GENERATING: 'bg-blue-50 text-blue-600',
  UPLOADING: 'bg-blue-50 text-blue-600',
  QUEUED: 'bg-amber-50 text-amber-600',
  RESERVED: 'bg-amber-50 text-amber-600',
  VALIDATING: 'bg-slate-100 text-slate-500',
  CREATED: 'bg-slate-100 text-slate-500',
};

export default function AdminVideoEffectTasksPage() {
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'video-effects', 'tasks', { page, pageSize, status, search }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (status) params.set('status', status);
      if (search) params.set('userId', search);
      return apiClient.get(`/admin/video-effects/tasks?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
    refetchInterval: 15_000,
  });

  const columns: DataTableColumn<TaskRow>[] = [
    {
      key: 'id',
      header: '任务',
      render: (r) => (
        <div className="min-w-0">
          <Link
            href={`/admin/video-effects/tasks/${r.id}`}
            className="font-mono text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            {r.id.slice(0, 8)}…
          </Link>
          <p className="mt-0.5 font-mono text-[10px] text-slate-400">tpl {r.templateId.slice(0, 8)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      width: 'w-32',
      render: (r) => (
        <div>
          <span
            className={cn(
              'inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium',
              STATUS_CLASS[r.status] ?? 'bg-slate-100 text-slate-500',
            )}
          >
            {STATUS_OPTIONS.find(([v]) => v === r.status)?.[1] ?? r.status}
          </span>
          <p className="mt-0.5 text-[11px] text-slate-400">{r.progressPercent}%</p>
        </div>
      ),
    },
    {
      key: 'currentStep',
      header: '当前步骤',
      width: 'w-32',
      render: (r) => <span className="text-xs text-slate-500">{r.currentStep || '—'}</span>,
    },
    {
      key: 'credits',
      header: '积分',
      width: 'w-28',
      align: 'right',
      render: (r) => (
        <span className="text-xs text-slate-600">
          {r.chargedCredits}
          {r.refundedCredits ? ` / -${r.refundedCredits}` : ''}
        </span>
      ),
    },
    {
      key: 'retryCount',
      header: '重试',
      width: 'w-16',
      align: 'right',
      render: (r) => <span className="text-xs text-slate-500">{r.retryCount}</span>,
    },
    {
      key: 'userId',
      header: '用户',
      width: 'w-40',
      render: (r) => <span className="font-mono text-[11px] text-slate-500">{r.userId.slice(0, 8)}…</span>,
    },
    {
      key: 'createdAt',
      header: '创建时间',
      width: 'w-40',
      render: (r) => <span className="text-xs text-slate-500">{formatDate(r.createdAt)}</span>,
    },
  ];

  return (
    <div className="admin-page">
      <div className="space-y-4 p-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <ListOrdered className="h-5 w-5 text-blue-600" />
            特效任务
          </h1>
          <p className="mt-1 text-sm text-slate-500">查看视频特效生成任务状态、积分与错误信息。</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value || 'all'} value={value}>
                {label}
              </option>
            ))}
          </select>
          <SearchBar
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="按用户 ID 精确过滤"
            width="w-72"
          />
        </div>

        <DataTable<TaskRow>
          columns={columns}
          rows={data?.items}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          isError={isError}
          error={error}
          emptyMessage="暂无特效任务"
          page={data?.page ?? page}
          pageSize={data?.pageSize ?? pageSize}
          total={data?.total}
          onPageChange={setPage}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  );
}
