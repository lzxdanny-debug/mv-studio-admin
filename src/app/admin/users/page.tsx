'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, Download, Users as UsersIcon } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn, formatDate } from '@/lib/utils';
import { SearchBar } from '@/components/search-bar';
import { DataTable, DataTableColumn } from '@/components/data-table';
import { downloadCsv } from '@/lib/csv-export';

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
  accountOrigin: 'user_signup' | 'order_signup';
  registrationAttribution: Record<string, unknown> | null;
  identity: 'Pro' | 'Free';
  totalGranted: number;
  totalUsed: number;
  paidGranted: number;
  paidRemaining: number;
  giftedGranted: number;
  giftedRemaining: number;
  orderCount: number;
  spentCents: number;
}

const STATUS_META: Record<UserStatus, { label: string; cls: string }> = {
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
  const [accountOrigin, setAccountOrigin] = useState('');
  const [identity, setIdentity] = useState('');

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'users', { page, pageSize, search, status, accountOrigin, identity }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (accountOrigin) params.set('accountOrigin', accountOrigin);
      if (identity) params.set('identity', identity);
      return apiClient.get(`/admin/users?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: UserStatus }) =>
      apiClient.patch(`/admin/users/${userId}/status`, { status }) as any,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (accountOrigin) params.set('accountOrigin', accountOrigin);
      if (identity) params.set('identity', identity);
      return apiClient.get(`/admin/users/export?${params.toString()}`) as Promise<ListResponse>;
    },
    onSuccess: (payload) => downloadCsv(`users-${new Date().toISOString().slice(0, 10)}.csv`, [
      { header: '用户ID', value: (row: AdminUserRow) => row.id },
      { header: '邮箱', value: (row: AdminUserRow) => row.email },
      { header: '用户名', value: (row: AdminUserRow) => row.displayName },
      { header: '身份', value: (row: AdminUserRow) => row.identity },
      { header: '账号来源', value: (row: AdminUserRow) => row.accountOrigin === 'order_signup' ? '订单注册' : '用户注册' },
      { header: '账号状态', value: (row: AdminUserRow) => STATUS_META[row.status]?.label ?? row.status },
      { header: '注册方式', value: (row: AdminUserRow) => row.primaryProvider },
      { header: '总发放积分', value: (row: AdminUserRow) => row.totalGranted },
      { header: '总使用积分', value: (row: AdminUserRow) => row.totalUsed },
      { header: '当前剩余积分', value: (row: AdminUserRow) => row.creditBalance },
      { header: '付费发放', value: (row: AdminUserRow) => row.paidGranted },
      { header: '付费剩余', value: (row: AdminUserRow) => row.paidRemaining },
      { header: '赠送发放', value: (row: AdminUserRow) => row.giftedGranted },
      { header: '赠送剩余', value: (row: AdminUserRow) => row.giftedRemaining },
      { header: '订单数', value: (row: AdminUserRow) => row.orderCount },
      { header: '消费USD', value: (row: AdminUserRow) => (row.spentCents / 100).toFixed(2) },
      { header: '注册时间', value: (row: AdminUserRow) => row.createdAt },
      { header: '最近登录', value: (row: AdminUserRow) => row.lastLoginAt },
      { header: '注册归因', value: (row: AdminUserRow) => row.registrationAttribution },
    ], payload.items),
  });

  const columns: DataTableColumn<AdminUserRow>[] = [
    {
      key: 'user',
      header: '用户',
      render: (row) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
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
              className="font-medium text-slate-800 hover:text-blue-600 truncate block"
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
      key: 'identity',
      header: '身份 / 来源',
      width: 'w-28',
      render: (row) => <div className="space-y-1"><span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-medium', row.identity === 'Pro' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600')}>{row.identity}</span><p className="text-[11px] text-slate-400">{row.accountOrigin === 'order_signup' ? '订单注册' : '用户注册'}</p></div>,
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
      header: '总发放 / 已使用 / 剩余',
      width: 'w-48',
      align: 'right',
      render: (row) => (
        <div className="tabular-nums text-xs text-slate-700"><p>{row.totalGranted.toLocaleString()} / {row.totalUsed.toLocaleString()} / <span className="font-medium text-blue-700">{row.creditBalance.toLocaleString()}</span></p><p className="mt-1 text-[10px] text-slate-400">付费 {row.paidRemaining.toLocaleString()} · 赠送 {row.giftedRemaining.toLocaleString()}</p></div>
      ),
    },
    {
      key: 'orders',
      header: '订单 / 消费',
      width: 'w-28',
      align: 'right',
      render: (row) => <div className="text-xs tabular-nums text-slate-700"><p>{row.orderCount} 笔</p><p className="text-emerald-700">${(row.spentCents / 100).toFixed(2)}</p></div>,
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
    <div className="admin-page">
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-blue-600" />
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
                    ? 'px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-600 text-white'
                    : 'px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100'
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select value={identity} onChange={(event) => { setPage(1); setIdentity(event.target.value); }} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"><option value="">全部身份</option><option value="Pro">Pro</option><option value="Free">Free</option></select>
          <select value={accountOrigin} onChange={(event) => { setPage(1); setAccountOrigin(event.target.value); }} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"><option value="">全部来源</option><option value="user_signup">用户注册</option><option value="order_signup">订单注册</option></select>
          <button type="button" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending || !data?.total} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Download className="h-3.5 w-3.5" />{exportMutation.isPending ? '导出中…' : '导出 CSV'}</button>
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
          tableClassName="min-w-[1900px] [&_td]:whitespace-nowrap"
        />
      </div>
    </div>
  );
}
