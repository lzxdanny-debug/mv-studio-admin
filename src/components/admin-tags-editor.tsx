'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Tag } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';

/** 与 mv-studio-api/src/shared/admin-tags.ts 保持一致 */
export const PRESET_ADMIN_TAGS = ['热门', '推荐', '精选', '新品'] as const;

const TAG_CHIP_CLASS: Record<string, string> = {
  热门: 'bg-red-100 text-red-700 ring-red-200',
  推荐: 'bg-blue-100 text-blue-700 ring-blue-200',
  精选: 'bg-amber-100 text-amber-800 ring-amber-200',
  新品: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
};

function chipClass(tag: string) {
  return TAG_CHIP_CLASS[tag] ?? 'bg-slate-100 text-slate-600 ring-slate-200';
}

export interface AdminTagsEditorProps {
  id: string;
  tags: string[] | null | undefined;
  kind: 'mv' | 'music';
  /** react-query invalidate 用的 queryKey 前缀，如 ['admin','mv','projects'] */
  invalidateQueryKey: readonly unknown[];
}

export function AdminTagsEditor({ id, tags, kind, invalidateQueryKey }: AdminTagsEditorProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(tags ?? []);
  const popoverRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    setSelected(tags ?? []);
  }, [tags]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSelected(tags ?? []);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, tags]);

  const mutation = useMutation({
    mutationFn: (newTags: string[]) => {
      const path =
        kind === 'mv'
          ? `/admin/mv/projects/${id}/admin-tags`
          : `/admin/music/tasks/${id}/admin-tags`;
      return apiClient.patch(path, { tags: newTags }) as Promise<{ adminTags: string[] }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...invalidateQueryKey] });
      setOpen(false);
    },
  });

  const toggleTag = (tag: string) => {
    setSelected((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length >= 5 ? prev : [...prev, tag],
    );
  };

  const currentTags = tags ?? [];

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="group flex min-w-[7rem] flex-col items-start gap-1 text-left"
        title="点击设置运营标签"
      >
        {currentTags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {currentTags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  'inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                  chipClass(tag),
                )}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-slate-400 group-hover:text-teal-600">
            <Tag className="h-3 w-3" />
            设置标签
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-xs font-semibold text-slate-500">运营标签（最多 5 个）</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_ADMIN_TAGS.map((tag) => {
              const active = selected.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    'rounded-lg px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
                    active ? chipClass(tag) : 'bg-slate-50 text-slate-500 ring-slate-200 hover:bg-slate-100',
                  )}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSelected(tags ?? []);
              }}
              className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(selected)}
              className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {mutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
