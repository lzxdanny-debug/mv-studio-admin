'use client';

import { cn } from '@/lib/utils';

/**
 * 与 mv-studio-web `gallery/page.tsx` 中的 STATUS_LABELS 对齐，
 * 让用户在前后两端看到的状态色一致。
 */
const MV_PROJECT_STATUS: Record<
  string,
  { label: string; className: string }
> = {
  pending: { label: '待开始', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  planning: { label: '规划中', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  reviewing: { label: '等待确认', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  generating: { label: '生成中', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  composing: { label: '合成中', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  done: { label: '已完成', className: 'bg-green-50 text-green-700 border-green-200' },
  failed: { label: '失败', className: 'bg-red-50 text-red-700 border-red-200' },
};

const SHOT_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: '待生成', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  generating_storyboard: {
    label: '故事板生成中',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  storyboard_ready: {
    label: '故事板就绪',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  generating_video: {
    label: '视频生成中',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  video_ready: {
    label: '视频就绪',
    className: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  completed: { label: '已完成', className: 'bg-green-50 text-green-700 border-green-200' },
  failed: { label: '失败', className: 'bg-red-50 text-red-700 border-red-200' },
};

const GENERIC: Record<string, { label: string; className: string }> = {
  pending: { label: '待处理', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  processing: { label: '处理中', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  running: { label: '运行中', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  completed: { label: '完成', className: 'bg-green-50 text-green-700 border-green-200' },
  done: { label: '已完成', className: 'bg-green-50 text-green-700 border-green-200' },
  instrumental: { label: '纯音乐', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  succeeded: { label: '成功', className: 'bg-green-50 text-green-700 border-green-200' },
  failed: { label: '失败', className: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: '已取消', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

/** Karaoke 项目状态：draft→queued→preparing→generating→composing→done，任意运行态可 failed/cancelling→cancelled */
const KARAOKE_PROJECT_STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  queued: { label: '排队中', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  preparing: { label: '准备中', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  generating: { label: '生成中', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  composing: { label: '合成中', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  done: { label: '已完成', className: 'bg-green-50 text-green-700 border-green-200' },
  failed: { label: '失败', className: 'bg-red-50 text-red-700 border-red-200' },
  cancelling: { label: '取消中', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  cancelled: { label: '已取消', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

/** Karaoke 片段状态：pending→preparing_audio→generating→extracting_frame→validating→completed */
const KARAOKE_SEGMENT_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: '待生成', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  preparing_audio: { label: '音频准备中', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  generating: { label: '生成中', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  extracting_frame: { label: '抽帧中', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  validating: { label: '质检中', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  completed: { label: '已完成', className: 'bg-green-50 text-green-700 border-green-200' },
  failed: { label: '失败', className: 'bg-red-50 text-red-700 border-red-200' },
};

const REGISTRY = {
  mvProject: MV_PROJECT_STATUS,
  shot: SHOT_STATUS,
  karaokeProject: KARAOKE_PROJECT_STATUS,
  karaokeSegment: KARAOKE_SEGMENT_STATUS,
  generic: GENERIC,
} as const;

export type StatusKind = keyof typeof REGISTRY;

interface StatusBadgeProps {
  status: string | null | undefined;
  kind?: StatusKind;
  className?: string;
}

export function StatusBadge({ status, kind = 'generic', className }: StatusBadgeProps) {
  const key = (status || 'pending').toLowerCase();
  const meta =
    REGISTRY[kind][key] ||
    REGISTRY.generic[key] || {
      label: key,
      className: 'bg-slate-100 text-slate-500 border-slate-200',
    };
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border whitespace-nowrap',
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
