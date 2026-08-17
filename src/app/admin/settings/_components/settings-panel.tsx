'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type PanelTone = 'slate' | 'sky' | 'violet' | 'emerald' | 'amber';

const TONE: Record<
  PanelTone,
  { head: string; badge: string; icon: string }
> = {
  slate: {
    head: 'bg-slate-100/90 border-slate-200',
    badge: 'bg-white/80 text-slate-700 ring-1 ring-slate-200/80',
    icon: 'text-slate-500',
  },
  sky: {
    head: 'bg-sky-50 border-sky-100',
    badge: 'bg-sky-100/80 text-sky-800 ring-1 ring-sky-200/70',
    icon: 'text-sky-600',
  },
  violet: {
    head: 'bg-violet-50 border-violet-100',
    badge: 'bg-violet-100/80 text-violet-800 ring-1 ring-violet-200/70',
    icon: 'text-violet-600',
  },
  emerald: {
    head: 'bg-emerald-50 border-emerald-100',
    badge: 'bg-emerald-100/80 text-emerald-800 ring-1 ring-emerald-200/70',
    icon: 'text-emerald-600',
  },
  amber: {
    head: 'bg-amber-50 border-amber-100',
    badge: 'bg-amber-100/80 text-amber-800 ring-1 ring-amber-200/70',
    icon: 'text-amber-600',
  },
};

export function SettingsPanel({
  title,
  badge,
  summary,
  tone = 'slate',
  defaultOpen = false,
  children,
  footer,
}: {
  title: string;
  badge?: ReactNode;
  summary?: ReactNode;
  tone?: PanelTone;
  defaultOpen?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const t = TONE[tone];

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors',
          t.head,
          open ? 'border-slate-200/80' : 'border-transparent',
        )}
      >
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/70',
            t.icon,
          )}
        >
          <Settings2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            {badge}
          </div>
          {summary ? (
            <div className="mt-0.5 truncate text-xs text-slate-500">{summary}</div>
          ) : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200/80">
          {open ? '收起' : '配置'}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 transition-transform',
              open && 'rotate-180',
            )}
          />
        </span>
      </button>

      {open ? (
        <div className="bg-white">
          <div className="px-4 py-3">{children}</div>
          {footer ? (
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function SettingsStatusBadge({
  ok,
  okText = '已配置',
  badText = '未配置',
  extra,
}: {
  ok: boolean;
  okText?: string;
  badText?: string;
  extra?: ReactNode;
}) {
  return (
    <>
      <span
        className={cn(
          'rounded-md px-1.5 py-0.5 text-[11px] font-medium',
          ok
            ? 'bg-emerald-100/90 text-emerald-800'
            : 'bg-amber-100/90 text-amber-800',
        )}
      >
        {ok ? okText : badText}
      </span>
      {extra}
    </>
  );
}

export function SettingsSaveBar({
  msg,
  saving,
  disabled,
  label = '保存',
}: {
  msg: { ok: boolean; text: string } | null;
  saving: boolean;
  disabled: boolean;
  label?: string;
}) {
  return (
    <>
      <div className="min-w-0 flex-1">
        {msg ? (
          <p
            className={cn(
              'truncate text-xs',
              msg.ok ? 'text-emerald-700' : 'text-rose-600',
            )}
          >
            {msg.text}
          </p>
        ) : (
          <span className="text-xs text-slate-400">修改后点击保存生效</span>
        )}
      </div>
      <button
        type="submit"
        disabled={saving || disabled}
        className="inline-flex h-8 shrink-0 items-center rounded-lg bg-slate-900 px-3.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-45"
      >
        {saving ? '保存中…' : label}
      </button>
    </>
  );
}
