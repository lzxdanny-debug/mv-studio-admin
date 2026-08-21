'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Film } from 'lucide-react';
import apiClient from '@/lib/api';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { SearchBar } from '@/components/search-bar';
import { StatusBadge } from '@/components/status-badge';
import { useServerPagination } from '@/lib/use-server-pagination';
import { formatDate } from '@/lib/utils';

type ProjectRow = {
  id: string;
  title: string;
  status: string;
  currentStep: number;
  styleTag: string;
  mvType: string;
  aspectRatio: string;
  videoProvider: string;
  resultUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  userDisplayName: string | null;
  userEmail: string | null;
};
type ListResponse = { items: ProjectRow[]; total: number; page: number; pageSize: number };

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

export default function AiMusicVideoProjectsPage() {
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const query = useQuery<ListResponse>({
    queryKey: ['admin', 'ai-music-video', 'projects', { page, pageSize, status, search }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      return apiClient.get(`/admin/mv/projects?${params.toString()}`) as any;
    },
    placeholderData: (previous) => previous,
  });

  const columns: DataTableColumn<ProjectRow>[] = [
    { key: 'title', header: '内容', render: (row) => <div className="min-w-0"><Link href={`/admin/mv/projects/${row.id}`} className="truncate font-medium text-slate-900 hover:text-blue-600">{row.title || '(未命名)'}</Link><p className="truncate text-xs text-slate-400">{row.id}</p></div> },
    { key: 'user', header: '用户', render: (row) => <div className="min-w-0"><p className="truncate text-sm text-slate-700">{row.userDisplayName || '—'}</p><p className="truncate text-xs text-slate-400">{row.userEmail || '—'}</p></div> },
    { key: 'status', header: '状态', width: 'w-32', render: (row) => <div className="space-y-1"><StatusBadge status={row.status} kind="mvProject" /><p className="text-[10px] text-slate-400">Step {row.currentStep}/10</p></div> },
    { key: 'config', header: '生成配置', width: 'w-48', render: (row) => <div className="space-y-0.5 text-xs text-slate-500"><p>{row.styleTag || '—'} · {row.mvType || '—'}</p><p className="text-slate-400">{row.aspectRatio || '—'} · {row.videoProvider || '—'}</p></div> },
    { key: 'createdAt', header: '创建时间', width: 'w-40', render: (row) => <span className="text-xs text-slate-500">{formatDate(row.createdAt)}</span> },
    { key: 'actions', header: '操作', width: 'w-32', render: (row) => <div className="flex flex-col items-start gap-1"><Link href={`/admin/mv/projects/${row.id}`} className="text-xs font-medium text-blue-600 hover:text-blue-700">管理详情</Link>{row.resultUrl && <a href={row.resultUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700">查看成片<ExternalLink className="h-3 w-3" /></a>}</div> },
  ];

  return <div className="admin-page p-6 space-y-4">
    <div><h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Film className="h-5 w-5 text-violet-600" />AI Music Video 生成内容</h1><p className="mt-1 text-sm text-slate-500">管理 AI Music Video 工作台生成的项目、状态与成片，共 {query.data?.total ?? 0} 条。</p></div>
    <div className="flex flex-wrap items-center gap-2">
      <SearchBar value={search} onChange={(value) => { setPage(1); setSearch(value); }} placeholder="搜索标题 / 用户名 / 邮箱" width="w-72" />
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">{STATUS_OPTIONS.map((option) => <button key={option.value} onClick={() => { setPage(1); setStatus(option.value); }} className={status === option.value ? 'rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-medium text-white' : 'rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100'}>{option.label}</button>)}</div>
    </div>
    <DataTable<ProjectRow> columns={columns} rows={query.data?.items} rowKey={(row) => row.id} isLoading={query.isLoading} isError={query.isError} error={query.error} emptyMessage="暂无 AI Music Video 生成内容" page={query.data?.page ?? page} pageSize={query.data?.pageSize ?? pageSize} total={query.data?.total} onPageChange={setPage} onPageSizeChange={onPageSizeChange} />
  </div>;
}
