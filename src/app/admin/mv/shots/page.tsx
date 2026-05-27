'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clapperboard, ExternalLink } from 'lucide-react';
import apiClient from '@/lib/api';
import { ShotCard, ShotCardData } from '@/components/shot-card';
import { QueryState } from '@/components/query-state';
import { cn } from '@/lib/utils';

interface ShotRow extends ShotCardData {
  projectId: string;
  projectTitle: string | null;
  userDisplayName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  items: ShotRow[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '待生成', value: 'pending' },
  { label: '故事板生成中', value: 'generating_storyboard' },
  { label: '视频生成中', value: 'generating_video' },
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' },
];

const GEN_TYPE_OPTIONS = [
  { label: '全部生成方式', value: '' },
  { label: 'I2V (图生视频)', value: 'i2v' },
  { label: '首尾帧', value: 'start_end' },
  { label: '文生视频', value: 'text2video' },
];

export default function AdminMvShotsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [genType, setGenType] = useState('');
  const [onlyFailed, setOnlyFailed] = useState(false);

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'mv', 'shots', { page, status, genType, onlyFailed }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '24');
      if (status) params.set('status', status);
      if (genType) params.set('genType', genType);
      if (onlyFailed) params.set('onlyFailed', 'true');
      return apiClient.get(`/admin/mv/shots?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
    refetchInterval: 20_000,
  });

  const retry = useMutation({
    mutationFn: ({ projectId, shotId, force }: { projectId: string; shotId: string; force?: boolean }) =>
      apiClient.post(`/admin/mv/shots/${projectId}/${shotId}/retry-video`, { force }) as any,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'mv', 'shots'] }),
  });

  const reset = useMutation({
    mutationFn: ({ projectId, shotId }: { projectId: string; shotId: string }) =>
      apiClient.post(`/admin/mv/shots/${projectId}/${shotId}/reset`) as any,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'mv', 'shots'] }),
  });

  const isMutating = retry.isPending || reset.isPending;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Clapperboard className="h-5 w-5 text-purple-600" />
            镜头运维
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            跨项目镜头清单，共 {data?.total ?? 0} 个镜头
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setPage(1);
                  setStatus(opt.value);
                }}
                className={
                  status === opt.value
                    ? 'px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-600 text-white'
                    : 'px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100'
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select
            value={genType}
            onChange={(e) => {
              setPage(1);
              setGenType(e.target.value);
            }}
            className="px-3 py-2 rounded-xl text-sm bg-white border border-slate-200 text-slate-700"
          >
            {GEN_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-white border border-slate-200 text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyFailed}
              onChange={(e) => {
                setPage(1);
                setOnlyFailed(e.target.checked);
              }}
              className="accent-purple-600"
            />
            仅显示失败
          </label>
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!data?.items.length}
          emptyMessage="暂无镜头记录"
          height="h-64"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data?.items.map((shot) => (
              <ShotCard
                key={shot.id}
                shot={shot}
                showProject
                actions={
                  <div className="flex flex-wrap items-center gap-1.5 w-full">
                    <button
                      onClick={() =>
                        retry.mutate({ projectId: shot.projectId, shotId: shot.id, force: false })
                      }
                      disabled={isMutating}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40"
                    >
                      重试
                    </button>
                    <button
                      onClick={() =>
                        retry.mutate({ projectId: shot.projectId, shotId: shot.id, force: true })
                      }
                      disabled={isMutating}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 disabled:opacity-40"
                    >
                      强制重生
                    </button>
                    <button
                      onClick={() => reset.mutate({ projectId: shot.projectId, shotId: shot.id })}
                      disabled={isMutating}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 disabled:opacity-40"
                    >
                      重置
                    </button>
                    <Link
                      href={`/admin/mv/projects/${shot.projectId}`}
                      className="text-[11px] ml-auto inline-flex items-center gap-0.5 text-slate-400 hover:text-purple-600"
                      title="打开所属项目"
                    >
                      项目
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                }
              />
            ))}
          </div>
        </QueryState>

        {data && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600',
                page <= 1 && 'opacity-40 cursor-not-allowed',
              )}
            >
              上一页
            </button>
            <span className="text-xs text-slate-500">
              第 {page} / {totalPages} 页
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600',
                page >= totalPages && 'opacity-40 cursor-not-allowed',
              )}
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
