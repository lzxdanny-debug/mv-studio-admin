'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Undo2, X, Loader2, Check, Ban, TrendingDown, Clock, Percent, Hash } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn, formatDate } from '@/lib/utils';
import { DataTable, DataTableColumn } from '@/components/data-table';
import { QueryState } from '@/components/query-state';
import { useAlert } from '@/components/ui/dialog-provider';
import {
  usd,
  usdCompact,
  pct,
  REFUND_STATUS_META,
  REFUND_KIND_LABEL,
  RANGE_LABEL,
  RangePreset,
  computeRange,
  tsLabel,
} from '../_lib/format';

interface RefundStats {
  range: { fromIso: string; toIso: string; bucket: 'day' | 'week' | 'month' };
  summary: {
    refundCents: number;
    refundCount: number;
    creditsReversed: number;
    pendingCount: number;
    refundRate: number;
  };
  trend: { ts: string; refundCents: number; count: number }[];
  byKind: { kind: string; count: number; cents: number }[];
  byReason: { reason: string; count: number; cents: number }[];
}

const ANALYTICS_PRESETS: RangePreset[] = ['7d', '30d', '90d', '12m'];

interface RefundRow {
  id: string;
  paymentId: string;
  userId: string;
  userEmail: string | null;
  userDisplayName: string | null;
  kind: string;
  status: string;
  amountCents: number;
  currency: string;
  creditsReversed: number;
  creditsGranted: number | null;
  creditsConsumedEstimate: number | null;
  suggestedAmountCents: number | null;
  paymentAmountCents: number | null;
  paymentRefundedCents: number | null;
  packageCode: string | null;
  reason: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface ListResponse {
  data: RefundRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'pending_review', label: '待审核' },
  { value: 'succeeded', label: '已退款' },
  { value: 'rejected', label: '已拒绝' },
  { value: '', label: '全部' },
];

export default function RefundReviewPage() {
  const alert = useAlert();
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [status, setStatus] = useState('pending_review');
  const [openRow, setOpenRow] = useState<RefundRow | null>(null);

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'billing', 'refunds', { page, pageSize, status }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (status) params.set('status', status);
      return apiClient.get(`/admin/billing/refunds?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
    refetchInterval: 20_000,
  });

  const columns: DataTableColumn<RefundRow>[] = [
    {
      key: 'time',
      header: '申请时间',
      width: 'w-32',
      render: (r) => (
        <span className="text-slate-500 text-xs whitespace-nowrap">{formatDate(r.createdAt)}</span>
      ),
    },
    {
      key: 'user',
      header: '用户',
      render: (r) => (
        <div className="min-w-0">
          <p className="text-xs text-slate-700 truncate">{r.userDisplayName ?? '—'}</p>
          <p className="text-[11px] text-slate-400 truncate">{r.userEmail ?? r.userId}</p>
        </div>
      ),
    },
    {
      key: 'order',
      header: '订单金额',
      align: 'right',
      render: (r) => (
        <span className="text-xs text-slate-700 tabular-nums">{usd(r.paymentAmountCents)}</span>
      ),
    },
    {
      key: 'consumed',
      header: '发放 / 已消费',
      align: 'right',
      render: (r) => (
        <span className="text-xs tabular-nums">
          <span className="text-slate-600">{r.creditsGranted ?? '—'}</span>
          <span className="text-slate-300"> / </span>
          <span className={cn((r.creditsConsumedEstimate ?? 0) > 0 ? 'text-amber-600' : 'text-slate-400')}>
            {r.creditsConsumedEstimate ?? 0}
          </span>
        </span>
      ),
    },
    {
      key: 'suggest',
      header: '建议 / 实退',
      align: 'right',
      render: (r) => (
        <span className="text-xs tabular-nums">
          <span className="text-slate-400">{usd(r.suggestedAmountCents)}</span>
          {r.amountCents > 0 && (
            <>
              <span className="text-slate-300"> → </span>
              <span className="text-emerald-600 font-medium">{usd(r.amountCents)}</span>
            </>
          )}
        </span>
      ),
    },
    {
      key: 'kind',
      header: '来源',
      width: 'w-24',
      render: (r) => (
        <span className="text-xs text-slate-500">{REFUND_KIND_LABEL[r.kind] ?? r.kind}</span>
      ),
    },
    {
      key: 'status',
      header: '状态',
      width: 'w-24',
      render: (r) => {
        const meta = REFUND_STATUS_META[r.status] ?? { label: r.status, cls: 'bg-slate-100 text-slate-600' };
        return (
          <span className={cn('inline-flex px-2 py-0.5 rounded-md text-xs border', meta.cls)}>
            {meta.label}
          </span>
        );
      },
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-purple-600" />
            退款审核
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            退款申请 → 系统判断（已消费/未消费）→ 人工审核 → 主动退款并回收未消费积分
          </p>
        </div>

        <RefundAnalytics />

        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 w-fit">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setStatus(t.value);
                setPage(1);
              }}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                status === t.value
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <DataTable
          columns={columns}
          rows={data?.data}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          isError={isError}
          error={error}
          emptyMessage="暂无退款记录"
          onRowClick={(r) => setOpenRow(r)}
          page={page}
          pageSize={data?.pageSize ?? pageSize}
          total={data?.total}
          onPageChange={setPage}
          onPageSizeChange={onPageSizeChange}
        />
      </div>

      {openRow && (
        <RefundDrawer row={openRow} onClose={() => setOpenRow(null)} alert={alert} />
      )}
    </div>
  );
}

function RefundAnalytics() {
  const [preset, setPreset] = useState<RangePreset>('30d');
  const range = useMemo(() => computeRange(preset), [preset]);

  const { data, isLoading, isError, error } = useQuery<RefundStats>({
    queryKey: ['admin', 'billing', 'refunds', 'analytics', preset],
    queryFn: () => {
      const p = new URLSearchParams();
      p.set('from', new Date(range.fromMs).toISOString());
      p.set('to', new Date(range.toMs).toISOString());
      p.set('bucket', range.bucket);
      return apiClient.get(`/admin/billing/refunds/analytics?${p.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
  });

  const trendData = (data?.trend ?? []).map((t) => ({
    label: tsLabel(t.ts, data?.range.bucket ?? 'day'),
    refund: t.refundCents / 100,
    count: t.count,
  }));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-900">退款分析</h3>
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
          {ANALYTICS_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                preset === p ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {RANGE_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-40">
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* KPI + 分布 */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <MiniKpi label="退款总额" value={usd(data.summary.refundCents)} icon={TrendingDown} tint="text-red-600 bg-red-50" />
                <MiniKpi label="退款笔数" value={String(data.summary.refundCount)} icon={Hash} tint="text-slate-600 bg-slate-100" />
                <MiniKpi label="退款率" value={pct(data.summary.refundRate)} icon={Percent} tint="text-amber-600 bg-amber-50" />
                <MiniKpi label="待审核" value={String(data.summary.pendingCount)} icon={Clock} tint="text-blue-600 bg-blue-50" />
              </div>
              <MiniBreakdown
                title="按来源"
                rows={data.byKind.map((k) => ({
                  label: REFUND_KIND_LABEL[k.kind] ?? k.kind,
                  cents: k.cents,
                  count: k.count,
                }))}
              />
            </div>

            {/* 趋势 */}
            <div className="lg:col-span-2">
              <p className="text-xs font-medium text-slate-500 mb-2">退款趋势</p>
              {trendData.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                  时间窗内暂无成功退款
                </div>
              ) : (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="refundFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickFormatter={(v) => usdCompact(Number(v) * 100)}
                      />
                      <Tooltip
                        formatter={(v: any, name) => (name === '退款额' ? usd(Number(v) * 100) : v)}
                        contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#e2e8f0' }}
                      />
                      <Area type="monotone" dataKey="refund" name="退款额" stroke="#ef4444" strokeWidth={2} fill="url(#refundFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-3">
                <MiniBreakdown
                  title="按原因"
                  rows={data.byReason.map((r) => ({ label: r.reason, cents: r.cents, count: r.count }))}
                />
              </div>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  );
}

function MiniKpi({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tint: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500">{label}</span>
        <span className={cn('p-1 rounded-md', tint)}>
          <Icon className="h-3 w-3" />
        </span>
      </div>
      <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

function MiniBreakdown({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; cents: number; count: number }[];
}) {
  const total = rows.reduce((a, b) => a + b.cents, 0);
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-[11px] font-medium text-slate-500 mb-2">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 py-2 text-center">暂无数据</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const ratio = total > 0 ? r.cents / total : 0;
            return (
              <div key={r.label + i}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-slate-600 truncate max-w-[140px]">
                    {r.label} <span className="text-slate-300">· {r.count}</span>
                  </span>
                  <span className="text-slate-800 font-medium tabular-nums">{usd(r.cents)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.max(2, ratio * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className="text-slate-800 text-xs font-medium tabular-nums">{children}</span>
    </div>
  );
}

function RefundDrawer({
  row,
  onClose,
  alert,
}: {
  row: RefundRow;
  onClose: () => void;
  alert: ReturnType<typeof useAlert>;
}) {
  const qc = useQueryClient();
  const canReview = useAdminAuthStore((s) => s.hasPermission('billing.manage'));
  const editable = row.status === 'pending_review' && canReview;
  const [amount, setAmount] = useState<string>(
    ((row.suggestedAmountCents ?? 0) / 100).toFixed(2),
  );
  const [note, setNote] = useState('');

  const review = useMutation<
    any,
    any,
    { action: 'approve' | 'reject' }
  >({
    mutationFn: ({ action }) =>
      apiClient.post(`/admin/billing/refunds/${row.id}/review`, {
        action,
        amountCents: action === 'approve' ? Math.round(Number(amount) * 100) : undefined,
        note: note || undefined,
      }) as any,
    onSuccess: async (res, vars) => {
      await qc.invalidateQueries({ queryKey: ['admin', 'billing'] });
      onClose();
      await alert({
        title: vars.action === 'approve' ? '退款已提交' : '已拒绝',
        description:
          vars.action === 'approve'
            ? `已退款 ${usd(res?.amountCents)}，回收 ${res?.creditsReversed ?? 0} 积分`
            : '该退款申请已被拒绝',
      });
    },
    onError: async (err: any) => {
      await alert({
        title: '操作失败',
        description: err?.message ?? String(err),
        variant: 'danger',
      });
    },
  });

  const consumed = row.creditsConsumedEstimate ?? 0;
  const granted = row.creditsGranted ?? 0;
  const unconsumed = Math.max(0, granted - consumed);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 h-14 border-b border-slate-200 flex-shrink-0">
          <h3 className="text-sm font-semibold text-slate-900">退款审核</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 用户 / 订单 */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-2">
            <InfoRow label="用户">{row.userDisplayName ?? row.userEmail ?? row.userId}</InfoRow>
            <InfoRow label="套餐">{row.packageCode ?? '—'}</InfoRow>
            <InfoRow label="订单金额">{usd(row.paymentAmountCents)}</InfoRow>
            <InfoRow label="已退金额">{usd(row.paymentRefundedCents)}</InfoRow>
            <InfoRow label="来源">{REFUND_KIND_LABEL[row.kind] ?? row.kind}</InfoRow>
            {row.reason && <InfoRow label="申请理由">{row.reason}</InfoRow>}
          </div>

          {/* 积分消费判定 */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-700 mb-1">积分消费判定</p>
            <InfoRow label="发放积分">{granted}</InfoRow>
            <InfoRow label="估算已消费">
              <span className={consumed > 0 ? 'text-amber-600' : ''}>{consumed}</span>
            </InfoRow>
            <InfoRow label="剩余未消费">{unconsumed}</InfoRow>
            <div className="pt-2 mt-1 border-t border-slate-100">
              <InfoRow label="系统建议退款额">
                <span className="text-purple-600">{usd(row.suggestedAmountCents)}</span>
              </InfoRow>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
              建议额按「未消费积分占比」估算（积分为合并池，无法精确追溯，仅供参考）。
            </p>
          </div>

          {editable ? (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  实际退款金额（USD）
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full h-9 pl-7 pr-3 rounded-lg border border-slate-200 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  将按此金额占订单比例回收对应积分（扣到 0 为止，不透支）。
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">审核备注</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="可选，记录审核理由"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-slate-200 p-4 space-y-2">
              <InfoRow label="当前状态">
                {REFUND_STATUS_META[row.status]?.label ?? row.status}
              </InfoRow>
              <InfoRow label="实退金额">{usd(row.amountCents)}</InfoRow>
              <InfoRow label="回收积分">{row.creditsReversed}</InfoRow>
              {row.reviewedAt && <InfoRow label="审核时间">{formatDate(row.reviewedAt)}</InfoRow>}
              {row.reviewNote && <InfoRow label="审核备注">{row.reviewNote}</InfoRow>}
            </div>
          )}
        </div>

        {editable && (
          <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2 flex-shrink-0">
            <button
              onClick={() => review.mutate({ action: 'reject' })}
              disabled={review.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <Ban className="h-4 w-4" />
              拒绝
            </button>
            <button
              onClick={() => review.mutate({ action: 'approve' })}
              disabled={review.isPending || Number(amount) <= 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {review.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              批准并退款
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
