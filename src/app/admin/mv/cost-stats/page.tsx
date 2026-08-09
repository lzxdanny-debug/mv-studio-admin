'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, LineChart, Loader2, RefreshCw } from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { useAlert } from '@/components/ui/dialog-provider';
import { CostStatsPayload, TimeRangePreset } from './_lib/types';
import { buildCostStatsCsv, downloadCsv } from './_lib/csv';
import { KpiCards } from './_components/kpi-cards';
import { ProviderPie } from './_components/provider-pie';
import { FailureBar } from './_components/failure-bar';
import { TimelineChart } from './_components/timeline-chart';
import { BreakdownTabs } from './_components/breakdown-tabs';
import { RangeFilter, computeRangeFromPreset } from './_components/range-filter';

/**
 * 成本统计页（admin 后台）：
 *
 * 单次 GET /admin/mv/cost/stats 拉回 6 个维度，前端只负责 layout + 图表渲染。
 * 默认窗口"今天 00:00 ~ now"（用户偏好），切换 preset 立即重新拉。
 *
 * 操作按钮：
 *   - 立即对账：调 POST /admin/mv/cost/reconcile-now，拉真实账单回填 reconciled_amount
 *     完成后失效 ['admin', 'mv'] queryKey 让本页表格自动重拉
 *   - CSV 导出：用当前 stats payload 在浏览器侧生成 CSV，直接下载
 *
 * 性能：
 *   - bucket 自动选（窗口 > 14d 用 day，避免几百个数据点把图表撑爆）
 *   - 不显式 polling；用户主动点刷新或对账才更新
 */
export default function CostStatsPage() {
  const qc = useQueryClient();
  const alert = useAlert();

  // ── 过滤器状态 ──────────────────────────────────────
  // 默认 preset = today（用户决定）
  const initialRange = useMemo(() => computeRangeFromPreset('today'), []);
  const [preset, setPreset] = useState<TimeRangePreset>('today');
  const [fromMs, setFromMs] = useState<number>(initialRange.fromMs);
  const [toMs, setToMs] = useState<number>(initialRange.toMs);
  const [provider, setProvider] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);

  // 自动选 bucket：> 14d → day，否则 hour
  const bucket: 'hour' | 'day' = toMs - fromMs > 14 * 24 * 3600 * 1000 ? 'day' : 'hour';

  const queryKey = useMemo(
    () => ['admin', 'mv', 'cost-stats', { fromMs, toMs, provider, step, bucket }],
    [fromMs, toMs, provider, step, bucket],
  );

  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery<CostStatsPayload>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('from', new Date(fromMs).toISOString());
      params.set('to', new Date(toMs).toISOString());
      if (provider) params.set('provider', provider);
      if (step) params.set('step', step);
      params.set('bucket', bucket);
      return apiClient.get(`/admin/mv/cost/stats?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
  });

  // 对账：成功后 invalidate 自身 cost-stats query 让 reconciled_amount 自动刷新
  const reconcileMutation = useMutation<{
    mountsea: number;
    apisale?: number;
    smartfashion?: number;
    aitokens?: number;
    total: number;
    reconciled: number;
    unmatched: number;
    window: { hours: number; startIso: string; endIso: string };
  }>({
    mutationFn: () =>
      apiClient.post('/admin/mv/cost/reconcile-now?hours=6', {}) as any,
    onSuccess: async (s) => {
      await qc.invalidateQueries({ queryKey: ['admin', 'mv'] });
      await alert({
        title: '对账完成',
        description:
          `时间窗：${s.window.startIso.slice(11, 19)} → ${s.window.endIso.slice(11, 19)}（最近 ${s.window.hours}h）\n\n` +
          `本次窗口待对账记录：${s.total} 条\n` +
          `成功匹配：${s.reconciled} 条（mountsea ${s.mountsea}` +
          ` / apisale ${s.apisale ?? 0} / smartfashion ${s.smartfashion ?? 0} / aitokens ${s.aitokens ?? 0}）\n` +
          `未匹配：${s.unmatched} 条`,
      });
    },
    onError: async (err: any) => {
      await alert({
        title: '对账失败',
        description: err?.message ?? String(err),
        variant: 'danger',
      });
    },
  });

  const handleExportCsv = () => {
    if (!data) return;
    const filename = `mv-cost-stats_${data.range.fromIso.slice(0, 10)}_to_${data.range.toIso.slice(0, 10)}.csv`;
    downloadCsv(filename, buildCostStatsCsv(data));
  };

  return (
    <div className="admin-page">
      <div className="p-6 space-y-4 max-w-[1600px]">
        {/* 顶部 ── 标题 + 操作按钮 ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <LineChart className="h-5 w-5 text-blue-600" />
              成本统计
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              所有渠道（Mountsea / Mountsea MS）的调用 & 消费聚合
              {data && (
                <span className="ml-2 text-slate-400">
                  · {data.range.fromIso.slice(0, 16).replace('T', ' ')} ~{' '}
                  {data.range.toIso.slice(0, 16).replace('T', ' ')}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => reconcileMutation.mutate()}
              disabled={reconcileMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              title="立刻调用上游账单 API，把最近 6 小时窗口内所有未对账的估算金额换成真实金额。"
            >
              {reconcileMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {reconcileMutation.isPending ? '对账中...' : '立即对账（最近 6h）'}
            </button>
            <button
              onClick={handleExportCsv}
              disabled={!data || isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title="把当前过滤范围内的统计数据导出为 CSV（含按渠道/步骤/模型/失败分类四张表）"
            >
              <Download className="h-3.5 w-3.5" />
              导出 CSV
            </button>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title="重新拉取统计数据"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>

        {/* 过滤器 */}
        <RangeFilter
          preset={preset}
          fromMs={fromMs}
          toMs={toMs}
          provider={provider}
          step={step}
          loading={isFetching}
          onChange={(next) => {
            setPreset(next.preset);
            setFromMs(next.fromMs);
            setToMs(next.toMs);
            setProvider(next.provider);
            setStep(next.step);
          }}
        />

        {/* 主内容（loading / error / empty 都交给 QueryState） */}
        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={false /* 数据为空时也要展示 0 值的图表骨架 */}
          height="h-96"
        >
          {data && (
            <div className="space-y-4">
              {/* KPI 卡 */}
              <KpiCards payload={data} />

              {/* 第一行：渠道饼图 + 失败分析 */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <ProviderPie payload={data} />
                <FailureBar payload={data} />
              </div>

              {/* 第二行：时间趋势 */}
              <TimelineChart payload={data} />

              {/* 第三行：Tab 表格（按步骤 / 按模型）*/}
              <BreakdownTabs payload={data} />

              {/* 底部说明 */}
              <div className="text-[11px] text-slate-400 leading-relaxed pt-2 px-1">
                <strong className="text-slate-500">数据说明：</strong>
                成本数据来自 mv_cost_records 埋点。"估算成本"按官方公开价计算（Mountsea credit 与原生 USD 单位异构，
                量级展示时按 1 credit ≈ 0.0014 USD 折算）；"已对账金额"由 cron 每小时调上游账单 API 回填，
                以 reconciled_amount 为最终结算依据。"失败浪费"基于失败类型启发式判断
                （内容审核/超时多半已被上游计费，5xx/限流/鉴权失败一般不计费），实际仍以对账为准。
              </div>
            </div>
          )}
        </QueryState>
      </div>
    </div>
  );
}
