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

/** Frankfurter 免费汇率（无需 API Key）：https://www.frankfurter.app/ */
export async function fetchCnyPerUsd(): Promise<number> {
  const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=CNY', {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`汇率接口 HTTP ${res.status}`);
  const json = (await res.json()) as { rates?: { CNY?: number } };
  const rate = json.rates?.CNY;
  if (!rate || rate <= 0) throw new Error('汇率数据无效');
  return rate;
}
