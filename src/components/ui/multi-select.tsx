'use client';

import { cn } from '@/lib/utils';

export type MultiSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type MultiSelectProps = {
  value: string[];
  onChange: (value: string[]) => void;
  options: MultiSelectOption[];
  disabled?: boolean;
  className?: string;
  /** 至少保留一项；为 true 时取消最后一项会被忽略 */
  requireAtLeastOne?: boolean;
};

/**
 * Admin 多选 Chip 组。适合选项较少的枚举（画幅 / 分辨率 / 画质等）。
 * 值对外为 string[]，存盘时由调用方拼成逗号串。
 */
export function MultiSelect({
  value,
  onChange,
  options,
  disabled,
  className,
  requireAtLeastOne = false,
}: MultiSelectProps) {
  const selected = new Set(value);

  const toggle = (optValue: string) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(optValue)) {
      if (requireAtLeastOne && next.size <= 1) return;
      next.delete(optValue);
    } else {
      next.add(optValue);
    }
    // 保持 options 原始顺序，避免每次切换乱序
    onChange(options.map((o) => o.value).filter((v) => next.has(v)));
  };

  return (
    <div className={cn('flex flex-wrap justify-end gap-1.5', className)}>
      {options.map((opt) => {
        const active = selected.has(opt.value);
        const isDisabled = disabled || opt.disabled;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={isDisabled}
            aria-pressed={active}
            onClick={() => toggle(opt.value)}
            className={cn(
              'inline-flex h-8 items-center rounded-[8px] border px-2.5 text-xs font-medium transition-colors duration-150',
              'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500/15',
              active
                ? 'border-blue-300 bg-blue-50 text-blue-800'
                : 'border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
              isDisabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
