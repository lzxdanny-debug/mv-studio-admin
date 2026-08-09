'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  TrendingUp,
  RefreshCw,
  DollarSign,
  Cpu,
  Gift,
  Receipt,
  Undo2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import {
  usdAmount,
  usdAmountCompact,
  pct,
  RANGE_LABEL,
  RangePreset,
  computeRange,
} from '../_lib/format';

interface ProfitSummaryPayload {
  range: { fromMs: number; toMs: number };
  usdCnyRate: number;
  rateAsOf: string | null;
  rateSource: 'live' | 'cache' | 'default';
  timelineGranularity: 'hour' | 'day';
  summary: {
    grossRevenueUsd: number;
    refundUsd: number;
    netRevenueUsd: number;
    aiCostUsd: number;
    bonusUsd: number;
    totalCostUsd: number;
    grossProfitUsd: number;
    marginRatio: number;
    refundRate: number;
    bonusCredits: number;
    bonusCount: number;
  };
  costByLine: Array<{ key: string; label: string; usd: number }>;
  bonusBySource: Array<{
    source: string;
    credits: number;
    count: number;
    usd: number;
  }>;
  timeline: Array<{
    date: string;
    netRevenueUsd: number;
    aiCostUsd: number;
    bonusUsd: number;
    totalCostUsd: number;
    grossProfitUsd: number;
  }>;
}

const PRESETS: RangePreset[] = ['today', '7d', '30d', '90d', '12m'];

const BONUS_SOURCE_LABEL: Record<string, string> = {
  signup: '注册',
  daily_check_in: '签到',
  referral: '邀请',
  membership: '会员月赠',
  manual: '手动',
  other: '其它',
};

const PIE_COLORS = [
  '#3b82f6',
  '#f59e0b',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#64748b',
];

export default function BillingProfitPage() {
  const [preset, setPreset] = useState<RangePreset>('today');
  const range = useMemo(() => computeRange(preset), [preset]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set('from', new Date(range.fromMs).toISOString());
    p.set('to', new Date(range.toMs).toISOString());
    return p.toString();
  }, [range]);

  const profit = useQuery<ProfitSummaryPayload>({
    queryKey: ['admin', 'billing', 'profit', 'summary', preset],
    queryFn: () => apiClient.get(`/admin/billing/profit/summary?${qs}`) as any,
    placeholderData: (p) => p,
  });

  const d = profit.data;
  const s = d?.summary;
  const bonusSourceLine = useMemo(() => {
    const sources = d?.bonusBySource;
    if (!sources?.length) return null;
    const order = [
      'signup',
      'daily_check_in',
      'referral',
      'membership',
      'manual',
      'other',
    ];
    const parts = order
      .map((src) => sources.find((x) => x.source === src))
      .filter((x): x is NonNullable<typeof x> => !!x && x.credits > 0)
      .map(
        (x) =>
          `${BONUS_SOURCE_LABEL[x.source] ?? x.source} ${x.credits.toLocaleString()}`,
      );
    return parts.length ? parts.join(' · ') : null;
  }, [d?.bonusBySource]);

  const rateText =
    d?.rateSource === 'live'
      ? '实时'
      : d?.rateSource === 'cache'
        ? '缓存'
        : '默认';

  return (
    <div className="admin-page">
      <div className="px-6 pt-6 pb-16 space-y-5 max-w-[1600px]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              利润分析
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              净收入与全业务线 AI / 赠送成本对比，估算经营毛利（统一美元，现金流口径）
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
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
              type="button"
              onClick={() => profit.refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', profit.isFetching && 'animate-spin')}
              />
              刷新
            </button>
          </div>
        </div>

        <QueryState
          isLoading={profit.isLoading}
          isError={profit.isError}
          error={profit.error}
          isEmpty={false}
          height="h-32"
        >
          {s && d && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <KpiCard
                  label="毛收入"
                  value={usdAmount(s.grossRevenueUsd)}
                  sub="支付成功金额合计"
                  icon={Receipt}
                  iconClass="text-slate-600 bg-slate-50"
                />
                <KpiCard
                  label="退款"
                  value={usdAmount(s.refundUsd)}
                  sub={`退款率 ${pct(s.refundRate)}`}
                  icon={Undo2}
                  iconClass="text-rose-600 bg-rose-50"
                />
                <KpiCard
                  label="净收入"
                  value={usdAmount(s.netRevenueUsd)}
                  sub="毛收入 − 同期退款"
                  icon={DollarSign}
                  iconClass="text-emerald-600 bg-emerald-50"
                />
                <KpiCard
                  label="AI 成本"
                  value={usdAmount(s.aiCostUsd)}
                  sub="MV / 音乐 / 歌词 / Karaoke / 舞蹈 / 特效"
                  icon={Cpu}
                  iconClass="text-amber-600 bg-amber-50"
                />
                <KpiCard
                  label="赠送积分成本"
                  value={usdAmount(s.bonusUsd)}
                  sub={
                    bonusSourceLine
                      ? `${(s.bonusCredits ?? 0).toLocaleString()} 积分 · ${bonusSourceLine}`
                      : `${(s.bonusCredits ?? 0).toLocaleString()} 积分 · ${s.bonusCount} 笔`
                  }
                  icon={Gift}
                  iconClass="text-emerald-600 bg-emerald-50"
                />
                <div
                  className={cn(
                    'rounded-lg p-4 border text-white',
                    s.grossProfitUsd >= 0
                      ? 'bg-blue-600 border-blue-700'
                      : 'bg-red-600 border-red-700',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white/90">估算毛利</span>
                    <span className="p-1.5 rounded-lg bg-white/15">
                      <Wallet className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <p className="mt-2 text-xl font-bold tabular-nums">
                    {usdAmount(s.grossProfitUsd)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/75 line-clamp-2">
                    净收入 − AI − 赠送 · 毛利率 {pct(s.marginRatio)}
                  </p>
                </div>
              </div>

              <ProfitTrend
                timeline={d.timeline}
                fromMs={d.range.fromMs}
                toMs={d.range.toMs}
                granularity={d.timelineGranularity}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <CostStructurePie rows={d.costByLine} />
                <CostStructureBars rows={d.costByLine} total={s.totalCostUsd} />
              </div>
            </div>
          )}
        </QueryState>

        <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
          <strong className="text-slate-500">口径说明：</strong>
          全部金额统一为美元 USD。净收入按支付完成时间统计毛收入并扣除同期退款（现金流）；
          AI 成本为六业务线对账/估算合计；赠送按对外售价折算（注册 / 签到 / 邀请 / 其它）。
          估算毛利 = 净收入 − AI 成本 − 赠送，未计入 Stripe 手续费、人力与其他运营成本。
          收款、AI 消耗、赠送入账时间轴不同，本页为经营粗估而非订单配比毛利。汇率 1 USD = ¥
          {(d?.usdCnyRate ?? 7.2).toFixed(2)}（{rateText}
          {d?.rateAsOf ? ` · ${new Date(d.rateAsOf).toLocaleString('zh-CN')}` : ''}
          ）。
        </p>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  iconClass: string;
}) {
  return (
    <div className="admin-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{label}</span>
        <span className={cn('p-1.5 rounded-lg', iconClass)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-2 text-xl font-bold text-slate-900 tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-2" title={sub}>
        {sub}
      </p>
    </div>
  );
}

function eachDateKey(fromMs: number, toMs: number): string[] {
  const cur = new Date(fromMs);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(toMs);
  end.setHours(0, 0, 0, 0);
  const keys: string[] = [];
  while (cur.getTime() <= end.getTime()) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    keys.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

function eachHourKey(fromMs: number, toMs: number): string[] {
  const hourMs = 3600 * 1000;
  let t = Math.floor(fromMs / hourMs) * hourMs;
  const keys: string[] = [];
  while (t <= toMs) {
    keys.push(`${new Date(t).toISOString().slice(0, 13)}:00:00.000Z`);
    t += hourMs;
  }
  return keys;
}

function bucketAxisLabel(key: string, granularity: 'hour' | 'day'): string {
  if (granularity === 'hour') {
    const dt = new Date(key);
    if (Number.isNaN(dt.getTime())) return key.slice(11, 16);
    return `${String(dt.getHours()).padStart(2, '0')}:00`;
  }
  return key.length >= 10 ? key.slice(5) : key;
}

function ProfitTrend({
  timeline,
  fromMs,
  toMs,
  granularity,
}: {
  timeline: ProfitSummaryPayload['timeline'];
  fromMs: number;
  toMs: number;
  granularity: 'hour' | 'day';
}) {
  const data = useMemo(() => {
    const dates =
      granularity === 'hour' ? eachHourKey(fromMs, toMs) : eachDateKey(fromMs, toMs);
    const byDate = new Map(timeline.map((t) => [t.date, t]));
    return dates.map((date) => {
      const t = byDate.get(date);
      return {
        label: bucketAxisLabel(date, granularity),
        date,
        净收入: Number((t?.netRevenueUsd ?? 0).toFixed(2)),
        总成本: Number((t?.totalCostUsd ?? 0).toFixed(2)),
        估算毛利: Number((t?.grossProfitUsd ?? 0).toFixed(2)),
      };
    });
  }, [timeline, fromMs, toMs, granularity]);

  const hasSignal = data.some(
    (r) => r.净收入 !== 0 || r.总成本 !== 0 || r.估算毛利 !== 0,
  );

  return (
    <div className="admin-card p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">
        利润趋势（{granularity === 'hour' ? '按小时' : '按天'}）
      </h3>
      {!hasSignal ? (
        <div className="h-64 flex items-center justify-center text-xs text-slate-400">
          时间窗内暂无数据
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={{ stroke: '#e2e8f0' }}
                interval={granularity === 'hour' ? 1 : 0}
                minTickGap={granularity === 'hour' ? 8 : 4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickFormatter={(v) => usdAmountCompact(Number(v))}
              />
              <Tooltip
                formatter={(v: number | string, name: string) => [
                  usdAmount(Number(v)),
                  name,
                ]}
                labelFormatter={(_, payload) => {
                  const d = payload?.[0]?.payload?.date as string | undefined;
                  if (!d) return '';
                  if (granularity === 'hour') {
                    const dt = new Date(d);
                    if (Number.isNaN(dt.getTime())) return d;
                    return dt.toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                  }
                  return d;
                }}
                contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#e2e8f0' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="净收入"
                stroke="#10b981"
                strokeWidth={1.75}
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 0 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="总成本"
                stroke="#f59e0b"
                strokeWidth={1.75}
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 0 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="估算毛利"
                stroke="#2563eb"
                strokeWidth={2.25}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </RechartsLineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function CostStructurePie({
  rows,
}: {
  rows: Array<{ key: string; label: string; usd: number }>;
}) {
  const data = rows
    .filter((r) => r.usd > 0)
    .map((r) => ({ key: r.key, name: r.label, value: r.usd }));
  const total = data.reduce((s, r) => s + r.value, 0);

  return (
    <div className="admin-card p-4">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-900">成本结构</h3>
        <span className="text-[10px] text-slate-400">业务线 + 赠送 · USD</span>
      </div>
      {total <= 0 ? (
        <div className="h-52 flex items-center justify-center text-xs text-slate-400">
          暂无成本
        </div>
      ) : (
        <>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={68}
                  paddingAngle={1.5}
                >
                  {data.map((row, i) => (
                    <Cell key={row.key} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number | string, name: string) => [
                    usdAmount(Number(v)),
                    name,
                  ]}
                  contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-1 space-y-1 max-h-28 overflow-y-auto">
            {data.map((r, i) => (
              <li
                key={r.key}
                className="flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="flex items-center gap-1.5 min-w-0 text-slate-600">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="truncate">{r.name}</span>
                </span>
                <span className="tabular-nums text-slate-800 shrink-0">
                  {usdAmount(r.value)}
                  <span className="text-slate-400 ml-1">
                    {pct(total > 0 ? r.value / total : 0)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function CostStructureBars({
  rows,
  total,
}: {
  rows: Array<{ key: string; label: string; usd: number }>;
  total: number;
}) {
  const data = [...rows].filter((r) => r.usd > 0).sort((a, b) => b.usd - a.usd);

  return (
    <div className="admin-card p-4">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-900">成本占比</h3>
        <span className="text-[10px] text-slate-400">
          合计 {usdAmount(total)}
        </span>
      </div>
      {data.length === 0 ? (
        <div className="h-52 flex items-center justify-center text-xs text-slate-400">
          暂无成本
        </div>
      ) : (
        <ul className="space-y-2.5">
          {data.map((r, i) => {
            const share = total > 0 ? r.usd / total : 0;
            return (
              <li key={r.key}>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-700 font-medium">{r.label}</span>
                  <span className="tabular-nums text-slate-500">
                    {usdAmount(r.usd)} · {pct(share)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(share * 100, share > 0 ? 1 : 0)}%`,
                      background: PIE_COLORS[i % PIE_COLORS.length],
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
