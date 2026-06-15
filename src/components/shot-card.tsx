'use client';

import { Film, Play } from 'lucide-react';
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

export function ShotCard({ shot, onClick, showProject, actions, className }: ShotCardProps) {
  const preview = shot.videoUrl || shot.lipsyncVideoUrl;
  const poster = shot.storyboardImageUrl;
  return (
    <div
      className={cn(
        'group bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col',
        onClick && 'cursor-pointer hover:border-teal-300 hover:shadow-sm transition-all',
        className,
      )}
      onClick={onClick ? () => onClick(shot) : undefined}
    >
      <div className="aspect-video bg-slate-100 relative overflow-hidden">
        {preview ? (
          <video
            src={preview}
            poster={poster ?? undefined}
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
            onMouseEnter={(e) => {
              const v = e.currentTarget;
              v.play().catch(() => {});
            }}
            onMouseLeave={(e) => {
              const v = e.currentTarget;
              v.pause();
              v.currentTime = 0;
            }}
          />
        ) : poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="storyboard" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Film className="h-8 w-8" />
          </div>
        )}
        {preview && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
            <Play className="h-8 w-8 text-white drop-shadow" />
          </div>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col gap-1.5">
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
        {actions && <div className="mt-1 flex items-center gap-1.5">{actions}</div>}
      </div>
    </div>
  );
}
