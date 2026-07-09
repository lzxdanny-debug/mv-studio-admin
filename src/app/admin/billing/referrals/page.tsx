'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { formatDate, cn } from '@/lib/utils';
import { SearchBar } from '@/components/search-bar';
import { DataTable, DataTableColumn } from '@/components/data-table';
import { usdAmount, RANGE_LABEL, RangePreset, computeRange } from '../_lib/format';

interface ReferralRow {
  id: string;
  inviterUserId: string;
  inviterEmail: string | null;
  inviterDisplayName: string | null;
  inviteeUserId: string;
  inviteeEmail: string | null;
  inviteeDisplayName: string | null;
  inviteCode: string;
  rewardCredits: number;
  rewardUsd: number;
  referenceId: string;
  createdAt: string;
}

interface ListResponse {
  data: ReferralRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PRESETS: Array<RangePreset | 'all'> = ['all', '7d', '30d', '90d'];

export default function AdminReferralsPage() {
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [search, setSearch] = useState('');
  const [rangePreset, setRangePreset] = useState<RangePreset | 'all'>('all');

  const window = useMemo(
    () => (rangePreset === 'all' ? null : computeRange(rangePreset)),
    [rangePreset],
  );

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'billing', 'referrals', { page, pageSize, search, rangePreset }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (search) params.set('search', search);
      if (window) {
        params.set('from', new Date(window.fromMs).toISOString());
        params.set('to', new Date(window.toMs).toISOString());
      }
      return apiClient.get(`/admin/billing/referrals?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
  });

  const totalCredits = useMemo(
    () => (data?.data ?? []).reduce((sum, row) => sum + row.rewardCredits, 0),
    [data?.data],
  );
  const totalUsd = useMemo(
    () => (data?.data ?? []).reduce((sum, row) => sum + row.rewardUsd, 0),
    [data?.data],
  );

  const columns: DataTableColumn<ReferralRow>[] = [
    {
      key: 'time',
      header: '时间',
      width: 'w-36',
      render: (row) => (
        <span className="text-slate-500 text-xs whitespace-nowrap">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: 'inviter',
      header: '邀请人',
      render: (row) => (
        <div className="min-w-0">
          <Link
            href={`/admin/users/${row.inviterUserId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium text-blue-700 hover:underline truncate block"
          >
            {row.inviterDisplayName || '—'}
          </Link>
          <p className="text-xs text-slate-400 truncate">{row.inviterEmail || row.inviterUserId.slice(0, 8)}</p>
        </div>
      ),
    },
    {
      key: 'invitee',
      header: '被邀请人',
      render: (row) => (
        <div className="min-w-0">
          <Link
            href={`/admin/users/${row.inviteeUserId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium text-slate-800 hover:underline truncate block"
          >
            {row.inviteeDisplayName || '—'}
          </Link>
          <p className="text-xs text-slate-400 truncate">{row.inviteeEmail || row.inviteeUserId.slice(0, 8)}</p>
        </div>
      ),
    },
    {
      key: 'code',
      header: '邀请码',
      width: 'w-28',
      render: (row) => (
        <span className="font-mono text-xs text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-100">
          {row.inviteCode}
        </span>
      ),
    },
    {
      key: 'reward',
      header: '奖励积分',
      width: 'w-28',
      align: 'right',
      render: (row) => (
        <span className="font-medium text-emerald-700 tabular-nums">
          +{row.rewardCredits.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'usd',
      header: '折算成本',
      width: 'w-24',
      align: 'right',
      render: (row) => <span className="text-slate-700 tabular-nums">{usdAmount(row.rewardUsd)}</span>,
    },
  ];

  return (
    <div className="admin-page">
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-600" />
            邀请拉新记录
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            被邀请人注册成功后，邀请人获得的积分奖励（可在「赠送积分配置」调整奖励数量）
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="rounded-lg p-4 bg-violet-600 text-white border border-violet-700">
            <span className="text-xs font-medium text-violet-50/90">本页邀请成功数</span>
            <p className="mt-2 text-2xl font-bold tabular-nums">{data?.total ?? 0}</p>
            <p className="mt-0.5 text-xs text-violet-50/75">符合当前筛选条件</p>
          </div>
          <div className="admin-card p-4">
            <span className="text-xs text-slate-500">本页奖励积分</span>
            <p className="mt-2 text-xl font-bold text-slate-900 tabular-nums">{totalCredits.toLocaleString()}</p>
          </div>
          <div className="admin-card p-4">
            <span className="text-xs text-slate-500">本页折算成本</span>
            <p className="mt-2 text-xl font-bold text-slate-900 tabular-nums">{usdAmount(totalUsd)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchBar
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="搜索邀请人 / 被邀请人 / 邀请码 / 用户 ID"
          />
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
                  rangePreset === p
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {p === 'all' ? '全部' : RANGE_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={data?.data}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          isError={isError}
          error={error}
          emptyMessage="暂无邀请记录"
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
