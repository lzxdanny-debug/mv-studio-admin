import { NextResponse } from 'next/server';

/** 无实时汇率时的兜底（与 mountsea-pricing.ts 一致） */
const DEFAULT_CNY_PER_USD = 7.2;

/** 服务端代理 Frankfurter，避免浏览器 CORS 限制 */
export async function GET() {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=CNY', {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { cnyPerUsd: DEFAULT_CNY_PER_USD, source: 'default', error: `HTTP ${res.status}` },
        { status: 200 },
      );
    }
    const json = (await res.json()) as { rates?: { CNY?: number } };
    const rate = json.rates?.CNY;
    if (!rate || rate <= 0) {
      return NextResponse.json(
        { cnyPerUsd: DEFAULT_CNY_PER_USD, source: 'default', error: 'invalid rate' },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { cnyPerUsd: rate, source: 'frankfurter' },
      { headers: { 'Cache-Control': 'public, max-age=3600' } },
    );
  } catch (err) {
    return NextResponse.json(
      {
        cnyPerUsd: DEFAULT_CNY_PER_USD,
        source: 'default',
        error: err instanceof Error ? err.message : 'fetch failed',
      },
      { status: 200 },
    );
  }
}
