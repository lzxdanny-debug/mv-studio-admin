import { cn } from '@/lib/utils';
import {
  DEFAULT_CNY_PER_USD,
  formatCnyAmount,
  formatUsdAmount,
  mountseaCreditsToCny,
  mountseaCreditsToUsd,
} from '@/lib/mountsea-pricing';

function safeCredits(value: number | null | undefined): number {
  return Number.isFinite(value) ? (value as number) : 0;
}

/** Mountsea credits → 人民币为主、与 MV 成本明细一致的金额展示 */
export function MountseaCostAmount({
  credits,
  align = 'right',
  amountClassName = 'text-blue-700 font-medium',
  cnyPerUsd = DEFAULT_CNY_PER_USD,
  showUsd = true,
}: {
  credits: number | null | undefined;
  align?: 'left' | 'right';
  amountClassName?: string;
  cnyPerUsd?: number;
  showUsd?: boolean;
}) {
  const safe = safeCredits(credits);
  if (safe <= 0) return <span className="text-slate-300">—</span>;

  const cny = mountseaCreditsToCny(safe);
  const usd = mountseaCreditsToUsd(safe, cnyPerUsd);

  return (
    <div className={cn('tabular-nums', align === 'right' && 'text-right')}>
      <div className={amountClassName}>{formatCnyAmount(cny)}</div>
      <div className="text-[10px] text-slate-400 font-normal">
        {safe.toLocaleString(undefined, { maximumFractionDigits: 2 })} credits
        {showUsd && (
          <span className="text-slate-300"> · {formatUsdAmount(usd)}</span>
        )}
      </div>
    </div>
  );
}
