'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Film } from 'lucide-react';
import apiClient from '@/lib/api';
import { DataTable, DataTableColumn } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { SearchBar } from '@/components/search-bar';
import { formatDate } from '@/lib/utils';

interface MvProjectRow {
  id: string;
  title: string;
  userId: string;
  status: string;
  currentStep: number;
  styleTag: string;
  mvType: string;
  aspectRatio: string;
  videoProvider: string;
  resultUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  userDisplayName: string | null;
  userEmail: string | null;
}

interface ListResponse {
  items: MvProjectRow[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '待开始', value: 'pending' },
  { label: '规划中', value: 'planning' },
  { label: '等待确认', value: 'reviewing' },
  { label: '生成中', value: 'generating' },
  { label: '合成中', value: 'composing' },
  { label: '已完成', value: 'done' },
  { label: '失败', value: 'failed' },
];

export default function AdminMvProjectsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'mv', 'projects', { page, status, search }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '20');
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      return apiClient.get(`/admin/mv/projects?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
  });

  const columns: DataTableColumn<MvProjectRow>[] = [
    {
      key: 'title',
      header: '项目',
      render: (row) => (
        <div className="min-w-0">
          <Link
            href={`/admin/mv/projects/${row.id}`}
            className="font-medium text-slate-900 hover:text-purple-600 truncate block"
          >
            {row.title || '(未命名)'}
          </Link>
          <p className="text-xs text-slate-400 truncate">{row.id}</p>
        </div>
      ),
    },
    {
      key: 'user',
      header: '用户',
      render: (row) => (
        <div className="min-w-0">
          <p className="text-sm text-slate-700 truncate">{row.userDisplayName || '—'}</p>
          {row.userEmail && (
            <p className="text-xs text-slate-400 truncate">{row.userEmail}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      width: 'w-32',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={row.status} kind="mvProject" />
          <span className="text-[10px] text-slate-400">Step {row.currentStep}/10</span>
        </div>
      ),
    },
    {
      key: 'config',
      header: '配置',
      width: 'w-40',
      render: (row) => (
        <div className="text-xs text-slate-500 space-y-0.5">
          <p>
            <span className="text-slate-700">{row.styleTag || '—'}</span> · {row.mvType}
          </p>
          <p className="text-slate-400">
            {row.aspectRatio} · {row.videoProvider}
          </p>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: '创建时间',
      width: 'w-40',
      render: (row) => (
        <span className="text-xs text-slate-500">{formatDate(row.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Film className="h-5 w-5 text-purple-600" />
              MV 项目
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              共 {data?.total ?? 0} 个项目
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SearchBar
            value={search}
            onChange={(v) => {
              setPage(1);
              setSearch(v);
            }}
            placeholder="搜索标题 / 用户名 / 邮箱"
            width="w-72"
          />
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setPage(1);
                  setStatus(opt.value);
                }}
                className={
                  status === opt.value
                    ? 'px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-600 text-white'
                    : 'px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100'
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <DataTable<MvProjectRow>
          columns={columns}
          rows={data?.items}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          isError={isError}
          error={error}
          emptyMessage="暂无 MV 项目"
          page={data?.page ?? page}
          pageSize={data?.pageSize ?? 20}
          total={data?.total}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
