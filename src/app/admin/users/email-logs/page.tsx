'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  HelpCircle,
  Mail,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn, formatDate } from '@/lib/utils';
import { SearchBar } from '@/components/search-bar';
import { DataTable, DataTableColumn } from '@/components/data-table';
import { hasPermission } from '@/lib/admin-permissions';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { useAlert } from '@/components/ui/dialog-provider';

type TabKey = 'detail' | 'summary';

interface MailLogRow {
  id: string;
  email: string;
  mailType: string;
  codeMasked: string | null;
  sendStatus: string;
  rejectReason: string | null;
  deliveryError: string | null;
  outcome: string | null;
  verifyFailCount: number;
  userId: string | null;
  user: { id: string; displayName: string; email: string | null } | null;
  clientIp: string | null;
  deviceId: string | null;
  expiresAt: string | null;
  outcomeAt: string | null;
  createdAt: string;
}

interface SummaryRow {
  email: string;
  mailType: string;
  totalAttempts: number;
  sentCount: number;
  rejectedCount: number;
  failedCount: number;
  verifyFailTotal: number;
  registeredCount: number;
  isRegistered: boolean;
  verifyRate: number;
  sendSuccessRate: number;
  lastSentAt: string;
}

interface StatsResponse {
  today: {
    sent: number;
    failed: number;
    rejected: number;
    registered: number;
  };
  registerOverall: {
    sent: number;
    registered: number;
    verifyRate: number;
  };
  dailyTrend: Array<{ day: string; sent: number; registered: number }>;
}

const MAIL_TYPE_OPTIONS = [
  { label: '全部类型', value: '' },
  { label: '注册验证码', value: 'register_verification' },
  { label: '找回密码', value: 'password_reset' },
];

const SEND_STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '已发送', value: 'sent' },
  { label: '发送失败', value: 'failed' },
  { label: '已拒绝', value: 'rejected' },
];

const OUTCOME_OPTIONS = [
  { label: '全部结果', value: '' },
  { label: '待核销', value: 'pending' },
  { label: '已注册', value: 'registered' },
  { label: '已过期', value: 'expired' },
  { label: '重置完成', value: 'reset_completed' },
];

const REGISTERED_OPTIONS = [
  { label: '全部', value: '' },
  { label: '已注册', value: 'true' },
  { label: '未注册', value: 'false' },
];

const MAIL_TYPE_LABELS: Record<string, string> = {
  register_verification: '注册验证码',
  password_reset: '找回密码',
};

const SEND_STATUS_BADGE: Record<string, string> = {
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  failed: 'bg-red-50 text-red-700 border-red-100',
  rejected: 'bg-amber-50 text-amber-700 border-amber-100',
};

const OUTCOME_BADGE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600 border-slate-200',
  registered: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  expired: 'bg-slate-100 text-slate-500 border-slate-200',
  reset_completed: 'bg-blue-50 text-blue-700 border-blue-100',
};

function FilterPills({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value || '__all'}
          onClick={() => onChange(opt.value)}
          className={
            value === opt.value
              ? 'px-2.5 py-1 rounded-lg text-xs font-medium bg-teal-600 text-white'
              : 'px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100'
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminEmailLogsPage() {
  const alert = useAlert();
  const permissions = useAdminAuthStore((s) => s.permissions);
  const canReveal = hasPermission(permissions, 'user.email_log.reveal');

  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [tab, setTab] = useState<TabKey>('detail');
  const [search, setSearch] = useState('');
  const [mailType, setMailType] = useState('');
  const [sendStatus, setSendStatus] = useState('');
  const [outcome, setOutcome] = useState('');
  const [registered, setRegistered] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);

  const { data: stats } = useQuery<StatsResponse>({
    queryKey: ['admin', 'mail-logs', 'stats'],
    queryFn: () => apiClient.get('/admin/mail-logs/stats') as any,
    refetchInterval: 30_000,
  });

  const detailQuery = useQuery<{ items: MailLogRow[]; total: number; pageSize: number }>({
    queryKey: ['admin', 'mail-logs', 'detail', { page, pageSize, search, mailType, sendStatus, outcome }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (search) params.set('search', search);
      if (mailType) params.set('mailType', mailType);
      if (sendStatus) params.set('sendStatus', sendStatus);
      if (outcome) params.set('outcome', outcome);
      return apiClient.get(`/admin/mail-logs?${params.toString()}`) as any;
    },
    enabled: tab === 'detail',
    placeholderData: (prev) => prev,
  });

  const summaryQuery = useQuery<{ items: SummaryRow[]; total: number; pageSize: number }>({
    queryKey: ['admin', 'mail-logs', 'summary', { page, pageSize, search, mailType, registered }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (search) params.set('search', search);
      if (mailType) params.set('mailType', mailType);
      if (registered) params.set('registered', registered);
      return apiClient.get(`/admin/mail-logs/summary?${params.toString()}`) as any;
    },
    enabled: tab === 'summary',
    placeholderData: (prev) => prev,
  });

  const recentQuery = useQuery<{ items: MailLogRow[] }>({
    queryKey: ['admin', 'mail-logs', 'recent', expandedEmail, mailType],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('email', expandedEmail!);
      params.set('limit', '5');
      if (mailType) params.set('mailType', mailType);
      return apiClient.get(`/admin/mail-logs/recent?${params.toString()}`) as any;
    },
    enabled: !!expandedEmail,
  });

  const revealMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/admin/mail-logs/${id}/reveal-code`, {}) as any,
    onSuccess: async (data: { code: string | null }) => {
      if (!data?.code) {
        await alert({ title: '无法查看', description: '该记录无验证码或解密失败', variant: 'danger' });
        return;
      }
      await alert({
        title: '验证码',
        description: (
          <div className="space-y-2">
            <p className="font-mono text-2xl tracking-widest text-center py-2">{data.code}</p>
            <p className="text-xs text-slate-500 text-center">此操作已写入管理员审计日志</p>
          </div>
        ),
        variant: 'default',
      });
    },
    onError: async () => {
      await alert({ title: 'Reveal 失败', description: '无权限或记录不存在', variant: 'danger' });
    },
  });

  const resetPage = () => setPage(1);

  const detailColumns: DataTableColumn<MailLogRow>[] = [
    {
      key: 'createdAt',
      header: '时间',
      width: 'w-36',
      render: (r) => <span className="text-xs text-slate-500">{formatDate(r.createdAt)}</span>,
    },
    {
      key: 'email',
      header: '邮箱',
      render: (r) => <span className="text-sm text-slate-800">{r.email}</span>,
    },
    {
      key: 'mailType',
      header: '类型',
      width: 'w-28',
      render: (r) => (
        <span className="text-xs text-slate-600">
          {MAIL_TYPE_LABELS[r.mailType] ?? r.mailType}
        </span>
      ),
    },
    {
      key: 'code',
      header: '验证码',
      width: 'w-28',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm text-slate-700">{r.codeMasked ?? '—'}</span>
          {canReveal && r.codeMasked && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                revealMutation.mutate(r.id);
              }}
              disabled={revealMutation.isPending}
              className="p-1 rounded-md text-slate-400 hover:text-teal-600 hover:bg-teal-50"
              title="Reveal 完整验证码"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'sendStatus',
      header: '发送',
      width: 'w-24',
      render: (r) => (
        <span
          className={cn(
            'inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium border',
            SEND_STATUS_BADGE[r.sendStatus] ?? 'bg-slate-100 text-slate-600 border-slate-200',
          )}
        >
          {r.sendStatus === 'sent' ? '已发送' : r.sendStatus === 'failed' ? '失败' : '拒绝'}
        </span>
      ),
    },
    {
      key: 'outcome',
      header: '结果',
      width: 'w-24',
      render: (r) =>
        r.outcome ? (
          <span
            className={cn(
              'inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium border',
              OUTCOME_BADGE[r.outcome] ?? 'bg-slate-100 text-slate-600 border-slate-200',
            )}
          >
            {r.outcome === 'pending'
              ? '待核销'
              : r.outcome === 'registered'
                ? '已注册'
                : r.outcome === 'expired'
                  ? '已过期'
                  : r.outcome === 'reset_completed'
                    ? '重置完成'
                    : r.outcome}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: 'verifyFailCount',
      header: '验证失败',
      width: 'w-20',
      align: 'center',
      render: (r) =>
        r.verifyFailCount > 0 ? (
          <span className="text-xs text-red-600 font-medium">{r.verifyFailCount}</span>
        ) : (
          <span className="text-xs text-slate-400">0</span>
        ),
    },
    {
      key: 'clientIp',
      header: 'IP',
      width: 'w-28',
      render: (r) => (
        <span className="text-xs font-mono text-slate-500">{r.clientIp ?? '—'}</span>
      ),
    },
    {
      key: 'user',
      header: '关联用户',
      width: 'w-32',
      render: (r) =>
        r.user ? (
          <Link
            href={`/admin/users?search=${encodeURIComponent(r.user.email ?? r.email)}`}
            className="text-xs text-teal-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {r.user.displayName || r.user.email}
          </Link>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
  ];

  const summaryColumns: DataTableColumn<SummaryRow>[] = [
    {
      key: 'email',
      header: '邮箱',
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedEmail(expandedEmail === r.email ? null : r.email);
            }}
            className="text-slate-400 hover:text-slate-600"
          >
            {expandedEmail === r.email ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          <span className="text-sm text-slate-800">{r.email}</span>
        </div>
      ),
    },
    {
      key: 'mailType',
      header: '类型',
      width: 'w-28',
      render: (r) => (
        <span className="text-xs">{MAIL_TYPE_LABELS[r.mailType] ?? r.mailType}</span>
      ),
    },
    {
      key: 'sentCount',
      header: '发送次数',
      width: 'w-20',
      align: 'center',
      render: (r) => <span className="text-sm font-medium">{r.sentCount}</span>,
    },
    {
      key: 'rejectedCount',
      header: '拒绝',
      width: 'w-16',
      align: 'center',
      render: (r) => (
        <span className={cn('text-sm', r.rejectedCount > 0 && 'text-amber-600')}>
          {r.rejectedCount}
        </span>
      ),
    },
    {
      key: 'verifyFailTotal',
      header: '验证失败',
      width: 'w-20',
      align: 'center',
      render: (r) => (
        <span className={cn('text-sm', r.verifyFailTotal > 0 && 'text-red-600')}>
          {r.verifyFailTotal}
        </span>
      ),
    },
    {
      key: 'isRegistered',
      header: '已注册',
      width: 'w-20',
      align: 'center',
      render: (r) =>
        r.isRegistered ? (
          <span className="text-xs text-emerald-600 font-medium">是</span>
        ) : (
          <span className="text-xs text-slate-400">否</span>
        ),
    },
    {
      key: 'verifyRate',
      header: '核销率',
      width: 'w-20',
      align: 'center',
      render: (r) => <span className="text-sm">{r.verifyRate}%</span>,
    },
    {
      key: 'lastSentAt',
      header: '最近发送',
      width: 'w-36',
      render: (r) => (
        <span className="text-xs text-slate-500">{formatDate(r.lastSentAt)}</span>
      ),
    },
  ];

  const activeData = tab === 'detail' ? detailQuery.data : summaryQuery.data;
  const isLoading = tab === 'detail' ? detailQuery.isLoading : summaryQuery.isLoading;
  const isError = tab === 'detail' ? detailQuery.isError : summaryQuery.isError;
  const error = tab === 'detail' ? detailQuery.error : summaryQuery.error;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Mail className="h-5 w-5 text-teal-600" />
              已发送邮件
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              注册验证码、找回密码等系统邮件发送审计
            </p>
          </div>
          <button
            onClick={() => setShowHelp((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            字段说明
          </button>
        </div>

        {showHelp && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-1">
            <p>
              <strong>发送成功率</strong> = 成功发送数 / 总尝试（含拒绝）；{' '}
              <strong>核销率</strong> = 已注册数 / 成功发送数（注册验证码）。
            </p>
            <p>拒绝包括：邮箱已注册、发送频控、用户不存在（找回密码）、账号非 active。</p>
            <p>验证码默认脱敏；Reveal 需 user.email_log.reveal 权限并写入审计。</p>
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="今日发送" value={stats.today.sent} />
            <StatCard label="今日失败" value={stats.today.failed} sub={`拒绝 ${stats.today.rejected}`} />
            <StatCard label="今日新注册" value={stats.today.registered} />
            <StatCard
              label="注册核销率（全量）"
              value={`${stats.registerOverall.verifyRate}%`}
              sub={`${stats.registerOverall.registered} / ${stats.registerOverall.sent}`}
            />
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {(
              [
                { key: 'detail', label: '发送明细' },
                { key: 'summary', label: '邮箱汇总' },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  resetPage();
                  setExpandedEmail(null);
                }}
                className={
                  tab === t.key
                    ? 'px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-600 text-white'
                    : 'px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100'
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <SearchBar
            value={search}
            onChange={(v) => {
              resetPage();
              setSearch(v);
            }}
            placeholder="搜索邮箱..."
            width="w-64"
          />
          <FilterPills
            options={MAIL_TYPE_OPTIONS}
            value={mailType}
            onChange={(v) => {
              resetPage();
              setMailType(v);
            }}
          />
          {tab === 'detail' && (
            <>
              <FilterPills
                options={SEND_STATUS_OPTIONS}
                value={sendStatus}
                onChange={(v) => {
                  resetPage();
                  setSendStatus(v);
                }}
              />
              <FilterPills
                options={OUTCOME_OPTIONS}
                value={outcome}
                onChange={(v) => {
                  resetPage();
                  setOutcome(v);
                }}
              />
            </>
          )}
          {tab === 'summary' && (
            <FilterPills
              options={REGISTERED_OPTIONS}
              value={registered}
              onChange={(v) => {
                resetPage();
                setRegistered(v);
              }}
            />
          )}
        </div>

        {tab === 'detail' ? (
          <DataTable
            columns={detailColumns}
            rows={detailQuery.data?.items}
            rowKey={(r) => r.id}
            isLoading={isLoading}
            isError={isError}
            error={error}
            emptyMessage="暂无邮件记录"
            page={page}
            pageSize={activeData?.pageSize ?? pageSize}
            total={activeData?.total}
            onPageChange={setPage}
            onPageSizeChange={onPageSizeChange}
          />
        ) : (
          <>
            <DataTable
              columns={summaryColumns}
              rows={summaryQuery.data?.items}
              rowKey={(r) => `${r.email}:${r.mailType}`}
              isLoading={isLoading}
              isError={isError}
              error={error}
              emptyMessage="暂无汇总数据"
              page={page}
              pageSize={activeData?.pageSize ?? pageSize}
              total={activeData?.total}
              onPageChange={setPage}
              onPageSizeChange={onPageSizeChange}
            />
            {expandedEmail && recentQuery.data?.items?.length ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-medium text-slate-600">
                  {expandedEmail} 最近 {recentQuery.data.items.length} 条
                </p>
                {recentQuery.data.items.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 text-xs text-slate-600 border-b border-slate-100 pb-2 last:border-0"
                  >
                    <span className="text-slate-400 w-32">{formatDate(r.createdAt)}</span>
                    <span>{MAIL_TYPE_LABELS[r.mailType] ?? r.mailType}</span>
                    <span className="font-mono">{r.codeMasked ?? '—'}</span>
                    <span>{r.sendStatus}</span>
                    <span>{r.outcome ?? '—'}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
