'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LineChart, RefreshCw, Film, Music, FileText, ExternalLink, Gift } from 'lucide-react';
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

interface CostLine {
  line: 'mv' | 'music' | 'lyrics';
  label: string;
  usd: number;
  calls: number;
  successCalls: number;
  failedCalls: number;
  reconciledCalls: number;
}

interface CostSummary {
  range: { fromMs: number; toMs: number };
  usdCnyRate: number;
  rateAsOf: string | null;
  rateSource: 'live' | 'cache' | 'default';
  lines: CostLine[];
  totalUsd: number;
  byProvider: { provider: string; usd: number; calls: number }[];
  timeline: { date: string; mvUsd: number; musicUsd: number; lyricsUsd: number }[];
}

interface BonusSummary {
  creditUsdRate: number;
  totalCredits: number;
  totalCount: number;
  totalUsd: number;
  bySource: { source: string; credits: number; count: number; usd: number }[];
  timeline: { date: string; credits: number; usd: number }[];
}

const BONUS_SOURCE_LABEL: Record<string, string> = {
  signup: '注册赠送',
  daily_check_in: '每日签到',
  referral: '邀请奖励',
  other: '会员 / 手动 / 活动',
};

const PRESETS: RangePreset[] = ['7d', '30d', '90d', '12m'];

const LINE_META: Record<
  CostLine['line'],
  { icon: typeof Film; tint: string; stroke: string }
> = {
  mv: { icon: Film, tint: 'text-teal-600 bg-teal-50', stroke: '#8b5cf6' },
  music: { icon: Music, tint: 'text-rose-600 bg-rose-50', stroke: '#ec4899' },
  lyrics: { icon: FileText, tint: 'text-cyan-600 bg-cyan-50', stroke: '#06b6d4' },
};

const PROVIDER_LABEL: Record<string, string> = {
  mountsea: 'Mountsea',
  fal: 'Fal.ai',
  cloudflare: 'Cloudflare',
};

export default function BillingCostPage() {
  const [preset, setPreset] = useState<RangePreset>('30d');
  const range = useMemo(() => computeRange(preset), [preset]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set('from', new Date(range.fromMs).toISOString());
    p.set('to', new Date(range.toMs).toISOString());
    return p.toString();
  }, [range]);

  const summary = useQuery<CostSummary>({
    queryKey: ['admin', 'billing', 'cost', preset],
    queryFn: () => apiClient.get(`/admin/billing/cost/summary?${qs}`) as any,
    placeholderData: (p) => p,
  });

  const bonus = useQuery<BonusSummary>({
    queryKey: ['admin', 'billing', 'bonus', 'summary', preset],
    queryFn: () => apiClient.get(`/admin/billing/bonus/summary?${qs}`) as any,
    placeholderData: (p) => p,
  });

  const d = summary.data;
  const b = bonus.data;
  const bonusUsd = b?.totalUsd ?? 0;
  const grandTotalUsd = (d?.totalUsd ?? 0) + bonusUsd;
  const rateText =
    d?.rateSource === 'live'
      ? '实时'
      : d?.rateSource === 'cache'
        ? '缓存'
        : '默认';

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-5 max-w-[1600px]">
        {/* 顶部 */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <LineChart className="h-5 w-5 text-teal-600" />
              成本统计
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              MV / 音乐 / 歌词 三业务线 AI 调用成本（统一折算美元 USD）
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    preset === p
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  {RANGE_LABEL[p]}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                summary.refetch();
                bonus.refetch();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw
                className={cn(
                  'h-3.5 w-3.5',
                  (summary.isFetching || bonus.isFetching) && 'animate-spin',
                )}
              />
              刷新
            </button>
            <Link
              href="/admin/billing/bonus"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Gift className="h-3.5 w-3.5" />
              赠送明细
            </Link>
            <Link
              href="/admin/mv/cost-stats"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              MV 调用明细
            </Link>
          </div>
        </div>

        <QueryState
          isLoading={summary.isLoading}
          isError={summary.isError}
          error={summary.error}
          isEmpty={false}
          height="h-32"
        >
          {d && (
            <>
              {/* 总成本 + 三业务线 + 赠送积分 */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="rounded-2xl p-4 shadow-sm bg-gradient-to-br from-amber-500 to-orange-600 text-white border border-amber-400/30">
                  <span className="text-xs font-medium text-amber-50/90">总成本（含赠送）</span>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{usdAmount(grandTotalUsd)}</p>
                  <p className="mt-0.5 text-xs text-amber-50/75">
                    AI {usdAmount(d.totalUsd)} + 赠送 {usdAmount(bonusUsd)}
                  </p>
                </div>
                {d.lines.map((l) => {
                  const meta = LINE_META[l.line];
                  const successRate = l.calls > 0 ? l.successCalls / l.calls : 0;
                  return (
                    <div
                      key={l.line}
                      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">{l.label} 成本</span>
                        <span className={cn('p-1.5 rounded-lg', meta.tint)}>
                          <meta.icon className="h-3.5 w-3.5" />
                        </span>
                      </div>
                      <p className="mt-2 text-xl font-bold text-slate-900 tabular-nums">
                        {usdAmount(l.usd)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {l.calls} 次调用 · 成功率 {pct(successRate)}
                      </p>
                    </div>
                  );
                })}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">赠送积分成本</span>
                    <span className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50">
                      <Gift className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <p className="mt-2 text-xl font-bold text-slate-900 tabular-nums">
                    {usdAmount(bonusUsd)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {(b?.totalCredits ?? 0).toLocaleString()} 积分 · {b?.totalCount ?? 0} 笔
                  </p>
                </div>
              </div>

              {/* 赠送来源拆分 */}
              {b && b.bySource.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">赠送积分来源</h3>
                    <Link
                      href="/admin/billing/bonus"
                      className="text-xs text-teal-600 hover:underline inline-flex items-center gap-1"
                    >
                      查看明细 <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {b.bySource.map((s) => (
                      <div
                        key={s.source}
                        className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
                      >
                        <p className="text-xs text-slate-500">
                          {BONUS_SOURCE_LABEL[s.source] ?? s.source}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-800 tabular-nums">
                          {usdAmount(s.usd)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {s.credits.toLocaleString()} 积分 · {s.count} 笔
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 趋势 + 渠道 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                <CostTrend
                  timeline={d.timeline}
                  bonusTimeline={b?.timeline ?? []}
                  className="lg:col-span-2"
                />
                <ProviderBreakdown rows={d.byProvider} />
              </div>
            </>
          )}
        </QueryState>

        <p className="text-[11px] text-slate-400 leading-relaxed px-1">
          <strong className="text-slate-500">口径说明：</strong>
          全部金额统一为美元 USD。成本优先取对账后的真实账单金额，未对账则用本地价格表估算。
          Fal / Cloudflare 本就是美元账单，直接计入；Mountsea 人民币成本（1 元 = 100 积分）按汇率
          {' '}1 USD = ¥{(d?.usdCnyRate ?? 7.2).toFixed(2)}（{rateText}
          {d?.rateAsOf ? ` · ${new Date(d.rateAsOf).toLocaleString('zh-CN')}` : ''}）换算成美元。
          业务线划分：MV = MV 全流程；音乐 = Suno 音乐生成；歌词 = 歌词生成 + 时间轴对齐。
          赠送积分（注册 / 签到 / 会员 / 手动）按对外售价折算
          {b ? `（1 积分 ≈ ${usdAmount(b.creditUsdRate)}）` : ''}计入营销成本，已含在「总成本（含赠送）」中。
        </p>
      </div>
    </div>
  );
}

function CostTrend({
  timeline,
  bonusTimeline,
  className,
}: {
  timeline: CostSummary['timeline'];
  bonusTimeline: BonusSummary['timeline'];
  className?: string;
}) {
  const bonusByDate = new Map(bonusTimeline.map((t) => [t.date, t.usd]));
  const data = timeline.map((t) => ({
    label: t.date.slice(5),
    MV: Number(t.mvUsd.toFixed(2)),
    音乐: Number(t.musicUsd.toFixed(2)),
    歌词: Number(t.lyricsUsd.toFixed(2)),
    赠送: Number((bonusByDate.get(t.date) ?? 0).toFixed(2)),
  }));
  return (
    <div className={cn('bg-white rounded-2xl border border-slate-200 p-5 shadow-sm', className)}>
      <h3 className="text-sm font-semibold text-slate-900 mb-3">成本趋势（按天）</h3>
      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-xs text-slate-400">
          时间窗内暂无成本
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickFormatter={(v) => usdAmountCompact(Number(v))}
              />
              <Tooltip
                formatter={(v: any) => usdAmount(Number(v))}
                contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#e2e8f0' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="MV" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
              <Area type="monotone" dataKey="音乐" stackId="1" stroke="#ec4899" fill="#ec4899" fillOpacity={0.25} />
              <Area type="monotone" dataKey="歌词" stackId="1" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.25} />
              <Area type="monotone" dataKey="赠送" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function ProviderBreakdown({ rows }: { rows: CostSummary['byProvider'] }) {
  const total = rows.reduce((a, b) => a + b.usd, 0);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">按渠道</h3>
      {total === 0 ? (
        <div className="h-56 flex items-center justify-center text-xs text-slate-400">暂无数据</div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const ratio = total > 0 ? r.usd / total : 0;
            return (
              <div key={r.provider}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 truncate">
                    {PROVIDER_LABEL[r.provider] ?? r.provider}
                    <span className="text-slate-400"> · {r.calls} 次</span>
                  </span>
                  <span className="text-slate-800 font-medium tabular-nums">{usdAmount(r.usd)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-500"
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
