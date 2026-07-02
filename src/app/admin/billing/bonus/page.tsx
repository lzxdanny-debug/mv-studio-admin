'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Gift } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn, formatDate } from '@/lib/utils';
import { SearchBar } from '@/components/search-bar';
import { DataTable, DataTableColumn } from '@/components/data-table';
import { usdAmount, RANGE_LABEL, RangePreset, computeRange } from '../_lib/format';

interface BonusRow {
  id: string;
  userId: string;
  userEmail: string | null;
  userDisplayName: string | null;
  amount: number;
  usd: number;
  source: 'signup' | 'daily_check_in' | 'referral' | 'other';
  referenceId: string | null;
  description: string;
  createdAt: string;
}

interface ListResponse {
  data: BonusRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface BonusSummary {
  totalCredits: number;
  totalCount: number;
  totalUsd: number;
  bySource: { source: string; credits: number; count: number; usd: number }[];
}

const PRESETS: Array<RangePreset | 'all'> = ['all', '7d', '30d', '90d'];

const SOURCE_META: Record<BonusRow['source'], { label: string; cls: string }> = {
  signup: { label: '注册赠送', cls: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  daily_check_in: { label: '每日签到', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  referral: { label: '邀请奖励', cls: 'bg-violet-50 text-violet-700 border-violet-100' },
  other: { label: '会员 / 手动', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export default function AdminBonusPage() {
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
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

  const summary = useQuery<BonusSummary>({
    queryKey: ['admin', 'billing', 'bonus', 'summary', 'list', rangePreset],
    queryFn: () => apiClient.get(`/admin/billing/bonus/summary?${rangeQs}`) as any,
    placeholderData: (p) => p,
  });

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'billing', 'bonus', { page, pageSize, search, source, rangePreset }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (search) params.set('search', search);
      if (source) params.set('source', source);
      if (window) {
        params.set('from', new Date(window.fromMs).toISOString());
        params.set('to', new Date(window.toMs).toISOString());
      }
      return apiClient.get(`/admin/billing/bonus?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
  });

  const columns: DataTableColumn<BonusRow>[] = [
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
            className="text-sm font-medium text-teal-700 hover:underline truncate block"
          >
            {row.userDisplayName || '—'}
          </Link>
          <p className="text-xs text-slate-400 truncate">{row.userEmail || row.userId.slice(0, 8)}</p>
        </div>
      ),
    },
    {
      key: 'source',
      header: '来源',
      width: 'w-28',
      render: (row) => {
        const meta = SOURCE_META[row.source];
        return (
          <span className={cn('inline-flex px-2 py-0.5 rounded-md text-xs border', meta.cls)}>
            {meta.label}
          </span>
        );
      },
    },
    {
      key: 'desc',
      header: '说明',
      render: (row) => (
        <span className="text-xs text-slate-500 truncate block max-w-[220px]">
          {row.description || '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: '赠送积分',
      width: 'w-28',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-emerald-700 tabular-nums">
          +{row.amount.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'usd',
      header: '折算成本',
      width: 'w-24',
      align: 'right',
      render: (row) => <span className="text-slate-700 tabular-nums">{usdAmount(row.usd)}</span>,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Gift className="h-5 w-5 text-teal-600" />
            赠送积分明细
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            注册赠送 / 每日签到 / 会员与后台手动赠送的积分流水（按对外售价折算营销成本）
          </p>
        </div>

        {/* 汇总卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-2xl p-4 shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600 text-white border border-emerald-400/30">
            <span className="text-xs font-medium text-emerald-50/90">赠送成本合计</span>
            <p className="mt-2 text-2xl font-bold tabular-nums">{usdAmount(summary.data?.totalUsd ?? 0)}</p>
            <p className="mt-0.5 text-xs text-emerald-50/75">
              {(summary.data?.totalCredits ?? 0).toLocaleString()} 积分 · {summary.data?.totalCount ?? 0} 笔
            </p>
          </div>
          {(summary.data?.bySource ?? []).map((s) => {
            const meta = SOURCE_META[s.source as BonusRow['source']] ?? {
              label: s.source,
              cls: '',
            };
            return (
              <div key={s.source} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <span className="text-xs text-slate-500">{meta.label}</span>
                <p className="mt-2 text-xl font-bold text-slate-900 tabular-nums">{usdAmount(s.usd)}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {s.credits.toLocaleString()} 积分 · {s.count} 笔
                </p>
              </div>
            );
          })}
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
                  rangePreset === p ? 'bg-teal-600 text-white' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {p === 'all' ? '全部时间' : RANGE_LABEL[p]}
              </button>
            ))}
          </div>
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700"
          >
            <option value="">全部来源</option>
            <option value="signup">注册赠送</option>
            <option value="daily_check_in">每日签到</option>
            <option value="referral">邀请奖励</option>
            <option value="other">会员 / 手动</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          rows={data?.data}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          isError={isError}
          error={error}
          emptyMessage="暂无赠送记录"
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
