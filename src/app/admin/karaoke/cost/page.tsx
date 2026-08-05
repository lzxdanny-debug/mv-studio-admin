'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart } from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { cn } from '@/lib/utils';

interface KaraokeCostView {
  totalCalls: number;
  successCalls: number;
  chargeCredits: number;
  byStep: Record<string, number>;
  byProvider: Record<string, number>;
}

const RANGE_OPTIONS = [7, 30, 90] as const;

const STEP_LABEL: Record<string, string> = {
  karaoke_scene_image: '场景图生成',
  scene_image: '场景图生成',
  karaoke_lrc_transcribe: 'LRC 转录',
  lrc_transcribe: 'LRC 转录',
  karaoke_audio_analyze: '音频分析',
  karaoke_video: '片段视频',
  video_segment: '片段视频',
  karaoke_frame_extract: '末帧抽取',
  karaoke_identity_validate: '人物身份校验',
  karaoke_compose: '最终合成',
  final_compose: '最终合成',
  pet_addon: 'Pet 附加',
  duet_addon: 'Duet 附加',
};

const PROVIDER_LABEL: Record<string, string> = {
  mountsea: 'Mountsea',
  apisale: 'apisale',
  mountseaMs: 'Mountsea MS（已下线）',
  cloudflare: 'Cloudflare（已下线）',
  fal: 'Fal.ai（已下线）',
};

function toRows(map: Record<string, number> | undefined) {
  return Object.entries(map ?? {})
    .map(([key, count]) => ({ key: key || '未标记', count }))
    .sort((a, b) => b.count - a.count);
}

export default function AdminKaraokeCostPage() {
  const [days, setDays] = useState<number>(30);

  const { data, isLoading, isError, error } = useQuery<KaraokeCostView>({
    queryKey: ['admin', 'karaoke', 'cost', days],
    queryFn: () => apiClient.get(`/admin/karaoke/cost?days=${days}`) as any,
  });

  const successRate =
    data && data.totalCalls > 0
      ? Math.round((data.successCalls / data.totalCalls) * 10000) / 100
      : 0;

  return (
    <div className="admin-page">
      <div className="space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <LineChart className="h-5 w-5 text-blue-600" />
              Karaoke 成本统计
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              按 karaoke_cost_records 聚合：统计窗口内调用次数、成功率与用户侧扣减积分。
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {RANGE_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDays(value)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  days === value ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50',
                )}
              >
                近 {value} 天
              </button>
            ))}
          </div>
        </div>

        <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="调用次数" value={data?.totalCalls ?? 0} />
              <MetricCard
                label="成功率"
                value={`${successRate}%`}
                hint={`${data?.successCalls ?? 0} / ${data?.totalCalls ?? 0} 次`}
              />
              <MetricCard label="扣减积分" value={data?.chargeCredits ?? 0} />
              <MetricCard label="统计窗口" value={`${days} 天`} />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <CountTable
                title="按步骤"
                rows={toRows(data?.byStep)}
                labelOf={(key) => STEP_LABEL[key] ?? key}
              />
              <CountTable
                title="按 Provider"
                rows={toRows(data?.byProvider)}
                labelOf={(key) => PROVIDER_LABEL[key] ?? key}
              />
            </div>
          </div>
        </QueryState>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function CountTable({
  title,
  rows,
  labelOf,
}: {
  title: string;
  rows: Array<{ key: string; count: number }>;
  labelOf: (key: string) => string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
      </div>
      {rows.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-4 py-2 text-left font-medium">名称</th>
              <th className="px-3 py-2 text-right font-medium">次数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="max-w-[240px] truncate px-4 py-2 text-sm text-slate-700">
                  {labelOf(r.key)}
                  <span className="ml-2 font-mono text-[11px] text-slate-400">{r.key}</span>
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-700">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="px-4 py-6 text-sm text-slate-400">暂无数据</p>
      )}
    </div>
  );
}
