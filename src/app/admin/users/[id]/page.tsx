'use client';

import { use } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Shield, ShieldOff } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { StatusBadge } from '@/components/status-badge';

interface UserDetail {
  user: {
    id: string;
    email: string | null;
    displayName: string;
    avatarUrl: string | null;
    role: 'user' | 'admin';
    googleId: string | null;
    hasPassword: boolean;
    mountseaBound: boolean;
    createdAt: string;
    updatedAt: string;
  };
  credit: { balance: number };
  transactions: Array<{
    id: string;
    amount: number;
    type: string;
    description: string | null;
    referenceId: string | null;
    createdAt: string;
  }>;
  mvProjects: Array<{
    id: string;
    title: string;
    status: string;
    currentStep: number;
    styleTag: string;
    createdAt: string;
    updatedAt: string;
  }>;
  feedback: Array<{
    id: string;
    category: string;
    content: string;
    isRead: boolean;
    createdAt: string;
    pagePath: string | null;
  }>;
}

const TX_TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  purchase: { label: '购买', cls: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
  consume: { label: '消耗', cls: 'text-red-700 bg-red-50 border-red-100' },
  refund: { label: '退款', cls: 'text-blue-700 bg-blue-50 border-blue-100' },
  bonus: { label: '赠送', cls: 'text-amber-700 bg-amber-50 border-amber-100' },
};

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery<UserDetail>({
    queryKey: ['admin', 'user', id],
    queryFn: () => apiClient.get(`/admin/users/${id}`) as any,
  });

  const roleMutation = useMutation({
    mutationFn: (role: 'user' | 'admin') =>
      apiClient.patch(`/admin/users/${id}/role`, { role }) as any,
    onSuccess: () => {
      refetch();
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const user = data?.user;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          返回用户列表
        </Link>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!user}
          height="h-96"
        >
          {data && user && (
            <>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-white">
                        {user.displayName?.[0]?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-lg font-bold text-slate-900 truncate flex items-center gap-2">
                      {user.displayName}
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {user.role === 'admin' ? '管理员' : '普通用户'}
                      </span>
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{user.id}</p>
                    <p className="text-xs text-slate-500 mt-1">{user.email || '— 未绑定邮箱'}</p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    roleMutation.mutate(user.role === 'admin' ? 'user' : 'admin')
                  }
                  disabled={roleMutation.isPending}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors disabled:opacity-50',
                    user.role === 'admin'
                      ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                      : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200',
                  )}
                >
                  {user.role === 'admin' ? (
                    <>
                      <ShieldOff className="h-3.5 w-3.5" />
                      撤销管理员
                    </>
                  ) : (
                    <>
                      <Shield className="h-3.5 w-3.5" />
                      提升为管理员
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <InfoCard label="本地积分余额" value={data.credit.balance.toLocaleString()} />
                <InfoCard label="MV 项目数" value={data.mvProjects.length} />
                <InfoCard label="积分流水" value={data.transactions.length} />
                <InfoCard label="反馈记录" value={data.feedback.length} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">最近 MV 项目</h3>
                  {data.mvProjects.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">暂无项目</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {data.mvProjects.map((p) => (
                        <li key={p.id} className="py-2 flex items-center justify-between gap-2">
                          <Link
                            href={`/admin/mv/projects/${p.id}`}
                            className="text-sm text-slate-700 hover:text-purple-600 truncate min-w-0"
                          >
                            {p.title || '(未命名)'}
                          </Link>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <StatusBadge status={p.status} kind="mvProject" />
                            <span className="text-[11px] text-slate-400">
                              {formatDate(p.createdAt)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">最近反馈</h3>
                  {data.feedback.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">暂无反馈</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {data.feedback.map((f) => (
                        <li key={f.id} className="py-2">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[10px] uppercase tracking-wider text-slate-500">
                              {f.category}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {formatDate(f.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 line-clamp-2">{f.content}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">本地积分流水</h3>
                {data.transactions.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">暂无流水</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-slate-500">
                        <tr className="border-b border-slate-100">
                          <th className="px-3 py-2 text-left">时间</th>
                          <th className="px-3 py-2 text-left">类型</th>
                          <th className="px-3 py-2 text-right">金额</th>
                          <th className="px-3 py-2 text-left">备注</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {data.transactions.map((t) => {
                          const meta = TX_TYPE_LABELS[t.type] ?? {
                            label: t.type,
                            cls: 'text-slate-600 bg-slate-50 border-slate-100',
                          };
                          return (
                            <tr key={t.id}>
                              <td className="px-3 py-2 text-xs text-slate-500">
                                {formatDate(t.createdAt)}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={cn(
                                    'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border',
                                    meta.cls,
                                  )}
                                >
                                  {meta.label}
                                </span>
                              </td>
                              <td
                                className={cn(
                                  'px-3 py-2 text-right text-sm tabular-nums font-medium',
                                  t.amount >= 0 ? 'text-emerald-700' : 'text-red-700',
                                )}
                              >
                                {t.amount >= 0 ? '+' : ''}
                                {t.amount.toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-600 max-w-md truncate">
                                {t.description || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </QueryState>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}
