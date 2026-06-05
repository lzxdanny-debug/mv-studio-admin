/** Mountsea 计价：100 credits = 1 CNY */
export const MOUNTSEA_CREDITS_PER_CNY = 100;

/** 无实时汇率时的兜底（≈ 7.2 CNY/USD） */
export const DEFAULT_CNY_PER_USD = 7.2;

export function mountseaCreditsToUsd(credits: number, cnyPerUsd = DEFAULT_CNY_PER_USD): number {
  if (!Number.isFinite(credits) || credits <= 0 || cnyPerUsd <= 0) return 0;
  return credits / MOUNTSEA_CREDITS_PER_CNY / cnyPerUsd;
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
