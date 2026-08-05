'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PersonStanding } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { DataTable, DataTableColumn } from '@/components/data-table';
import { SearchBar } from '@/components/search-bar';
import { formatDate, cn } from '@/lib/utils';

interface DanceProjectRow {
  id: string;
  userId: string;
  title: string;
  status: string;
  stage: string;
  progressPercent: number;
  musicDuration: number;
  aspectRatio: string;
  resolution: string;
  quality: string;
  creditsCost: number;
  sectionCount: number;
  clipCount: number;
  errorCode: string | null;
  createdAt: string;
}

interface ListResponse {
  items: DanceProjectRow[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_OPTIONS = [
  ['', '全部状态'],
  ['draft', '草稿'],
  ['queued', '排队中'],
  ['running', '生成中'],
  ['waiting_user', '等待确认'],
  ['composing', '合成中'],
  ['completed', '已完成'],
  ['failed', '失败'],
  ['cancelled', '已取消'],
] as const;

const STAGE_LABEL: Record<string, string> = {
  input: '素材',
  character_analysis: '角色分析',
  music_analysis: '音乐分析',
  visual_direction: '视觉方向',
  master_choreography: '总编舞',
  reference_images: '参考图',
  section_plan: '段落编排',
  camera_plan: '镜头设计',
  storyboards: '分镜',
  clips: '片段生成',
  quality_review: '质检',
  compose: '合成',
  complete: '完成',
};

const STATUS_CLASS: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-600',
  failed: 'bg-red-50 text-red-600',
  running: 'bg-blue-50 text-blue-600',
  composing: 'bg-blue-50 text-blue-600',
  queued: 'bg-slate-100 text-slate-500',
  waiting_user: 'bg-amber-50 text-amber-600',
  cancelled: 'bg-slate-100 text-slate-400',
  cancelling: 'bg-amber-50 text-amber-600',
  draft: 'bg-slate-100 text-slate-500',
};

export default function AdminDanceProjectsPage() {
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'dance', 'projects', { page, pageSize, status, search }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (status) params.set('status', status);
      // 后端 Phase 0 只支持按 userId 精确过滤，搜索框用于填 userId
      if (search) params.set('userId', search);
      return apiClient.get(`/admin/dance/projects?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
    refetchInterval: 15_000,
  });

  const columns: DataTableColumn<DanceProjectRow>[] = [
    {
      key: 'title',
      header: '项目',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-700">{r.title || '未命名'}</p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-400">{r.id}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      width: 'w-28',
      render: (r) => (
        <div>
          <span
            className={cn(
              'inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium',
              STATUS_CLASS[r.status] ?? 'bg-slate-100 text-slate-500',
            )}
          >
            {STATUS_OPTIONS.find(([v]) => v === r.status)?.[1] ?? r.status}
          </span>
          <p className="mt-0.5 text-[11px] text-slate-400">{r.progressPercent}%</p>
        </div>
      ),
    },
    {
      key: 'stage',
      header: '阶段',
      width: 'w-24',
      render: (r) => <span className="text-xs text-slate-500">{STAGE_LABEL[r.stage] ?? r.stage}</span>,
    },
    {
      key: 'structure',
      header: '段落 / 片段',
      width: 'w-28',
      align: 'right',
      render: (r) => (
        <span className="text-xs text-slate-500">
          {r.sectionCount} / {r.clipCount}
        </span>
      ),
    },
    {
      key: 'output',
      header: '输出',
      width: 'w-40',
      render: (r) => (
        <span className="text-xs text-slate-500">
          {r.aspectRatio} · {r.resolution} · {Math.round(r.musicDuration)}s
        </span>
      ),
    },
    {
      key: 'creditsCost',
      header: '积分',
      width: 'w-20',
      align: 'right',
      render: (r) => <span className="text-xs text-slate-600">{r.creditsCost}</span>,
    },
    {
      key: 'createdAt',
      header: '创建时间',
      width: 'w-40',
      render: (r) => <span className="text-xs text-slate-500">{formatDate(r.createdAt)}</span>,
    },
  ];

  return (
    <div className="admin-page">
      <div className="space-y-4 p-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <PersonStanding className="h-5 w-5 text-blue-600" />
            舞蹈项目
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            舞蹈视频项目的生成阶段、结构规模与积分消耗。重试、取消与人工判定随编排能力上线后开放。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <SearchBar
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="按用户 ID 精确过滤"
            width="w-72"
          />
        </div>

        <DataTable<DanceProjectRow>
          columns={columns}
          rows={data?.items}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          isError={isError}
          error={error}
          emptyMessage="暂无舞蹈项目"
          page={data?.page ?? page}
          pageSize={data?.pageSize ?? pageSize}
          total={data?.total}
          onPageChange={setPage}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  );
}
