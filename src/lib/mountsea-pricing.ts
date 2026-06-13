/** Mountsea 计价：100 credits = 1 CNY，即 1 credit = ¥0.01 */
export const MOUNTSEA_CREDITS_PER_CNY = 100;

/** 1 Mountsea 内部积分的人民币成本 */
export const MOUNTSEA_CNY_PER_CREDIT = 1 / MOUNTSEA_CREDITS_PER_CNY;

/** 无实时汇率时的兜底（≈ 7.2 CNY/USD） */
export const DEFAULT_CNY_PER_USD = 7.2;

/** 1 Mountsea 内部积分折算美元（按 CNY/USD 汇率） */
export function mountseaCreditUsdPerCredit(cnyPerUsd = DEFAULT_CNY_PER_USD): number {
  if (!Number.isFinite(cnyPerUsd) || cnyPerUsd <= 0) return 0;
  return MOUNTSEA_CNY_PER_CREDIT / cnyPerUsd;
}

export function mountseaCreditsToCny(credits: number): number {
  if (!Number.isFinite(credits) || credits <= 0) return 0;
  return credits / MOUNTSEA_CREDITS_PER_CNY;
}

export function mountseaCreditsToUsd(credits: number, cnyPerUsd = DEFAULT_CNY_PER_USD): number {
  if (!Number.isFinite(credits) || credits <= 0 || cnyPerUsd <= 0) return 0;
  return mountseaCreditsToCny(credits) / cnyPerUsd;
}

export function formatCnyAmount(cny: number, maxDecimals = 2): string {
  if (!Number.isFinite(cny) || cny <= 0) return '¥0.00';
  if (cny >= 1) return `¥${cny.toFixed(2)}`;
  return `¥${cny.toFixed(maxDecimals)}`;
}

export function formatUsdAmount(usd: number, maxDecimals = 4): string {
  if (!Number.isFinite(usd) || usd <= 0) return '$0.00';
  if (Math.abs(usd) >= 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(maxDecimals)}`;
}

/** 经 Next.js 同源 API 代理 Frankfurter，避免浏览器 CORS */
export async function fetchCnyPerUsd(): Promise<number> {
  try {
    const res = await fetch('/api/exchange-rate/cny-per-usd', { cache: 'no-store' });
    if (!res.ok) return DEFAULT_CNY_PER_USD;
    const json = (await res.json()) as { cnyPerUsd?: number };
    const rate = json.cnyPerUsd;
    if (!rate || rate <= 0 || !Number.isFinite(rate)) return DEFAULT_CNY_PER_USD;
    return rate;
  } catch {
    return DEFAULT_CNY_PER_USD;
  }
}
