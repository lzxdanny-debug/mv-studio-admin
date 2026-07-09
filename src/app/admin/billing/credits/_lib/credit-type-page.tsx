'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn, formatDate } from '@/lib/utils';
import { SearchBar } from '@/components/search-bar';
import { DataTable, DataTableColumn } from '@/components/data-table';
import { RANGE_LABEL, RangePreset, computeRange } from '../../_lib/format';
import {
  CREDIT_TYPE_PAGES,
  amountDisplay,
  formatCredits,
  type CreditsSummary,
  type ListResponse,
  type TransactionRow,
} from './constants';
import { LabelTip } from './label-tip';
import { CREDIT_TERM_TIPS, CREDIT_TYPE_TIPS } from './term-tips';

const PRESETS: Array<RangePreset | 'all'> = ['all', '7d', '30d', '90d'];

interface CreditTypePageProps {
  slug: string;
}

export function CreditTypePage({ slug }: CreditTypePageProps) {
  const config = CREDIT_TYPE_PAGES.find((t) => t.slug === slug);
  const source = config?.source ?? 'purchase';

  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [search, setSearch] = useState('');
  const [rangePreset, setRangePreset] = useState<RangePreset | 'all'>('all');

  const window = useMemo(
    () => (rangePreset === 'all' ? null : computeRange(rangePreset)),
    [rangePreset],
  );

  const rangeQs = useMemo(() => {
    if (!window) return '';
    const p = new URLSearchParams();
    p.set('from', new Date(window.fromMs).toISOString());
    p.set('to', new Date(window.toMs).toISOString());
    return p.toString();
  }, [window]);

  const summary = useQuery<CreditsSummary>({
    queryKey: ['admin', 'billing', 'credits', 'summary', source, rangePreset],
    queryFn: () => apiClient.get(`/admin/billing/credits/summary?${rangeQs}`) as any,
    enabled: !!config,
    placeholderData: (p) => p,
  });

  const transactions = useQuery<ListResponse<TransactionRow>>({
    queryKey: [
      'admin',
      'billing',
      'credits',
      'transactions',
      source,
      { page, pageSize, search, rangePreset },
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('source', source);
      if (search) params.set('search', search);
      if (window) {
        params.set('from', new Date(window.fromMs).toISOString());
        params.set('to', new Date(window.toMs).toISOString());
      }
      return apiClient.get(`/admin/billing/credits/transactions?${params.toString()}`) as any;
    },
    enabled: !!config,
    placeholderData: (prev) => prev,
  });

  if (!config) {
    return (
      <div className="admin-page p-6">
        <p className="text-sm text-slate-500">未知的积分类型</p>
      </div>
    );
  }

  const Icon = config.icon;

  const stat = summary.data?.bySource.find((s) => s.source === config.source);

  const columns: DataTableColumn<TransactionRow>[] = [
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
      key: 'desc',
      header: '说明',
      render: (row) => (
        <span className="text-xs text-slate-500 truncate block max-w-[280px]">
          {row.description || '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: (
        <LabelTip label="积分变动" tip={CREDIT_TERM_TIPS.creditChange} labelClassName="text-inherit" />
      ),
      width: 'w-28',
      align: 'right',
      render: (row) => (
        <span
          className={cn(
            'font-medium tabular-nums',
            row.amount > 0 ? 'text-emerald-700' : 'text-rose-600',
          )}
        >
          {amountDisplay(row.amount)}
        </span>
      ),
    },
  ];

  const mainValue =
    config.metric === 'net'
      ? formatCredits(stat?.netCredits ?? 0)
      : `+${formatCredits(stat?.inCredits ?? 0)}`;

  return (
    <div className="admin-page">
      <div className="admin-page-inner">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Icon className="h-5 w-5 text-blue-600" />
            {config.label}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{config.description}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="admin-card p-4 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('inline-flex px-2 py-0.5 rounded-md text-xs border', config.cls)}>
                {config.label}
              </span>
              {CREDIT_TYPE_TIPS[config.source] && (
                <LabelTip tip={CREDIT_TYPE_TIPS[config.source]} />
              )}
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{mainValue}</p>
            <div className="mt-0.5">
              <LabelTip
                label={`${stat?.count ?? 0} 笔`}
                tip={CREDIT_TERM_TIPS.transactionCount}
                labelClassName="text-xs text-slate-400"
              />
            </div>
          </div>
          {config.metric === 'net' ? (
            <>
              <div className="admin-card p-4">
                <LabelTip
                  label="增加"
                  tip={CREDIT_TERM_TIPS.increaseAmount}
                  labelClassName="text-xs text-slate-500"
                />
                <p className="mt-2 text-xl font-bold text-emerald-700 tabular-nums">
                  +{formatCredits(stat?.inCredits ?? 0)}
                </p>
              </div>
              <div className="admin-card p-4">
                <LabelTip
                  label="扣减"
                  tip={CREDIT_TERM_TIPS.decreaseAmount}
                  labelClassName="text-xs text-slate-500"
                />
                <p className="mt-2 text-xl font-bold text-rose-600 tabular-nums">
                  -{formatCredits(stat?.outCredits ?? 0)}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="admin-card p-4">
                <LabelTip
                  label="交易笔数"
                  tip={CREDIT_TERM_TIPS.transactionCount}
                  labelClassName="text-xs text-slate-500"
                />
                <p className="mt-2 text-xl font-bold text-slate-900 tabular-nums">
                  {(stat?.count ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="admin-card p-4">
                <LabelTip
                  label="平台总余额"
                  tip={CREDIT_TERM_TIPS.totalBalance}
                  labelClassName="text-xs text-slate-500"
                />
                <p className="mt-2 text-xl font-bold text-blue-700 tabular-nums">
                  {formatCredits(summary.data?.balance.totalBalance ?? 0)}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-64">
            <SearchBar
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="搜索邮箱 / 昵称 / 用户 ID"
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
        </div>

        <DataTable
          columns={columns}
          rows={transactions.data?.data}
          rowKey={(r) => r.id}
          isLoading={transactions.isLoading}
          isError={transactions.isError}
          error={transactions.error}
          emptyMessage={`暂无${config.label}记录`}
          page={page}
          pageSize={transactions.data?.pageSize ?? pageSize}
          total={transactions.data?.total}
          onPageChange={setPage}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  );
}
