'use client';

import { useEffect, useState } from 'react';
import { TimeRangePreset, TIME_RANGE_LABELS } from '../_lib/types';

/**
 * 时间窗口 / provider / step 过滤器条。
 * 父组件给"已经计算好的 fromMs/toMs"，本组件负责管理 preset 切换 + 自定义日期编辑。
 *
 * preset 切换 → 立刻把 from/to 对应的 ISO 推回给父组件
 * 自定义模式 → 仍然给 datetime-local 编辑（精度到分钟）
 */
interface RangeFilterProps {
  preset: TimeRangePreset;
  fromMs: number;
  toMs: number;
  provider: string | null;
  step: string | null;
  loading?: boolean;
  onChange: (next: {
    preset: TimeRangePreset;
    fromMs: number;
    toMs: number;
    provider: string | null;
    step: string | null;
  }) => void;
}

const PRESET_OPTIONS: TimeRangePreset[] = ['today', '24h', '7d', '30d', 'custom'];
const PROVIDER_OPTIONS: Array<{ value: string | null; label: string }> = [
  { value: null, label: '全部渠道' },
  { value: 'mountsea', label: 'Mountsea' },
  { value: 'fal', label: 'Fal.ai' },
  { value: 'cloudflare', label: 'Cloudflare' },
];
const STEP_OPTIONS: Array<{ value: string | null; label: string }> = [
  { value: null, label: '全部步骤' },
  { value: 'lrc_transcribe', label: 'LRC 转写' },
  { value: 'music_analyze', label: '音乐分析' },
  { value: 'storyboard_image', label: '故事板图' },
  { value: 'video_gen', label: '镜头视频' },
  { value: 'lipsync_post', label: '口型同步' },
];

export function RangeFilter({
  preset,
  fromMs,
  toMs,
  provider,
  step,
  loading,
  onChange,
}: RangeFilterProps) {
  // 自定义模式下用 local state，避免每次 keyDown 都触发查询
  const [customFrom, setCustomFrom] = useState(toLocalInput(fromMs));
  const [customTo, setCustomTo] = useState(toLocalInput(toMs));

  // 父级 fromMs/toMs 更新（如切换 preset）时同步 input 显示值
  useEffect(() => {
    setCustomFrom(toLocalInput(fromMs));
    setCustomTo(toLocalInput(toMs));
  }, [fromMs, toMs]);

  const handlePresetClick = (p: TimeRangePreset) => {
    if (p === 'custom') {
      onChange({ preset: p, fromMs, toMs, provider, step });
      return;
    }
    const range = computeRangeFromPreset(p);
    onChange({ preset: p, fromMs: range.fromMs, toMs: range.toMs, provider, step });
  };

  const handleCustomApply = () => {
    const f = Date.parse(customFrom);
    const t = Date.parse(customTo);
    if (!Number.isFinite(f) || !Number.isFinite(t)) return;
    onChange({
      preset: 'custom',
      fromMs: Math.min(f, t),
      toMs: Math.max(f, t),
      provider,
      step,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2 shadow-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-slate-400 font-medium px-1">时间</span>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {PRESET_OPTIONS.map((p) => (
            <button
              key={p}
              onClick={() => handlePresetClick(p)}
              disabled={loading}
              className={
                preset === p
                  ? 'px-2.5 py-1 rounded-md text-xs font-medium bg-white text-slate-900 shadow-sm'
                  : 'px-2.5 py-1 rounded-md text-xs font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50'
              }
            >
              {TIME_RANGE_LABELS[p]}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        <span className="text-[11px] text-slate-400 font-medium px-1">渠道</span>
        <select
          value={provider ?? ''}
          onChange={(e) =>
            onChange({
              preset,
              fromMs,
              toMs,
              provider: e.target.value || null,
              step,
            })
          }
          disabled={loading}
          className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:border-purple-400 disabled:opacity-50"
        >
          {PROVIDER_OPTIONS.map((o) => (
            <option key={o.value ?? 'all'} value={o.value ?? ''}>
              {o.label}
            </option>
          ))}
        </select>

        <span className="text-[11px] text-slate-400 font-medium px-1">步骤</span>
        <select
          value={step ?? ''}
          onChange={(e) =>
            onChange({
              preset,
              fromMs,
              toMs,
              provider,
              step: e.target.value || null,
            })
          }
          disabled={loading}
          className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:border-purple-400 disabled:opacity-50"
        >
          {STEP_OPTIONS.map((o) => (
            <option key={o.value ?? 'all'} value={o.value ?? ''}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          <span className="text-[11px] text-slate-400 px-1">自定义区间</span>
          <input
            type="datetime-local"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:border-purple-400"
          />
          <span className="text-xs text-slate-400">→</span>
          <input
            type="datetime-local"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:border-purple-400"
          />
          <button
            onClick={handleCustomApply}
            disabled={loading}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
          >
            应用
          </button>
        </div>
      )}
    </div>
  );
}

function computeRangeFromPreset(preset: TimeRangePreset): {
  fromMs: number;
  toMs: number;
} {
  const now = Date.now();
  switch (preset) {
    case 'today': {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return { fromMs: d.getTime(), toMs: now };
    }
    case '24h':
      return { fromMs: now - 24 * 3600 * 1000, toMs: now };
    case '7d':
      return { fromMs: now - 7 * 24 * 3600 * 1000, toMs: now };
    case '30d':
      return { fromMs: now - 30 * 24 * 3600 * 1000, toMs: now };
    case 'custom':
    default:
      return { fromMs: now - 24 * 3600 * 1000, toMs: now };
  }
}

/** epoch ms → datetime-local input value (本地时区，YYYY-MM-DDTHH:MM) */
function toLocalInput(ms: number): string {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export { computeRangeFromPreset };
