'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ExternalLink, Film, Loader2, Search, Sparkles } from 'lucide-react';
import apiClient from '@/lib/api';

type CreatedItem = {
  id: string;
  userId: string;
  productLine: string;
  resultUrl: string | null;
  coverUrl: string | null;
  quoteCredits: number;
  createdAt: string;
  finishedAt: string | null;
  configSnapshot?: { productName?: string; productSlug?: string; formCode?: string };
};

const LINE_LABELS: Record<string, string> = {
  viral_presets: 'Viral Presets',
  ai_presets: 'AI Presets',
  mv_templates: 'MV Templates',
};

export default function InspirationCreatedPage() {
  const [line, setLine] = useState('');
  const [search, setSearch] = useState('');
  const query = useQuery<CreatedItem[]>({
    queryKey: ['inspiration', 'created'],
    queryFn: () => apiClient.get('/admin/inspiration/tasks', { params: { status: 'succeeded' } }) as Promise<CreatedItem[]>,
    refetchInterval: 30_000,
  });
  const items = (query.data ?? []).filter((item) => {
    if (line && item.productLine !== line) return false;
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return [item.id, item.userId, item.configSnapshot?.productName, item.configSnapshot?.productSlug]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(keyword));
  });

  return <div className="h-full overflow-y-auto bg-slate-50">
    <div className="mx-auto w-full max-w-[1680px] space-y-5 p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-violet-600">生成内容</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-950"><Sparkles className="h-6 w-6 text-violet-600"/>Inspiration 成片</h1><p className="mt-2 text-sm text-slate-500">集中查看 Inspiration 各产品线已经成功交付的 MV，不包含进行中或失败任务。</p></div>
        <div className="rounded-xl bg-violet-50 px-4 py-3 text-right"><p className="text-xs text-violet-600">当前成片</p><p className="mt-0.5 text-2xl font-bold text-violet-900">{query.data?.length ?? 0}</p></div>
      </header>

      <section className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="relative min-w-64 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索成片、用户或模板" className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"/></label>
        <select value={line} onChange={(event) => setLine(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400"><option value="">全部产品线</option>{Object.entries(LINE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </section>

      {query.isLoading ? <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-violet-500"/></div> : items.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{items.map((item) => <article key={item.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="relative aspect-video bg-slate-950">{item.resultUrl ? <video src={item.resultUrl} poster={item.coverUrl || undefined} controls preload="metadata" className="h-full w-full object-contain"/> : item.coverUrl ? <img src={item.coverUrl} alt="" className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-slate-600"><Film className="h-8 w-8"/></div>}<span className="absolute left-3 top-3 rounded-full bg-slate-950/70 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">{LINE_LABELS[item.productLine] ?? item.productLine}</span></div>
        <div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-semibold text-slate-900">{item.configSnapshot?.productName || item.configSnapshot?.productSlug || 'Inspiration MV'}</h2><p className="mt-1 truncate font-mono text-[11px] text-slate-400">{item.id}</p></div>{item.resultUrl ? <a href={item.resultUrl} target="_blank" rel="noreferrer" title="打开成片" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-violet-300 hover:text-violet-700"><ExternalLink className="h-4 w-4"/></a> : null}</div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5"/>{new Date(item.finishedAt || item.createdAt).toLocaleString()}</span><span className="font-medium text-slate-700">{item.quoteCredits} Credits</span></div></div>
      </article>)}</div> : <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-slate-400"><Film className="h-8 w-8"/><p className="mt-3 text-sm">暂无符合条件的 Inspiration 成片</p></div>}
    </div>
  </div>;
}
