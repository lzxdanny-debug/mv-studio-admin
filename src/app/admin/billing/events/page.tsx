'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, RefreshCw, X, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn, formatDate } from '@/lib/utils';
import { DataTable, DataTableColumn } from '@/components/data-table';
import { QueryState } from '@/components/query-state';
import { useAlert } from '@/components/ui/dialog-provider';
import { EVENT_STATUS_META } from '../_lib/format';

interface EventRow {
  id: string;
  type: string;
  status: string;
  error: string | null;
  retryCount: number;
  createdAt: string;
  processedAt: string | null;
}

interface ListResponse {
  data: EventRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface EventDetail extends EventRow {
  payload: Record<string, unknown>;
}

export default function StripeEventsPage() {
  const qc = useQueryClient();
  const alert = useAlert();
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'billing', 'events', { page, pageSize, status, type }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (status) params.set('status', status);
      if (type) params.set('type', type);
      return apiClient.get(`/admin/billing/events?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
    refetchInterval: 15_000,
  });

  const columns: DataTableColumn<EventRow>[] = [
    {
      key: 'time',
      header: '时间',
      width: 'w-36',
      render: (r) => (
        <span className="text-slate-500 text-xs whitespace-nowrap">{formatDate(r.createdAt)}</span>
      ),
    },
    {
      key: 'type',
      header: '事件类型',
      render: (r) => <span className="font-mono text-xs text-slate-700">{r.type}</span>,
    },
    {
      key: 'id',
      header: 'Event ID',
      render: (r) => (
        <span className="font-mono text-xs text-slate-400 truncate max-w-[180px] block">{r.id}</span>
      ),
    },
    {
      key: 'retry',
      header: '重试',
      width: 'w-16',
      align: 'right',
      render: (r) => (
        <span className={cn('text-xs', r.retryCount > 0 ? 'text-amber-600' : 'text-slate-300')}>
          {r.retryCount}
        </span>
      ),
    },
    {
      key: 'status',
      header: '状态',
      width: 'w-24',
      render: (r) => {
        const meta = EVENT_STATUS_META[r.status] ?? { label: r.status, cls: 'bg-slate-100 text-slate-600' };
        return (
          <span className={cn('inline-flex px-2 py-0.5 rounded-md text-xs border', meta.cls)}>
            {meta.label}
          </span>
        );
      },
    },
  ];

  return (
    <div className="admin-page">
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Stripe 事件
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Webhook 事件日志中心，支持查看原始 payload、错误与重放（每 15s 自动刷新）
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700"
          >
            <option value="">全部状态</option>
            <option value="received">已接收</option>
            <option value="processed">已处理</option>
            <option value="failed">失败</option>
            <option value="ignored">已忽略</option>
          </select>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700"
          >
            <option value="">全部类型</option>
            <option value="checkout.session.completed">checkout.session.completed</option>
            <option value="invoice.paid">invoice.paid</option>
            <option value="customer.subscription.updated">customer.subscription.updated</option>
            <option value="charge.refunded">charge.refunded</option>
            <option value="refund.updated">refund.updated</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          rows={data?.data}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          isError={isError}
          error={error}
          emptyMessage="暂无事件"
          onRowClick={(r) => setOpenId(r.id)}
          page={page}
          pageSize={data?.pageSize ?? pageSize}
          total={data?.total}
          onPageChange={setPage}
          onPageSizeChange={onPageSizeChange}
        />
      </div>

      {openId && (
        <EventDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onReplayed={() => qc.invalidateQueries({ queryKey: ['admin', 'billing'] })}
          alert={alert}
        />
      )}
    </div>
  );
}

function EventDrawer({
  id,
  onClose,
  onReplayed,
  alert,
}: {
  id: string;
  onClose: () => void;
  onReplayed: () => void;
  alert: ReturnType<typeof useAlert>;
}) {
  const { data, isLoading, isError, error } = useQuery<EventDetail>({
    queryKey: ['admin', 'billing', 'event', id],
    queryFn: () => apiClient.get(`/admin/billing/events/${id}`) as any,
  });

  const replay = useMutation<{ replayed: boolean; status?: string }>({
    mutationFn: () => apiClient.post(`/admin/billing/events/${id}/replay`, {}) as any,
    onSuccess: async (res) => {
      onReplayed();
      await alert({
        title: '重放完成',
        description: res.replayed
          ? `事件已重新分发，当前状态：${res.status ?? '未知'}`
          : '事件不存在',
      });
    },
    onError: async (err: any) => {
      await alert({
        title: '重放失败',
        description: err?.message ?? String(err),
        variant: 'danger',
      });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 h-14 border-b border-slate-200 flex-shrink-0">
          <h3 className="text-sm font-semibold text-slate-900">事件详情</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-64">
            {data && (
              <>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-xs">Event ID</span>
                    <span className="font-mono text-xs">{data.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-xs">类型</span>
                    <span className="font-mono text-xs">{data.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-xs">状态</span>
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 rounded-md text-xs border',
                        EVENT_STATUS_META[data.status]?.cls ?? 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {EVENT_STATUS_META[data.status]?.label ?? data.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-xs">接收 / 处理</span>
                    <span className="text-xs text-slate-600">
                      {formatDate(data.createdAt)}
                      {data.processedAt ? ` → ${formatDate(data.processedAt)}` : ''}
                    </span>
                  </div>
                </div>

                {data.error && (
                  <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                    <p className="text-xs font-medium text-red-700 mb-1">错误日志</p>
                    <pre className="text-xs text-red-600 whitespace-pre-wrap break-all">{data.error}</pre>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">原始 Payload</p>
                  <pre className="text-[11px] leading-relaxed bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto max-h-[50vh]">
                    {JSON.stringify(data.payload, null, 2)}
                  </pre>
                </div>
              </>
            )}
          </QueryState>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2 flex-shrink-0">
          <button
            onClick={() => replay.mutate()}
            disabled={replay.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {replay.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            重放事件
          </button>
        </div>
      </div>
    </div>
  );
}
