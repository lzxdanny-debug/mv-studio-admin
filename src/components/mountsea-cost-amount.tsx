import { cn } from '@/lib/utils';
import {
  DEFAULT_CNY_PER_USD,
  formatUsdAmount,
  mountseaCreditsToUsd,
} from '@/lib/mountsea-pricing';

function safeCredits(value: number | null | undefined): number {
  return Number.isFinite(value) ? (value as number) : 0;
}

/** Mountsea credits → 美元为主（副标 credits）；平台成本统一 USD */
export function MountseaCostAmount({
  credits,
  align = 'right',
  amountClassName = 'text-blue-700 font-medium',
  cnyPerUsd = DEFAULT_CNY_PER_USD,
}: {
  credits: number | null | undefined;
  align?: 'left' | 'right';
  amountClassName?: string;
  cnyPerUsd?: number;
  /** @deprecated 已统一美元展示，忽略 */
  showUsd?: boolean;
}) {
  const safe = safeCredits(credits);
  if (safe <= 0) return <span className="text-slate-300">—</span>;

  const usd = mountseaCreditsToUsd(safe, cnyPerUsd);

  return (
    <div className={cn('tabular-nums', align === 'right' && 'text-right')}>
      <div className={amountClassName}>{formatUsdAmount(usd)}</div>
      <div className="text-[10px] text-slate-400 font-normal">
        {safe.toLocaleString(undefined, { maximumFractionDigits: 2 })} credits
      </div>
    </div>
  );
}
