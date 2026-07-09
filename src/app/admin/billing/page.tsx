'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  RefreshCw,
  Receipt,
  Users,
  CreditCard,
  Repeat,
  ArrowLeftRight,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import {
  usd,
  usdCompact,
  pct,
  CHART_COLORS,
  TYPE_LABEL,
  METHOD_LABEL,
  RANGE_LABEL,
  RangePreset,
  computeRange,
  tsLabel,
} from './_lib/format';

interface Overview {
  grossRevenueCents: number;
  refundCents: number;
  netRevenueCents: number;
  refundRate: number;
  payingUsers: number;
  newPayingUsers: number;
  arppuCents: number;
  activeSubscribers: number;
  mrrCents: number;
}

interface RevenuePayload {
  range: { fromIso: string; toIso: string; bucket: 'day' | 'week' | 'month' };
  trend: { ts: string; revenueCents: number; count: number }[];
  byProduct: { code: string; type: string; revenueCents: number; count: number }[];
  byCountry: { country: string; revenueCents: number }[];
  byMethod: { method: string; revenueCents: number }[];
}

interface ExchangeRate {
  rate: number;
  updatedAt: string | null;
  source: 'live' | 'cache' | 'default';
}

const PRESETS: RangePreset[] = ['today', '7d', '30d', '90d', '12m'];

export default function BillingDashboardPage() {
  const [preset, setPreset] = useState<RangePreset>('today');
  const range = useMemo(() => computeRange(preset), [preset]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set('from', new Date(range.fromMs).toISOString());
    p.set('to', new Date(range.toMs).toISOString());
    return p.toString();
  }, [range]);

  const overview = useQuery<Overview>({
    queryKey: ['admin', 'billing', 'overview', preset],
    queryFn: () => apiClient.get(`/admin/billing/overview?${qs}`) as any,
    placeholderData: (p) => p,
  });

  const revenue = useQuery<RevenuePayload>({
    queryKey: ['admin', 'billing', 'revenue', preset],
    queryFn: () =>
      apiClient.get(`/admin/billing/analytics/revenue?${qs}&bucket=${range.bucket}`) as any,
    placeholderData: (p) => p,
  });

  const fx = useQuery<ExchangeRate>({
    queryKey: ['admin', 'billing', 'exchange-rate'],
    queryFn: () => apiClient.get('/admin/billing/exchange-rate') as any,
    placeholderData: (p) => p,
    staleTime: 5 * 60 * 1000,
  });

  const isFetching = overview.isFetching || revenue.isFetching;

  return (
    <div className="admin-page">
      <div className="p-6 space-y-5 max-w-[1600px]">
        {/* 顶部 */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              财务总览
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              收入 / 退款 / 付费用户 / 订阅经营大盘（现金流口径）
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RateBadge fx={fx.data} />
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    preset === p
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  {RANGE_LABEL[p]}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                overview.refetch();
                revenue.refetch();
                fx.refetch();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              刷新
            </button>
            <Link
              href="/admin/billing/payments"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Receipt className="h-3.5 w-3.5" />
              充值记录
            </Link>
          </div>
        </div>

        {/* KPI 卡 */}
        <QueryState
          isLoading={overview.isLoading}
          isError={overview.isError}
          error={overview.error}
          isEmpty={false}
          height="h-32"
        >
          {overview.data && <KpiGrid data={overview.data} />}
        </QueryState>

        {/* 图表区 */}
        <QueryState
          isLoading={revenue.isLoading}
          isError={revenue.isError}
          error={revenue.error}
          isEmpty={false}
          height="h-80"
        >
          {revenue.data && (
            <div className="space-y-4">
              <RevenueTrend payload={revenue.data} />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ProductPie payload={revenue.data} />
                <BreakdownList
                  title="按国家"
                  rows={revenue.data.byCountry.map((r) => ({
                    label: r.country === 'unknown' ? '未知' : r.country.toUpperCase(),
                    cents: r.revenueCents,
                  }))}
                />
                <BreakdownList
                  title="按支付方式"
                  rows={revenue.data.byMethod.map((r) => ({
                    label: METHOD_LABEL[r.method] ?? r.method,
                    cents: r.revenueCents,
                  }))}
                />
              </div>
            </div>
          )}
        </QueryState>

        <p className="text-[11px] text-slate-400 leading-relaxed px-1">
          <strong className="text-slate-500">口径说明：</strong>
          总收入按支付完成时间（paid_at）统计曾成功支付的订单全额，<strong className="text-slate-500">不扣退款</strong>；
          退款按退款成功时间单独统计；净收入 = 总收入 − 退款，为该时间段的现金净流入（非单笔订单毛利）。
          国家 / 支付方式自计费重构上线起采集，历史订单显示「未知」。
        </p>
      </div>
    </div>
  );
}

function RateBadge({ fx }: { fx?: ExchangeRate }) {
  if (!fx) return null;
  const sourceMeta: Record<ExchangeRate['source'], { label: string; cls: string }> = {
    live: { label: '实时', cls: 'text-emerald-600' },
    cache: { label: '缓存', cls: 'text-amber-600' },
    default: { label: '默认', cls: 'text-slate-400' },
  };
  const meta = sourceMeta[fx.source];
  const when = fx.updatedAt
    ? new Date(fx.updatedAt).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;
  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700"
      title={`USD→CNY ${fx.source}${when ? ` · 更新于 ${when}` : ''}`}
    >
      <ArrowLeftRight className="h-3.5 w-3.5 text-blue-600" />
      <span className="font-medium tabular-nums">1 USD = ¥{fx.rate.toFixed(4)}</span>
      <span className={cn('font-medium', meta.cls)}>{meta.label}</span>
      {when && <span className="text-slate-400">· {when}</span>}
    </div>
  );
}

function KpiGrid({ data }: { data: Overview }) {
  const cards = [
    {
      label: '总收入',
      value: usd(data.grossRevenueCents),
      sub: '支付完成全额，不扣退款',
      icon: TrendingUp,
      tint: 'text-blue-600 bg-blue-50',
    },
    {
      label: '净收入',
      value: usd(data.netRevenueCents),
      sub: `退款 ${usd(data.refundCents)} · ${pct(data.refundRate)}`,
      icon: TrendingUp,
      tint: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: '付费用户',
      value: String(data.payingUsers),
      sub: `新增 +${data.newPayingUsers}`,
      icon: Users,
      tint: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'ARPPU',
      value: usd(data.arppuCents),
      sub: '净收入 / 付费用户',
      icon: CreditCard,
      tint: 'text-rose-600 bg-rose-50',
    },
    {
      label: 'MRR',
      value: usd(data.mrrCents),
      sub: '月度经常性收入',
      icon: Repeat,
      tint: 'text-amber-600 bg-amber-50',
    },
    {
      label: '活跃订阅',
      value: String(data.activeSubscribers),
      sub: '当前 active',
      icon: Repeat,
      tint: 'text-cyan-600 bg-cyan-50',
    },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="admin-card p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{c.label}</span>
            <span className={cn('p-1.5 rounded-lg', c.tint)}>
              <c.icon className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900 tabular-nums">{c.value}</p>
          {c.sub && <p className="mt-0.5 text-[11px] text-slate-400">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}

function RevenueTrend({ payload }: { payload: RevenuePayload }) {
  const data = payload.trend.map((p) => ({
    label: tsLabel(p.ts, payload.range.bucket),
    revenue: p.revenueCents / 100,
    revenueCents: p.revenueCents,
    count: p.count,
  }));
  return (
    <div className="admin-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900">收入趋势</h3>
        <span className="text-[11px] text-slate-400">
          {payload.range.bucket === 'day' ? '按天' : payload.range.bucket === 'week' ? '按周' : '按月'}聚合
        </span>
      </div>
      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-xs text-slate-400">
          时间窗内暂无收入
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickFormatter={(v) => usdCompact(Number(v) * 100)}
              />
              <Tooltip
                formatter={(v: any, name) =>
                  name === '收入' ? usd(Number(v) * 100) : v
                }
                contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#e2e8f0' }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="收入"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#revFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function ProductPie({ payload }: { payload: RevenuePayload }) {
  const data = payload.byProduct.map((p, i) => ({
    name: `${TYPE_LABEL[p.type] ?? p.type}·${p.code}`,
    value: p.revenueCents,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="admin-card p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">产品收入占比</h3>
      {total === 0 ? (
        <div className="h-56 flex items-center justify-center text-xs text-slate-400">
          暂无数据
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="h-40 w-40 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => usd(Number(v))} contentStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                <span className="text-slate-600 truncate flex-1">{d.name}</span>
                <span className="text-slate-800 font-medium tabular-nums">{usd(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BreakdownList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; cents: number }[];
}) {
  const total = rows.reduce((a, b) => a + b.cents, 0);
  return (
    <div className="admin-card p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">{title}</h3>
      {total === 0 ? (
        <div className="h-56 flex items-center justify-center text-xs text-slate-400">暂无数据</div>
      ) : (
        <div className="space-y-2.5">
          {rows.slice(0, 6).map((r, i) => {
            const ratio = total > 0 ? r.cents / total : 0;
            return (
              <div key={r.label + i}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 truncate">{r.label}</span>
                  <span className="text-slate-800 font-medium tabular-nums">{usd(r.cents)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.max(2, ratio * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
