'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Trash2,
  RefreshCw,
  Play,
  ExternalLink,
  AlertTriangle,
  Download,
  Loader2,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { ShotCard, ShotCardData } from '@/components/shot-card';
import { QueryState } from '@/components/query-state';
import { formatDate, cn } from '@/lib/utils';
import { exportMvProject } from '@/lib/mv-import-export';

interface MvProjectDetail {
  project: {
    id: string;
    title: string;
    userId: string;
    musicUrl: string;
    musicFilename: string;
    musicDuration: number;
    styleTag: string;
    mvType: string;
    aspectRatio: string;
    videoProvider: string;
    resolution: string;
    status: string;
    currentStep: number;
    resultUrl: string | null;
    resultName: string | null;
    errorMessage: string | null;
    enableLipsync: boolean;
    compositionHistory: Array<{ url: string; createdAt: string; name?: string }> | null;
    /** 非 null 表示该项目来自 admin 跨环境导入，记录上一跳来源 */
    importSource: {
      sourceProjectId: string;
      sourceUserEmail: string | null;
      sourceUserDisplayName: string | null;
      originalCreatedAt: string;
      importedAt: string;
    } | null;
    createdAt: string;
    updatedAt: string;
  };
  user: {
    id: string;
    email: string | null;
    displayName: string;
    avatarUrl: string | null;
    role: string;
  } | null;
  shots: Array<{
    id: string;
    projectId: string;
    shotIndex: number;
    shotType: string;
    genType: string;
    status: string;
    storyboardImageUrl: string | null;
    videoUrl: string | null;
    lipsyncVideoUrl: string | null;
    failureReason: string | null;
    label: string | null;
  }>;
  planning: Array<{
    id: string;
    step: number;
    status: string;
    llmModel: string | null;
    retryCount: number;
    errorMessage: string | null;
    startedAt: string | null;
    completedAt: string | null;
    updatedAt: string;
  }>;
  assets: Array<{
    id: string;
    assetType: string;
    url: string;
    createdAt: string;
  }>;
}

const STEP_LABELS: Record<number, string> = {
  1: '分析输入',
  2: '音乐分析',
  3: '视觉风格',
  4: '创意简报',
  5: '参考图',
  6: '场景规划',
  7: '镜头规划',
  8: '故事板',
  9: '视频片段',
  10: '最终合成',
};

type TabKey = 'overview' | 'shots' | 'planning' | 'history';

export default function AdminMvProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('overview');
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery<MvProjectDetail>({
    queryKey: ['admin', 'mv', 'project', id],
    queryFn: () => apiClient.get(`/admin/mv/projects/${id}`) as any,
    refetchInterval: 15_000,
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete(`/admin/mv/projects/${id}`) as any,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'mv', 'projects'] });
      router.push('/admin/mv/projects');
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => apiClient.post(`/admin/mv/projects/${id}/reset-stuck`) as any,
    onSuccess: () => refetch(),
  });

  const retryShotMutation = useMutation({
    mutationFn: ({ shotId, force }: { shotId: string; force?: boolean }) =>
      apiClient.post(`/admin/mv/shots/${id}/${shotId}/retry-video`, { force }) as any,
    onSuccess: () => refetch(),
  });

  const resetShotMutation = useMutation({
    mutationFn: ({ shotId }: { shotId: string }) =>
      apiClient.post(`/admin/mv/shots/${id}/${shotId}/reset`) as any,
    onSuccess: () => refetch(),
  });

  const handleDelete = () => {
    if (!data) return;
    if (
      window.confirm(
        `确认删除项目「${data.project.title || data.project.id}」吗？\n仅删除 DB 记录，COS 文件保留。`,
      )
    ) {
      deleteMutation.mutate();
    }
  };

  /** 导出当前项目 JSON：列表页和详情页共用 utility，下载文件名由 utility 决定 */
  const handleExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      await exportMvProject(data.project.id, data.project.title);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`导出失败：${msg}`);
    } finally {
      setExporting(false);
    }
  };

  const project = data?.project;
  const shots = data?.shots ?? [];
  const planning = data?.planning ?? [];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/mv/projects"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            返回项目列表
          </Link>
          {project && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                title="导出项目 JSON（含全部 shots/planning/assets）"
              >
                {exporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                导出 JSON
              </button>
              <button
                onClick={() => resetMutation.mutate()}
                disabled={resetMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  className={cn('h-3.5 w-3.5', resetMutation.isPending && 'animate-spin')}
                />
                重置卡死镜头
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除项目
              </button>
            </div>
          )}
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!project}
          height="h-96"
        >
          {project && (
            <>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-lg font-bold text-slate-900 truncate">
                      {project.title || '(未命名)'}
                    </h1>
                    <p className="text-xs text-slate-400 mt-0.5">{project.id}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={project.status} kind="mvProject" />
                    <span className="text-xs text-slate-400">
                      Step {project.currentStep}/10
                    </span>
                  </div>
                </div>

                {project.importSource && (
                  <div className="flex items-start gap-2 p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-700">
                    <Download className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-medium">该项目从其它环境导入，与本地真实数据区分</p>
                      <p className="text-purple-600/80">
                        源用户：{project.importSource.sourceUserDisplayName ?? '—'}
                        {project.importSource.sourceUserEmail && (
                          <span> ({project.importSource.sourceUserEmail})</span>
                        )}
                      </p>
                      <p className="text-purple-600/80 break-all">
                        源项目 ID：{project.importSource.sourceProjectId}
                      </p>
                      <p className="text-purple-600/80">
                        原创建：{formatDate(project.importSource.originalCreatedAt)}
                        <span className="mx-1.5 text-purple-300">·</span>
                        导入于：{formatDate(project.importSource.importedAt)}
                      </p>
                    </div>
                  </div>
                )}

                {project.errorMessage && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <p className="break-all">{project.errorMessage}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <Meta label="所属用户">
                    {data?.user ? (
                      <span className="text-slate-700">
                        {data.user.displayName}
                        {data.user.email && (
                          <span className="text-slate-400"> · {data.user.email}</span>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </Meta>
                  <Meta label="风格">{project.styleTag || '—'}</Meta>
                  <Meta label="MV 类型">{project.mvType}</Meta>
                  <Meta label="画幅 / 分辨率">
                    {project.aspectRatio} · {project.resolution}
                  </Meta>
                  <Meta label="视频模型">{project.videoProvider}</Meta>
                  <Meta label="口型同步">{project.enableLipsync ? '已开启' : '已关闭'}</Meta>
                  <Meta label="音乐时长">{project.musicDuration.toFixed(1)}s</Meta>
                  <Meta label="创建时间">{formatDate(project.createdAt)}</Meta>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl">
                <div className="flex border-b border-slate-100 px-4">
                  {(
                    [
                      ['overview', '概览'],
                      ['shots', `镜头 (${shots.length})`],
                      ['planning', `规划步骤 (${planning.length})`],
                      ['history', `成片历史 (${(project.compositionHistory?.length ?? 0) + (project.resultUrl ? 1 : 0)})`],
                    ] as [TabKey, string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={cn(
                        'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                        tab === key
                          ? 'text-purple-600 border-purple-600'
                          : 'text-slate-500 border-transparent hover:text-slate-800',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  {tab === 'overview' && <OverviewTab project={project} />}
                  {tab === 'shots' && (
                    <ShotsTab
                      shots={shots}
                      onRetry={(shotId, force) => retryShotMutation.mutate({ shotId, force })}
                      onReset={(shotId) => resetShotMutation.mutate({ shotId })}
                      isMutating={retryShotMutation.isPending || resetShotMutation.isPending}
                    />
                  )}
                  {tab === 'planning' && <PlanningTab planning={planning} />}
                  {tab === 'history' && (
                    <HistoryTab
                      resultUrl={project.resultUrl}
                      resultName={project.resultName}
                      history={project.compositionHistory ?? []}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </QueryState>
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
      <div className="text-slate-700 font-medium">{children}</div>
    </div>
  );
}

function OverviewTab({ project }: { project: MvProjectDetail['project'] }) {
  return (
    <div className="space-y-4">
      {project.resultUrl && (
        <div>
          <p className="text-xs text-slate-500 mb-2">最新成片</p>
          <video
            src={project.resultUrl}
            controls
            className="w-full max-w-xl rounded-xl bg-black"
          />
        </div>
      )}
      <div>
        <p className="text-xs text-slate-500 mb-2">原始音乐</p>
        <audio src={project.musicUrl} controls className="w-full max-w-xl" />
        <p className="text-xs text-slate-400 mt-1 truncate">{project.musicFilename}</p>
      </div>
    </div>
  );
}

function ShotsTab({
  shots,
  onRetry,
  onReset,
  isMutating,
}: {
  shots: MvProjectDetail['shots'];
  onRetry: (shotId: string, force?: boolean) => void;
  onReset: (shotId: string) => void;
  isMutating: boolean;
}) {
  if (shots.length === 0) {
    return (
      <p className="text-sm text-slate-400 py-6 text-center">尚未生成镜头</p>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {shots.map((shot) => (
        <ShotCard
          key={shot.id}
          shot={shot as ShotCardData}
          actions={
            <>
              <button
                onClick={() => onRetry(shot.id, false)}
                disabled={isMutating}
                className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40"
              >
                重试
              </button>
              <button
                onClick={() => onRetry(shot.id, true)}
                disabled={isMutating}
                className="text-[11px] px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 disabled:opacity-40"
              >
                强制重生
              </button>
              <button
                onClick={() => onReset(shot.id)}
                disabled={isMutating}
                className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 disabled:opacity-40"
              >
                重置状态
              </button>
            </>
          }
        />
      ))}
    </div>
  );
}

function PlanningTab({ planning }: { planning: MvProjectDetail['planning'] }) {
  if (planning.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">尚无规划记录</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500">
          <tr className="border-b border-slate-100">
            <th className="px-3 py-2 text-left">Step</th>
            <th className="px-3 py-2 text-left">状态</th>
            <th className="px-3 py-2 text-left">LLM</th>
            <th className="px-3 py-2 text-right">重试</th>
            <th className="px-3 py-2 text-left">完成时间</th>
            <th className="px-3 py-2 text-left">错误</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {planning.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-3 py-2">
                <span className="font-mono text-xs text-slate-700">{p.step}</span>
                <span className="text-slate-400 text-xs ml-1">
                  {STEP_LABELS[p.step] ?? ''}
                </span>
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={p.status} kind="generic" />
              </td>
              <td className="px-3 py-2 text-xs text-slate-500">{p.llmModel || '—'}</td>
              <td className="px-3 py-2 text-right text-xs text-slate-500">{p.retryCount}</td>
              <td className="px-3 py-2 text-xs text-slate-500">
                {p.completedAt ? formatDate(p.completedAt) : '—'}
              </td>
              <td className="px-3 py-2 text-xs text-red-500 max-w-xs truncate">
                {p.errorMessage || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTab({
  resultUrl,
  resultName,
  history,
}: {
  resultUrl: string | null;
  resultName: string | null;
  history: Array<{ url: string; createdAt: string; name?: string }>;
}) {
  const items: Array<{ url: string; createdAt: string; name?: string; current?: boolean }> = [];
  if (resultUrl) {
    items.push({
      url: resultUrl,
      createdAt: new Date().toISOString(),
      name: resultName ?? undefined,
      current: true,
    });
  }
  items.push(...history.slice().reverse());

  if (items.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">尚未合成成片</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((item, idx) => (
        <div
          key={item.url + idx}
          className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50"
        >
          <div className="aspect-video bg-black">
            <video
              src={item.url}
              controls
              poster={undefined}
              className="w-full h-full"
              preload="metadata"
            />
          </div>
          <div className="p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">
                {item.name || (item.current ? '最新版本' : `历史版本 ${formatDate(item.createdAt)}`)}
                {item.current && (
                  <span className="ml-2 text-[10px] text-purple-600 font-semibold uppercase">
                    current
                  </span>
                )}
              </p>
              {!item.current && (
                <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(item.createdAt)}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-md text-slate-500 hover:bg-white"
                title="新窗口打开"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href={item.url}
                download
                className="p-1.5 rounded-md text-slate-500 hover:bg-white"
                title="下载"
              >
                <Play className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
