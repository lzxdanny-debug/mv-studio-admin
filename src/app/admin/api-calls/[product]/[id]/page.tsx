'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { formatDate } from '@/lib/utils';

type Detail = {
  id: string; provider: string; exactModel?: string; model: string; status: string;
  providerTaskId: string | null; upstreamCostUsd: number | null; errorCode: string | null;
  errorMessage: string | null; submittedAt: string | null; finishedAt: string | null; createdAt: string;
  project: { id: string; title: string; status: string; stage: string; model: string; resolution: string; aspectRatio: string; durationSec: number };
  unit: null | { id: string; index: number; status: string; startSecond: number; plannedSeconds: number; event: string; prompt: string; storyboardPrompt: string; storyboardStatus: string; storyboardImageUrl: string | null; errorCode: string | null; errorMessage: string | null };
  dispatch: null | { id: string; status: string; priority: number; retryCount: number; leaseOwner: string | null; queuedAt: string; submittedAt: string | null; finishedAt: string | null; errorCode: string | null; errorMessage: string | null };
  metadata: Record<string, unknown>;
};

export default function AimvCallDetailPage() {
  const { id } = useParams<{ product: string; id: string }>();
  const query = useQuery<Detail>({ queryKey: ['aimv-call-detail', id], queryFn: () => apiClient.get(`/admin/aimv-generator/operations/calls/${encodeURIComponent(id)}`) as any, enabled: !!id });
  const data = query.data;
  return <div className="admin-page"><div className="space-y-5 p-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><Link href="/admin/api-calls" className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"><ArrowLeft className="h-3.5 w-3.5" />返回调用记录</Link><h1 className="text-xl font-bold text-slate-900">AI MV 调用详情</h1><p className="mt-1 font-mono text-xs text-slate-400">{id}</p></div>{data && <Link href={`/admin/ai-music-video/projects/${data.project.id}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><ExternalLink className="h-4 w-4" />打开项目详情</Link>}</header>
    <QueryState isLoading={query.isLoading} isError={query.isError} error={query.error} isEmpty={!data} emptyMessage="未找到 AI MV 调用记录" height="h-64">{data && <div className="grid gap-4 xl:grid-cols-2">
      <Card title="渠道调用"><Field label="状态" value={data.status} /><Field label="渠道" value={data.provider} /><Field label="精确模型" value={data.model || data.exactModel} /><Field label="上游任务 ID" value={data.providerTaskId} mono /><Field label="上游成本" value={data.upstreamCostUsd == null ? '未回传' : `$${data.upstreamCostUsd.toFixed(6)}`} /><Field label="创建时间" value={formatDate(data.createdAt)} /><Field label="提交时间" value={data.submittedAt ? formatDate(data.submittedAt) : null} /><Field label="完成时间" value={data.finishedAt ? formatDate(data.finishedAt) : null} /></Card>
      <Card title="项目"><Field label="项目" value={`${data.project.title} · ${data.project.id}`} /><Field label="项目状态" value={`${data.project.status} · ${data.project.stage}`} /><Field label="展示模型" value={data.project.model} /><Field label="规格" value={`${data.project.durationSec}s · ${data.project.resolution} · ${data.project.aspectRatio}`} /></Card>
      <Card title="分镜与提示词"><Field label="分镜" value={data.unit ? `#${data.unit.index + 1} · ${data.unit.startSecond}s–${data.unit.startSecond + data.unit.plannedSeconds}s` : null} /><Field label="分镜状态" value={data.unit?.status} /><Text label="镜头描述" value={data.unit?.event} /><Text label="视频提示词" value={data.unit?.prompt} /><Text label="故事板提示词" value={data.unit?.storyboardPrompt} /></Card>
      <Card title="排队与 Worker"><Field label="队列状态" value={data.dispatch?.status} /><Field label="优先级" value={data.dispatch?.priority} /><Field label="重试次数" value={data.dispatch?.retryCount} /><Field label="Worker" value={data.dispatch?.leaseOwner} /><Field label="入队时间" value={data.dispatch?.queuedAt ? formatDate(data.dispatch.queuedAt) : null} /></Card>
      <div className="xl:col-span-2"><Card title="错误信息"><Field label="错误码" value={data.errorCode || data.dispatch?.errorCode || data.unit?.errorCode} mono /><Text label="完整错误" value={data.errorMessage || data.dispatch?.errorMessage || data.unit?.errorMessage} danger /><Text label="调用元数据" value={JSON.stringify(data.metadata || {}, null, 2)} mono /></Card></div>
    </div>}</QueryState>
  </div></div>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><h2 className="border-b border-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h2><div className="divide-y divide-slate-100 px-5 py-2">{children}</div></section>; }
function Field({ label, value, mono }: { label: string; value: unknown; mono?: boolean }) { return <div className="flex items-start justify-between gap-5 py-3 text-sm"><span className="text-slate-500">{label}</span><span className={`max-w-[70%] break-all text-right text-slate-800 ${mono ? 'font-mono text-xs' : ''}`}>{value == null || value === '' ? '—' : String(value)}</span></div>; }
function Text({ label, value, danger, mono }: { label: string; value?: string | null; danger?: boolean; mono?: boolean }) { return <div className="py-3"><div className="mb-2 text-sm text-slate-500">{label}</div><pre className={`whitespace-pre-wrap break-words rounded-xl p-3 text-xs leading-5 ${danger ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-700'} ${mono ? 'font-mono' : 'font-sans'}`}>{value || '—'}</pre></div>; }
