'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HardDrive, RefreshCw, Trash2, Server, Save } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { useConfirm, useAlert } from '@/components/ui/dialog-provider';
import { LineTabs } from '../settings/_components/line-tabs';

type StorageTab = 'worker' | 'api';

interface ClipCacheConfig {
  enabled: string;
  ttlDays: string;
  cleanOnComposeDone: string;
  skipPrecacheInWorkerMode: string;
}

interface EffectiveConfig {
  enabled: boolean;
  ttlDays: number;
  cleanOnComposeDone: boolean;
  skipPrecacheInWorkerMode: boolean;
}

interface ProjectEntry {
  projectId: string;
  title: string | null;
  status: string | null;
  hasResultUrl: boolean;
  bytes: number;
  fileCount: number;
  lastAccessAt: string | null;
}

interface WorkerInstance {
  workerId: string;
  runningJobs: number;
  capacity: number;
  version?: string;
  diskFreeBytes?: number;
  tmpUsedBytes?: number;
  tmpDirCount?: number;
  clipCacheBytes?: number;
  clipCacheProjectCount?: number;
  clipCacheFileCount?: number;
  clipCacheBase?: string;
  clipCacheProjects?: ProjectEntry[];
  tmpDir?: string;
  hostname?: string;
  lastSeenAt: string;
  online: boolean;
  pendingCommands: number;
  activeCommands?: WorkerCommand[];
}

interface WorkerCommand {
  id: string;
  workerId: string;
  type: 'cleanup_tmp';
  scope: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  result?: { freedBytes?: number; deletedDirs?: number; message?: string };
}

interface OverviewResp {
  api: {
    cacheBase: string;
    totalBytes: number;
    projectCount: number;
    fileCount: number;
    topProjects: ProjectEntry[];
  };
  config: {
    saved: ClipCacheConfig;
    effective: EffectiveConfig;
  };
  workers: WorkerInstance[];
  recentWorkerCommands: WorkerCommand[];
}

const TABS = [
  { id: 'worker' as const, label: 'Worker 存储' },
  { id: 'api' as const, label: 'API 存储' },
];

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx++;
  }
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function formatTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-CN');
}

function scopeLabel(scope: string): string {
  if (scope === 'clip_cache' || scope === 'clip_cache_all') return '清理片段缓存';
  if (scope === 'stale') return '清理过期临时目录';
  if (scope === 'all_tmp') return '清理全部临时目录';
  if (scope.startsWith('clip_cache_project:')) {
    return `清理项目缓存`;
  }
  return scope;
}

function scopesConflict(requested: string, active: string): boolean {
  if (requested === active) return true;
  const clipAll = new Set(['clip_cache', 'clip_cache_all']);
  const reqClipAll = clipAll.has(requested);
  const actClipAll = clipAll.has(active);
  const reqProject = requested.startsWith('clip_cache_project:');
  const actProject = active.startsWith('clip_cache_project:');
  if (reqClipAll && (actClipAll || actProject)) return true;
  if (actClipAll && (reqClipAll || reqProject)) return true;
  return false;
}

function findActiveConflict(
  activeCommands: WorkerCommand[] | undefined,
  workerId: string,
  scope: string,
): WorkerCommand | undefined {
  return (activeCommands ?? []).find(
    (cmd) =>
      cmd.workerId === workerId &&
      (cmd.status === 'pending' || cmd.status === 'running') &&
      scopesConflict(scope, cmd.scope),
  );
}

function commandStatusLabel(status: string): string {
  if (status === 'pending') return '等待下发';
  if (status === 'running') return '执行中';
  if (status === 'done') return '已完成';
  if (status === 'failed') return '失败';
  return status;
}

export default function AdminLocalStoragePage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const alert = useAlert();
  const [activeTab, setActiveTab] = useState<StorageTab>('worker');
  const [configDraft, setConfigDraft] = useState<ClipCacheConfig | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<OverviewResp>({
    queryKey: ['admin', 'local-storage'],
    queryFn: () => apiClient.get('/admin/system/local-storage') as Promise<OverviewResp>,
    refetchInterval: (query) => {
      const workers = query.state.data?.workers ?? [];
      const hasActive = workers.some((w) => (w.activeCommands?.length ?? w.pendingCommands) > 0);
      return hasActive ? 5_000 : 30_000;
    },
  });

  const effectiveDraft = useMemo(() => {
    if (!data) return null;
    return configDraft ?? {
      enabled: data.config.saved.enabled || String(data.config.effective.enabled),
      ttlDays: data.config.saved.ttlDays || String(data.config.effective.ttlDays),
      cleanOnComposeDone:
        data.config.saved.cleanOnComposeDone || String(data.config.effective.cleanOnComposeDone),
      skipPrecacheInWorkerMode:
        data.config.saved.skipPrecacheInWorkerMode ||
        String(data.config.effective.skipPrecacheInWorkerMode),
    };
  }, [configDraft, data]);

  const workerClipTotal = useMemo(
    () => (data?.workers ?? []).reduce((sum, w) => sum + (w.clipCacheBytes ?? 0), 0),
    [data?.workers],
  );

  const workerClipFileTotal = useMemo(
    () => (data?.workers ?? []).reduce((sum, w) => sum + (w.clipCacheFileCount ?? 0), 0),
    [data?.workers],
  );

  const saveConfig = useMutation({
    mutationFn: (payload: ClipCacheConfig) =>
      apiClient.patch('/admin/system/local-storage/config', payload),
    onSuccess: () => {
      setMsg({ ok: true, text: 'API 缓存策略已保存' });
      setConfigDraft(null);
      qc.invalidateQueries({ queryKey: ['admin', 'local-storage'] });
    },
    onError: (err: Error) => setMsg({ ok: false, text: err.message || '保存失败' }),
  });

  const cleanupApi = useMutation({
    mutationFn: (payload: { scope: 'expired' | 'all'; dryRun?: boolean }) =>
      apiClient.post('/admin/system/local-storage/api/cleanup', payload),
    onSuccess: (resp: any) => {
      const r = resp?.data ?? resp;
      setMsg({
        ok: true,
        text: `${r?.dryRun ? '预览' : '已清理'}：${r?.deletedProjects ?? 0} 个项目，释放 ${formatBytes(r?.deletedBytes ?? 0)}`,
      });
      qc.invalidateQueries({ queryKey: ['admin', 'local-storage'] });
    },
    onError: (err: Error) => setMsg({ ok: false, text: err.message || '清理失败' }),
  });

  const cleanupWorker = useMutation({
    mutationFn: (payload: { workerId?: string; scope: string }) =>
      apiClient.post('/admin/system/local-storage/workers/cleanup', payload),
    onSuccess: (resp: any) => {
      const r = resp?.data ?? resp;
      const targets = (r?.targetWorkerIds ?? []).join(', ') || '无目标 Worker';
      setMsg({
        ok: true,
        text: `清理指令已下发至 ${targets}，Worker 下次心跳时将执行，请勿重复点击。`,
      });
      qc.invalidateQueries({ queryKey: ['admin', 'local-storage'] });
    },
    onError: (err: Error) => setMsg({ ok: false, text: err.message || '下发失败' }),
  });

  const handleWorkerCleanup = async (
    workerId: string,
    scope: string,
    opts: { title: string; description: string },
    activeCommands?: WorkerCommand[],
  ) => {
    const conflict = findActiveConflict(activeCommands, workerId, scope);
    if (conflict) {
      await alert({
        title: '已有清理指令进行中',
        description: `Worker「${workerId}」的「${scopeLabel(conflict.scope)}」指令当前为${commandStatusLabel(conflict.status)}，请等待完成后再试。`,
        variant: 'warning',
      });
      return;
    }

    const ok = await confirm({
      title: opts.title,
      description: opts.description,
      variant: 'danger',
      confirmText: '确认清理',
    });
    if (!ok) return;
    cleanupWorker.mutate({ workerId, scope });
  };

  const handleApiCleanup = async (scope: 'expired' | 'all') => {
    const ok = await confirm({
      title: scope === 'all' ? '确定清理全部 API 片段缓存？' : '确定清理过期 API 片段缓存？',
      description:
        scope === 'all'
          ? '将删除 API 本机全部片段缓存，下次合成需重新下载。'
          : '将删除超过 TTL 的过期片段缓存，此操作不可撤销。',
      variant: 'danger',
      confirmText: '确认清理',
    });
    if (!ok) return;
    cleanupApi.mutate({ scope });
  };

  return (
    <div className="admin-page">
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false}>
        {data && effectiveDraft && (
          <div className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-blue-600" />
                  本地存储管理
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  以 Worker 片段缓存为主；合成后保留本地 clip，重复合成可命中缓存跳过下载。
                </p>
              </div>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-slate-50"
              >
                <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
                刷新
              </button>
            </div>

            {msg && (
              <div
                className={cn(
                  'rounded-lg px-4 py-3 text-sm',
                  msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700',
                )}
              >
                {msg.text}
              </div>
            )}

            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
              <LineTabs items={TABS} active={activeTab} onChange={setActiveTab} variant="primary" />
            </div>

            {activeTab === 'worker' && (
              <section className="bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      Worker 片段缓存
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      路径默认 <code className="font-mono">~/.mv-worker-cache/</code>，合成后不自动清除。
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-slate-500">全部 Worker 片段占用</div>
                    <div className="text-lg font-semibold mt-1">{formatBytes(workerClipTotal)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-slate-500">缓存项目 / 文件</div>
                    <div className="text-lg font-semibold mt-1">
                      {(data?.workers ?? []).reduce((sum, w) => sum + (w.clipCacheProjectCount ?? 0), 0)} 项 ·{' '}
                      {workerClipFileTotal} 文件
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-slate-500">在线 Worker</div>
                    <div className="text-lg font-semibold mt-1">
                      {data.workers.filter((w) => w.online).length}/{data.workers.length}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-slate-500">说明</div>
                    <div className="text-xs text-slate-600 mt-1">
                      数据来自 Worker 心跳（约 30s）；重启 Worker 后等待一次心跳即可看到项目明细。
                    </div>
                  </div>
                </div>

                {data.workers.length === 0 ? (
                  <p className="text-sm text-slate-500">暂无 Worker 心跳（启动 Worker 并完成一次合成后可见缓存占用）。</p>
                ) : (
                  <div className="space-y-3">
                    {data.workers.map((w) => {
                      const clipCacheConflict = findActiveConflict(w.activeCommands, w.workerId, 'clip_cache');
                      const staleConflict = findActiveConflict(w.activeCommands, w.workerId, 'stale');

                      return (
                      <div key={w.workerId} className="border rounded-xl p-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium">
                            {w.workerId}
                            <span
                              className={cn(
                                'ml-2 text-xs px-2 py-0.5 rounded-full',
                                w.online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500',
                              )}
                            >
                              {w.online ? '在线' : '离线'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={!!clipCacheConflict || cleanupWorker.isPending}
                              onClick={() =>
                                void handleWorkerCleanup(
                                  w.workerId,
                                  'clip_cache',
                                  {
                                    title: '确定清理片段缓存？',
                                    description: `将清理 Worker「${w.workerId}」上的全部片段缓存（${formatBytes(w.clipCacheBytes ?? 0)}），下次合成需重新下载。`,
                                  },
                                  w.activeCommands,
                                )
                              }
                              className={cn(
                                'inline-flex items-center gap-1 px-3 py-1.5 border border-amber-300 text-amber-800 rounded-lg',
                                (clipCacheConflict || cleanupWorker.isPending) && 'opacity-50 cursor-not-allowed',
                              )}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {clipCacheConflict ? '清理中…' : '清理片段缓存'}
                            </button>
                            <button
                              type="button"
                              disabled={!!staleConflict || cleanupWorker.isPending}
                              onClick={() =>
                                void handleWorkerCleanup(
                                  w.workerId,
                                  'stale',
                                  {
                                    title: '确定清理过期临时目录？',
                                    description: `将清理 Worker「${w.workerId}」上过期的 FFmpeg 临时目录（当前残余 ${w.tmpDirCount ?? 0} 个）。`,
                                  },
                                  w.activeCommands,
                                )
                              }
                              className={cn(
                                'px-3 py-1.5 border rounded-lg',
                                (staleConflict || cleanupWorker.isPending) && 'opacity-50 cursor-not-allowed',
                              )}
                            >
                              {staleConflict ? '清理中…' : '清理过期临时目录'}
                            </button>
                          </div>
                        </div>

                        {(w.activeCommands?.length ?? 0) > 0 && (
                          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900 space-y-1">
                            <div className="font-medium">进行中的清理指令（请勿重复下发）</div>
                            {w.activeCommands!.map((cmd) => (
                              <div key={cmd.id} className="flex flex-wrap gap-x-3 gap-y-1">
                                <span>{scopeLabel(cmd.scope)}</span>
                                <span className="text-amber-700">{commandStatusLabel(cmd.status)}</span>
                                <span className="text-amber-600">{formatTime(cmd.createdAt)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="grid md:grid-cols-4 gap-3 mt-3 text-slate-600">
                          <div>任务：{w.runningJobs}/{w.capacity}</div>
                          <div>片段缓存：{formatBytes(w.clipCacheBytes ?? 0)}（{w.clipCacheProjectCount ?? 0} 项目）</div>
                          <div>残余临时：{w.tmpDirCount ?? 0} 个 · {formatBytes(w.tmpUsedBytes ?? 0)}</div>
                          <div>磁盘剩余：{w.diskFreeBytes ? formatBytes(w.diskFreeBytes) : '—'}</div>
                        </div>
                        <div className="text-xs text-slate-400 mt-2 font-mono break-all">
                          {w.hostname || '—'} · 缓存 {w.clipCacheBase || '~/.mv-worker-cache'} · 心跳 {formatTime(w.lastSeenAt)}
                        </div>

                        {(w.clipCacheProjects?.length ?? 0) > 0 ? (
                          <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-slate-500 border-b">
                                  <th className="py-2 pr-3">项目</th>
                                  <th className="py-2 pr-3">状态</th>
                                  <th className="py-2 pr-3">占用</th>
                                  <th className="py-2 pr-3">文件</th>
                                  <th className="py-2 pr-3">最后访问</th>
                                  <th className="py-2">操作</th>
                                </tr>
                              </thead>
                              <tbody>
                                {w.clipCacheProjects!.map((p) => {
                                  const projectScope = `clip_cache_project:${p.projectId}`;
                                  const projectConflict = findActiveConflict(
                                    w.activeCommands,
                                    w.workerId,
                                    projectScope,
                                  );

                                  return (
                                  <tr key={p.projectId} className="border-b border-slate-100">
                                    <td className="py-2 pr-3">
                                      <div className="font-medium">{p.title || '未命名'}</div>
                                      <div className="text-xs text-slate-400 font-mono">{p.projectId}</div>
                                    </td>
                                    <td className="py-2 pr-3">{p.status || '—'}</td>
                                    <td className="py-2 pr-3">{formatBytes(p.bytes)}</td>
                                    <td className="py-2 pr-3">{p.fileCount}</td>
                                    <td className="py-2 pr-3">{formatTime(p.lastAccessAt)}</td>
                                    <td className="py-2">
                                      <button
                                        type="button"
                                        disabled={!!projectConflict || cleanupWorker.isPending}
                                        onClick={() =>
                                          void handleWorkerCleanup(
                                            w.workerId,
                                            projectScope,
                                            {
                                              title: '确定清理此项目缓存？',
                                              description: `将清理 Worker「${w.workerId}」上项目「${p.title || p.projectId}」的片段缓存（${formatBytes(p.bytes)}，${p.fileCount} 个文件）。`,
                                            },
                                            w.activeCommands,
                                          )
                                        }
                                        className={cn(
                                          'text-xs text-amber-700 hover:underline',
                                          (projectConflict || cleanupWorker.isPending) &&
                                            'opacity-50 cursor-not-allowed no-underline',
                                        )}
                                      >
                                        {projectConflict ? '清理中…' : '清理此项目'}
                                      </button>
                                    </td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : w.online && (w.clipCacheBytes ?? 0) > 0 ? (
                          <p className="text-xs text-amber-600 mt-3">
                            有缓存占用但暂无项目明细，请重启 Worker 以加载新版心跳上报后刷新页面。
                          </p>
                        ) : null}
                      </div>
                      );
                    })}
                  </div>
                )}

                {data.recentWorkerCommands.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-medium text-slate-700 mb-2">最近清理指令</h3>
                    <div className="space-y-2 text-sm">
                      {data.recentWorkerCommands.map((cmd) => (
                        <div key={cmd.id} className="rounded-lg bg-slate-50 px-3 py-2">
                          <div className="flex flex-wrap gap-3">
                            <span className="font-mono text-xs">{cmd.id.slice(0, 8)}</span>
                            <span>{cmd.workerId}</span>
                            <span>{scopeLabel(cmd.scope)}</span>
                            <span>{commandStatusLabel(cmd.status)}</span>
                            <span>{formatTime(cmd.createdAt)}</span>
                          </div>
                          {cmd.result?.message && (
                            <div className="text-slate-500 mt-1">{cmd.result.message}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'api' && (
              <section className="bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6 space-y-4">
                <div>
                  <h2 className="font-semibold text-slate-900">API 本机片段缓存</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    仅当合成走 API local 模式或 Step 9 预缓存时占用；Worker 模式默认不在 API 预下载。
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-slate-500">总占用</div>
                    <div className="text-lg font-semibold mt-1">{formatBytes(data.api.totalBytes)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-slate-500">项目数</div>
                    <div className="text-lg font-semibold mt-1">{data.api.projectCount}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-slate-500">文件数</div>
                    <div className="text-lg font-semibold mt-1">{data.api.fileCount}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-slate-500">缓存路径</div>
                    <div className="text-xs font-mono mt-1 break-all">{data.api.cacheBase}</div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 border-t pt-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={effectiveDraft.enabled === 'true' || effectiveDraft.enabled === '1'}
                      onChange={(e) =>
                        setConfigDraft({ ...effectiveDraft, enabled: e.target.checked ? 'true' : 'false' })
                      }
                    />
                    启用 API 片段缓存
                  </label>
                  <label className="text-sm">
                    TTL（天）
                    <input
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      value={effectiveDraft.ttlDays}
                      onChange={(e) => setConfigDraft({ ...effectiveDraft, ttlDays: e.target.value })}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={
                        effectiveDraft.cleanOnComposeDone === 'true' ||
                        effectiveDraft.cleanOnComposeDone === '1'
                      }
                      onChange={(e) =>
                        setConfigDraft({
                          ...effectiveDraft,
                          cleanOnComposeDone: e.target.checked ? 'true' : 'false',
                        })
                      }
                    />
                    合成完成后自动清理 API clip 缓存
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={
                        effectiveDraft.skipPrecacheInWorkerMode === 'true' ||
                        effectiveDraft.skipPrecacheInWorkerMode === '1'
                      }
                      onChange={(e) =>
                        setConfigDraft({
                          ...effectiveDraft,
                          skipPrecacheInWorkerMode: e.target.checked ? 'true' : 'false',
                        })
                      }
                    />
                    Worker 模式跳过 Step 9 预缓存
                  </label>
                  <button
                    type="button"
                    disabled={saveConfig.isPending}
                    onClick={() => saveConfig.mutate(effectiveDraft)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
                  >
                    <Save className="h-4 w-4" />
                    保存 API 策略
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 border-t pt-4">
                  <button
                    type="button"
                    onClick={() => cleanupApi.mutate({ scope: 'expired', dryRun: true })}
                    className="px-3 py-2 text-sm border rounded-lg"
                  >
                    预览清理过期
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleApiCleanup('expired')}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-amber-300 text-amber-800 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                    清理过期缓存
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleApiCleanup('all')}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-red-300 text-red-700 rounded-lg"
                  >
                    清理全部
                  </button>
                </div>

                {data.api.topProjects.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 border-b">
                          <th className="py-2 pr-3">项目</th>
                          <th className="py-2 pr-3">状态</th>
                          <th className="py-2 pr-3">占用</th>
                          <th className="py-2 pr-3">文件</th>
                          <th className="py-2">最后访问</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.api.topProjects.map((p) => (
                          <tr key={p.projectId} className="border-b border-slate-100">
                            <td className="py-2 pr-3">
                              <div className="font-medium">{p.title || '未命名'}</div>
                              <div className="text-xs text-slate-400 font-mono">{p.projectId}</div>
                            </td>
                            <td className="py-2 pr-3">{p.status || '—'}</td>
                            <td className="py-2 pr-3">{formatBytes(p.bytes)}</td>
                            <td className="py-2 pr-3">{p.fileCount}</td>
                            <td className="py-2">{formatTime(p.lastAccessAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </QueryState>
    </div>
  );
}
