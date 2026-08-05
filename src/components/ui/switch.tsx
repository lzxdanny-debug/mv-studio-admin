'use client';

import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** 无可见文字时供读屏使用 */
  label?: string;
  /** md 用于列表行，lg 用于强调总开关 */
  size?: 'md' | 'lg';
  className?: string;
}

const SIZE = {
  md: {
    track: 'h-6 w-11',
    thumb: 'h-5 w-5',
    on: 'translate-x-[22px]',
    off: 'translate-x-0.5',
  },
  lg: {
    track: 'h-7 w-12',
    thumb: 'h-6 w-6',
    on: 'translate-x-5',
    off: 'translate-x-0',
  },
} as const;

/**
 * Admin 通用开关。纯按钮实现，不依赖 Radix。
 * 约定：开启 = 蓝色，关闭 = 灰色。
 */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
  size = 'md',
  className,
}: SwitchProps) {
  const s = SIZE[size];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      className={cn(
        'relative inline-flex flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2',
        s.track,
        checked ? 'bg-blue-600' : 'bg-slate-300',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block transform rounded-full bg-white shadow transition-transform duration-200',
          s.thumb,
          checked ? s.on : s.off,
        )}
      />
    </button>
  );
}
