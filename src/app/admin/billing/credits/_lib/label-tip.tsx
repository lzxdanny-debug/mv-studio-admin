'use client';

import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type LabelTipVariant = 'default' | 'light';

interface LabelTipProps {
  label?: React.ReactNode;
  tip: string;
  className?: string;
  labelClassName?: string;
  variant?: LabelTipVariant;
  iconClassName?: string;
}

export function LabelTip({
  label,
  tip,
  className,
  labelClassName,
  variant = 'default',
  iconClassName,
}: LabelTipProps) {
  const isLight = variant === 'light';

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {label != null && label !== '' ? <span className={labelClassName}>{label}</span> : null}
      <span
        className="relative inline-flex group/tip"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <HelpCircle
          className={cn(
            'h-3.5 w-3.5 shrink-0 cursor-help transition-colors',
            isLight
              ? 'text-blue-100/80 hover:text-white'
              : 'text-slate-400 hover:text-blue-600',
            iconClassName,
          )}
          aria-label="查看说明"
        />
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute left-1/2 bottom-full z-30 mb-1.5 hidden w-56 -translate-x-1/2',
            'rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] leading-relaxed',
            'text-slate-600 shadow-lg group-hover/tip:block group-focus-within/tip:block',
          )}
        >
          {tip}
        </span>
      </span>
    </span>
  );
}
