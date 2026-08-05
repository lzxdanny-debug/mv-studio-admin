'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: 'sm' | 'md';
  mono?: boolean;
};

/**
 * Admin 通用文本输入。样式对齐 SelectTrigger（圆角写死、细边框、蓝 focus ring）。
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size = 'md', mono, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'w-full border bg-white text-slate-800',
        'rounded-[10px] border-slate-200/90',
        'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        'transition-[border-color,box-shadow,background-color] duration-150',
        'hover:border-slate-300 hover:bg-slate-50/70',
        'focus:outline-none',
        'focus-visible:border-blue-400 focus-visible:ring-[3px] focus-visible:ring-blue-500/15',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none disabled:opacity-80',
        'placeholder:text-slate-400',
        size === 'sm' && 'h-8 px-2.5 text-xs',
        size === 'md' && 'h-10 px-3 text-sm',
        mono && 'font-mono text-[12px]',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
