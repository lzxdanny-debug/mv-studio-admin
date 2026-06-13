'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, RefreshCw, DollarSign, Cpu } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { usd, cny, pct, RANGE_LABEL, computeRange } from '../_lib/format';

interface Overview {
  netRevenueCents: number;
}

interface CostSummary {
  totalCny: number;
  usdCnyRate: number;
}

const PRESET = '30d' as const;

export default function BillingProfitPage() {
  const range = useMemo(() => computeRange(PRESET), []);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set('from', new Date(range.fromMs).toISOString());
    p.set('to', new Date(range.toMs).toISOString());
    return p.toString();
  }, [range]);

  const overview = useQuery<Overview>({
    queryKey: ['admin', 'billing', 'overview', PRESET, 'profit'],
    queryFn: () => apiClient.get(`/admin/billing/overview?${qs}`) as any,
    placeholderData: (p) => p,
  });

  const cost = useQuery<CostSummary>({
    queryKey: ['admin', 'billing', 'cost', PRESET, 'profit'],
    queryFn: () => apiClient.get(`/admin/billing/cost/summary?${qs}`) as any,
    placeholderData: (p) => p,
  });

  const isFetching = overview.isFetching || cost.isFetching;
  const netUsd = (overview.data?.netRevenueCents ?? 0) / 100;
  const aiCostCny = cost.data?.totalCny ?? 0;
  const rate = cost.data?.usdCnyRate ?? 7.2;
  const netCny = netUsd * rate;
  const grossProfitCny = netCny - aiCostCny;
  const marginRatio = netCny > 0 ? grossProfitCny / netCny : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-5 max-w-[1600px]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              利润分析
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {RANGE_LABEL[PRESET]}净收入与 AI 成本对比，估算经营毛利（现金流口径）
            </p>
          </div>
          <button
            onClick={() => {
              overview.refetch();
              cost.refetch();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            刷新
          </button>
        </div>

        <QueryState
          isLoading={overview.isLoading || cost.isLoading}
          isError={overview.isError || cost.isError}
          error={overview.error ?? cost.error}
          isEmpty={false}
          height="h-32"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">净收入</span>
                <span className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50">
                  <DollarSign className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {usd(overview.data?.netRevenueCents)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                折算约 {cny(netCny)}（汇率 {rate}）
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">AI 成本</span>
                <span className="p-1.5 rounded-lg text-amber-600 bg-amber-50">
                  <Cpu className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{cny(aiCostCny)}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">MV / 音乐 / 歌词 AI 调用合计</p>
            </div>

            <div
              className={cn(
                'rounded-2xl p-5 shadow-sm border text-white',
                grossProfitCny >= 0
                  ? 'bg-gradient-to-br from-purple-600 to-indigo-600 border-purple-400/30'
                  : 'bg-gradient-to-br from-red-500 to-rose-600 border-red-400/30',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/90">估算毛利</span>
                <span className="p-1.5 rounded-lg bg-white/15">
                  <TrendingUp className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">{cny(grossProfitCny)}</p>
              <p className="mt-0.5 text-xs text-white/75">
                净收入（CNY）− AI 成本 · 毛利率 {pct(marginRatio)}
              </p>
            </div>
          </div>
        </QueryState>

        <p className="text-[11px] text-slate-400 leading-relaxed px-1">
          <strong className="text-slate-500">口径说明：</strong>
          净收入按支付完成时间统计总收入并扣除同期退款；AI 成本为对账/估算后的人民币合计。
          估算毛利 = 净收入按 USD→CNY 汇率折算后减去 AI 成本，未计入 Stripe 手续费、人力与其他运营成本。
        </p>
      </div>
    </div>
  );
}
