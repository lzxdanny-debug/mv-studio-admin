'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, ShieldOff, Users as UsersIcon } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { SearchBar } from '@/components/search-bar';
import { DataTable, DataTableColumn } from '@/components/data-table';

interface AdminUserRow {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: 'user' | 'admin';
  googleId: string | null;
  hasPassword: boolean;
  mountseaBound: boolean;
  creditBalance: number;
  mvProjectCount: number;
  createdAt: string;
}

interface ListResponse {
  items: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
}

const ROLE_OPTIONS = [
  { label: '全部', value: '' },
  { label: '管理员', value: 'admin' },
  { label: '普通用户', value: 'user' },
];

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'users', { page, search, role }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '20');
      if (search) params.set('search', search);
      if (role) params.set('role', role);
      return apiClient.get(`/admin/users?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'user' | 'admin' }) =>
      apiClient.patch(`/admin/users/${userId}/role`, { role }) as any,
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
          <p className="text-xs text-slate-700 truncate">{row.email || '—'}</p>
          <div className="flex gap-1 mt-0.5">
            {row.mountseaBound && (
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
      key: 'role',
      header: '角色',
      width: 'w-24',
      render: (row) => (
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium',
            row.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600',
          )}
        >
          {row.role === 'admin' ? '管理员' : '普通用户'}
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            roleMutation.mutate({
              userId: row.id,
              role: row.role === 'admin' ? 'user' : 'admin',
            });
          }}
          disabled={roleMutation.isPending}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50',
            row.role === 'admin'
              ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
              : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200',
          )}
        >
          {row.role === 'admin' ? (
            <>
              <ShieldOff className="h-3 w-3" />
              撤销
            </>
          ) : (
            <>
              <Shield className="h-3 w-3" />
              提权
            </>
          )}
        </button>
      ),
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-purple-600" />
            用户管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            共 {data?.total ?? 0} 名用户
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
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setPage(1);
                  setRole(opt.value);
                }}
                className={
                  role === opt.value
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
          emptyMessage="暂无用户"
          page={data?.page ?? page}
          pageSize={data?.pageSize ?? 20}
          total={data?.total}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
