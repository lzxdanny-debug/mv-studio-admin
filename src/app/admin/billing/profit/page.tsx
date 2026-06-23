'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, RefreshCw, DollarSign, Cpu, Gift } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { usd, usdAmount, pct, RANGE_LABEL, computeRange } from '../_lib/format';

interface Overview {
  netRevenueCents: number;
}

interface CostSummary {
  totalUsd: number;
  usdCnyRate: number;
}

interface BonusSummary {
  totalUsd: number;
  totalCredits: number;
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

  const bonus = useQuery<BonusSummary>({
    queryKey: ['admin', 'billing', 'bonus', 'summary', PRESET, 'profit'],
    queryFn: () => apiClient.get(`/admin/billing/bonus/summary?${qs}`) as any,
    placeholderData: (p) => p,
  });

  const isFetching = overview.isFetching || cost.isFetching || bonus.isFetching;
  const netUsd = (overview.data?.netRevenueCents ?? 0) / 100;
  const aiCostUsd = cost.data?.totalUsd ?? 0;
  const bonusUsd = bonus.data?.totalUsd ?? 0;
  const totalCostUsd = aiCostUsd + bonusUsd;
  const grossProfitUsd = netUsd - totalCostUsd;
  const marginRatio = netUsd > 0 ? grossProfitUsd / netUsd : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-5 max-w-[1600px]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-teal-600" />
              利润分析
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {RANGE_LABEL[PRESET]}净收入与成本对比，估算经营毛利（统一美元 USD，现金流口径）
            </p>
          </div>
          <button
            onClick={() => {
              overview.refetch();
              cost.refetch();
              bonus.refetch();
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
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
              <p className="mt-0.5 text-[11px] text-slate-400">总收入扣除同期退款</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">AI 成本</span>
                <span className="p-1.5 rounded-lg text-amber-600 bg-amber-50">
                  <Cpu className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{usdAmount(aiCostUsd)}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">MV / 音乐 / 歌词 AI 调用合计</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">赠送积分成本</span>
                <span className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50">
                  <Gift className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{usdAmount(bonusUsd)}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                注册 / 签到 / 会员赠送 · {(bonus.data?.totalCredits ?? 0).toLocaleString()} 积分
              </p>
            </div>

            <div
              className={cn(
                'rounded-2xl p-5 shadow-sm border text-white',
                grossProfitUsd >= 0
                  ? 'bg-gradient-to-br from-teal-600 to-indigo-600 border-teal-400/30'
                  : 'bg-gradient-to-br from-red-500 to-rose-600 border-red-400/30',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/90">估算毛利</span>
                <span className="p-1.5 rounded-lg bg-white/15">
                  <TrendingUp className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">{usdAmount(grossProfitUsd)}</p>
              <p className="mt-0.5 text-xs text-white/75">
                净收入 − AI 成本 − 赠送 · 毛利率 {pct(marginRatio)}
              </p>
            </div>
          </div>
        </QueryState>

        <p className="text-[11px] text-slate-400 leading-relaxed px-1">
          <strong className="text-slate-500">口径说明：</strong>
          全部金额统一为美元 USD。净收入按支付完成时间统计总收入并扣除同期退款；
          AI 成本为对账/估算后的美元合计（Fal/Cloudflare 原生美元，Mountsea 人民币按实时汇率折算）；
          赠送积分成本按对外售价折算（注册 / 签到 / 会员 / 手动赠送，直接以美元计价）。
          估算毛利 = 净收入 − AI 成本 − 赠送积分成本，未计入 Stripe 手续费、人力与其他运营成本。
        </p>
      </div>
    </div>
  );
}
