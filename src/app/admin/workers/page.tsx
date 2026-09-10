'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  HardDrive,
  RefreshCw,
  Search,
  ServerCog,
  Trash2,
  WifiOff,
  XCircle,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { useAlert, useConfirm } from '@/components/ui/dialog-provider';

type SlotGroup = { running: number; max: number };

interface WorkerCommand {
  id: string;
  workerId: string;
  type: 'cleanup_tmp';
  scope: string;
  status: 'pending' | 'running' | 'done' | 'failed' | string;
  createdAt: string;
  completedAt?: string;
  result?: { freedBytes?: number; deletedDirs?: number; message?: string };
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
  hostname?: string;
  lastSeenAt: string;
  online: boolean;
  pendingCommands: number;
  activeCommands?: WorkerCommand[];
  slotGroups?: { compose: SlotGroup; aimv: SlotGroup; cleanup: SlotGroup };
  tickInFlight?: boolean;
  oldestAimvAgeMs?: number | null;
  cpuLoad1m?: number;
  cpuCount?: number;
  memoryTotalBytes?: number;
  memoryFreeBytes?: number;
  hostUptimeSec?: number;
  processUptimeSec?: number;
}

interface OverviewResponse {
  workers: WorkerInstance[];
  recentWorkerCommands: WorkerCommand[];
}

type WorkerFilter = 'all' | 'online' | 'attention' | 'offline';
type SlotGroupKey = 'compose' | 'aimv' | 'cleanup';

const GIB = 1024 ** 3;
const LOW_DISK_BYTES = 10 * GIB;

function formatBytes(bytes?: number): string {
  if (bytes == null) return '未上报';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDuration(ms?: number | null): string {
  if (ms == null) return '—';
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时 ${minutes % 60} 分钟`;
}

function formatTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', { hour12: false });
}

function heartbeatAge(value?: string): string {
  if (!value) return '从未上报';
  const diff = Date.now() - Date.parse(value);
  if (!Number.isFinite(diff)) return '时间未知';
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))} 秒前`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  return `${Math.floor(diff / 3_600_000)} 小时前`;
}

function legacyLoadPercent(worker: WorkerInstance): number {
  return worker.capacity > 0 ? Math.round((worker.runningJobs / worker.capacity) * 100) : 0;
}

function slotLoadPercent(slot?: SlotGroup): number {
  return slot?.max ? Math.round((slot.running / slot.max) * 100) : 0;
}

function workerLoadPercent(worker: WorkerInstance): number {
  if (!worker.slotGroups) return legacyLoadPercent(worker);
  return Math.max(
    slotLoadPercent(worker.slotGroups.compose),
    slotLoadPercent(worker.slotGroups.aimv),
    slotLoadPercent(worker.slotGroups.cleanup),
  );
}

function aggregateSlotGroups(workers: WorkerInstance[], key: SlotGroupKey): SlotGroup {
  return workers.reduce((total, worker) => {
    if (!worker.online) return total;
    const slot = worker.slotGroups?.[key];
    if (!slot) return total;
    total.running += slot.running;
    total.max += slot.max;
    return total;
  }, { running: 0, max: 0 });
}

function needsAttention(worker: WorkerInstance): boolean {
  return !worker.online || workerLoadPercent(worker) >= 90 || (worker.diskFreeBytes != null && worker.diskFreeBytes < LOW_DISK_BYTES);
}

function scopeLabel(scope: string): string {
  if (scope === 'stale') return '清理过期临时文件';
  if (scope === 'all_tmp') return '清理全部临时文件';
  if (scope === 'clip_cache' || scope === 'clip_cache_all') return '清理片段缓存';
  if (scope.startsWith('clip_cache_project:')) return '清理项目片段缓存';
  if (scope.startsWith('project:')) return '清理项目临时文件';
  return scope;
}

function commandStatus(status: string): { label: string; cls: string } {
  if (status === 'done') return { label: '已完成', cls: 'bg-emerald-50 text-emerald-700' };
  if (status === 'failed') return { label: '失败', cls: 'bg-red-50 text-red-700' };
  if (status === 'running') return { label: '执行中', cls: 'bg-blue-50 text-blue-700' };
  return { label: '等待下发', cls: 'bg-amber-50 text-amber-700' };
}

function SummaryCard({
  label,
  value,
  hint,
  icon,
  tone = 'slate',
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ReactNode;
  tone?: 'slate' | 'green' | 'amber' | 'blue';
}) {
  const toneClass = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{hint}</p>
        </div>
        <span className={cn('rounded-lg p-2', toneClass)}>{icon}</span>
      </div>
    </div>
  );
}

function SlotCard({ label, description, slot, tone }: { label: string; description: string; slot?: SlotGroup; tone: 'violet' | 'blue' | 'emerald' }) {
  const percent = slotLoadPercent(slot);
  const colors = {
    violet: 'bg-violet-500',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
  }[tone];
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className={cn('font-semibold tabular-nums', percent >= 90 ? 'text-amber-700' : 'text-slate-800')}>{slot ? `${slot.running} / ${slot.max}` : '—'}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className={cn('h-full rounded-full transition-all', percent >= 90 ? 'bg-amber-500' : colors)} style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        {slot ? `${description} · 空闲 ${Math.max(0, slot.max - slot.running)}` : '旧版本未上报独立槽位'}
      </p>
    </div>
  );
}

export default function AdminWorkersPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const alert = useAlert();
  const [filter, setFilter] = useState<WorkerFilter>('all');
  const [keyword, setKeyword] = useState('');

  const query = useQuery<OverviewResponse>({
    queryKey: ['admin', 'worker-dashboard'],
    queryFn: () => apiClient.get('/admin/system/local-storage') as Promise<OverviewResponse>,
    refetchInterval: 10_000,
  });

  const workers = query.data?.workers ?? [];
  const summary = useMemo(() => {
    const online = workers.filter((worker) => worker.online).length;
    const compose = aggregateSlotGroups(workers, 'compose');
    const aimv = aggregateSlotGroups(workers, 'aimv');
    const cleanup = aggregateSlotGroups(workers, 'cleanup');
    const attention = workers.filter(needsAttention).length;
    const cache = workers.reduce((sum, worker) => sum + (worker.clipCacheBytes ?? 0), 0);
    return { online, compose, aimv, cleanup, attention, cache };
  }, [workers]);

  const visibleWorkers = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return workers
      .filter((worker) => {
        if (filter === 'online' && !worker.online) return false;
        if (filter === 'offline' && worker.online) return false;
        if (filter === 'attention' && !needsAttention(worker)) return false;
        return !q || worker.workerId.toLowerCase().includes(q) || worker.hostname?.toLowerCase().includes(q);
      })
      .sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)) || b.runningJobs - a.runningJobs);
  }, [filter, keyword, workers]);

  const cleanup = useMutation({
    mutationFn: (payload: { workerId: string; scope: 'stale' | 'clip_cache' }) =>
      apiClient.post('/admin/system/local-storage/workers/cleanup', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'worker-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'local-storage'] });
    },
    onError: async (error: Error) => {
      await alert({ title: '指令下发失败', description: error.message || '请稍后重试', variant: 'danger' });
    },
  });

  const requestCleanup = async (worker: WorkerInstance, scope: 'stale' | 'clip_cache') => {
    if ((worker.activeCommands?.length ?? worker.pendingCommands) > 0) {
      await alert({ title: '已有指令执行中', description: '请等待当前指令完成后再操作。', variant: 'warning' });
      return;
    }
    const ok = await confirm({
      title: scope === 'stale' ? '清理过期临时文件' : '清理片段缓存',
      description: `将向 Worker「${worker.workerId}」下发清理指令，由 Worker 在下次心跳时执行。`,
      confirmText: '下发指令',
      variant: 'danger',
    });
    if (ok) cleanup.mutate({ workerId: worker.workerId, scope });
  };

  const alerts = workers.filter(needsAttention);

  return (
    <div className="admin-page space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ServerCog className="h-6 w-6 text-violet-600" />
            <h1 className="text-2xl font-bold text-slate-900">Worker 看板</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">集中查看所有 Worker 的在线状态、任务槽位、磁盘、缓存和运维指令。</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">每 10 秒刷新 · 超过 120 秒未心跳视为离线</span>
          <button
            type="button"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', query.isFetching && 'animate-spin')} />刷新
          </button>
        </div>
      </div>

      <QueryState isLoading={query.isLoading} isError={query.isError} error={query.error}>
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <SummaryCard label="在线 Worker" value={`${summary.online} / ${workers.length}`} hint="当前可调度实例" icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
            <SummaryCard label="合成槽位" value={`${summary.compose.running} / ${summary.compose.max}`} hint={`空闲 ${Math.max(0, summary.compose.max - summary.compose.running)} · FFmpeg`} icon={<Activity className="h-5 w-5" />} tone="blue" />
            <SummaryCard label="AI MV 槽位" value={`${summary.aimv.running} / ${summary.aimv.max}`} hint={`空闲 ${Math.max(0, summary.aimv.max - summary.aimv.running)} · 渠道任务`} icon={<ServerCog className="h-5 w-5" />} tone="blue" />
            <SummaryCard label="清理槽位" value={`${summary.cleanup.running} / ${summary.cleanup.max}`} hint={`空闲 ${Math.max(0, summary.cleanup.max - summary.cleanup.running)} · 文件任务`} icon={<Trash2 className="h-5 w-5" />} tone="green" />
            <SummaryCard label="需要关注" value={summary.attention} hint="离线、高负载或低磁盘" icon={<AlertTriangle className="h-5 w-5" />} tone={summary.attention ? 'amber' : 'green'} />
            <SummaryCard label="片段缓存" value={formatBytes(summary.cache)} hint="所有 Worker 合计" icon={<HardDrive className="h-5 w-5" />} />
          </div>

          {alerts.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">有 {alerts.length} 个 Worker 需要关注</p>
                  <p className="mt-1 text-xs leading-5 text-amber-700">
                    {alerts.map((worker) => `${worker.workerId}（${!worker.online ? '离线' : workerLoadPercent(worker) >= 90 ? '某类槽位负载过高' : '磁盘不足 10 GB'}）`).join('、')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
                {([
                  ['all', '全部'],
                  ['online', '在线'],
                  ['attention', '需关注'],
                  ['offline', '离线'],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setFilter(value)} className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition', filter === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>{label}</button>
                ))}
              </div>
              <label className="relative block w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索 Worker 或主机名" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
              </label>
            </div>

            {visibleWorkers.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">没有符合条件的 Worker</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleWorkers.map((worker) => {
                  const lowDisk = worker.diskFreeBytes != null && worker.diskFreeBytes < LOW_DISK_BYTES;
                  const activeCount = worker.activeCommands?.length ?? worker.pendingCommands;
                  return (
                    <article key={worker.workerId} className="p-4 lg:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', worker.online ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                              <span className={cn('h-2 w-2 rounded-full', worker.online ? 'bg-emerald-500' : 'bg-slate-400')} />
                              {worker.online ? '在线' : '离线'}
                            </span>
                            <h2 className="break-all font-semibold text-slate-900">{worker.workerId}</h2>
                            {worker.version && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">v{worker.version}</span>}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{worker.hostname || '未上报主机名'} · 最后心跳 {heartbeatAge(worker.lastSeenAt)}（{formatTime(worker.lastSeenAt)}）</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button disabled={!worker.online || cleanup.isPending || activeCount > 0} onClick={() => void requestCleanup(worker, 'stale')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" />临时文件</button>
                          <button disabled={!worker.online || cleanup.isPending || activeCount > 0} onClick={() => void requestCleanup(worker, 'clip_cache')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" />片段缓存</button>
                          <Link href="/admin/local-storage" className="rounded-lg bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700 transition hover:bg-violet-100">存储详情</Link>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                        <SlotCard label="合成槽位" description="FFmpeg" slot={worker.slotGroups?.compose} tone="violet" />
                        <SlotCard label="AI MV 槽位" description="渠道任务" slot={worker.slotGroups?.aimv} tone="blue" />
                        <SlotCard label="清理槽位" description="文件任务" slot={worker.slotGroups?.cleanup} tone="emerald" />
                        <div className={cn('rounded-lg border p-3', lowDisk ? 'border-amber-200 bg-amber-50' : 'border-slate-100')}>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600"><HardDrive className="h-3.5 w-3.5" />磁盘与临时文件</div>
                          <div className={cn('mt-1 text-sm font-semibold', lowDisk ? 'text-amber-800' : 'text-slate-800')}>可用 {formatBytes(worker.diskFreeBytes)}</div>
                          <p className="mt-1 text-[11px] text-slate-400">临时目录 {worker.tmpDirCount ?? '—'} 个 · {formatBytes(worker.tmpUsedBytes)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-100 p-3">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600"><Database className="h-3.5 w-3.5" />片段缓存</div>
                          <div className="mt-1 text-sm font-semibold text-slate-800">{formatBytes(worker.clipCacheBytes)}</div>
                          <p className="mt-1 text-[11px] text-slate-400">{worker.clipCacheProjectCount ?? '—'} 个项目 · {worker.clipCacheFileCount ?? '—'} 个文件</p>
                        </div>
                        <div className="rounded-lg border border-slate-100 p-3">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600"><Activity className="h-3.5 w-3.5" />主机资源</div>
                          <div className="mt-1 text-sm font-semibold text-slate-800">
                            CPU {worker.cpuLoad1m == null ? '未上报' : `${worker.cpuLoad1m.toFixed(2)} / ${worker.cpuCount ?? '—'} 核`}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400">
                            内存 {worker.memoryTotalBytes == null || worker.memoryFreeBytes == null ? '未上报' : `${Math.round((1 - worker.memoryFreeBytes / worker.memoryTotalBytes) * 100)}%`} · 进程运行 {formatDuration(worker.processUptimeSec == null ? null : worker.processUptimeSec * 1000)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />最老 AI MV 任务：{formatDuration(worker.oldestAimvAgeMs)}</span>
                        <span>轮询状态：{worker.tickInFlight == null ? '旧版本未上报' : worker.tickInFlight ? '正在拉取任务' : '等待下一轮'}</span>
                        <span>运维指令：{activeCount > 0 ? `${activeCount} 个执行中` : '无'}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3"><h2 className="font-semibold text-slate-900">最近运维指令</h2><p className="mt-0.5 text-xs text-slate-400">用于确认清理指令是否已被 Worker 接收并完成</p></div>
            {(query.data?.recentWorkerCommands ?? []).length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">暂无运维指令</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">Worker</th><th className="px-4 py-3">指令</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">下发时间</th><th className="px-4 py-3">完成时间</th><th className="px-4 py-3">执行结果</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {(query.data?.recentWorkerCommands ?? []).slice(0, 20).map((command) => {
                      const status = commandStatus(command.status);
                      return <tr key={command.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-medium text-slate-800">{command.workerId}</td><td className="px-4 py-3 text-slate-600">{scopeLabel(command.scope)}</td><td className="px-4 py-3"><span className={cn('rounded-full px-2 py-1 text-xs font-medium', status.cls)}>{status.label}</span></td><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatTime(command.createdAt)}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatTime(command.completedAt)}</td><td className="px-4 py-3 text-xs text-slate-500">{command.status === 'failed' ? <span className="inline-flex items-center gap-1 text-red-600"><XCircle className="h-3.5 w-3.5" />{command.result?.message || '执行失败'}</span> : command.status === 'done' ? `释放 ${formatBytes(command.result?.freedBytes)} · 删除 ${command.result?.deletedDirs ?? 0} 个目录` : '—'}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="flex items-center gap-2 text-xs text-slate-400"><WifiOff className="h-3.5 w-3.5" />离线 Worker 会保留在看板中，便于识别未恢复的服务器。</div>
        </div>
      </QueryState>
    </div>
  );
}
