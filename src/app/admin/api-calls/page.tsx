'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Activity, RefreshCw, Search } from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { PaginationBar } from '@/components/pagination-bar';
import { useServerPagination } from '@/lib/use-server-pagination';
import { formatDate } from '@/lib/utils';

type CallRow = {
  id: string; projectId: string; projectTitle: string; projectStatus: string;
  unitIndex: number | null; startSecond: number | null; plannedSeconds: number | null;
  provider: string; model: string; status: string; providerTaskId: string | null;
  upstreamCostUsd: number | null; errorCode: string | null; errorMessage: string | null;
  submittedAt: string | null; finishedAt: string | null; createdAt: string;
};
type ListResponse = { items: CallRow[]; total: number; page: number; pageSize: number };
type Facets = { providers: Array<{ value: string; count: number }>; models: Array<{ value: string; count: number }>; statuses: Array<{ value: string; count: number }> };

export default function ApiCallsPage() {
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const params = useMemo(() => ({ page, pageSize, search: search || undefined, status: status || undefined, provider: provider || undefined, model: model || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }), [page, pageSize, search, status, provider, model, dateFrom, dateTo]);
  const query = useQuery<ListResponse>({ queryKey: ['aimv-operations-calls', params], queryFn: () => apiClient.get('/admin/aimv-generator/operations/calls', { params }) as any });
  const facets = useQuery<Facets>({ queryKey: ['aimv-operations-call-facets', search, dateFrom, dateTo], queryFn: () => apiClient.get('/admin/aimv-generator/operations/calls/facets', { params: { search: search || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined } }) as any });
  const resetPage = () => setPage(1);

  return <div className="admin-page"><div className="space-y-5 p-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Activity className="h-5 w-5 text-violet-600" />AI MV API 调用记录</h1><p className="mt-1 text-sm text-slate-500">仅显示 /create-mv 产生的分镜视频模型调用、渠道切换、上游任务和错误。</p></div><button onClick={() => query.refetch()} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:text-violet-600" aria-label="刷新"><RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} /></button></header>
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3 xl:grid-cols-6">
      <label className="relative md:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} placeholder="项目编号或标题" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm" /></label>
      <Select value={status} setValue={(v) => { setStatus(v); resetPage(); }} placeholder="全部状态" options={facets.data?.statuses} />
      <Select value={provider} setValue={(v) => { setProvider(v); resetPage(); }} placeholder="全部渠道" options={facets.data?.providers} />
      <Select value={model} setValue={(v) => { setModel(v); resetPage(); }} placeholder="全部模型" options={facets.data?.models} />
      <div className="flex gap-2"><input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); resetPage(); }} className="min-w-0 rounded-lg border border-slate-200 px-2 text-xs" /><input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); resetPage(); }} className="min-w-0 rounded-lg border border-slate-200 px-2 text-xs" /></div>
    </section>
    <QueryState isLoading={query.isLoading} isError={query.isError} error={query.error} isEmpty={!query.data?.items.length} emptyMessage="暂无 AI MV 渠道调用记录" height="h-64">
      {query.data && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">项目 / 分镜</th><th className="px-4 py-3">渠道 / 模型</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">上游任务</th><th className="px-4 py-3">成本</th><th className="px-4 py-3">耗时</th><th className="px-4 py-3">错误</th><th className="px-4 py-3">时间</th></tr></thead><tbody className="divide-y divide-slate-100">{query.data.items.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="px-4 py-3"><Link href={`/admin/api-calls/aimv/${row.id}`} className="font-medium text-violet-700 hover:underline">{row.projectTitle || row.projectId}</Link><div className="text-[11px] text-slate-400">{row.projectId}{row.unitIndex == null ? '' : ` · #${row.unitIndex + 1}`}</div></td><td className="px-4 py-3 text-slate-700">{row.provider}<div className="max-w-xs truncate text-xs text-slate-400" title={row.model}>{row.model}</div></td><td className="px-4 py-3"><Status value={row.status} /></td><td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-slate-500" title={row.providerTaskId || ''}>{row.providerTaskId || '—'}</td><td className="px-4 py-3 text-slate-700">{row.upstreamCostUsd == null ? '未回传' : `$${row.upstreamCostUsd.toFixed(6)}`}</td><td className="px-4 py-3 text-slate-500">{elapsed(row.submittedAt, row.finishedAt)}</td><td className="max-w-xs px-4 py-3"><span className="line-clamp-2 text-xs text-rose-600" title={row.errorMessage || ''}>{row.errorCode || row.errorMessage || '—'}</span></td><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDate(row.createdAt)}</td></tr>)}</tbody></table></div><PaginationBar page={query.data.page} total={query.data.total} pageSize={query.data.pageSize} onPageChange={setPage} onPageSizeChange={onPageSizeChange} /></section>}
    </QueryState>
  </div></div>;
}

function Select({ value, setValue, placeholder, options }: { value: string; setValue: (value: string) => void; placeholder: string; options?: Array<{ value: string; count: number }> }) { return <select value={value} onChange={(e) => setValue(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600"><option value="">{placeholder}</option>{options?.map((item) => <option key={item.value} value={item.value}>{item.value} ({item.count})</option>)}</select>; }
function Status({ value }: { value: string }) { const ok = value === 'succeeded'; const bad = ['failed', 'cancelled', 'submission_unknown'].includes(value); return <span className={`rounded-full px-2 py-1 text-xs font-medium ${ok ? 'bg-emerald-50 text-emerald-700' : bad ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>{value}</span>; }
function elapsed(start?: string | null, end?: string | null) { if (!start) return '—'; const ms = new Date(end || Date.now()).getTime() - new Date(start).getTime(); if (!Number.isFinite(ms) || ms < 0) return '—'; return ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`; }
