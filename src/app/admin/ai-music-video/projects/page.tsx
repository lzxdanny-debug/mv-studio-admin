'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Download, Eye, Film, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { SearchBar } from '@/components/search-bar';
import { StatusBadge } from '@/components/status-badge';
import { useServerPagination } from '@/lib/use-server-pagination';
import { formatDate } from '@/lib/utils';

type ProjectRow = {
  id: string;
  mvId: string;
  title: string;
  status: string;
  stage: string;
  progressPercent: number;
  productModelCode: string;
  actualModels: string;
  durationSec: number;
  aspectRatio: string;
  resolution: string;
  videoFormat: string;
  reservedCredits: number;
  chargedCredits: number;
  upstreamCostUsd: string | null;
  resultUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  userDisplayName: string | null;
  userEmail: string | null;
};
type ListResponse = { items: ProjectRow[]; total: number; page: number; pageSize: number };

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '排队中', value: 'queued' },
  { label: '生成中', value: 'generating' },
  { label: '合成中', value: 'composing' },
  { label: '已完成', value: 'succeeded' },
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'cancelled' },
];

export default function AiMusicVideoProjectsPage() {
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [status, setStatus] = useState('succeeded');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const query = useQuery<ListResponse>({
    queryKey: ['admin', 'ai-music-video', 'projects', { page, pageSize, status, search }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      return apiClient.get(`/admin/aimv-generator/projects?${params.toString()}`) as any;
    },
    placeholderData: (previous) => previous,
  });

  const exportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError('');
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (search.trim()) params.set('search', search.trim());
      const suffix = params.size ? `?${params.toString()}` : '';
      const blob = await apiClient.get(`/admin/aimv-generator/projects/export.xlsx${suffix}`, {
        responseType: 'blob',
      }) as unknown as Blob;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `aimv-projects-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  const columns: DataTableColumn<ProjectRow>[] = [
    { key: 'title', header: '视频名', width: 'w-64', render: (row) => <div className="min-w-0"><p className="max-w-56 truncate font-medium text-slate-900" title={row.title}>{row.title || '(未命名)'}</p><p className="max-w-56 truncate font-mono text-xs text-slate-400" title={row.mvId}>{row.mvId}</p></div> },
    { key: 'user', header: '用户', width: 'w-56', render: (row) => <div className="min-w-0"><p className="max-w-48 truncate text-sm text-slate-700">{row.userDisplayName || '—'}</p><p className="max-w-48 truncate text-xs text-slate-400">{row.userEmail || '—'}</p></div> },
    { key: 'status', header: '状态', width: 'w-32', render: (row) => <div className="space-y-1"><StatusBadge status={row.status} kind="mvProject" /><p className="text-[10px] text-slate-400">{row.stage} · {row.progressPercent}%</p></div> },
    { key: 'productModelCode', header: 'AI 模型-展示', width: 'w-44', render: (row) => <span className="text-xs text-slate-600">{row.productModelCode || '—'}</span> },
    { key: 'actualModels', header: 'AI 模型-实际', width: 'w-64', render: (row) => <span className="block max-w-60 whitespace-normal break-words text-xs text-slate-600" title={row.actualModels}>{row.actualModels || '—'}</span> },
    { key: 'durationSec', header: '时长', width: 'w-24', render: (row) => <span className="whitespace-nowrap text-xs text-slate-600">{row.durationSec ? `${row.durationSec}s` : '—'}</span> },
    { key: 'resolution', header: '分辨率', width: 'w-28', render: (row) => <div className="whitespace-nowrap text-xs text-slate-600"><p>{row.resolution || '—'}</p><p className="text-slate-400">{row.aspectRatio || '—'}</p></div> },
    { key: 'videoFormat', header: '视频格式', width: 'w-24', render: (row) => <span className="text-xs uppercase text-slate-600">{row.videoFormat || '—'}</span> },
    { key: 'cost', header: '花费', width: 'w-40', render: (row) => <div className="whitespace-nowrap text-xs text-slate-600"><p>{Number(row.chargedCredits || 0).toLocaleString()} Credits</p><p className="text-slate-400">{row.upstreamCostUsd == null ? '上游待上报' : `上游 $${Number(row.upstreamCostUsd).toFixed(6)}`}</p></div> },
    { key: 'createdAt', header: '创建时间', width: 'w-40', render: (row) => <span className="text-xs text-slate-500">{formatDate(row.createdAt)}</span> },
    { key: 'actions', header: '操作', width: 'w-28', headerClassName: 'sticky right-0 z-20 border-l border-slate-200 bg-slate-100 shadow-[-6px_0_10px_-8px_rgba(15,23,42,0.45)]', cellClassName: 'sticky right-0 z-10 border-l border-slate-100 bg-white shadow-[-6px_0_10px_-8px_rgba(15,23,42,0.35)]', render: (row) => <Link href={`/admin/ai-music-video/projects/${row.mvId}`} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-violet-600 hover:text-violet-700"><Eye className="h-3 w-3" />查看详情</Link> },
  ];

  return <div className="admin-page p-6 space-y-4">
    <div><h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Film className="h-5 w-5 text-violet-600" />AI Music Video 生成内容</h1><p className="mt-1 text-sm text-slate-500">管理 AI Music Video 工作台生成的项目、状态与成片，共 {query.data?.total ?? 0} 条。</p></div>
    <div className="flex flex-wrap items-center gap-2">
      <SearchBar value={search} onChange={(value) => { setPage(1); setSearch(value); }} placeholder="搜索标题 / 用户名 / 邮箱" width="w-72" />
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">{STATUS_OPTIONS.map((option) => <button key={option.value} onClick={() => { setPage(1); setStatus(option.value); }} className={status === option.value ? 'rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-medium text-white' : 'rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100'}>{option.label}</button>)}</div>
      <button type="button" onClick={() => void exportExcel()} disabled={exporting || !query.data?.total} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}{exporting ? '导出中…' : '导出 Excel'}</button>
      {exportError ? <span className="w-full text-right text-xs text-red-500">{exportError}</span> : null}
    </div>
    <DataTable<ProjectRow> columns={columns} rows={query.data?.items} rowKey={(row) => row.id} tableClassName="min-w-[1780px]" isLoading={query.isLoading} isError={query.isError} error={query.error} emptyMessage="暂无 AI Music Video 生成内容" page={query.data?.page ?? page} pageSize={query.data?.pageSize ?? pageSize} total={query.data?.total} onPageChange={setPage} onPageSizeChange={onPageSizeChange} />
  </div>;
}
