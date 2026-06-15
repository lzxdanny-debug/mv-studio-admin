'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Check } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { StatusBadge } from '@/components/status-badge';
import { PaginationBar } from '@/components/pagination-bar';

const DETAIL_PAGE_SIZE_DEFAULT = 10;

type UserStatus = 'active' | 'suspended' | 'banned' | 'deleted';

const STATUS_META: Record<UserStatus, { label: string; cls: string }> = {
  active: { label: '正常', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  suspended: { label: '已暂停', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  banned: { label: '已封禁', cls: 'bg-red-50 text-red-700 border-red-100' },
  deleted: { label: '已注销', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

interface UserDetail {
  user: {
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
    lastLoginAt: string | null;
    lastLoginIp: string | null;
    createdAt: string;
    updatedAt: string;
  };
  oauthAccounts: Array<{
    provider: string;
    providerUserId: string;
    email: string | null;
    createdAt: string;
  }>;
  credit: { balance: number };
  counts: {
    mvProjects: number;
    musicTasks: number;
    lyricsTasks: number;
    transactions: number;
    feedback: number;
    payments: number;
  };
  subscription: {
    planCode: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    createdAt: string;
  } | null;
}

const PAYMENT_STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: '待支付', cls: 'text-amber-700 bg-amber-50 border-amber-100' },
  succeeded: { label: '已支付', cls: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
  failed: { label: '失败', cls: 'text-red-700 bg-red-50 border-red-100' },
  refunded: { label: '已退款', cls: 'text-blue-700 bg-blue-50 border-blue-100' },
};

const TX_TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  purchase: { label: '购买', cls: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
  consume: { label: '消耗', cls: 'text-red-700 bg-red-50 border-red-100' },
  refund: { label: '退款', cls: 'text-blue-700 bg-blue-50 border-blue-100' },
  bonus: { label: '赠送', cls: 'text-amber-700 bg-amber-50 border-amber-100' },
};

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [mvPage, setMvPage] = useState(1);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [musicPage, setMusicPage] = useState(1);
  const [lyricsPage, setLyricsPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const [payPage, setPayPage] = useState(1);
  const [detailPageSize, setDetailPageSize] = useState(DETAIL_PAGE_SIZE_DEFAULT);

  const onDetailPageSizeChange = (size: number) => {
    setDetailPageSize(size);
    setMvPage(1);
    setFeedbackPage(1);
    setMusicPage(1);
    setLyricsPage(1);
    setTxPage(1);
    setPayPage(1);
  };

  const { data, isLoading, isError, error, refetch } = useQuery<UserDetail>({
    queryKey: ['admin', 'user', id],
    queryFn: () => apiClient.get(`/admin/users/${id}`) as any,
  });

  const mvProjectsQ = useQuery<
    Paginated<{
      id: string;
      title: string;
      status: string;
      createdAt: string;
    }>
  >({
    queryKey: ['admin', 'user', id, 'mv-projects', mvPage, detailPageSize],
    queryFn: () =>
      apiClient.get(
        `/admin/users/${id}/mv-projects?page=${mvPage}&pageSize=${detailPageSize}`,
      ) as any,
    enabled: !!data,
  });

  const feedbackQ = useQuery<
    Paginated<{
      id: string;
      category: string;
      content: string;
      isRead: boolean;
      createdAt: string;
    }>
  >({
    queryKey: ['admin', 'user', id, 'feedback', feedbackPage, detailPageSize],
    queryFn: () =>
      apiClient.get(
        `/admin/users/${id}/feedback?page=${feedbackPage}&pageSize=${detailPageSize}`,
      ) as any,
    enabled: !!data,
  });

  const musicQ = useQuery<
    Paginated<{
      id: string;
      title: string;
      model: string;
      status: string;
      createdAt: string;
    }>
  >({
    queryKey: ['admin', 'user', id, 'music-tasks', musicPage, detailPageSize],
    queryFn: () =>
      apiClient.get(
        `/admin/users/${id}/music-tasks?page=${musicPage}&pageSize=${detailPageSize}`,
      ) as any,
    enabled: !!data,
  });

  const lyricsQ = useQuery<
    Paginated<{
      id: string;
      title: string;
      model: string;
      status: string;
      createdAt: string;
    }>
  >({
    queryKey: ['admin', 'user', id, 'lyrics-tasks', lyricsPage, detailPageSize],
    queryFn: () =>
      apiClient.get(
        `/admin/users/${id}/lyrics-tasks?page=${lyricsPage}&pageSize=${detailPageSize}`,
      ) as any,
    enabled: !!data,
  });

  const txQ = useQuery<
    Paginated<{
      id: string;
      amount: number;
      type: string;
      description: string | null;
      createdAt: string;
    }>
  >({
    queryKey: ['admin', 'user', id, 'transactions', txPage, detailPageSize],
    queryFn: () =>
      apiClient.get(
        `/admin/users/${id}/transactions?page=${txPage}&pageSize=${detailPageSize}`,
      ) as any,
    enabled: !!data,
  });

  const payQ = useQuery<
    Paginated<{
      id: string;
      type: 'topup' | 'subscription';
      status: 'pending' | 'succeeded' | 'failed' | 'refunded';
      amountCents: number;
      currency: string;
      creditAmount: number | null;
      packageCode: string | null;
      planCode: string | null;
      createdAt: string;
    }>
  >({
    queryKey: ['admin', 'user', id, 'payments', payPage, detailPageSize],
    queryFn: () =>
      apiClient.get(
        `/admin/users/${id}/payments?page=${payPage}&pageSize=${detailPageSize}`,
      ) as any,
    enabled: !!data,
  });

  const statusMutation = useMutation({
    mutationFn: (status: UserStatus) =>
      apiClient.patch(`/admin/users/${id}/status`, { status }) as any,
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
          返回 C 端用户列表
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
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-rose-500 flex items-center justify-center overflow-hidden flex-shrink-0">
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
                    <h1 className="text-lg font-bold text-slate-900 truncate flex items-center gap-2 flex-wrap">
                      {user.displayName}
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
                          (STATUS_META[user.status] ?? STATUS_META.active).cls,
                        )}
                      >
                        {(STATUS_META[user.status] ?? STATUS_META.active).label}
                      </span>
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{user.id}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {user.email || '— 未绑定邮箱'}
                      {user.email && (
                        <span
                          className={cn(
                            'ml-1.5 inline-flex items-center px-1 py-0.5 rounded text-[10px] border',
                            user.emailVerified
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              : 'bg-slate-50 text-slate-400 border-slate-200',
                          )}
                        >
                          {user.emailVerified ? '已验证' : '未验证'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {user.status === 'active' ? (
                    <button
                      onClick={() => statusMutation.mutate('banned')}
                      disabled={statusMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border bg-red-50 hover:bg-red-100 text-red-700 border-red-200 transition-colors disabled:opacity-50"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      封禁用户
                    </button>
                  ) : (
                    <button
                      onClick={() => statusMutation.mutate('active')}
                      disabled={statusMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 transition-colors disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      解除封禁
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <DetailField label="登录方式" value={providerLabel(user.primaryProvider)} />
                <DetailField
                  label="最近登录"
                  value={user.lastLoginAt ? formatDate(user.lastLoginAt) : '—'}
                />
                <DetailField label="最近登录 IP" value={user.lastLoginIp || '—'} mono />
                <DetailField label="注册时间" value={formatDate(user.createdAt)} />
                {data.oauthAccounts.length > 0 && (
                  <div className="col-span-2 lg:col-span-4">
                    <p className="text-xs text-slate-500 mb-1.5">第三方绑定</p>
                    <div className="flex flex-wrap gap-2">
                      {data.oauthAccounts.map((o) => (
                        <span
                          key={`${o.provider}:${o.providerUserId}`}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-600"
                        >
                          <span className="font-medium capitalize">{o.provider}</span>
                          <span className="text-slate-400">{o.email || o.providerUserId}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <InfoCard label="本地积分余额" value={data.credit.balance.toLocaleString()} />
                <InfoCard label="MV 项目数" value={data.counts.mvProjects} />
                <InfoCard label="音乐项目数" value={data.counts.musicTasks} />
                <InfoCard label="歌词项目数" value={data.counts.lyricsTasks} />
                <InfoCard label="积分流水" value={data.counts.transactions} />
                <InfoCard label="反馈记录" value={data.counts.feedback} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="p-5 pb-3">
                    <h3 className="text-sm font-semibold text-slate-700">MV 项目</h3>
                  </div>
                  {!mvProjectsQ.data?.items.length ? (
                    <p className="text-xs text-slate-400 py-4 text-center">暂无项目</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 px-5">
                      {mvProjectsQ.data.items.map((p) => (
                        <li key={p.id} className="py-2 flex items-center justify-between gap-2">
                          <Link
                            href={`/admin/mv/projects/${p.id}`}
                            className="text-sm text-slate-700 hover:text-teal-600 truncate min-w-0"
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
                  {mvProjectsQ.data && (
                    <PaginationBar
                      page={mvPage}
                      pageSize={detailPageSize}
                      total={mvProjectsQ.data.total}
                      onPageChange={setMvPage}
                      onPageSizeChange={onDetailPageSizeChange}
                      pageSizeOptions={[10, 20, 50]}
                    />
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="p-5 pb-3">
                    <h3 className="text-sm font-semibold text-slate-700">用户反馈</h3>
                  </div>
                  {!feedbackQ.data?.items.length ? (
                    <p className="text-xs text-slate-400 py-4 text-center">暂无反馈</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 px-5">
                      {feedbackQ.data.items.map((f) => (
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
                  {feedbackQ.data && (
                    <PaginationBar
                      page={feedbackPage}
                      pageSize={detailPageSize}
                      total={feedbackQ.data.total}
                      onPageChange={setFeedbackPage}
                      onPageSizeChange={onDetailPageSizeChange}
                      pageSizeOptions={[10, 20, 50]}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="p-5 pb-3">
                    <h3 className="text-sm font-semibold text-slate-700">音乐项目</h3>
                  </div>
                  {!musicQ.data?.items.length ? (
                    <p className="text-xs text-slate-400 py-4 text-center">暂无项目</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 px-5">
                      {musicQ.data.items.map((m) => (
                        <li key={m.id} className="py-2 flex items-center justify-between gap-2">
                          <Link
                            href={`/admin/music/tasks/${m.id}`}
                            className="text-sm text-slate-700 hover:text-teal-600 truncate min-w-0"
                          >
                            {m.title}
                          </Link>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                              {m.model}
                            </span>
                            <StatusBadge status={m.status} kind="generic" />
                            <span className="text-[11px] text-slate-400">
                              {formatDate(m.createdAt)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {musicQ.data && (
                    <PaginationBar
                      page={musicPage}
                      pageSize={detailPageSize}
                      total={musicQ.data.total}
                      onPageChange={setMusicPage}
                      onPageSizeChange={onDetailPageSizeChange}
                      pageSizeOptions={[10, 20, 50]}
                    />
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="p-5 pb-3">
                    <h3 className="text-sm font-semibold text-slate-700">歌词项目</h3>
                  </div>
                  {!lyricsQ.data?.items.length ? (
                    <p className="text-xs text-slate-400 py-4 text-center">暂无项目</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 px-5">
                      {lyricsQ.data.items.map((l) => (
                        <li key={l.id} className="py-2 flex items-center justify-between gap-2">
                          <Link
                            href={`/admin/music/tasks/${l.id}`}
                            className="text-sm text-slate-700 hover:text-teal-600 truncate min-w-0"
                          >
                            {l.title}
                          </Link>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <StatusBadge status={l.status} kind="generic" />
                            <span className="text-[11px] text-slate-400">
                              {formatDate(l.createdAt)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {lyricsQ.data && (
                    <PaginationBar
                      page={lyricsPage}
                      pageSize={detailPageSize}
                      total={lyricsQ.data.total}
                      onPageChange={setLyricsPage}
                      onPageSizeChange={onDetailPageSizeChange}
                      pageSizeOptions={[10, 20, 50]}
                    />
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="p-5 pb-3">
                  <h3 className="text-sm font-semibold text-slate-700">本地积分流水</h3>
                </div>
                {!txQ.data?.items.length ? (
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
                        {txQ.data.items.map((t) => {
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
                {txQ.data && (
                  <PaginationBar
                    page={txPage}
                    pageSize={detailPageSize}
                    total={txQ.data.total}
                    onPageChange={setTxPage}
                    onPageSizeChange={onDetailPageSizeChange}
                    pageSizeOptions={[10, 20, 50]}
                  />
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between p-5 pb-3">
                  <h3 className="text-sm font-semibold text-slate-700">充值 / 支付记录</h3>
                  {data.subscription && (
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border',
                        data.subscription.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-slate-50 text-slate-500 border-slate-200',
                      )}
                    >
                      会员：{data.subscription.planCode} · {data.subscription.status}
                      {data.subscription.cancelAtPeriodEnd && '（到期取消）'}
                      {data.subscription.currentPeriodEnd &&
                        ` · 到期 ${formatDate(data.subscription.currentPeriodEnd)}`}
                    </span>
                  )}
                </div>
                {!payQ.data?.items.length ? (
                  <p className="text-xs text-slate-400 py-6 text-center">暂无支付记录</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-slate-500">
                        <tr className="border-b border-slate-100">
                          <th className="px-3 py-2 text-left">时间</th>
                          <th className="px-3 py-2 text-left">类型</th>
                          <th className="px-3 py-2 text-left">状态</th>
                          <th className="px-3 py-2 text-right">金额</th>
                          <th className="px-3 py-2 text-right">到账积分</th>
                          <th className="px-3 py-2 text-left">套餐/计划</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {payQ.data.items.map((p) => {
                          const meta = PAYMENT_STATUS_META[p.status] ?? {
                            label: p.status,
                            cls: 'text-slate-600 bg-slate-50 border-slate-100',
                          };
                          return (
                            <tr key={p.id}>
                              <td className="px-3 py-2 text-xs text-slate-500">
                                {formatDate(p.createdAt)}
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-700">
                                {p.type === 'topup' ? '充值' : '订阅'}
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
                              <td className="px-3 py-2 text-right text-sm tabular-nums">
                                {p.currency.toUpperCase()} {(p.amountCents / 100).toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-right text-sm tabular-nums text-emerald-700">
                                {p.creditAmount ? `+${p.creditAmount.toLocaleString()}` : '—'}
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-600">
                                {p.packageCode || p.planCode || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {payQ.data && (
                  <PaginationBar
                    page={payPage}
                    pageSize={detailPageSize}
                    total={payQ.data.total}
                    onPageChange={setPayPage}
                    onPageSizeChange={onDetailPageSizeChange}
                    pageSizeOptions={[10, 20, 50]}
                  />
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

function DetailField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className={cn('text-sm text-slate-800 truncate', mono && 'font-mono text-xs')}>
        {value}
      </p>
    </div>
  );
}

const PROVIDER_LABELS: Record<string, string> = {
  email: '邮箱密码',
  google: 'Google',
  apple: 'Apple',
  facebook: 'Facebook',
  mountsea: 'Mountsea',
};

function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] || provider || '—';
}
