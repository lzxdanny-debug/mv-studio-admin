'use client';

import { useMemo, useState } from 'react';
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
import { LineChart, RefreshCw } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';

type RangePreset = 'today' | '7d' | '30d' | '90d';

const RANGE_LABEL: Record<RangePreset, string> = {
  today: '今日',
  '7d': '近 7 天',
  '30d': '近 30 天',
  '90d': '近 90 天',
};

function computeRange(preset: RangePreset): { fromMs: number; toMs: number } {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  if (preset === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return { fromMs: start.getTime(), toMs: now };
  }
  if (preset === '7d') return { fromMs: now - 7 * day, toMs: now };
  if (preset === '30d') return { fromMs: now - 30 * day, toMs: now };
  return { fromMs: now - 90 * day, toMs: now };
}

const usdAmount = (v: number | null | undefined) => `$${(v ?? 0).toFixed(2)}`;
const usdAmountCompact = (v: number | null | undefined) => {
  const n = v ?? 0;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
};
const pct = (ratio: number | null | undefined) => `${((ratio ?? 0) * 100).toFixed(1)}%`;

interface StepBreakdown {
  step: string;
  usd: number;
  credits: number;
  calls: number;
  successCalls: number;
}
interface ProviderBreakdown {
  provider: string;
  usd: number;
  calls: number;
}
interface ModeBreakdown {
  mode: string;
  usd: number;
  credits: number;
  calls: number;
  projects: number;
}
interface TimelinePoint {
  date: string;
  usd: number;
  credits: number;
}

interface KaraokeCostStats {
  range: { fromIso: string; toIso: string };
  totalUsd: number;
  totalCredits: number;
  totalCalls: number;
  successCalls: number;
  byStep: StepBreakdown[];
  byProvider: ProviderBreakdown[];
  byMode: ModeBreakdown[];
  timeline: TimelinePoint[];
}

const STEP_LABEL: Record<string, string> = {
  karaoke_scene_image: '场景图生成',
  karaoke_lrc_transcribe: 'LRC 转录',
  karaoke_audio_analyze: '音频分析',
  karaoke_video: '片段视频',
  karaoke_frame_extract: '末帧抽取',
  karaoke_identity_validate: '人物身份校验',
  karaoke_compose: '最终合成',
};

const MODE_LABEL: Record<string, string> = { solo: 'Solo', pet: 'Pet', duet: 'Duet' };

const PROVIDER_LABEL: Record<string, string> = {
  mountsea: 'Mountsea',
  fal: 'Fal.ai',
  cloudflare: 'Cloudflare',
};

const PRESETS: RangePreset[] = ['today', '7d', '30d', '90d'];

export default function AdminKaraokeCostPage() {
  const [preset, setPreset] = useState<RangePreset>('today');
  const range = useMemo(() => computeRange(preset), [preset]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set('from', new Date(range.fromMs).toISOString());
    p.set('to', new Date(range.toMs).toISOString());
    return p.toString();
  }, [range]);

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery<KaraokeCostStats>({
    queryKey: ['admin', 'karaoke', 'cost', 'stats', preset],
    queryFn: () => apiClient.get(`/admin/karaoke/cost/stats?${qs}`) as any,
    placeholderData: (p) => p,
  });

  const d = data;
  const successRate = d && d.totalCalls > 0 ? d.successCalls / d.totalCalls : 0;

  return (
    <div className="admin-page">
      <div className="p-6 space-y-5 max-w-[1600px]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <LineChart className="h-5 w-5 text-blue-600" />
              Karaoke 成本统计
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Photo Karaoke 全流程 AI 调用成本（场景图 / 转录 / 音频分析 / 片段视频 / 抽帧 / 合成）
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
                    preset === p ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  {RANGE_LABEL[p]}
                </button>
              ))}
            </div>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              刷新
            </button>
          </div>
        </div>

        <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-32">
          {d && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg p-4 bg-amber-600 text-white border border-amber-700">
                  <span className="text-xs font-medium text-amber-50/90">总成本（USD）</span>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{usdAmount(d.totalUsd)}</p>
                  <p className="mt-0.5 text-xs text-amber-50/75">
                    {d.range.fromIso.slice(0, 10)} ~ {d.range.toIso.slice(0, 10)}
                  </p>
                </div>
                <div className="admin-card p-4">
                  <span className="text-xs text-slate-500">积分消耗</span>
                  <p className="mt-2 text-xl font-bold text-slate-900 tabular-nums">
                    {d.totalCredits.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">已实扣积分合计</p>
                </div>
                <div className="admin-card p-4">
                  <span className="text-xs text-slate-500">调用次数</span>
                  <p className="mt-2 text-xl font-bold text-slate-900 tabular-nums">
                    {d.totalCalls.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">全部步骤合计</p>
                </div>
                <div className="admin-card p-4">
                  <span className="text-xs text-slate-500">成功率</span>
                  <p className="mt-2 text-xl font-bold text-slate-900 tabular-nums">{pct(successRate)}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{d.successCalls} / {d.totalCalls} 成功</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                <CostTrend timeline={d.timeline} className="lg:col-span-2" />
                <ProviderBreakdownCard rows={d.byProvider} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                <StepBreakdownTable rows={d.byStep} />
                <ModeBreakdownTable rows={d.byMode} />
              </div>
            </>
          )}
        </QueryState>

        <p className="text-[11px] text-slate-400 leading-relaxed px-1">
          <strong className="text-slate-500">数据说明：</strong>
          成本数据来自 karaoke_cost_records 埋点，按渠道官方公开价估算；已对账记录以 reconciled_amount
          为最终结算依据。「片段视频」通常占比最高，与项目片段数、时长直接相关。
        </p>
      </div>
    </div>
  );
}

function CostTrend({ timeline, className }: { timeline: TimelinePoint[]; className?: string }) {
  const data = timeline.map((t) => ({
    label: t.date.slice(5),
    美元: Number(t.usd.toFixed(2)),
    积分: t.credits,
  }));
  return (
    <div className={cn('admin-card p-5', className)}>
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
                formatter={(v: any, name: any) => (name === '美元' ? usdAmount(Number(v)) : v)}
                contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#e2e8f0' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="美元" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function ProviderBreakdownCard({ rows }: { rows: ProviderBreakdown[] }) {
  const total = rows.reduce((a, b) => a + b.usd, 0);
  return (
    <div className="admin-card p-5">
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

function StepBreakdownTable({ rows }: { rows: StepBreakdown[] }) {
  return (
    <div className="admin-card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">按步骤</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wider">
            <th className="text-left px-4 py-2 font-medium">步骤</th>
            <th className="text-right px-3 py-2 font-medium">调用</th>
            <th className="text-right px-3 py-2 font-medium">成功率</th>
            <th className="text-right px-3 py-2 font-medium">积分</th>
            <th className="text-right px-4 py-2 font-medium">美元</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center text-xs text-slate-400 py-6">
                暂无数据
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.step}>
                <td className="px-4 py-2.5 text-slate-700 font-medium">
                  {STEP_LABEL[r.step] ?? r.step}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{r.calls}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                  {pct(r.calls > 0 ? r.successCalls / r.calls : 0)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{r.credits}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-800 font-medium">
                  {usdAmount(r.usd)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ModeBreakdownTable({ rows }: { rows: ModeBreakdown[] }) {
  return (
    <div className="admin-card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">按模式</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wider">
            <th className="text-left px-4 py-2 font-medium">模式</th>
            <th className="text-right px-3 py-2 font-medium">项目数</th>
            <th className="text-right px-3 py-2 font-medium">调用</th>
            <th className="text-right px-3 py-2 font-medium">积分</th>
            <th className="text-right px-4 py-2 font-medium">美元</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center text-xs text-slate-400 py-6">
                暂无数据
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.mode}>
                <td className="px-4 py-2.5 text-slate-700 font-medium">
                  {MODE_LABEL[r.mode] ?? r.mode}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{r.projects}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{r.calls}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{r.credits}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-800 font-medium">
                  {usdAmount(r.usd)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
