'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Clock3,
  Coins,
  ExternalLink,
  Film,
  Gauge,
  ImageIcon,
  Mail,
  MapPin,
  Music2,
  RefreshCw,
  Route,
  UserRound,
  Users,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { StatusBadge } from '@/components/status-badge';
import { formatDate, cn } from '@/lib/utils';

type Attempt = {
  id: string;
  candidateOrder: number;
  provider: string;
  exactModel: string;
  status: string;
  providerTaskId: string | null;
  submittedAt: string | null;
  finishedAt: string | null;
  outputUrl: string | null;
  upstreamCostUsd: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type GenerationUnit = {
  id: string;
  unitIndex: number;
  startSecond: number;
  plannedSeconds: number;
  successfulSeconds: number | null;
  status: string;
  event: string;
  prompt: string;
  storyboardPrompt: string;
  storyboardStatus: string;
  storyboardImageUrl: string | null;
  storyboardError: string | null;
  resultUrl: string | null;
  settledCredits: number;
  errorCode: string | null;
  errorMessage: string | null;
  attempts: Attempt[];
};

type DispatchJob = {
  id: string;
  generationUnitId: string | null;
  provider: string;
  exactModel: string;
  capacityGroup: string | null;
  status: string;
  priority: number;
  retryCount: number;
  leaseOwner: string | null;
  queuedAt: string;
  submitStartedAt: string | null;
  submittedAt: string | null;
  finishedAt: string | null;
  providerTaskId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  adminNote: string | null;
};

type ProjectDetail = {
  project: {
    id: string;
    publicId: string;
    userId: string;
    title: string;
    status: string;
    stage: string;
    progressPercent: number;
    musicAsset: Record<string, unknown>;
    singerPhotoAsset: Record<string, unknown>;
    productModelCode: string;
    durationSec: number;
    aspectRatio: string;
    resolution: string;
    videoFormat: string;
    configSnapshot: Record<string, unknown>;
    reservedCredits: number;
    chargedCredits: number;
    resultUrl: string | null;
    coverUrl: string | null;
    expiresAt: string | null;
    expiredAt: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    cancelRequestedAt: string | null;
    succeededAt: string | null;
    fileSizeBytes: string | null;
    createdAt: string;
    updatedAt: string;
  };
  user: null | {
    id: string;
    email: string | null;
    displayName: string;
    avatarUrl: string | null;
    status: string;
    accountOrigin: string;
    primaryProvider: string;
    userType: 'registered' | 'paid_guest' | 'converted_guest' | 'unknown';
    emailVerified: boolean;
    registrationAttribution: Record<string, string> | null;
    createdAt: string;
  };
  reservation: null | {
    id: string;
    amount: number;
    actualAmount: number | null;
    status: string;
    reason: string | null;
    createdAt: string;
    confirmedAt: string | null;
    refundedAt: string | null;
    expiresAt: string | null;
  };
  summary: {
    unitCount: number;
    unitCounts: Record<string, number>;
    successfulSeconds: number;
    settledCredits: number;
    attemptCount: number;
    attemptCounts: Record<string, number>;
    upstreamCostUsd: number;
    dispatchJobCount: number;
    dispatchCounts: Record<string, number>;
    providerCounts: Record<string, number>;
    queuedJobCount: number;
    activeJobCount: number;
    averageQueueSeconds: number;
    maxQueueSeconds: number;
    errorCount: number;
  };
  attribution: Record<string, string> | null;
  attributionSource: 'project' | 'registration' | 'none';
  errors: Array<{
    sourceType: string;
    sourceLabel: string;
    code: string | null;
    message: string;
    occurredAt: string;
  }>;
  units: GenerationUnit[];
  dispatchJobs: DispatchJob[];
};

type TabKey = 'overview' | 'shots' | 'execution' | 'snapshot';
type MetricKey = 'progress' | 'shots' | 'attempts' | 'credits' | 'timing';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: '运营概览' },
  { key: 'shots', label: '分镜结果' },
  { key: 'execution', label: '执行链路' },
  { key: 'snapshot', label: '配置快照' },
];

function valueFromAsset(asset: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asset?.[key];
    if (typeof value === 'string' && value) return value;
  }
  return null;
}

function secondsBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  return Number.isFinite(seconds) ? seconds : null;
}

function durationLabel(seconds: number | null) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}

function fileSizeLabel(value: string | null) {
  const bytes = Number(value ?? 0);
  if (!bytes) return '—';
  return bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0"><span className="text-xs text-slate-400">{label}</span><div className="max-w-[70%] text-right text-sm font-medium text-slate-700 break-words">{value ?? '—'}</div></div>;
}

function MetricCard({ icon, label, value, hint, active, onClick }: { icon: React.ReactNode; label: string; value: string; hint?: string; active?: boolean; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className={cn('rounded-2xl border bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-sm', active ? 'border-violet-400 ring-2 ring-violet-100' : 'border-slate-200')}><div className="mb-3 flex items-center justify-between gap-2 text-xs text-slate-400"><span className="flex items-center gap-2">{icon}{label}</span><BarChart3 className="h-3.5 w-3.5" /></div><p className="text-2xl font-semibold text-slate-900">{value}</p>{hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}</button>;
}

export default function AiMusicVideoProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<TabKey>('overview');
  const [metric, setMetric] = useState<MetricKey>('progress');
  const query = useQuery<ProjectDetail>({
    queryKey: ['admin', 'ai-music-video', 'project', id],
    queryFn: () => apiClient.get(`/admin/aimv-generator/projects/${encodeURIComponent(id)}`) as any,
    refetchInterval: (state) => {
      const status = state.state.data?.project.status;
      return status && !['succeeded', 'failed', 'cancelled'].includes(status) ? 5000 : false;
    },
  });
  const detail = query.data;
  const unitById = useMemo(() => new Map(detail?.units.map((unit) => [unit.id, unit]) ?? []), [detail?.units]);

  return <div className="admin-page min-h-full bg-slate-50 p-6">
    <QueryState isLoading={query.isLoading} isError={query.isError} error={query.error} isEmpty={!detail} height="h-[70vh]">
      {detail && <>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Link href="/admin/ai-music-video/projects" className="mt-0.5 rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft className="h-4 w-4" /></Link>
            <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-bold text-slate-900">{detail.project.title || '(未命名)'}</h1><StatusBadge status={detail.project.status} /></div><p className="mt-1 font-mono text-xs text-slate-400">{detail.project.publicId}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => query.refetch()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"><RefreshCw className={cn('h-3.5 w-3.5', query.isFetching && 'animate-spin')} />刷新</button>
            <a href={`${process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000'}/en/mv/${detail.project.publicId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700">打开用户页<ExternalLink className="h-3.5 w-3.5" /></a>
          </div>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard active={metric === 'progress'} onClick={() => setMetric('progress')} icon={<Gauge className="h-4 w-4" />} label="项目进度" value={`${detail.project.progressPercent}%`} hint={`${detail.project.stage} · ${detail.project.status}`} />
          <MetricCard active={metric === 'shots'} onClick={() => setMetric('shots')} icon={<Film className="h-4 w-4" />} label="成功分镜" value={`${detail.summary.unitCounts.succeeded ?? 0}/${detail.summary.unitCount}`} hint={`有效成片 ${detail.summary.successfulSeconds}s`} />
          <MetricCard active={metric === 'attempts'} onClick={() => setMetric('attempts')} icon={<Route className="h-4 w-4" />} label="渠道尝试" value={String(detail.summary.attemptCount)} hint={`失败 ${detail.summary.attemptCounts.failed ?? 0} 次`} />
          <MetricCard active={metric === 'credits'} onClick={() => setMetric('credits')} icon={<Coins className="h-4 w-4" />} label="积分结算" value={String(detail.project.chargedCredits)} hint={`估算 ${detail.project.reservedCredits} · 分镜 ${detail.summary.settledCredits}`} />
          <MetricCard active={metric === 'timing'} onClick={() => setMetric('timing')} icon={<Clock3 className="h-4 w-4" />} label="总耗时" value={durationLabel(secondsBetween(detail.project.createdAt, detail.project.succeededAt || detail.project.updatedAt))} hint={`上游成本 $${detail.summary.upstreamCostUsd.toFixed(4)}`} />
        </div>

        <MetricBreakdown detail={detail} metric={metric} />

        {detail.errors.length > 0 && <ErrorSummary errors={detail.errors} />}

        <div className="mb-5 flex w-fit gap-1 rounded-xl border border-slate-200 bg-white p-1">{TABS.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={cn('rounded-lg px-3 py-2 text-xs font-medium transition-colors', tab === item.key ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-100')}>{item.label}</button>)}</div>

        {tab === 'overview' && <Overview detail={detail} />}
        {tab === 'shots' && <Shots units={detail.units} />}
        {tab === 'execution' && <Execution jobs={detail.dispatchJobs} unitById={unitById} />}
        {tab === 'snapshot' && <Snapshot detail={detail} />}
      </>}
    </QueryState>
  </div>;
}

function Distribution({ title, values }: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return <div><p className="mb-3 text-xs font-semibold text-slate-500">{title}</p><div className="space-y-2">{entries.length ? entries.map(([label, count]) => <div key={label} className="grid grid-cols-[110px_1fr_44px] items-center gap-3"><span className="truncate text-xs text-slate-600" title={label}>{label}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-400" style={{ width: `${Math.max(4, total ? count / total * 100 : 0)}%` }} /></div><span className="text-right text-xs font-semibold text-slate-700">{count}</span></div>) : <p className="text-xs text-slate-400">暂无数据</p>}</div></div>;
}

function SmallStat({ label, value, tone = 'slate' }: { label: string; value: React.ReactNode; tone?: 'slate' | 'violet' | 'amber' | 'red' }) {
  const tones = { slate: 'bg-slate-50 text-slate-800', violet: 'bg-violet-50 text-violet-800', amber: 'bg-amber-50 text-amber-800', red: 'bg-red-50 text-red-800' };
  return <div className={cn('rounded-xl p-3', tones[tone])}><p className="text-[11px] opacity-60">{label}</p><p className="mt-1 text-base font-semibold">{value}</p></div>;
}

function MetricBreakdown({ detail, metric }: { detail: ProjectDetail; metric: MetricKey }) {
  const project = detail.project;
  return <section className="mb-5 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
    {metric === 'progress' && <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><SmallStat label="项目状态" value={project.status} tone="violet" /><SmallStat label="当前阶段" value={project.stage} /><SmallStat label="排队中" value={detail.summary.queuedJobCount} tone={detail.summary.queuedJobCount ? 'amber' : 'slate'} /><SmallStat label="执行中" value={detail.summary.activeJobCount} tone="violet" /></div><Distribution title="队列任务状态分布" values={detail.summary.dispatchCounts} /></div>}
    {metric === 'shots' && <div className="grid gap-5 xl:grid-cols-2"><Distribution title="分镜状态分布" values={detail.summary.unitCounts} /><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><SmallStat label="计划分镜" value={detail.summary.unitCount} /><SmallStat label="成功分镜" value={detail.summary.unitCounts.succeeded ?? 0} tone="violet" /><SmallStat label="失败分镜" value={detail.summary.unitCounts.failed ?? 0} tone={(detail.summary.unitCounts.failed ?? 0) ? 'red' : 'slate'} /><SmallStat label="有效成片" value={`${detail.summary.successfulSeconds}s`} /></div></div>}
    {metric === 'attempts' && <div className="grid gap-6 xl:grid-cols-2"><Distribution title="渠道分布" values={detail.summary.providerCounts} /><Distribution title="调用结果分布" values={detail.summary.attemptCounts} /></div>}
    {metric === 'credits' && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><SmallStat label="创建时估算" value={`${project.reservedCredits} Credits`} /><SmallStat label="最终实扣" value={`${project.chargedCredits} Credits`} tone="violet" /><SmallStat label="成功分镜结算" value={`${detail.summary.settledCredits} Credits`} /><SmallStat label="上游成本" value={`$${detail.summary.upstreamCostUsd.toFixed(6)}`} /></div>}
    {metric === 'timing' && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><SmallStat label="项目总耗时" value={durationLabel(secondsBetween(project.createdAt, project.succeededAt || project.updatedAt))} tone="violet" /><SmallStat label="平均排队" value={durationLabel(detail.summary.averageQueueSeconds)} /><SmallStat label="最长排队" value={durationLabel(detail.summary.maxQueueSeconds)} tone={detail.summary.maxQueueSeconds > 60 ? 'amber' : 'slate'} /><SmallStat label="队列任务数" value={detail.summary.dispatchJobCount} /></div>}
  </section>;
}

function ErrorSummary({ errors }: { errors: ProjectDetail['errors'] }) {
  return <section className="mb-5 overflow-hidden rounded-2xl border border-red-200 bg-red-50"><div className="flex items-center justify-between border-b border-red-100 px-5 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold text-red-800"><AlertTriangle className="h-4 w-4" />错误原因</h2><span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{errors.length}</span></div><div className="divide-y divide-red-100">{errors.slice(0, 8).map((error, index) => <div key={`${error.sourceType}-${index}`} className="grid gap-1 px-5 py-3 md:grid-cols-[220px_1fr_150px]"><div><p className="text-xs font-semibold text-red-800">{error.sourceLabel}</p><p className="mt-0.5 font-mono text-[11px] text-red-500">{error.code || 'UNKNOWN_ERROR'}</p></div><p className="whitespace-pre-wrap break-words text-xs leading-5 text-red-700">{error.message}</p><p className="text-xs text-red-400 md:text-right">{formatDate(error.occurredAt)}</p></div>)}</div>{errors.length > 8 && <p className="border-t border-red-100 px-5 py-2 text-xs text-red-500">其余 {errors.length - 8} 条可在“分镜结果”和“执行链路”中查看。</p>}</section>;
}

function userTypeLabel(value?: 'registered' | 'paid_guest' | 'converted_guest' | 'unknown') {
  if (value === 'paid_guest') return '付费游客';
  if (value === 'converted_guest') return '游客已转正式用户';
  if (value === 'registered') return '注册用户';
  return '未知';
}

function Overview({ detail }: { detail: ProjectDetail }) {
  const project = detail.project;
  const musicUrl = valueFromAsset(project.musicAsset, ['url', 'publicUrl', 'fileUrl']);
  const musicName = valueFromAsset(project.musicAsset, ['filename', 'fileName', 'name', 'title']);
  const singerUrl = valueFromAsset(project.singerPhotoAsset, ['url', 'publicUrl', 'fileUrl', 'imageUrl']);
  return <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">成片与输入素材</h2><p className="mt-1 text-xs text-slate-400">运营可直接核对用户提交内容与最终交付结果。</p></div><div className="grid gap-4 p-5 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl bg-slate-950 aspect-video">{project.resultUrl ? <video src={project.resultUrl} poster={project.coverUrl || undefined} controls className="h-full w-full object-contain" /> : project.coverUrl ? <img src={project.coverUrl} alt="项目封面" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-slate-500">暂无成片</div>}</div>
        <div className="space-y-3">
          <div className="flex gap-3 rounded-xl border border-slate-100 p-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-violet-50">{singerUrl ? <img src={singerUrl} alt="歌手照片" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-violet-400" />}</div><div className="min-w-0"><p className="text-xs text-slate-400">歌手照片</p>{singerUrl ? <a href={singerUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm font-medium text-violet-600">查看原图</a> : <p className="mt-1 text-sm text-slate-500">未记录</p>}</div></div>
          <div className="flex gap-3 rounded-xl border border-slate-100 p-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-emerald-50"><Music2 className="h-5 w-5 text-emerald-500" /></div><div className="min-w-0"><p className="text-xs text-slate-400">音乐</p><p className="mt-1 truncate text-sm font-medium text-slate-700">{musicName || '用户上传音乐'}</p>{musicUrl && <audio src={musicUrl} controls className="mt-2 h-8 max-w-full" />}</div></div>
        </div>
      </div></section>
      {(project.errorCode || project.errorMessage) && <section className="rounded-2xl border border-red-200 bg-red-50 p-5"><h2 className="font-semibold text-red-800">项目异常</h2><p className="mt-2 font-mono text-xs text-red-600">{project.errorCode || 'UNKNOWN_ERROR'}</p><p className="mt-2 whitespace-pre-wrap text-sm text-red-700">{project.errorMessage}</p></section>}
    </div>
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-900"><UserRound className="h-4 w-4 text-violet-500" />用户与归属</h2><InfoRow label="用户" value={detail.user?.displayName || '—'} /><InfoRow label="邮箱" value={<span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{detail.user?.email || '—'}</span>} /><InfoRow label="用户类型" value={<span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{userTypeLabel(detail.user?.userType)}</span>} /><InfoRow label="账号来源" value={detail.user?.accountOrigin || '—'} /><InfoRow label="注册方式" value={detail.user?.primaryProvider || '—'} /><InfoRow label="账号状态" value={detail.user?.status || '—'} /><InfoRow label="邮箱验证" value={detail.user?.emailVerified ? '已验证' : '未验证'} /></section>
      <AttributionCard detail={detail} />
      <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-2 font-semibold text-slate-900">生成与计费</h2><InfoRow label="展示模型" value={project.productModelCode} /><InfoRow label="规格" value={`${project.resolution} · ${project.aspectRatio} · ${project.durationSec}s`} /><InfoRow label="格式 / 文件大小" value={`${project.videoFormat.toUpperCase()} · ${fileSizeLabel(project.fileSizeBytes)}`} /><InfoRow label="估算 / 实扣积分" value={`${project.reservedCredits} / ${project.chargedCredits}`} /><InfoRow label="积分记录" value={detail.reservation ? <StatusBadge status={detail.reservation.status} /> : '成功后扣费，无预扣记录'} /><InfoRow label="上游成本" value={`$${detail.summary.upstreamCostUsd.toFixed(6)}`} /></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-2 font-semibold text-slate-900">生命周期与存储</h2><InfoRow label="创建" value={formatDate(project.createdAt)} /><InfoRow label="最后更新" value={formatDate(project.updatedAt)} /><InfoRow label="完成" value={project.succeededAt ? formatDate(project.succeededAt) : '—'} /><InfoRow label="取消请求" value={project.cancelRequestedAt ? formatDate(project.cancelRequestedAt) : '—'} /><InfoRow label="存储到期" value={project.expiresAt ? formatDate(project.expiresAt) : '未设置'} /><InfoRow label="已清理" value={project.expiredAt ? formatDate(project.expiredAt) : '否'} /></section>
    </div>
  </div>;
}

function AttributionCard({ detail }: { detail: ProjectDetail }) {
  const value = detail.attribution;
  const sourceLabel = detail.attributionSource === 'project'
    ? '本项目创建时归因（精确）'
    : detail.attributionSource === 'registration'
      ? '用户首次注册归因（旧项目回溯）'
      : '未采集';
  return <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-2 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold text-slate-900"><MapPin className="h-4 w-4 text-violet-500" />流量与着落</h2><span className={cn('rounded-full px-2 py-1 text-[11px] font-medium', detail.attributionSource === 'project' ? 'bg-emerald-50 text-emerald-700' : detail.attributionSource === 'registration' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500')}>{sourceLabel}</span></div>
    <InfoRow label="创建来源页" value={value?.sourcePage || '—'} />
    <InfoRow label="创建页面" value={value?.pagePath || value?.pageUrl || '—'} />
    <InfoRow label="首次着落页" value={value?.landingPage || '—'} />
    <InfoRow label="Referrer" value={value?.referrer || '直接访问 / 未采集'} />
    <InfoRow label="UTM 来源 / 媒介" value={[value?.utmSource, value?.utmMedium].filter(Boolean).join(' / ') || '—'} />
    <InfoRow label="UTM Campaign" value={value?.utmCampaign || '—'} />
    <InfoRow label="会话 / 匿名访客" value={<span className="font-mono text-[11px]">{value?.sessionId || '—'} / {value?.anonymousId || '—'}</span>} />
    <InfoRow label="设备环境" value={[value?.browserLanguage, value?.timezone, value?.viewportSize].filter(Boolean).join(' · ') || '—'} />
  </section>;
}

function Shots({ units }: { units: GenerationUnit[] }) {
  if (!units.length) return <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">尚未生成分镜</div>;
  return <div className="space-y-4">{units.map((unit) => <section key={unit.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3"><div className="flex items-center gap-3"><span className="font-mono text-lg font-bold text-violet-600">#{String(unit.unitIndex + 1).padStart(2, '0')}</span><div><p className="text-sm font-medium text-slate-800">{unit.event || '未命名分镜'}</p><p className="text-xs text-slate-400">{unit.startSecond}s – {unit.startSecond + unit.plannedSeconds}s · 计划 {unit.plannedSeconds}s</p></div></div><div className="flex items-center gap-2"><StatusBadge status={unit.storyboardStatus} /><StatusBadge status={unit.status} /></div></div><div className="grid gap-4 p-5 lg:grid-cols-[240px_1fr]">
    <div className="space-y-3"><div className="overflow-hidden rounded-xl bg-slate-100 aspect-video">{unit.storyboardImageUrl ? <img src={unit.storyboardImageUrl} alt={`分镜 ${unit.unitIndex + 1}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-slate-400">无分镜图</div>}</div>{unit.resultUrl && <video src={unit.resultUrl} controls className="w-full rounded-xl bg-black" />}</div>
    <div className="space-y-3"><div><p className="mb-1 text-xs font-medium text-slate-400">镜头描述</p><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{unit.prompt || '—'}</p></div>{unit.storyboardPrompt && <div><p className="mb-1 text-xs font-medium text-slate-400">分镜图片提示词</p><p className="whitespace-pre-wrap text-xs leading-5 text-slate-500">{unit.storyboardPrompt}</p></div>}<div className="flex flex-wrap gap-4 text-xs text-slate-500"><span>成功时长：{unit.successfulSeconds ?? 0}s</span><span>结算积分：{unit.settledCredits}</span><span>渠道尝试：{unit.attempts.length}</span></div>{(unit.errorMessage || unit.storyboardError) && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700"><p className="font-mono font-medium">{unit.errorCode || 'SHOT_ERROR'}</p><p className="mt-1 whitespace-pre-wrap">{unit.errorMessage || unit.storyboardError}</p></div>}
    {unit.attempts.length > 0 && <div className="overflow-x-auto rounded-xl border border-slate-100"><table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-slate-50 text-slate-400"><tr><th className="px-3 py-2">候选</th><th className="px-3 py-2">渠道 / 模型</th><th className="px-3 py-2">状态</th><th className="px-3 py-2">上游任务</th><th className="px-3 py-2">成本</th><th className="px-3 py-2">异常</th></tr></thead><tbody>{unit.attempts.map((attempt) => <tr key={attempt.id} className="border-t border-slate-100"><td className="px-3 py-2">P{attempt.candidateOrder}</td><td className="px-3 py-2 font-medium text-slate-700">{attempt.provider}<span className="block font-normal text-slate-400">{attempt.exactModel}</span></td><td className="px-3 py-2"><StatusBadge status={attempt.status} /></td><td className="max-w-44 truncate px-3 py-2 font-mono text-slate-500" title={attempt.providerTaskId || ''}>{attempt.providerTaskId || '—'}</td><td className="px-3 py-2">{attempt.upstreamCostUsd == null ? '—' : `$${attempt.upstreamCostUsd.toFixed(6)}`}</td><td className="max-w-64 px-3 py-2 text-red-600"><p className="truncate" title={attempt.errorMessage || ''}>{attempt.errorCode || attempt.errorMessage || '—'}</p></td></tr>)}</tbody></table></div>}
    </div></div></section>)}</div>;
}

function Execution({ jobs, unitById }: { jobs: DispatchJob[]; unitById: Map<string, GenerationUnit> }) {
  if (!jobs.length) return <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">暂无队列执行记录</div>;
  return <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[1150px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">分镜</th><th className="px-4 py-3">渠道 / 精确模型</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">优先级 / 重试</th><th className="px-4 py-3">Worker</th><th className="px-4 py-3">排队耗时</th><th className="px-4 py-3">执行耗时</th><th className="px-4 py-3">上游任务</th><th className="px-4 py-3">异常</th></tr></thead><tbody>{jobs.map((job) => { const unit = job.generationUnitId ? unitById.get(job.generationUnitId) : null; return <tr key={job.id} className="border-t border-slate-100 align-top"><td className="px-4 py-3 font-medium text-slate-700">{unit ? `#${unit.unitIndex + 1}` : '项目任务'}<span className="block max-w-32 truncate font-normal text-slate-400">{unit?.event}</span></td><td className="px-4 py-3 font-medium text-slate-700">{job.provider}<span className="block max-w-52 truncate font-normal text-slate-400" title={job.exactModel}>{job.exactModel}</span></td><td className="px-4 py-3"><StatusBadge status={job.status} /></td><td className="px-4 py-3 text-slate-600">{job.priority} / {job.retryCount}</td><td className="px-4 py-3"><span className="block max-w-40 truncate text-slate-600" title={job.leaseOwner || ''}>{job.leaseOwner || '—'}</span><span className="text-slate-400">{job.capacityGroup || '默认容量组'}</span></td><td className="px-4 py-3 text-slate-600">{durationLabel(secondsBetween(job.queuedAt, job.submitStartedAt || job.submittedAt))}</td><td className="px-4 py-3 text-slate-600">{durationLabel(secondsBetween(job.submitStartedAt || job.submittedAt, job.finishedAt))}</td><td className="max-w-48 truncate px-4 py-3 font-mono text-slate-500" title={job.providerTaskId || ''}>{job.providerTaskId || '—'}</td><td className="max-w-64 px-4 py-3 text-red-600"><p className="truncate" title={job.errorMessage || ''}>{job.errorCode || job.errorMessage || '—'}</p>{job.adminNote && <p className="mt-1 truncate text-amber-600">备注：{job.adminNote}</p>}</td></tr>; })}</tbody></table></div>;
}

function Snapshot({ detail }: { detail: ProjectDetail }) {
  return <div className="grid gap-4 xl:grid-cols-2"><JsonCard title="项目配置快照" value={detail.project.configSnapshot} /><JsonCard title="音乐素材元数据" value={detail.project.musicAsset} /><JsonCard title="歌手素材元数据" value={detail.project.singerPhotoAsset} /><JsonCard title="计费记录" value={detail.reservation ?? { mode: 'charge_on_success', reservedCredits: detail.project.reservedCredits, chargedCredits: detail.project.chargedCredits }} /></div>;
}

function JsonCard({ title, value }: { title: string; value: unknown }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">{title}</h2><pre className="max-h-[480px] overflow-auto p-5 text-xs leading-5 text-slate-600">{JSON.stringify(value, null, 2)}</pre></section>;
}
