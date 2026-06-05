/**
 * 跟后端 MvCostStatsService.CostStatsPayload 严格对齐。
 * 后端字段名变化时这里要同步（admin 没有共享 schema 包，靠人工对齐）。
 */

export interface CostStatsPayload {
  range: {
    fromMs: number;
    toMs: number;
    fromIso: string;
    toIso: string;
    bucket: 'hour' | 'day';
  };
  filters: {
    provider: string | null;
    step: string | null;
  };
  summary: {
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    estimated: {
      mountseaCredits: number;
      falUsd: number;
      cloudflareNeuron: number;
    };
    reconciled: {
      mountseaCredits: number;
      falUsd: number;
      cloudflareNeuron: number;
    };
    reconciliation: {
      reconciledCount: number;
      totalCount: number;
      ratio: number;
    };
  };
  byProvider: Array<{
    provider: string;
    calls: number;
    success: number;
    failed: number;
    /** 估算金额（按 cost_native_unit 求和；CF 价格表为空时为 0） */
    estAmount: number;
    /** 估算单位（credits/usd/neuron），CF 因价格表空时为 null → 前端显示 "—" */
    estUnit: string | null;
    /** 真实账单金额（按 reconciled_source 求和） */
    reconciledAmount: number;
    /** 真实账单单位（mountsea_usage→credits / fal_billing_events,cf_aig_logs→usd） */
    reconciledUnit: string | null;
  }>;
  byStep: Array<{
    step: string;
    calls: number;
    success: number;
    failed: number;
    estAmountUsd: number;
  }>;
  byModel: Array<{
    provider: string;
    model: string;
    calls: number;
    success: number;
    failed: number;
    estAmountUsd: number;
  }>;
  failureBreakdown: Array<{
    errorKind: string;
    label: string;
    calls: number;
    estCostWastedUsd: number;
    avgElapsedMs: number;
    likelyBilled: boolean;
    note: string;
  }>;
  timeline: Array<{
    ts: string;
    calls: number;
    success: number;
    failed: number;
    estAmountUsd: number;
  }>;
}

/** 时间窗口预设值，下拉切换时直接换算成 from/to。 */
export type TimeRangePreset = 'today' | '24h' | '7d' | '30d' | 'custom';

export const TIME_RANGE_LABELS: Record<TimeRangePreset, string> = {
  today: '本日',
  '24h': '最近 24 小时',
  '7d': '最近 7 天',
  '30d': '最近 30 天',
  custom: '自定义',
};

/** 步骤标签（与后端 step 字段值对齐） */
export const STEP_LABELS: Record<string, string> = {
  lrc_transcribe: 'LRC 转写',
  music_analyze: '音乐分析',
  storyboard_image: '故事板图',
  video_gen: '镜头视频',
  lipsync_post: '口型同步',
};

/** Provider 标签 */
export const PROVIDER_LABELS: Record<string, string> = {
  mountsea: 'Mountsea',
  fal: 'Fal.ai',
  cloudflare: 'Cloudflare',
};

export const PROVIDER_COLORS: Record<string, string> = {
  mountsea: '#a855f7', // purple
  fal: '#3b82f6', // blue
  cloudflare: '#f97316', // orange
};

/** 失败大类的颜色：billed=红，not billed=灰 */
export const FAILURE_COLORS = {
  billed: '#ef4444', // red
  notBilled: '#94a3b8', // slate-400
};

/** 把 step key 转成可读 label（未知值原样返回） */
export function stepLabel(step: string): string {
  return STEP_LABELS[step] ?? step;
}

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

/** 格式化金额：USD → "$1.23"、credit/neuron → 整数 */
export function formatUsd(v: number): string {
  if (!Number.isFinite(v)) return '$0.00';
  if (Math.abs(v) >= 100) return `$${v.toFixed(0)}`;
  if (Math.abs(v) >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}

export function formatCount(v: number): string {
  if (!Number.isFinite(v)) return '0';
  return v.toLocaleString('en-US');
}

export function formatPercent(v: number): string {
  if (!Number.isFinite(v)) return '0%';
  return `${(v * 100).toFixed(0)}%`;
}
