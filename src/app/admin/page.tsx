'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Film,
  CheckCircle2,
  XCircle,
  Loader2,
  Clapperboard,
  MessageCircle,
  Calendar,
  Wallet,
  Coins,
  ChevronRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';

interface OverviewStats {
  users: { total: number; admin: number };
  mvProjects: {
    total: number;
    done: number;
    failed: number;
    generating: number;
    composing: number;
  };
  shots: { total: number; completed: number; failed: number };
  feedback: { unread: number };
  today: {
    newUsers: number;
    newProjects: number;
    doneProjects: number;
    rechargeCents: number;
    costCny: number;
  };
}

interface TrendPoint {
  date: string;
  created: number;
  done: number;
  failed: number;
}

interface StatusItem {
  status: string;
  count: number;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待开始',
  planning: '规划中',
  reviewing: '等待确认',
  generating: '生成中',
  composing: '合成中',
  done: '已完成',
  failed: '失败',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#94a3b8',
  planning: '#3b82f6',
  reviewing: '#f59e0b',
  generating: '#2563eb',
  composing: '#06b6d4',
  done: '#10b981',
  failed: '#ef4444',
};

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  iconBg,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  iconBg: string;
}) {
  return (
    <div className="admin-card p-4 flex flex-col gap-2 hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <div className={cn('w-8 h-8 rounded-md flex items-center justify-center', iconBg)}>
          <Icon className={cn('h-4 w-4', color)} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function FinanceCard({
  href,
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  href: string;
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group rounded-lg border border-slate-200 border-l-4 bg-white p-5 flex items-center gap-4 hover:border-slate-300 transition-colors',
        tone,
      )}
    >
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
        <Icon className="h-6 w-6 text-slate-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-3xl font-bold tabular-nums mt-1 text-slate-950">{value}</p>
        <p className="text-xs text-slate-500 mt-1">{sub}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="admin-card p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AdminDashboard() {
  const statsQuery = useQuery<OverviewStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => apiClient.get('/admin/stats') as any,
    refetchInterval: 30_000,
  });

  const trendsQuery = useQuery<TrendPoint[]>({
    queryKey: ['admin', 'trends', 14],
    queryFn: () => apiClient.get('/admin/trends?days=14') as any,
    refetchInterval: 60_000,
  });

  const statusQuery = useQuery<StatusItem[]>({
    queryKey: ['admin', 'trends', 'status'],
    queryFn: () => apiClient.get('/admin/trends/status') as any,
    refetchInterval: 60_000,
  });

  const s = statsQuery.data;
  const completionRate = s?.mvProjects.total
    ? Math.round((s.mvProjects.done / s.mvProjects.total) * 100)
    : 0;
  const failRate = s?.mvProjects.total
    ? Math.round((s.mvProjects.failed / s.mvProjects.total) * 100)
    : 0;
  const shotSuccessRate = s?.shots.total
    ? Math.round((s.shots.completed / s.shots.total) * 100)
    : 0;

  const cards = s
    ? [
        {
          label: 'C 端用户',
          value: s.users.total.toLocaleString(),
          sub: `后台管理员 ${s.users.admin} 人`,
          icon: Users,
          color: 'text-blue-600',
          iconBg: 'bg-blue-50',
        },
        {
          label: 'MV 项目',
          value: s.mvProjects.total.toLocaleString(),
          sub: `生成中 ${s.mvProjects.generating} · 合成中 ${s.mvProjects.composing}`,
          icon: Film,
          color: 'text-blue-600',
          iconBg: 'bg-blue-50',
        },
        {
          label: '已完成项目',
          value: s.mvProjects.done.toLocaleString(),
          sub: `成功率 ${completionRate}%`,
          icon: CheckCircle2,
          color: 'text-emerald-600',
          iconBg: 'bg-emerald-50',
        },
        {
          label: '失败项目',
          value: s.mvProjects.failed.toLocaleString(),
          sub: `失败率 ${failRate}%`,
          icon: XCircle,
          color: 'text-red-600',
          iconBg: 'bg-red-50',
        },
        {
          label: '镜头总数',
          value: s.shots.total.toLocaleString(),
          sub: `成功率 ${shotSuccessRate}%`,
          icon: Clapperboard,
          color: 'text-indigo-600',
          iconBg: 'bg-indigo-50',
        },
        {
          label: '今日新建',
          value: s.today.newProjects,
          sub: `今日完成 ${s.today.doneProjects}`,
          icon: Calendar,
          color: 'text-cyan-600',
          iconBg: 'bg-cyan-50',
        },
        {
          label: '今日新用户',
          value: s.today.newUsers,
          icon: Users,
          color: 'text-rose-600',
          iconBg: 'bg-rose-50',
        },
        {
          label: '未读反馈',
          value: s.feedback.unread,
          icon: MessageCircle,
          color: 'text-amber-600',
          iconBg: 'bg-amber-50',
        },
      ]
    : [];

  const dailyData = (trendsQuery.data ?? []).map((d) => ({
    ...d,
    date: formatDate(d.date),
  }));

  const statusData = (statusQuery.data ?? []).map((item) => ({
    name: STATUS_LABELS[item.status] ?? item.status,
    value: item.count,
    color: STATUS_COLORS[item.status] ?? '#94a3b8',
  }));

  return (
    <div className="admin-page">
      <div className="p-6 space-y-6">
        {/* 今日财务速览 —— 置顶高亮 */}
        {s && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FinanceCard
              href="/admin/billing"
              label="今日充值金额"
              value={`$${((s.today.rechargeCents ?? 0) / 100).toFixed(2)}`}
              sub="点击查看财务总览"
              icon={Wallet}
              tone="border-l-blue-500"
            />
            <FinanceCard
              href="/admin/billing/cost"
              label="今日成本"
              value={`¥${(s.today.costCny ?? 0).toFixed(2)}`}
              sub="点击查看成本统计"
              icon={Coins}
              tone="border-l-amber-500"
            />
          </div>
        )}

        <div>
          <h1 className="text-xl font-bold text-slate-900">仪表盘</h1>
          <p className="text-sm text-slate-500 mt-1">MV Studio 平台实时概览</p>
        </div>

        <QueryState
          isLoading={statsQuery.isLoading}
          isError={statsQuery.isError}
          error={statsQuery.error}
          isEmpty={!s}
          height="h-48"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>
        </QueryState>

        <ChartCard title="近 14 天 MV 项目趋势">
          {trendsQuery.isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
            </div>
          ) : dailyData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">
              暂无数据
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dailyData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  labelStyle={{ color: '#475569', fontWeight: 600 }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="created"
                  name="新建"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#14b8a6' }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="done"
                  name="完成"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#10b981' }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="failed"
                  name="失败"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#ef4444' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="项目状态分布">
            {statusQuery.isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              </div>
            ) : statusData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-slate-400">
                暂无数据
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={84}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      fontSize: 12,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="镜头执行概况">
            {s ? (
              <div className="space-y-3 py-2">
                <ShotBar
                  label="已完成"
                  value={s.shots.completed}
                  total={s.shots.total}
                  color="bg-emerald-500"
                />
                <ShotBar
                  label="失败"
                  value={s.shots.failed}
                  total={s.shots.total}
                  color="bg-red-500"
                />
                <ShotBar
                  label="其它进行中 / 待处理"
                  value={Math.max(0, s.shots.total - s.shots.completed - s.shots.failed)}
                  total={s.shots.total}
                  color="bg-blue-500"
                />
                <div className="pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
                  <span>镜头总数</span>
                  <span className="font-medium text-slate-700 tabular-nums">
                    {s.shots.total.toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-sm text-slate-400">
                暂无数据
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

function ShotBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-700 font-medium tabular-nums">
          {value.toLocaleString()} <span className="text-slate-400">· {pct}%</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={cn('h-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
