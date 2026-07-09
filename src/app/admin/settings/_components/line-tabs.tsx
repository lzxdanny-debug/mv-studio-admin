'use client';

import { cn } from '@/lib/utils';

export type LineTabItem<T extends string> = {
  id: T;
  label: string;
};

type LineTabsProps<T extends string> = {
  items: LineTabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  /** primary：一级导航（下划线）；secondary：二级导航（胶囊分段） */
  variant?: 'primary' | 'secondary';
};

export function LineTabs<T extends string>({
  items,
  active,
  onChange,
  className,
  variant = 'primary',
}: LineTabsProps<T>) {
  if (variant === 'secondary') {
    return (
      <div className={cn('border-b border-slate-100 bg-slate-50/70 px-6 py-3', className)}>
        <nav
          className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100/90 p-1 ring-1 ring-slate-200/60"
          aria-label="子分类"
        >
          {items.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={cn(
                  'shrink-0 rounded-md px-3.5 py-1.5 text-[13px] leading-none transition-all duration-200',
                  isActive
                    ? 'bg-white font-medium text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                    : 'font-normal text-slate-500 hover:text-slate-700',
                )}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <div className={cn('border-b border-slate-200 bg-white', className)}>
      <nav className="flex items-end gap-10 px-6" aria-label="设置分类">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                'group relative -mb-px shrink-0 pb-3.5 pt-4 text-[15px] leading-none transition-colors duration-200',
                isActive
                  ? 'font-semibold text-[#1677ff]'
                  : 'font-normal text-slate-500 hover:text-[#4096ff]',
              )}
            >
              {item.label}
              <span
                aria-hidden
                className={cn(
                  'pointer-events-none absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#1677ff] transition-opacity duration-200',
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-25',
                )}
              />
            </button>
          );
        })}
      </nav>
    </div>
  );
}
