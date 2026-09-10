'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export type TimeRangePreset = 'all' | 'today' | '7d' | '30d' | '90d' | '12m' | 'custom';

export type TimeRangeSelection = {
  preset: TimeRangePreset;
  fromMs: number | null;
  toMs: number | null;
  bucket: 'day' | 'week' | 'month';
};

const LABELS: Record<TimeRangePreset, string> = {
  all: '全部时间',
  today: '今日',
  '7d': '近 7 天',
  '30d': '近 30 天',
  '90d': '近 90 天',
  '12m': '近 12 月',
  custom: '自定义',
};

export function createTimeRange(preset: Exclude<TimeRangePreset, 'custom'>): TimeRangeSelection {
  if (preset === 'all') return { preset, fromMs: null, toMs: null, bucket: 'day' };
  const now = Date.now();
  const day = 86_400_000;
  if (preset === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { preset, fromMs: start.getTime(), toMs: now, bucket: 'day' };
  }
  if (preset === '12m') return { preset, fromMs: now - 365 * day, toMs: now, bucket: 'month' };
  const days = Number.parseInt(preset, 10);
  return { preset, fromMs: now - days * day, toMs: now, bucket: preset === '90d' ? 'week' : 'day' };
}

export function TimeRangeFilter({
  value,
  onChange,
  presets = ['all', 'today', '7d', '30d', '90d', 'custom'],
  disabled,
  tone = 'blue',
}: {
  value: TimeRangeSelection;
  onChange: (value: TimeRangeSelection) => void;
  presets?: TimeRangePreset[];
  disabled?: boolean;
  tone?: 'blue' | 'violet';
}) {
  const fallback = createTimeRange('30d');
  const [customFrom, setCustomFrom] = useState(toLocalInput(value.fromMs ?? fallback.fromMs));
  const [customTo, setCustomTo] = useState(toLocalInput(value.toMs ?? fallback.toMs));
  const [error, setError] = useState('');

  useEffect(() => {
    if (value.fromMs != null) setCustomFrom(toLocalInput(value.fromMs));
    if (value.toMs != null) setCustomTo(toLocalInput(value.toMs));
  }, [value.fromMs, value.toMs]);

  const selectPreset = (preset: TimeRangePreset) => {
    setError('');
    if (preset === 'custom') {
      onChange({
        preset,
        fromMs: Date.parse(customFrom),
        toMs: Date.parse(customTo),
        bucket: 'day',
      });
      return;
    }
    onChange(createTimeRange(preset));
  };

  const applyCustom = () => {
    const fromMs = Date.parse(customFrom);
    const toMs = Date.parse(customTo);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
      setError('请选择完整的开始和结束时间');
      return;
    }
    if (fromMs > toMs) {
      setError('开始时间不能晚于结束时间');
      return;
    }
    setError('');
    const days = (toMs - fromMs) / 86_400_000;
    onChange({ preset: 'custom', fromMs, toMs, bucket: days > 120 ? 'month' : days > 45 ? 'week' : 'day' });
  };

  const activeClass = tone === 'violet' ? 'bg-violet-600 text-white' : 'bg-blue-600 text-white';
  const applyClass = tone === 'violet' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-blue-600 hover:bg-blue-700';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            onClick={() => selectPreset(preset)}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
              value.preset === preset ? activeClass : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700',
            )}
          >
            {LABELS[preset]}
          </button>
        ))}
      </div>
      {value.preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <input type="datetime-local" aria-label="开始时间" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700" />
          <span className="text-xs text-slate-400">至</span>
          <input type="datetime-local" aria-label="结束时间" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700" />
          <button type="button" disabled={disabled} onClick={applyCustom} className={cn('h-9 rounded-lg px-3 text-xs font-medium text-white disabled:opacity-50', applyClass)}>应用</button>
          {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
      )}
    </div>
  );
}

function toLocalInput(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return '';
  const date = new Date(ms);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
