'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mic2, Loader2, RotateCcw, Ban } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { DataTable, DataTableColumn } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { SearchBar } from '@/components/search-bar';
import { formatDate, cn } from '@/lib/utils';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { useAlert, useConfirm } from '@/components/ui/dialog-provider';

interface KaraokeProjectRow {
  id: string;
  userId: string;
  userDisplayName: string | null;
  userEmail: string | null;
  title: string;
  mode: 'solo' | 'pet' | 'duet';
  status: string;
  stage: string;
  progressPercent: number;
  aspectRatio: string;
  resolution: string;
  musicDuration: number;
  resultUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  creditsCost: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  items: KaraokeProjectRow[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '排队中', value: 'queued' },
  { label: '准备中', value: 'preparing' },
  { label: '生成中', value: 'generating' },
  { label: '合成中', value: 'composing' },
  { label: '已完成', value: 'done' },
  { label: '失败', value: 'failed' },
  { label: '取消中', value: 'cancelling' },
  { label: '已取消', value: 'cancelled' },
];

const MODE_OPTIONS = [
  { label: '全部模式', value: '' },
  { label: 'Solo', value: 'solo' },
  { label: 'Pet', value: 'pet' },
  { label: 'Duet', value: 'duet' },
];

const MODE_LABEL: Record<string, string> = {
  solo: 'Solo',
  pet: 'Pet',
  duet: 'Duet',
};

const ACTIVE_STATUSES = new Set(['queued', 'preparing', 'generating', 'composing', 'cancelling']);

export default function AdminKaraokeProjectsPage() {
  const qc = useQueryClient();
  const alert = useAlert();
  const confirm = useConfirm();
  const canRetry = useAdminAuthStore((s) => s.hasPermission('karaoke.projects.retry'));
  const canCancel = useAdminAuthStore((s) => s.hasPermission('karaoke.projects.cancel'));
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('');
  const [search, setSearch] = useState('');
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'karaoke', 'projects', { page, pageSize, status, mode, search }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (status) params.set('status', status);
      if (mode) params.set('mode', mode);
      if (search) params.set('search', search);
      return apiClient.get(`/admin/karaoke/projects?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
    refetchInterval: 15_000,
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/admin/karaoke/projects/${id}/retry`, {}) as any,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'karaoke', 'projects'] });
    },
    onError: async (err: any) => {
      await alert({ title: '重试失败', description: err?.message ?? String(err), variant: 'danger' });
    },
    onSettled: () => setPendingActionId(null),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/admin/karaoke/projects/${id}/cancel`, {}) as any,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'karaoke', 'projects'] });
    },
    onError: async (err: any) => {
      await alert({ title: '取消失败', description: err?.message ?? String(err), variant: 'danger' });
    },
    onSettled: () => setPendingActionId(null),
  });

  const handleRetry = async (row: KaraokeProjectRow) => {
    const ok = await confirm({
      title: `重试项目「${row.title || row.id}」？`,
      description: '将重新排队并从上次失败点继续，已完成的片段不会重新生成。',
      confirmText: '重试',
    });
    if (!ok) return;
    setPendingActionId(row.id);
    retryMutation.mutate(row.id);
  };

  const handleCancel = async (row: KaraokeProjectRow) => {
    const ok = await confirm({
      title: `取消项目「${row.title || row.id}」？`,
      description: '将标记为取消中，等待当前调用安全结束后停止。',
      variant: 'danger',
      confirmText: '取消项目',
    });
    if (!ok) return;
    setPendingActionId(row.id);
    cancelMutation.mutate(row.id);
  };

  const columns: DataTableColumn<KaraokeProjectRow>[] = [
    {
      key: 'title',
      header: '项目',
      render: (row) => (
        <div className="min-w-0">
          <Link
            href={`/admin/karaoke/projects/${row.id}`}
            className="font-medium text-slate-900 hover:text-blue-600 truncate block"
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
          {row.userEmail && <p className="text-xs text-slate-400 truncate">{row.userEmail}</p>}
        </div>
      ),
    },
    {
      key: 'mode',
      header: '模式',
      width: 'w-20',
      render: (row) => (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-violet-50 text-violet-700 border border-violet-100">
          {MODE_LABEL[row.mode] ?? row.mode}
        </span>
      ),
    },
    {
      key: 'status',
      header: '状态',
      width: 'w-36',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={row.status} kind="karaokeProject" />
          <span className="text-[10px] text-slate-400">{row.progressPercent}% · {row.stage}</span>
        </div>
      ),
    },
    {
      key: 'config',
      header: '配置',
      width: 'w-36',
      render: (row) => (
        <div className="text-xs text-slate-500 space-y-0.5">
          <p>
            {row.aspectRatio} · {row.resolution}
          </p>
          <p className="text-slate-400">{row.musicDuration?.toFixed?.(0) ?? row.musicDuration}s</p>
        </div>
      ),
    },
    {
      key: 'credits',
      header: '积分',
      width: 'w-20',
      align: 'right',
      render: (row) => <span className="tabular-nums text-slate-700">{row.creditsCost}</span>,
    },
    {
      key: 'createdAt',
      header: '创建时间',
      width: 'w-40',
      render: (row) => <span className="text-xs text-slate-500">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '操作',
      width: 'w-32',
      render: (row) => {
        const isPending = pendingActionId === row.id && (retryMutation.isPending || cancelMutation.isPending);
        const showRetry = canRetry && row.status === 'failed';
        const showCancel = canCancel && ACTIVE_STATUSES.has(row.status);
        if (!showRetry && !showCancel) return <span className="text-xs text-slate-300">—</span>;
        return (
          <div className="flex flex-col gap-1">
            {showRetry && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleRetry(row);
                }}
                disabled={isPending}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                重试
              </button>
            )}
            {showCancel && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleCancel(row);
                }}
                disabled={isPending}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Ban className="h-3.5 w-3.5" />
                )}
                取消
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="admin-page">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Mic2 className="h-5 w-5 text-blue-600" />
              Karaoke 项目
            </h1>
            <p className="text-sm text-slate-500 mt-1">共 {data?.total ?? 0} 个项目</p>
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
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 flex-wrap">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setPage(1);
                  setStatus(opt.value);
                }}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium',
                  status === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setPage(1);
                  setMode(opt.value);
                }}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium',
                  mode === opt.value
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <DataTable<KaraokeProjectRow>
          columns={columns}
          rows={data?.items}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          isError={isError}
          error={error}
          emptyMessage="暂无 Karaoke 项目"
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
