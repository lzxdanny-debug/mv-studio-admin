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
import { LineChart, RefreshCw, Film, Music, FileText, ExternalLink } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import {
  cny,
  cnyCompact,
  pct,
  RANGE_LABEL,
  RangePreset,
  computeRange,
} from '../_lib/format';

interface CostLine {
  line: 'mv' | 'music' | 'lyrics';
  label: string;
  cny: number;
  calls: number;
  successCalls: number;
  failedCalls: number;
  reconciledCalls: number;
}

interface CostSummary {
  range: { fromMs: number; toMs: number };
  usdCnyRate: number;
  lines: CostLine[];
  totalCny: number;
  byProvider: { provider: string; cny: number; calls: number }[];
  timeline: { date: string; mvCny: number; musicCny: number; lyricsCny: number }[];
}

const PRESETS: RangePreset[] = ['7d', '30d', '90d', '12m'];

const LINE_META: Record<
  CostLine['line'],
  { icon: typeof Film; tint: string; stroke: string }
> = {
  mv: { icon: Film, tint: 'text-purple-600 bg-purple-50', stroke: '#8b5cf6' },
  music: { icon: Music, tint: 'text-pink-600 bg-pink-50', stroke: '#ec4899' },
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

  const d = summary.data;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-5 max-w-[1600px]">
        {/* 顶部 */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <LineChart className="h-5 w-5 text-purple-600" />
              成本统计
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              MV / 音乐 / 歌词 三业务线 AI 调用成本（折算人民币）
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
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  {RANGE_LABEL[p]}
                </button>
              ))}
            </div>
            <button
              onClick={() => summary.refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', summary.isFetching && 'animate-spin')} />
              刷新
            </button>
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
              {/* 总成本 + 三业务线 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-2xl p-4 shadow-sm bg-gradient-to-br from-amber-500 to-orange-600 text-white border border-amber-400/30">
                  <span className="text-xs font-medium text-amber-50/90">总成本</span>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{cny(d.totalCny)}</p>
                  <p className="mt-0.5 text-xs text-amber-50/75">
                    USD→CNY 汇率 {d.usdCnyRate}
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
                        {cny(l.cny)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {l.calls} 次调用 · 成功率 {pct(successRate)}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* 趋势 + 渠道 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                <CostTrend timeline={d.timeline} className="lg:col-span-2" />
                <ProviderBreakdown rows={d.byProvider} />
              </div>
            </>
          )}
        </QueryState>

        <p className="text-[11px] text-slate-400 leading-relaxed px-1">
          <strong className="text-slate-500">口径说明：</strong>
          成本优先取对账后的真实账单金额，未对账则用本地价格表估算。Mountsea 按 1 元 = 100 积分折算；
          Fal / Cloudflare 美元账单按汇率 {d?.usdCnyRate ?? 7.2} 折算人民币。
          业务线划分：MV = MV 全流程；音乐 = Suno 音乐生成；歌词 = 歌词生成 + 时间轴对齐。
        </p>
      </div>
    </div>
  );
}

function CostTrend({
  timeline,
  className,
}: {
  timeline: CostSummary['timeline'];
  className?: string;
}) {
  const data = timeline.map((t) => ({
    label: t.date.slice(5),
    MV: Number(t.mvCny.toFixed(2)),
    音乐: Number(t.musicCny.toFixed(2)),
    歌词: Number(t.lyricsCny.toFixed(2)),
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
                tickFormatter={(v) => cnyCompact(Number(v))}
              />
              <Tooltip
                formatter={(v: any) => cny(Number(v))}
                contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#e2e8f0' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="MV" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
              <Area type="monotone" dataKey="音乐" stackId="1" stroke="#ec4899" fill="#ec4899" fillOpacity={0.25} />
              <Area type="monotone" dataKey="歌词" stackId="1" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function ProviderBreakdown({ rows }: { rows: CostSummary['byProvider'] }) {
  const total = rows.reduce((a, b) => a + b.cny, 0);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">按渠道</h3>
      {total === 0 ? (
        <div className="h-56 flex items-center justify-center text-xs text-slate-400">暂无数据</div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const ratio = total > 0 ? r.cny / total : 0;
            return (
              <div key={r.provider}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 truncate">
                    {PROVIDER_LABEL[r.provider] ?? r.provider}
                    <span className="text-slate-400"> · {r.calls} 次</span>
                  </span>
                  <span className="text-slate-800 font-medium tabular-nums">{cny(r.cny)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500"
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
