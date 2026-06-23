'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Globe, Flame, Star, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';

interface OperationsTabProps {
  projectId: string;
  isPublic: boolean;
  adminTags: string[] | null | undefined;
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200">
          <Icon className="h-4 w-4 text-slate-600" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-teal-600' : 'bg-slate-300',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

export function OperationsTab({ projectId, isPublic, adminTags }: OperationsTabProps) {
  const qc = useQueryClient();
  const tags = adminTags ?? [];
  const isHot = tags.includes('热门');
  const isRecommended = tags.includes('推荐');

  const mutation = useMutation({
    mutationFn: (payload: { isPublic?: boolean; hot?: boolean; recommended?: boolean }) =>
      apiClient.patch(`/admin/mv/projects/${projectId}/operations`, payload) as Promise<{
        isPublic: boolean;
        adminTags: string[];
      }>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'mv', 'project', projectId] });
      qc.invalidateQueries({ queryKey: ['admin', 'mv', 'projects'] });
    },
  });

  const pending = mutation.isPending;

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">运营设置</h3>
        <p className="mt-1 text-xs text-slate-500">
          控制该 MV 是否在公开作品墙展示，以及前台卡片上的运营标签。
        </p>
      </div>

      {pending && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          保存中…
        </div>
      )}

      <div className="space-y-3">
        <ToggleRow
          icon={Globe}
          label="公开"
          description="开启后会在首页公开作品墙与用户公开画廊中展示（需已完成且有成片）"
          checked={isPublic}
          disabled={pending}
          onChange={(v) => mutation.mutate({ isPublic: v })}
        />
        <ToggleRow
          icon={Flame}
          label="热门"
          description="在前台卡片上显示「热门」标签"
          checked={isHot}
          disabled={pending}
          onChange={(v) => mutation.mutate({ hot: v })}
        />
        <ToggleRow
          icon={Star}
          label="推荐"
          description="在前台卡片上显示「推荐」标签"
          checked={isRecommended}
          disabled={pending}
          onChange={(v) => mutation.mutate({ recommended: v })}
        />
      </div>

      {tags.length > 0 && (
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
          <p className="text-xs font-medium text-slate-500">当前运营标签</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-400">
            其他标签（精选、新品等）可在项目列表页的「运营标签」列设置。
          </p>
        </div>
      )}
    </div>
  );
}
