'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Search, type LucideIcon } from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { PaginationBar } from '@/components/pagination-bar';
import { useServerPagination } from '@/lib/use-server-pagination';
import { formatDate } from '@/lib/utils';

type Kind = 'video' | 'storyboard' | 'llm';
type Item = {
  id: string; projectId: string; projectTitle: string; projectStatus?: string; projectStage?: string;
  status: string; stage?: string; anomalyKind?: 'failed' | 'stuck'; unitIndex?: number;
  startSecond?: number; plannedSeconds?: number; storyboardStatus?: string; storyboardImageUrl?: string | null;
  storyboardPrompt?: string; prompt?: string; provider?: string | null; model?: string | null;
  providerTaskId?: string | null; attemptStatus?: string | null; errorCode?: string | null;
  errorMessage?: string | null; storyboardError?: string | null; createdAt: string; updatedAt: string;
};
type Response = { items: Item[]; total: number; page: number; pageSize: number };

export function AimvOperationsAnomalyPage({ kind, title, description, emptyMessage, icon: Icon }: { kind: Kind; title: string; description: string; emptyMessage: string; icon: LucideIcon }) {
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const params = useMemo(() => ({ page, pageSize, search: search || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }), [page, pageSize, search, dateFrom, dateTo]);
  const query = useQuery<Response>({ queryKey: ['aimv-operation-anomalies', kind, params], queryFn: () => apiClient.get(`/admin/aimv-generator/operations/anomalies/${kind}`, { params }) as any });
  return <div className="admin-page"><div className="space-y-5 p-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Icon className="h-5 w-5 text-amber-600" />{title}</h1><p className="mt-1 text-sm text-slate-500">{description}</p></div><button onClick={() => query.refetch()} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:text-violet-600" aria-label="刷新"><RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} /></button></header>
    <section className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4"><label className="relative min-w-72 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="搜索项目编号或标题" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm" /></label><input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="rounded-lg border border-slate-200 px-3 text-sm" /><input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="rounded-lg border border-slate-200 px-3 text-sm" /></section>
    <QueryState isLoading={query.isLoading} isError={query.isError} error={query.error} isEmpty={!query.data?.items.length} emptyMessage={emptyMessage} height="h-64">{query.data && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">项目</th>{kind !== 'llm' && <th className="px-4 py-3">分镜</th>}<th className="px-4 py-3">异常状态</th>{kind === 'video' && <th className="px-4 py-3">渠道 / 模型</th>}<th className="px-4 py-3">错误原因</th>{kind !== 'llm' && <th className="px-4 py-3">提示词</th>}<th className="px-4 py-3">更新时间</th></tr></thead><tbody className="divide-y divide-slate-100">{query.data.items.map((row) => <tr key={row.id} className="align-top hover:bg-slate-50"><td className="px-4 py-3"><Link href={`/admin/ai-music-video/projects/${row.projectId}`} className="font-medium text-violet-700 hover:underline">{row.projectTitle || row.projectId}</Link><div className="text-[11px] text-slate-400">{row.projectId}</div></td>{kind !== 'llm' && <td className="px-4 py-3 text-slate-700">#{(row.unitIndex ?? 0) + 1}<div className="text-xs text-slate-400">{row.startSecond}s–{Number(row.startSecond || 0) + Number(row.plannedSeconds || 0)}s</div></td>}<td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${row.anomalyKind === 'stuck' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{row.anomalyKind === 'stuck' ? '卡住 ≥30min' : '失败'}</span><div className="mt-2 text-xs text-slate-400">{kind === 'storyboard' ? row.storyboardStatus : row.status}{row.stage ? ` · ${row.stage}` : ''}</div></td>{kind === 'video' && <td className="px-4 py-3 text-slate-700">{row.provider || '—'}<div className="max-w-xs truncate text-xs text-slate-400" title={row.model || ''}>{row.model || '—'}</div><div className="font-mono text-[10px] text-slate-400">{row.providerTaskId || ''}</div></td>}<td className="max-w-lg px-4 py-3"><div className="font-mono text-xs text-rose-700">{row.errorCode || '—'}</div><div className="mt-1 line-clamp-4 text-xs leading-5 text-slate-600" title={row.errorMessage || row.storyboardError || ''}>{row.errorMessage || row.storyboardError || '未记录详细错误'}</div></td>{kind !== 'llm' && <td className="max-w-md px-4 py-3"><div className="line-clamp-4 text-xs leading-5 text-slate-600" title={(kind === 'storyboard' ? row.storyboardPrompt : row.prompt) || ''}>{(kind === 'storyboard' ? row.storyboardPrompt : row.prompt) || '—'}</div></td>}<td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDate(row.updatedAt)}</td></tr>)}</tbody></table></div><PaginationBar page={query.data.page} total={query.data.total} pageSize={query.data.pageSize} onPageChange={setPage} onPageSizeChange={onPageSizeChange} /></section>}</QueryState>
  </div></div>;
}
