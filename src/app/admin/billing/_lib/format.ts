/** 计费板块通用格式化与常量 */

/** 分 → $X.XX */
export const usd = (cents: number | null | undefined): string =>
  `$${((cents ?? 0) / 100).toFixed(2)}`;

/** 分 → 紧凑金额（图表轴用）：$1.2k / $980 */
export const usdCompact = (cents: number | null | undefined): string => {
  const v = (cents ?? 0) / 100;
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
};

/** 元 → ¥X.XX */
export const cny = (yuan: number | null | undefined): string =>
  `¥${(yuan ?? 0).toFixed(2)}`;

/** 元 → 紧凑金额（图表轴用）：¥1.2k / ¥980 */
export const cnyCompact = (yuan: number | null | undefined): string => {
  const v = yuan ?? 0;
  if (Math.abs(v) >= 1000) return `¥${(v / 1000).toFixed(1)}k`;
  return `¥${Math.round(v)}`;
};

/** 0.123 → 12.3% */
export const pct = (ratio: number | null | undefined, digits = 1): string =>
  `${((ratio ?? 0) * 100).toFixed(digits)}%`;

export const TYPE_LABEL: Record<string, string> = {
  topup: '充值',
  subscription: '会员',
};

export const PAYMENT_STATUS_META: Record<
  string,
  { label: string; cls: string }
> = {
  pending: { label: '待支付', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  succeeded: { label: '已支付', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  failed: { label: '失败', cls: 'bg-red-50 text-red-700 border-red-100' },
  refunded: { label: '已退款', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const REFUND_STATUS_META: Record<string, { label: string; cls: string }> = {
  requested: { label: '待判定', cls: 'bg-blue-50 text-blue-700 border-blue-100' },
  pending_review: { label: '待审核', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  approved: { label: '已批准', cls: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  rejected: { label: '已拒绝', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  pending: { label: '处理中', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  succeeded: { label: '已退款', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  failed: { label: '失败', cls: 'bg-red-50 text-red-700 border-red-100' },
  canceled: { label: '已取消', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const REFUND_KIND_LABEL: Record<string, string> = {
  user_request: '用户申请',
  stripe: 'Stripe 后台',
  dispute: '争议/拒付',
};

export const EVENT_STATUS_META: Record<string, { label: string; cls: string }> = {
  received: { label: '已接收', cls: 'bg-blue-50 text-blue-700 border-blue-100' },
  processed: { label: '已处理', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  failed: { label: '失败', cls: 'bg-red-50 text-red-700 border-red-100' },
  ignored: { label: '已忽略', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const RISK_META: Record<string, { label: string; cls: string }> = {
  normal: { label: '正常', cls: 'text-emerald-600' },
  elevated: { label: '偏高', cls: 'text-amber-600' },
  highest: { label: '高危', cls: 'text-red-600' },
};

/** 产品/国家/支付方式 饼图配色 */
export const CHART_COLORS = [
  '#8b5cf6',
  '#ec4899',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#06b6d4',
  '#ef4444',
  '#64748b',
];

export const METHOD_LABEL: Record<string, string> = {
  card: '银行卡',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  link: 'Link',
  unknown: '未知',
};

/** 时间窗口预设 */
export type RangePreset = 'today' | '7d' | '30d' | '90d' | '12m';

export const RANGE_LABEL: Record<RangePreset, string> = {
  today: '今日',
  '7d': '近 7 天',
  '30d': '近 30 天',
  '90d': '近 90 天',
  '12m': '近 12 月',
};

export function computeRange(preset: RangePreset): {
  fromMs: number;
  toMs: number;
  bucket: 'day' | 'week' | 'month';
} {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  switch (preset) {
    case 'today': {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return { fromMs: start.getTime(), toMs: now, bucket: 'day' };
    }
    case '7d':
      return { fromMs: now - 7 * day, toMs: now, bucket: 'day' };
    case '30d':
      return { fromMs: now - 30 * day, toMs: now, bucket: 'day' };
    case '90d':
      return { fromMs: now - 90 * day, toMs: now, bucket: 'week' };
    case '12m':
      return { fromMs: now - 365 * day, toMs: now, bucket: 'month' };
  }
}

/** ISO → 图表轴 label，按 bucket 粒度 */
export function tsLabel(ts: string, bucket: 'day' | 'week' | 'month'): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  if (bucket === 'month') return `${d.getFullYear()}-${mm}`;
  return `${mm}-${dd}`;
}
