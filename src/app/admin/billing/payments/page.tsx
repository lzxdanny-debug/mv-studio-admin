'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Copy, Download, Receipt } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn, formatDate } from '@/lib/utils';
import { SearchBar } from '@/components/search-bar';
import { DataTable, DataTableColumn } from '@/components/data-table';
import { downloadCsv } from '@/lib/csv-export';
import {
  usd,
  TYPE_LABEL,
  PAYMENT_STATUS_META,
  METHOD_LABEL,
  RANGE_LABEL,
  RangePreset,
  computeRange,
} from '../_lib/format';

interface AdminPaymentRow {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userDisplayName: string | null;
  type: string;
  status: string;
  rawStatus: string;
  manualStatus: string | null;
  isValid: boolean;
  amountCents: number;
  listAmountCents: number | null;
  discountAmountCents: number;
  discountCode: string | null;
  refundedCents: number;
  netCents: number;
  currency: string;
  creditAmount: number | null;
  packageCode: string | null;
  planCode: string | null;
  country: string | null;
  paymentMethod: string | null;
  riskLevel: string | null;
  providerPaymentId: string | null;
  expiresAt: string | null;
  disputeStatus: string;
  committedCredits: number;
  grantedCredits: number;
  pendingCredits: number;
  usedCredits: number;
  availableCredits: number;
  attributionSnapshot: Record<string, unknown> | null;
  createdAt: string;
}

interface ListResponse {
  data: AdminPaymentRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PRESETS: Array<RangePreset | 'all'> = ['all', '7d', '30d', '90d'];

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // HTTP 管理后台等非安全上下文会拒绝 Clipboard API，继续使用兼容方案。
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [method, setMethod] = useState('');
  const [rangePreset, setRangePreset] = useState<RangePreset | 'all'>('all');
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const window = useMemo(
    () => (rangePreset === 'all' ? null : computeRange(rangePreset)),
    [rangePreset],
  );

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'billing', 'payments', { page, pageSize, search, status, type, method, rangePreset }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (type) params.set('type', type);
      if (method) params.set('method', method);
      if (window) {
        params.set('from', new Date(window.fromMs).toISOString());
        params.set('to', new Date(window.toMs).toISOString());
      }
      return apiClient.get(`/admin/billing/payments?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
  });

  const buildFilterParams = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (method) params.set('method', method);
    if (window) {
      params.set('from', new Date(window.fromMs).toISOString());
      params.set('to', new Date(window.toMs).toISOString());
    }
    return params;
  };

  const exportMutation = useMutation({
    mutationFn: () => apiClient.get(`/admin/billing/payments/export?${buildFilterParams().toString()}`) as Promise<ListResponse>,
    onSuccess: (payload) => downloadCsv(`payments-${new Date().toISOString().slice(0, 10)}.csv`, [
      { header: '订单号', value: (row: AdminPaymentRow) => row.id },
      { header: '下单时间', value: (row: AdminPaymentRow) => row.createdAt },
      { header: '邮箱', value: (row: AdminPaymentRow) => row.userEmail },
      { header: '类型', value: (row: AdminPaymentRow) => TYPE_LABEL[row.type] ?? row.type },
      { header: '状态', value: (row: AdminPaymentRow) => PAYMENT_STATUS_META[row.status]?.label ?? row.status },
      { header: '方案', value: (row: AdminPaymentRow) => row.packageCode ?? row.planCode },
      { header: '原价USD', value: (row: AdminPaymentRow) => ((row.listAmountCents ?? row.amountCents) / 100).toFixed(2) },
      { header: '实付USD', value: (row: AdminPaymentRow) => (row.amountCents / 100).toFixed(2) },
      { header: '优惠USD', value: (row: AdminPaymentRow) => (row.discountAmountCents / 100).toFixed(2) },
      { header: '优惠码', value: (row: AdminPaymentRow) => row.discountCode },
      { header: '承诺总积分', value: (row: AdminPaymentRow) => row.committedCredits },
      { header: '已发放积分', value: (row: AdminPaymentRow) => row.grantedCredits },
      { header: '待发放积分', value: (row: AdminPaymentRow) => row.pendingCredits },
      { header: '已使用积分', value: (row: AdminPaymentRow) => row.usedCredits },
      { header: '可用剩余积分', value: (row: AdminPaymentRow) => row.availableCredits },
      { header: '退款USD', value: (row: AdminPaymentRow) => (row.refundedCents / 100).toFixed(2) },
      { header: '支付方式', value: (row: AdminPaymentRow) => row.paymentMethod },
      { header: '国家', value: (row: AdminPaymentRow) => row.country },
      { header: '争议状态', value: (row: AdminPaymentRow) => row.disputeStatus },
      { header: '到期时间', value: (row: AdminPaymentRow) => row.expiresAt },
      { header: '订单归因', value: (row: AdminPaymentRow) => row.attributionSnapshot },
    ], payload.data),
  });

  const columns: DataTableColumn<AdminPaymentRow>[] = [
    {
      key: 'orderId',
      header: '订单号',
      width: 'w-[360px]',
      render: (row) => (
        <div className="flex items-center gap-1.5" title={row.id}>
          <span className="font-mono text-xs text-slate-600">{row.id}</span>
          <button
            type="button"
            onClick={async (event) => {
              event.stopPropagation();
              await copyText(row.id);
              setCopiedOrderId(row.id);
              globalThis.setTimeout(() => {
                setCopiedOrderId((current) => (current === row.id ? null : current));
              }, 1500);
            }}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600"
            title={copiedOrderId === row.id ? '已复制' : '复制完整订单号'}
            aria-label={copiedOrderId === row.id ? '订单号已复制' : '复制完整订单号'}
          >
            {copiedOrderId === row.id ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      ),
    },
    {
      key: 'time',
      header: '时间',
      width: 'w-36',
      render: (row) => (
        <span className="text-slate-500 text-xs whitespace-nowrap">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: 'userName',
      header: '用户名',
      width: 'w-36',
      render: (row) => {
        const primaryLabel = row.userDisplayName || (row.userId ? '—' : '游客订单');

        return row.userId ? (
          <Link
            href={`/admin/users/${row.userId}`}
            onClick={(e) => e.stopPropagation()}
            className="block truncate text-sm font-medium text-blue-700 hover:underline"
            title={primaryLabel}
          >
            {primaryLabel}
          </Link>
        ) : (
          <span className="block truncate text-sm font-medium text-slate-700" title={primaryLabel}>
            {primaryLabel}
          </span>
        );
      },
    },
    {
      key: 'email',
      header: '邮箱',
      width: 'w-56',
      render: (row) => {
        const email = row.userEmail || '—';
        return (
          <span className="block truncate text-sm text-slate-500" title={email}>
            {email}
          </span>
        );
      },
    },
    {
      key: 'type',
      header: '类型',
      width: 'w-32',
      render: (row) => (
        <span className="text-sm text-slate-700">
          {TYPE_LABEL[row.type] ?? row.type}
          {(row.packageCode || row.planCode) && (
            <span className="text-slate-400 ml-1 text-xs">{row.packageCode ?? row.planCode}</span>
          )}
        </span>
      ),
    },
    {
      key: 'amount',
      header: '原价 / 实付 / 优惠',
      width: 'w-44',
      align: 'right',
      render: (row) => <div className="text-xs tabular-nums"><p className="text-slate-400 line-through">{usd(row.listAmountCents ?? row.amountCents)}</p><p className="font-medium text-slate-800">{usd(row.amountCents)}</p><p className="text-emerald-700">优惠 {usd(row.discountAmountCents)}</p></div>,
    },
    {
      key: 'refund',
      header: '退款',
      width: 'w-20',
      align: 'right',
      render: (row) =>
        row.refundedCents > 0 ? (
          <span className="text-red-600">-{usd(row.refundedCents)}</span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      key: 'net',
      header: '实得',
      width: 'w-24',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-emerald-700">{usd(row.netCents)}</span>
      ),
    },
    {
      key: 'credits',
      header: '承诺 / 发放 / 待发放',
      width: 'w-48',
      align: 'right',
      render: (row) => <div className="text-xs tabular-nums text-slate-700"><p>{row.committedCredits.toLocaleString()} / {row.grantedCredits.toLocaleString()} / {row.pendingCredits.toLocaleString()}</p><p className="mt-1 text-[10px] text-slate-400">已用 {row.usedCredits.toLocaleString()} · 剩余 {row.availableCredits.toLocaleString()}</p></div>,
    },
    {
      key: 'method',
      header: '渠道 / 国家',
      width: 'w-36',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.paymentMethod ? METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod : '—'}
          {row.country && <span className="text-slate-400"> · {row.country.toUpperCase()}</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: '状态',
      width: 'w-28',
      render: (row) => {
        const meta = PAYMENT_STATUS_META[row.status] ?? {
          label: row.status,
          cls: 'bg-slate-100 text-slate-600',
        };
        return (
          <span className={cn('inline-flex whitespace-nowrap px-2 py-0.5 rounded-md text-xs border', meta.cls)}>
            {meta.label}
          </span>
        );
      },
    },
    {
      key: 'validity',
      header: '订单效力',
      width: 'w-24',
      render: (row) => (
        <span className={cn(
          'inline-flex rounded-md border px-2 py-0.5 text-xs',
          row.isValid
            ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
            : 'border-red-100 bg-red-50 text-red-700',
        )}>
          {row.isValid ? '有效' : '无效'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '操作',
      width: 'w-24',
      align: 'center',
      headerClassName: 'sticky right-0 z-20 border-l border-slate-200 bg-slate-100',
      cellClassName: 'sticky right-0 z-10 border-l border-slate-100 bg-white',
      render: (row) => (
        <button
          type="button"
          onClick={() => router.push(`/admin/billing/payments/${row.id}`)}
          className="inline-flex h-8 items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100"
        >
          详情
        </button>
      ),
    },
  ];

  return (
    <div className="admin-page">
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-blue-600" />
            充值记录
          </h1>
          <p className="text-sm text-slate-500 mt-1">全站 Stripe 充值与会员订阅支付流水</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-64">
            <SearchBar
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="搜索订单号 / 邮箱 / Stripe ID"
            />
          </div>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setRangePreset(p);
                  setPage(1);
                }}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  rangePreset === p ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {p === 'all' ? '全部时间' : RANGE_LABEL[p]}
              </button>
            ))}
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700"
          >
            <option value="">全部状态</option>
            <option value="pending">待支付</option>
            <option value="failed">支付失败</option>
            <option value="succeeded">支付成功</option>
            <option value="expired">过期</option>
            <option value="refunded">全额退款</option>
            <option value="partially_refunded">部分退款</option>
            <option value="disputed">争议中</option>
            <option value="chargeback">CB</option>
          </select>
          <button type="button" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending || !data?.total} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Download className="h-3.5 w-3.5" />{exportMutation.isPending ? '导出中…' : '导出 CSV'}</button>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700"
          >
            <option value="">全部类型</option>
            <option value="topup">充值</option>
            <option value="subscription">会员</option>
          </select>
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700"
          >
            <option value="">全部渠道</option>
            <option value="card">银行卡</option>
            <option value="apple_pay">Apple Pay</option>
            <option value="google_pay">Google Pay</option>
            <option value="link">Link</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          rows={data?.data}
          rowKey={(r) => r.id}
          tableClassName="min-w-[2280px] [&_td]:whitespace-nowrap"
          isLoading={isLoading}
          isError={isError}
          error={error}
          emptyMessage="暂无支付记录"
          page={page}
          pageSize={data?.pageSize ?? pageSize}
          total={data?.total}
          onPageChange={setPage}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  );
}
