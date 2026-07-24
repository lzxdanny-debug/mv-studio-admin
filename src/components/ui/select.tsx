'use client';

/**
 * Select — 参照 shadcn/ui / Radix Themes 的通用下拉。
 *
 * 注意：本仓库 tailwind 把 rounded-lg/xl/2xl 压成近直角，组件内一律用
 * rounded-[Npx] 写死圆角，避免再被全局配置打扁。
 */

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
    size?: 'sm' | 'md';
  }
>(({ className, children, size = 'md', ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'group flex w-full items-center justify-between gap-2 border bg-white text-left text-slate-800',
      'rounded-[10px] border-slate-200/90',
      'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
      'transition-[border-color,box-shadow,background-color] duration-150',
      'hover:border-slate-300 hover:bg-slate-50/70',
      'focus:outline-none',
      'focus-visible:border-blue-400 focus-visible:ring-[3px] focus-visible:ring-blue-500/15',
      'data-[state=open]:border-blue-400 data-[state=open]:ring-[3px] data-[state=open]:ring-blue-500/15',
      'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none disabled:opacity-80',
      'data-[placeholder]:text-slate-400',
      '[&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:text-left',
      size === 'sm' && 'h-8 px-2.5 text-xs',
      size === 'md' && 'h-10 px-3 text-sm',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown
        className={cn(
          'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200',
          'group-data-[state=open]:rotate-180 group-data-[state=open]:text-blue-500',
        )}
      />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1 text-slate-400',
      className,
    )}
    {...props}
  >
    <ChevronUp className="h-3.5 w-3.5" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1 text-slate-400',
      className,
    )}
    {...props}
  >
    <ChevronDown className="h-3.5 w-3.5" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        'relative z-[80] max-h-72 min-w-[8rem] overflow-hidden',
        'rounded-[12px] border border-slate-200/80 bg-white text-slate-800',
        'shadow-[0_10px_40px_-8px_rgba(15,23,42,0.18),0_4px_12px_-4px_rgba(15,23,42,0.08)]',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1.5 data-[side=top]:-translate-y-1.5',
        className,
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          'p-1.5',
          position === 'popper' &&
            'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('px-2.5 py-1.5 text-[11px] font-semibold text-slate-400', className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center',
      'rounded-[8px] py-2 pl-2.5 pr-8 text-sm outline-none',
      'text-slate-700',
      'focus:bg-blue-50 focus:text-blue-900',
      'data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-900',
      'data-[state=checked]:bg-blue-50/80 data-[state=checked]:font-medium data-[state=checked]:text-blue-900',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>
      <span className="flex min-w-0 items-center gap-2.5">{children}</span>
    </SelectPrimitive.ItemText>
    <span className="absolute right-2.5 flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5 text-blue-600" strokeWidth={2.5} />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1.5 h-px bg-slate-100', className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export type SimpleSelectOption = {
  value: string;
  label: React.ReactNode;
  /** 触发器 / 列表共用的前置内容（图标等） */
  leading?: React.ReactNode;
  disabled?: boolean;
};

export type SimpleSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SimpleSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  mono?: boolean;
  id?: string;
};

function OptionRow({
  leading,
  label,
  mono,
}: {
  leading?: React.ReactNode;
  label: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <>
      {leading ? <span className="inline-flex shrink-0 items-center">{leading}</span> : null}
      <span className={cn('truncate', mono && 'font-mono text-[12px]')}>{label}</span>
    </>
  );
}

/** 高频场景：options + value 一步到位 */
export function SimpleSelect({
  value,
  onValueChange,
  options,
  placeholder = '请选择',
  disabled,
  size = 'md',
  className,
  triggerClassName,
  contentClassName,
  mono,
  id,
}: SimpleSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        id={id}
        size={size}
        className={cn(mono && 'font-mono', className, triggerClassName)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
            <OptionRow leading={opt.leading} label={opt.label} mono={mono} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
