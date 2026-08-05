'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type FormFieldProps = {
  label: string;
  description?: string;
  htmlFor?: string;
  /** 右侧控件列，固定宽度两端对齐 */
  children: React.ReactNode;
  className?: string;
  /** 控件列宽度，默认 220px；窄屏可传更小 */
  controlClassName?: string;
};

/**
 * 设置页通用字段行：左标签+说明，右控件，两端对齐。
 * 借鉴 Linear / Stripe / Vercel 设置页布局。
 */
export function FormField({
  label,
  description,
  htmlFor,
  children,
  className,
  controlClassName,
}: FormFieldProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <label
          htmlFor={htmlFor}
          className="block text-sm font-medium text-slate-800"
        >
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
        ) : null}
      </div>
      <div
        className={cn(
          'flex w-[160px] shrink-0 justify-end sm:w-[220px]',
          controlClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
