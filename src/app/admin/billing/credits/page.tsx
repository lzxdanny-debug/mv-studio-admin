'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn, formatDate } from '@/lib/utils';
import { SearchBar } from '@/components/search-bar';
import { DataTable, DataTableColumn } from '@/components/data-table';
import { RANGE_LABEL, RangePreset, computeRange } from '../_lib/format';
import {
  CREDIT_TYPE_PAGES,
  OVERVIEW_ICON,
  formatCredits,
  type BalanceRow,
  type CreditsSummary,
  type ListResponse,
} from './_lib/constants';
import { LabelTip } from './_lib/label-tip';
import { CREDIT_TERM_TIPS, CREDIT_TYPE_TIPS } from './_lib/term-tips';

const PRESETS: Array<RangePreset | 'all'> = ['all', '7d', '30d', '90d'];

export default function AdminCreditsOverviewPage() {
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
    queryKey: ['admin', 'billing', 'credits', 'summary', rangePreset],
    queryFn: () => apiClient.get(`/admin/billing/credits/summary?${rangeQs}`) as any,
    placeholderData: (p) => p,
  });

  const balances = useQuery<ListResponse<BalanceRow>>({
    queryKey: ['admin', 'billing', 'credits', 'balances', { page, pageSize, search }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (search) params.set('search', search);
      return apiClient.get(`/admin/billing/credits/balances?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
  });

  const sourceMap = useMemo(() => {
    const map = new Map(summary.data?.bySource.map((s) => [s.source, s]) ?? []);
    return map;
  }, [summary.data?.bySource]);

  const balanceColumns: DataTableColumn<BalanceRow>[] = [
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
      key: 'balance',
      header: (
        <LabelTip label="当前余额" tip={CREDIT_TERM_TIPS.currentBalance} labelClassName="text-inherit" />
      ),
      width: 'w-32',
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-slate-900 tabular-nums">
          {formatCredits(row.balance)}
        </span>
      ),
    },
    {
      key: 'updated',
      header: (
        <LabelTip label="最近变动" tip={CREDIT_TERM_TIPS.lastUpdated} labelClassName="text-inherit" />
      ),
      width: 'w-36',
      render: (row) => (
        <span className="text-slate-500 text-xs whitespace-nowrap">{formatDate(row.updatedAt)}</span>
      ),
    },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-inner">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <OVERVIEW_ICON className="h-5 w-5 text-blue-600" />
            积分总览
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            全站积分余额快照，点击下方分类卡片进入各类型明细页
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="rounded-lg p-4 bg-blue-600 text-white border border-blue-700 col-span-2 md:col-span-1">
            <LabelTip
              label="平台总余额"
              tip={CREDIT_TERM_TIPS.totalBalance}
              variant="light"
              labelClassName="text-xs font-medium text-blue-100"
            />
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {formatCredits(summary.data?.balance.totalBalance ?? 0)}
            </p>
            <p className="mt-0.5 text-xs text-blue-100/80">
              {summary.data?.balance.usersWithBalance ?? 0} 人有余额 · 共{' '}
              {summary.data?.balance.userCount ?? 0} 个账户
            </p>
          </div>
          <div className="admin-card p-4">
            <LabelTip
              label="时间窗内入账"
              tip={CREDIT_TERM_TIPS.totalIn}
              labelClassName="text-xs text-slate-500"
            />
            <p className="mt-2 text-xl font-bold text-emerald-700 tabular-nums">
              +{formatCredits(summary.data?.totalIn ?? 0)}
            </p>
          </div>
          <div className="admin-card p-4">
            <LabelTip
              label="时间窗内出账"
              tip={CREDIT_TERM_TIPS.totalOut}
              labelClassName="text-xs text-slate-500"
            />
            <p className="mt-2 text-xl font-bold text-rose-600 tabular-nums">
              -{formatCredits(summary.data?.totalOut ?? 0)}
            </p>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <LabelTip
              label="按类型统计"
              tip={CREDIT_TERM_TIPS.bySource}
              labelClassName="text-sm font-semibold text-slate-700"
            />
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setRangePreset(p)}
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {CREDIT_TYPE_PAGES.map((type) => {
              const stat = sourceMap.get(type.source);
              const Icon = type.icon;
              const value =
                type.metric === 'net'
                  ? formatCredits(stat?.netCredits ?? 0)
                  : `+${formatCredits(stat?.inCredits ?? 0)}`;
              return (
                <Link
                  key={type.slug}
                  href={`/admin/billing/credits/${type.slug}`}
                  className="admin-card p-4 hover:border-blue-300 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    <span className={cn('inline-flex px-2 py-0.5 rounded-md text-xs border', type.cls)}>
                      {type.label}
                    </span>
                    {CREDIT_TYPE_TIPS[type.source] && (
                      <LabelTip tip={CREDIT_TYPE_TIPS[type.source]} />
                    )}
                  </div>
                  <p className="text-lg font-bold text-slate-900 tabular-nums group-hover:text-blue-700 transition-colors">
                    {value}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {stat?.count ?? 0} 笔 · 查看明细 →
                  </p>
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <LabelTip
            label="用户余额排行"
            tip={CREDIT_TERM_TIPS.userBalanceRank}
            labelClassName="text-sm font-semibold text-slate-700 mb-3 block"
            className="mb-3"
          />
          <div className="flex flex-wrap items-center gap-3 mb-3">
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
          </div>
          <DataTable
            columns={balanceColumns}
            rows={balances.data?.data}
            rowKey={(r) => r.userId}
            isLoading={balances.isLoading}
            isError={balances.isError}
            error={balances.error}
            emptyMessage="暂无用户余额记录"
            page={page}
            pageSize={balances.data?.pageSize ?? pageSize}
            total={balances.data?.total}
            onPageChange={setPage}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      </div>
    </div>
  );
}
