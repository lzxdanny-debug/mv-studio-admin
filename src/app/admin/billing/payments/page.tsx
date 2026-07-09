'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn, formatDate } from '@/lib/utils';
import { SearchBar } from '@/components/search-bar';
import { DataTable, DataTableColumn } from '@/components/data-table';
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
  userId: string;
  userEmail: string | null;
  userDisplayName: string | null;
  type: string;
  status: string;
  amountCents: number;
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

export default function AdminPaymentsPage() {
  const router = useRouter();
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [method, setMethod] = useState('');
  const [rangePreset, setRangePreset] = useState<RangePreset | 'all'>('all');

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

  const columns: DataTableColumn<AdminPaymentRow>[] = [
    {
      key: 'time',
      header: '时间',
      width: 'w-36',
      render: (row) => (
        <span className="text-slate-500 text-xs whitespace-nowrap">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: 'user',
      header: '用户',
      render: (row) => (
        <div className="min-w-0">
          <Link
            href={`/admin/users/${row.userId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium text-blue-700 hover:underline truncate block"
          >
            {row.userDisplayName || '—'}
          </Link>
          <p className="text-xs text-slate-400 truncate">{row.userEmail || row.userId.slice(0, 8)}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: '类型',
      width: 'w-28',
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
      header: '金额',
      width: 'w-24',
      align: 'right',
      render: (row) => <span className="font-medium text-slate-800">{usd(row.amountCents)}</span>,
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
      key: 'method',
      header: '渠道 / 国家',
      width: 'w-28',
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
      width: 'w-24',
      render: (row) => {
        const meta = PAYMENT_STATUS_META[row.status] ?? {
          label: row.status,
          cls: 'bg-slate-100 text-slate-600',
        };
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
            <Receipt className="h-5 w-5 text-blue-600" />
            充值记录
          </h1>
          <p className="text-sm text-slate-500 mt-1">全站 Stripe 充值与会员订阅支付流水（点击行查看详情）</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-64">
            <SearchBar
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="搜索邮箱 / 昵称 / Stripe ID"
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
            <option value="succeeded">已支付</option>
            <option value="failed">失败</option>
            <option value="refunded">已退款</option>
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
          isLoading={isLoading}
          isError={isError}
          error={error}
          emptyMessage="暂无支付记录"
          onRowClick={(r) => router.push(`/admin/billing/payments/${r.id}`)}
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
