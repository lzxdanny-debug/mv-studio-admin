'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type NumberInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'size'
> & {
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  size?: 'sm' | 'md';
  /** 空输入时回落值，默认 0 */
  emptyFallback?: number;
};

/**
 * Admin 数字输入 + 可选单位后缀。样式对齐 Input / SelectTrigger。
 */
export function NumberInput({
  value,
  onChange,
  unit,
  size = 'md',
  min,
  max,
  step,
  disabled,
  className,
  emptyFallback = 0,
  ...props
}: NumberInputProps) {
  return (
    <div
      className={cn(
        'inline-flex w-full items-center border bg-white',
        'rounded-[10px] border-slate-200/90',
        'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        'transition-[border-color,box-shadow,background-color] duration-150',
        'hover:border-slate-300',
        'focus-within:border-blue-400 focus-within:ring-[3px] focus-within:ring-blue-500/15',
        disabled && 'cursor-not-allowed bg-slate-50 opacity-80 shadow-none',
        size === 'sm' && 'h-8',
        size === 'md' && 'h-10',
        className,
      )}
    >
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : emptyFallback}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(emptyFallback);
            return;
          }
          const next = Number(raw);
          if (!Number.isFinite(next)) return;
          onChange(next);
        }}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-right text-slate-800',
          'focus:outline-none',
          'disabled:cursor-not-allowed disabled:text-slate-400',
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          size === 'sm' && 'px-2.5 text-xs',
          size === 'md' && 'px-3 text-sm',
        )}
        {...props}
      />
      {unit ? (
        <span
          className={cn(
            'shrink-0 border-l border-slate-100 text-slate-400',
            size === 'sm' && 'px-2 text-[11px]',
            size === 'md' && 'px-2.5 text-xs',
          )}
        >
          {unit}
        </span>
      ) : null}
    </div>
  );
}
