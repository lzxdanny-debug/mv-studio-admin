'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart } from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { cn } from '@/lib/utils';

interface Bucket {
  calls: number;
  credits: number;
  nativeCost: number;
}

interface DanceCostView {
  days: number;
  projects: number;
  totalCalls: number;
  successCalls: number;
  chargeCredits: number;
  nativeCost: number;
  refundedCredits: number;
  grossProfitCredits: number;
  avgCreditsPerProject: number;
  successRate: number;
  byStep: Record<string, Bucket>;
  byProvider: Record<string, Bucket>;
  byModel: Record<string, Bucket>;
  failureReasons: Record<string, number>;
}

const RANGE_OPTIONS = [7, 30, 90] as const;

function toRows(map: Record<string, Bucket> | undefined) {
  return Object.entries(map ?? {})
    .map(([key, v]) => ({ key: key || '未标记', ...v }))
    .sort((a, b) => b.credits - a.credits);
}

export default function AdminDanceCostPage() {
  const [days, setDays] = useState<number>(30);

  const { data, isLoading, isError, error } = useQuery<DanceCostView>({
    queryKey: ['admin', 'dance', 'cost', days],
    queryFn: () => apiClient.get(`/admin/dance/cost?days=${days}`) as any,
  });

  const failureRows = Object.entries(data?.failureReasons ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="admin-page">
      <div className="space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <LineChart className="h-5 w-5 text-blue-600" />
              舞蹈成本统计
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              按 dance_cost_records 聚合：用户侧扣减积分与渠道原生成本分开口径，便于核算毛利。
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
              <MetricCard label="项目数" value={data?.projects ?? 0} />
              <MetricCard label="扣减积分" value={data?.chargeCredits ?? 0} />
              <MetricCard
                label="渠道成本"
                value={`$${(data?.nativeCost ?? 0).toFixed(4)}`}
                hint="Provider 原生计价累计"
              />
              <MetricCard
                label="调用成功率"
                value={`${data?.successRate ?? 0}%`}
                hint={`${data?.successCalls ?? 0} / ${data?.totalCalls ?? 0} 次`}
              />
              <MetricCard label="退还积分" value={data?.refundedCredits ?? 0} />
              <MetricCard label="净积分收入" value={data?.grossProfitCredits ?? 0} />
              <MetricCard label="单项目均积分" value={data?.avgCreditsPerProject ?? 0} />
              <MetricCard label="统计窗口" value={`${data?.days ?? days} 天`} />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <BucketTable title="按步骤" rows={toRows(data?.byStep)} />
              <BucketTable title="按 Provider" rows={toRows(data?.byProvider)} />
              <BucketTable title="按模型" rows={toRows(data?.byModel)} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                失败原因分布
              </h2>
              {failureRows.length ? (
                <div className="space-y-1.5">
                  {failureRows.map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between text-sm">
                      <span className="truncate font-mono text-xs text-slate-500">{reason}</span>
                      <span className="font-medium text-slate-700">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">窗口内没有失败调用。</p>
              )}
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

function BucketTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; calls: number; credits: number; nativeCost: number }>;
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
              <th className="px-3 py-2 text-right font-medium">积分</th>
              <th className="px-3 py-2 text-right font-medium">成本</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="max-w-[180px] truncate px-4 py-2 font-mono text-[11px] text-slate-600">
                  {r.key}
                </td>
                <td className="px-3 py-2 text-right text-xs text-slate-500">{r.calls}</td>
                <td className="px-3 py-2 text-right text-xs text-slate-700">{r.credits}</td>
                <td className="px-3 py-2 text-right text-xs text-slate-500">
                  ${r.nativeCost.toFixed(4)}
                </td>
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
