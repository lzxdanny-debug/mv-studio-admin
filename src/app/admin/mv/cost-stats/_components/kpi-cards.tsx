'use client';

import { Activity, AlertCircle, DollarSign, RefreshCw } from 'lucide-react';
import {
  CostStatsPayload,
  formatCount,
  formatPercent,
  formatUsd,
} from '../_lib/types';
import { DEFAULT_CNY_PER_USD, mountseaCreditUsdPerCredit } from '@/lib/mountsea-pricing';

/**
 * 4 张 KPI 卡（成本统计页顶栏）：
 *   - 总调用 / 成功率
 *   - 总估算成本（按 USD 折算合计）
 *   - 失败浪费（"已计费但失败"分类的估算成本之和）
 *   - 对账覆盖率
 *
 * 货币单位：Mountsea credits / Cloudflare neuron 折算到 USD 仅做"量级展示"，
 * 不用于结算。Fal 本来就是 USD。详见后端 native-pricing.ts 顶部注释。
 */

interface KpiCardsProps {
  payload: CostStatsPayload;
}

const USD_PER_MOUNTSEA_CREDIT = mountseaCreditUsdPerCredit(DEFAULT_CNY_PER_USD);
const USD_PER_CLOUDFLARE_NEURON = 0;

export function KpiCards({ payload }: KpiCardsProps) {
  const { summary, failureBreakdown } = payload;

  const successRate =
    summary.totalCalls > 0 ? summary.successCalls / summary.totalCalls : 0;

  const estTotalUsd =
    summary.estimated.falUsd +
    summary.estimated.mountseaCredits * USD_PER_MOUNTSEA_CREDIT +
    summary.estimated.cloudflareNeuron * USD_PER_CLOUDFLARE_NEURON;

  // reconciled.falUsd 后端已合并 fal_billing_events + cf_aig_logs 两个 USD 来源，
  // cloudflareNeuron 现在恒为 0（CF 真实账单不是 neuron 计价）
  const recTotalUsd =
    summary.reconciled.falUsd +
    summary.reconciled.mountseaCredits * USD_PER_MOUNTSEA_CREDIT;

  // "失败浪费" = 失败分类中标记 likelyBilled=true 的总估算
  const wastedUsd = failureBreakdown
    .filter((r) => r.likelyBilled)
    .reduce((acc, r) => acc + r.estCostWastedUsd, 0);
  const wastedRatio = estTotalUsd > 0 ? wastedUsd / estTotalUsd : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        icon={<Activity className="h-4 w-4 text-blue-500" />}
        label="总调用"
        value={formatCount(summary.totalCalls)}
        helper={
          <>
            <span className="text-emerald-600">{formatCount(summary.successCalls)} 成功</span>
            <span className="text-slate-300 mx-1">·</span>
            <span className="text-red-500">{formatCount(summary.failedCalls)} 失败</span>
            <span className="text-slate-400 ml-1">({formatPercent(successRate)} 成功率)</span>
          </>
        }
      />

      <KpiCard
        icon={<DollarSign className="h-4 w-4 text-teal-500" />}
        label="估算总成本"
        value={formatUsd(estTotalUsd)}
        helper={
          <>
            <span className="text-slate-500">已对账 {formatUsd(recTotalUsd)}</span>
            <span className="text-slate-300 mx-1">·</span>
            <span className="text-slate-400">含 Mountsea/CF 折算</span>
          </>
        }
        helperTitle={
          'Mountsea：100 credits = 1 CNY，按 CNY/USD=7.2 折算；Cloudflare 暂未登记单价。\n' +
          '此为量级展示，不用于结算（结算以对账后的真实账单 reconciled_amount 为准）。'
        }
      />

      <KpiCard
        icon={<AlertCircle className="h-4 w-4 text-red-500" />}
        label="失败浪费 (估算)"
        value={formatUsd(wastedUsd)}
        valueClassName={wastedUsd > 0 ? 'text-red-600' : 'text-slate-700'}
        helper={
          <>
            <span className="text-slate-500">
              占总成本 {formatPercent(wastedRatio)}
            </span>
            <span className="text-slate-300 mx-1">·</span>
            <span className="text-slate-400">
              内容审核 + 超时（这两类多半已被上游计费）
            </span>
          </>
        }
        helperTitle={
          '"失败浪费" = 失败但上游可能仍计费的调用之估算成本之和。\n' +
          '主要来自：内容审核拦截（Veo 推理中途拒绝）、超时（任务跑到一半）。\n' +
          '上游服务器错误 / 限流 / 鉴权失败 不算入此项（前置拦截不计费）。'
        }
      />

      <KpiCard
        icon={<RefreshCw className="h-4 w-4 text-emerald-500" />}
        label="对账覆盖率"
        value={formatPercent(summary.reconciliation.ratio)}
        helper={
          <>
            <span className="text-slate-500">
              {formatCount(summary.reconciliation.reconciledCount)} /{' '}
              {formatCount(summary.reconciliation.totalCount)}
            </span>
            <span className="text-slate-300 mx-1">·</span>
            <span className="text-slate-400">cron 每小时跑一次</span>
          </>
        }
      />
    </div>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  helper?: React.ReactNode;
  helperTitle?: string;
}

function KpiCard({ icon, label, value, valueClassName, helper, helperTitle }: KpiCardProps) {
  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"
      title={helperTitle}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-xs text-slate-500 font-medium">{label}</span>
      </div>
      <div
        className={`text-2xl font-bold leading-none mb-2 ${
          valueClassName ?? 'text-slate-900'
        }`}
      >
        {value}
      </div>
      <div className="text-[11px] text-slate-500">{helper}</div>
    </div>
  );
}
