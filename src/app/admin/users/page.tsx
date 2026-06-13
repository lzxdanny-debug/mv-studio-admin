'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, Users as UsersIcon } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn, formatDate } from '@/lib/utils';
import { SearchBar } from '@/components/search-bar';
import { DataTable, DataTableColumn } from '@/components/data-table';

type UserStatus = 'active' | 'suspended' | 'banned' | 'deleted';

interface AdminUserRow {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: 'user' | 'admin';
  status: UserStatus;
  emailVerified: boolean;
  primaryProvider: string;
  googleId: string | null;
  hasPassword: boolean;
  mountseaBound: boolean;
  creditBalance: number;
  mvProjectCount: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export const STATUS_META: Record<UserStatus, { label: string; cls: string }> = {
  active: { label: '正常', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  suspended: { label: '已暂停', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  banned: { label: '已封禁', cls: 'bg-red-50 text-red-700 border-red-100' },
  deleted: { label: '已注销', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '正常', value: 'active' },
  { label: '已暂停', value: 'suspended' },
  { label: '已封禁', value: 'banned' },
];

interface ListResponse {
  items: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'users', { page, pageSize, search, status }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      return apiClient.get(`/admin/users?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: UserStatus }) =>
      apiClient.patch(`/admin/users/${userId}/status`, { status }) as any,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const columns: DataTableColumn<AdminUserRow>[] = [
    {
      key: 'user',
      header: '用户',
      render: (row) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {row.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-white">
                {row.displayName?.[0]?.toUpperCase() || 'U'}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <Link
              href={`/admin/users/${row.id}`}
              className="font-medium text-slate-800 hover:text-purple-600 truncate block"
            >
              {row.displayName}
            </Link>
            <p className="text-[11px] text-slate-400 font-mono truncate">{row.id.slice(0, 8)}…</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: '邮箱 / 绑定',
      render: (row) => (
        <div className="min-w-0">
          <p className="text-xs text-slate-700 truncate">
            {row.email || '—'}
            {row.email && (
              <span
                className={cn(
                  'ml-1.5 inline-flex items-center px-1 py-0.5 rounded text-[9px] border',
                  row.emailVerified
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : 'bg-slate-50 text-slate-400 border-slate-200',
                )}
              >
                {row.emailVerified ? '已验证' : '未验证'}
              </span>
            )}
          </p>
          <div className="flex gap-1 mt-0.5">
            {row.primaryProvider === 'mountsea' && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-cyan-50 text-cyan-700 border border-cyan-100">
                Mountsea
              </span>
            )}
            {row.googleId && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-100">
                Google
              </span>
            )}
            {row.hasPassword && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                本地密码
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      width: 'w-20',
      render: (row) => {
        const meta = STATUS_META[row.status] ?? STATUS_META.active;
        return (
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
              meta.cls,
            )}
          >
            {meta.label}
          </span>
        );
      },
    },
    {
      key: 'lastLogin',
      header: '最近登录',
      width: 'w-36',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.lastLoginAt ? formatDate(row.lastLoginAt) : '—'}
        </span>
      ),
    },
    {
      key: 'mv',
      header: 'MV 项目',
      width: 'w-20',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-sm text-slate-700">{row.mvProjectCount}</span>
      ),
    },
    {
      key: 'credit',
      header: '本地积分',
      width: 'w-24',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-sm text-slate-700">
          {row.creditBalance.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: '注册时间',
      width: 'w-36',
      render: (row) => <span className="text-xs text-slate-500">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '操作',
      width: 'w-32',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {row.status === 'active' ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                statusMutation.mutate({ userId: row.id, status: 'banned' });
              }}
              disabled={statusMutation.isPending}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border bg-red-50 hover:bg-red-100 text-red-700 border-red-200 transition-colors disabled:opacity-50"
            >
              <Ban className="h-3 w-3" />
              封禁
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                statusMutation.mutate({ userId: row.id, status: 'active' });
              }}
              disabled={statusMutation.isPending}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 transition-colors disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              解禁
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-purple-600" />
            C 端用户
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            共 {data?.total ?? 0} 名注册用户 · 后台管理员请至「系统 → 后台管理员」
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SearchBar
            value={search}
            onChange={(v) => {
              setPage(1);
              setSearch(v);
            }}
            placeholder="搜索邮箱 / 用户名"
            width="w-64"
          />
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setPage(1);
                  setStatus(opt.value);
                }}
                className={
                  status === opt.value
                    ? 'px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-600 text-white'
                    : 'px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100'
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <DataTable<AdminUserRow>
          columns={columns}
          rows={data?.items}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          isError={isError}
          error={error}
          emptyMessage="暂无 C 端用户"
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
