'use client';

import { useState } from 'react';
import { Check, Copy, Film, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from './status-badge';

export interface ShotCardData {
  id: string;
  shotIndex?: number | null;
  shotType?: string | null;
  genType?: string | null;
  status: string;
  storyboardImageUrl?: string | null;
  videoUrl?: string | null;
  lipsyncVideoUrl?: string | null;
  failureReason?: string | null;
  projectId?: string;
  projectTitle?: string | null;
}

interface ShotCardProps {
  shot: ShotCardData;
  onClick?: (shot: ShotCardData) => void;
  showProject?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

function CopyUrlButton({
  url,
  title = '复制链接',
}: {
  url: string;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.alert('复制失败，请手动选择复制');
    }
  };

  return (
    <button
      type="button"
      onClick={(e) => void handleCopy(e)}
      className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition shrink-0"
      title={copied ? '已复制' : title}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-600" />
          <span className="text-emerald-600">已复制</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>复制</span>
        </>
      )}
    </button>
  );
}

function MediaPanel({
  label,
  url,
  kind,
}: {
  label: string;
  url: string | null | undefined;
  kind: 'storyboard' | 'video';
}) {
  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between gap-1 mb-1 px-0.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
        {url ? <CopyUrlButton url={url} title={`复制${label}链接`} /> : null}
      </div>
      <div className="aspect-video bg-slate-100 relative overflow-hidden rounded-md border border-slate-200/80">
        {!url ? (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Film className="h-6 w-6" />
          </div>
        ) : kind === 'storyboard' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="w-full h-full object-cover" />
        ) : (
          <video
            src={url}
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
            onMouseEnter={(e) => {
              e.stopPropagation();
              const v = e.currentTarget;
              v.play().catch(() => {});
            }}
            onMouseLeave={(e) => {
              const v = e.currentTarget;
              v.pause();
              v.currentTime = 0;
            }}
          />
        )}
        {url && kind === 'video' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
            <Play className="h-6 w-6 text-white drop-shadow" />
          </div>
        )}
      </div>
    </div>
  );
}

export function ShotCard({ shot, onClick, showProject, actions, className }: ShotCardProps) {
  const videoUrl = shot.videoUrl || shot.lipsyncVideoUrl;

  return (
    <div
      className={cn(
        'group bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col',
        onClick && 'cursor-pointer hover:border-teal-300 hover:shadow-sm transition-all',
        className,
      )}
      onClick={onClick ? () => onClick(shot) : undefined}
    >
      <div className="p-2 grid grid-cols-2 gap-2">
        <MediaPanel label="故事板" url={shot.storyboardImageUrl} kind="storyboard" />
        <MediaPanel label="视频" url={videoUrl} kind="video" />
      </div>

      <div className="p-3 pt-1 flex-1 flex flex-col gap-1.5 border-t border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-800 truncate">
            #{shot.shotIndex ?? '—'} · {shot.shotType ?? '—'}
          </p>
          <StatusBadge status={shot.status} kind="shot" />
        </div>
        {showProject && shot.projectTitle && (
          <p className="text-xs text-slate-400 truncate" title={shot.projectTitle}>
            {shot.projectTitle}
          </p>
        )}
        {shot.genType && (
          <p className="text-[10px] uppercase tracking-wider text-slate-400">{shot.genType}</p>
        )}
        {shot.failureReason && (
          <p className="text-[11px] text-red-500 line-clamp-2" title={shot.failureReason}>
            {shot.failureReason}
          </p>
        )}
        {actions && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
