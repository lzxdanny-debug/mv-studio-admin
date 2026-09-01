'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Eye,
  List,
  MousePointerClick,
  RefreshCw,
  Route,
  Users,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';

type Preset = 'today' | '7d' | '30d' | '90d';
type AnalyticsTab = 'overview' | 'events' | 'journeys';

interface AnalyticsOverview {
  range: { from: string; to: string };
  summary: {
    totalEvents: number;
    uniqueSessions: number;
    uniqueVisitors: number;
    loggedInUsers: number;
    pageViews: number;
    revenueUsd: number;
  };
  trend: { day: string; count: number; uniqueVisitors: number }[];
  eventBreakdown: {
    eventName: string;
    eventAlias: string;
    count: number;
    uniqueVisitors: number;
  }[];
  funnel: { key: string; label: string; count: number }[];
  dimensions: {
    sourcePages: DimensionItem[];
    modules: DimensionItem[];
    devices: DimensionItem[];
    countries: DimensionItem[];
    results: DimensionItem[];
  };
}

interface DimensionItem { value: string; count: number }

interface AnalyticsEvent {
  id: string;
  eventId: string;
  eventName: string;
  eventAlias: string;
  module: string | null;
  sourcePage: string | null;
  pagePath: string | null;
  pageUrl: string | null;
  pageTitle: string | null;
  referrer: string | null;
  sessionId: string | null;
  anonymousId: string | null;
  userId: string | null;
  browser: string | null;
  browserVersion: string | null;
  browserLanguage: string | null;
  country: string | null;
  device: string | null;
  os: string | null;
  osVersion: string | null;
  screenResolution: string | null;
  viewportSize: string | null;
  timezone: string | null;
  appVersion: string | null;
  properties: Record<string, unknown>;
  occurredAt: string;
}

interface EventsPayload {
  items: AnalyticsEvent[];
  total: number;
  page: number;
  pageSize: number;
}

interface JourneyPayload {
  items: Array<{
    sessionId: string;
    userId: string | null;
    anonymousId: string | null;
    startedAt: string;
    endedAt: string;
    matchedCount: number;
    events: AnalyticsEvent[];
  }>;
  total: number;
  page: number;
  pageSize: number;
}

interface ExportPayload { filename: string; total: number; items: AnalyticsEvent[] }

interface FilterPayload {
  events: { value: string; label: string }[];
  modules: string[];
  sourcePages: string[];
}

const PRESETS: Array<{ value: Preset; label: string }> = [
  { value: 'today', label: '今天' },
  { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' },
  { value: '90d', label: '近 90 天' },
];

function rangeFor(preset: Preset) {
  const to = new Date();
  const from = new Date(to);
  if (preset === 'today') from.setHours(0, 0, 0, 0);
  else from.setDate(from.getDate() - Number.parseInt(preset, 10));
  return { from: from.toISOString(), to: to.toISOString() };
}

function number(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(value));
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState<AnalyticsTab>('overview');
  const [preset, setPreset] = useState<Preset>('7d');
  const [eventName, setEventName] = useState('');
  const [module, setModule] = useState('');
  const [sourcePage, setSourcePage] = useState('');
  const [result, setResult] = useState('');
  const [page, setPage] = useState(1);
  const [journeyPage, setJourneyPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const pageSize = 30;
  const range = useMemo(() => rangeFor(preset), [preset]);

  const baseQuery = useMemo(() => {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (eventName) params.set('eventName', eventName);
    if (module) params.set('module', module);
    if (sourcePage) params.set('sourcePage', sourcePage);
    if (result) params.set('result', result);
    return params.toString();
  }, [eventName, module, range, result, sourcePage]);

  useEffect(() => { setPage(1); setJourneyPage(1); }, [baseQuery]);

  const overview = useQuery<AnalyticsOverview>({
    queryKey: ['admin', 'analytics', 'overview', baseQuery],
    queryFn: () => apiClient.get(`/admin/analytics/overview?${baseQuery}`) as any,
    placeholderData: (previous) => previous,
  });
  const events = useQuery<EventsPayload>({
    queryKey: ['admin', 'analytics', 'events', baseQuery, page],
    queryFn: () => apiClient.get(`/admin/analytics/events?${baseQuery}&page=${page}&pageSize=${pageSize}`) as any,
    placeholderData: (previous) => previous,
  });
  const filters = useQuery<FilterPayload>({
    queryKey: ['admin', 'analytics', 'filters'],
    queryFn: () => apiClient.get('/admin/analytics/filters') as any,
    staleTime: 5 * 60 * 1000,
  });
  const journeys = useQuery<JourneyPayload>({
    queryKey: ['admin', 'analytics', 'journeys', baseQuery, journeyPage],
    queryFn: () => apiClient.get(`/admin/analytics/journeys?${baseQuery}&page=${journeyPage}&pageSize=10`) as any,
    placeholderData: (previous) => previous,
    enabled: tab === 'journeys',
  });
  const isFetching = overview.isFetching || events.isFetching || journeys.isFetching;
  const totalPages = Math.max(1, Math.ceil((events.data?.total ?? 0) / pageSize));
  const journeyTotalPages = Math.max(1, Math.ceil((journeys.data?.total ?? 0) / 10));
  const trend = (overview.data?.trend ?? []).map((item) => ({
    ...item,
    label: new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(item.day)),
  }));

  const resetFilters = () => {
    setEventName(''); setModule(''); setSourcePage(''); setResult('');
  };

  const exportCsv = async () => {
    setExporting(true); setExportError('');
    try {
      const payload = await apiClient.get(`/admin/analytics/export?${baseQuery}`) as unknown as ExportPayload;
      downloadEventsCsv(payload);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="admin-page">
      <div className="p-6 space-y-5 max-w-[1700px]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />埋点分析
            </h1>
            <p className="text-sm text-slate-500 mt-1">核心事件与全局事件的趋势、转化和原始明细</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
              {PRESETS.map((item) => (
                <button key={item.value} onClick={() => setPreset(item.value)} className={cn(
                  'px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                  preset === item.value ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-800',
                )}>{item.label}</button>
              ))}
            </div>
            <button onClick={() => { overview.refetch(); events.refetch(); journeys.refetch(); filters.refetch(); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />刷新
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 border-b border-slate-200">
          {([
            { value: 'overview', label: '分析总览', icon: BarChart3 },
            { value: 'events', label: '事件列表', icon: List },
            { value: 'journeys', label: '用户路径', icon: Route },
          ] as Array<{ value: AnalyticsTab; label: string; icon: typeof BarChart3 }>).map((item) => (
            <button key={item.value} onClick={() => setTab(item.value)} className={cn(
              'relative inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors',
              tab === item.value ? 'text-blue-700' : 'text-slate-500 hover:text-slate-800',
            )}>
              <item.icon className="h-4 w-4" />{item.label}
              {tab === item.value && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded bg-blue-600" />}
            </button>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap gap-2">
          <FilterSelect value={eventName} onChange={setEventName} label="全部事件"
            options={(filters.data?.events ?? []).map((item) => ({ value: item.value, label: `${item.label} · ${item.value}` }))} />
          <FilterSelect value={module} onChange={setModule} label="全部模块"
            options={(filters.data?.modules ?? []).map((value) => ({ value, label: value }))} />
          <FilterSelect value={sourcePage} onChange={setSourcePage} label="全部来源页面"
            options={(filters.data?.sourcePages ?? []).map((value) => ({ value, label: value }))} />
          <FilterSelect value={result} onChange={setResult} label="全部结果" options={[
            { value: 'Success', label: '成功' }, { value: 'Failed', label: '失败' }, { value: 'Timeout', label: '超时' },
          ]} />
          {(eventName || module || sourcePage || result) && (
            <button onClick={resetFilters} className="px-3 py-2 text-xs text-blue-600 hover:text-blue-800">清除筛选</button>
          )}
        </div>

        {tab === 'overview' && <>
        <QueryState isLoading={overview.isLoading} isError={overview.isError} error={overview.error} isEmpty={false} height="h-32">
          {overview.data && <SummaryCards data={overview.data.summary} />}
        </QueryState>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <section className="xl:col-span-3 bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-800">事件趋势</h2>
            <p className="text-xs text-slate-400 mt-0.5">事件量与独立访客数</p>
            <div className="h-72 mt-3">
              {trend.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="eventCount" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.24}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, borderColor: '#e2e8f0', fontSize: 12 }} />
                    <Area type="monotone" dataKey="count" name="事件量" stroke="#2563eb" strokeWidth={2} fill="url(#eventCount)" />
                    <Area type="monotone" dataKey="uniqueVisitors" name="独立访客" stroke="#14b8a6" strokeWidth={2} fill="transparent" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
          </section>
          <section className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-800">事件分布</h2>
            <p className="text-xs text-slate-400 mt-0.5">按事件量排序，最多展示 10 项</p>
            <EventBreakdown items={(overview.data?.eventBreakdown ?? []).slice(0, 10)} />
          </section>
        </div>

        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-800">核心转化</h2>
          <p className="text-xs text-slate-400 mt-0.5">创作与支付分开计算，相邻步骤展示事件次数转化率</p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-4">
            <Funnel title="创作流程" steps={(overview.data?.funnel ?? []).slice(0, 4)} />
            <Funnel title="支付流程" steps={(overview.data?.funnel ?? []).slice(4)} />
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          <DimensionChart title="来源页面" data={overview.data?.dimensions.sourcePages ?? []} color="#2563eb" />
          <DimensionChart title="业务模块" data={overview.data?.dimensions.modules ?? []} color="#8b5cf6" />
          <DimensionChart title="设备类型" data={overview.data?.dimensions.devices ?? []} color="#14b8a6" />
          <DimensionChart title="国家 / 地区" data={overview.data?.dimensions.countries ?? []} color="#f59e0b" />
          <DimensionChart title="事件结果" data={overview.data?.dimensions.results ?? []} color="#f43f5e" />
        </div>
        </>}

        {tab === 'events' && <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div><h2 className="text-sm font-semibold text-slate-800">事件明细</h2><p className="text-xs text-slate-400 mt-0.5">共 {number(events.data?.total ?? 0)} 条</p></div>
            <div className="flex items-center gap-3">
              {exportError && <span className="max-w-md text-xs text-red-500">{exportError}</span>}
              <span className="text-xs text-slate-500">第 {page} / {totalPages} 页</span>
              <button onClick={exportCsv} disabled={exporting || !events.data?.total} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Download className="h-3.5 w-3.5" />{exporting ? '导出中…' : '导出 CSV'}
              </button>
            </div>
          </div>
          <EventTable query={events} />
          <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
            <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" />上一页</button>
            <button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">下一页<ChevronRight className="h-4 w-4" /></button>
          </div>
        </section>}

        {tab === 'journeys' && <JourneyList
          query={journeys}
          page={journeyPage}
          totalPages={journeyTotalPages}
          onPageChange={setJourneyPage}
        />}
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: { value: string; label: string }[] }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 min-w-36 max-w-72 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-500">
    <option value="">{label}</option>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
  </select>;
}

function SummaryCards({ data }: { data: AnalyticsOverview['summary'] }) {
  const cards = [
    { label: '事件总量', value: number(data.totalEvents), icon: Activity, color: 'text-blue-600 bg-blue-50' },
    { label: '独立访客', value: number(data.uniqueVisitors), icon: Users, color: 'text-violet-600 bg-violet-50' },
    { label: '会话数', value: number(data.uniqueSessions), icon: MousePointerClick, color: 'text-cyan-600 bg-cyan-50' },
    { label: '登录用户', value: number(data.loggedInUsers), icon: Users, color: 'text-amber-600 bg-amber-50' },
    { label: '页面浏览', value: number(data.pageViews), icon: Eye, color: 'text-emerald-600 bg-emerald-50' },
    { label: '成功支付金额', value: `$${data.revenueUsd.toFixed(2)}`, icon: CircleDollarSign, color: 'text-rose-600 bg-rose-50' },
  ];
  return <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">{cards.map((card) => <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4"><div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', card.color)}><card.icon className="h-4 w-4" /></div><div className="text-2xl font-bold text-slate-900 mt-3">{card.value}</div><div className="text-xs text-slate-500 mt-1">{card.label}</div></div>)}</div>;
}

function EventBreakdown({ items }: { items: AnalyticsOverview['eventBreakdown'] }) {
  const max = Math.max(...items.map((item) => item.count), 1);
  if (!items.length) return <div className="h-72"><Empty /></div>;
  return <div className="mt-4 space-y-3">{items.map((item) => <div key={item.eventName}><div className="flex justify-between gap-3 text-xs"><div className="min-w-0"><span className="font-medium text-slate-700">{item.eventAlias}</span><span className="ml-1.5 text-slate-400">{item.eventName}</span></div><span className="font-semibold text-slate-700">{number(item.count)}</span></div><div className="h-1.5 rounded-full bg-slate-100 mt-1.5 overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(2, item.count / max * 100)}%` }} /></div></div>)}</div>;
}

function Funnel({ title, steps }: { title: string; steps: AnalyticsOverview['funnel'] }) {
  return <div><div className="text-xs font-medium text-slate-600 mb-2">{title}</div><div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(steps.length, 1)}, minmax(0, 1fr))` }}>{steps.map((step, index) => { const previous = steps[index - 1]?.count; const conversion = index === 0 ? null : previous ? step.count / previous * 100 : 0; return <div key={step.key} className="relative rounded-lg border border-slate-200 bg-slate-50 p-3 min-w-0"><div className="text-xs text-slate-500 truncate">{step.label}</div><div className="text-xl font-bold text-slate-900 mt-1">{number(step.count)}</div>{conversion !== null && <div className={cn('text-[11px] mt-1', conversion > 100 ? 'text-amber-600' : 'text-emerald-600')}>{conversion.toFixed(1)}%</div>}</div>; })}</div></div>;
}

function DimensionChart({ title, data, color }: { title: string; data: DimensionItem[]; color: string }) {
  return <section className="bg-white border border-slate-200 rounded-xl p-4">
    <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
    <p className="text-xs text-slate-400 mt-0.5">按事件量统计</p>
    <div className="mt-3" style={{ height: Math.max(180, Math.min(320, data.length * 30)) }}>
      {data.length ? <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis type="category" dataKey="value" width={88} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
          <Tooltip formatter={(value) => [number(Number(value)), '事件量']} contentStyle={{ borderRadius: 10, borderColor: '#e2e8f0', fontSize: 12 }} />
          <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} barSize={14} />
        </RechartsBarChart>
      </ResponsiveContainer> : <Empty />}
    </div>
  </section>;
}

function EventTable({ query }: { query: ReturnType<typeof useQuery<EventsPayload>> }) {
  if (query.isLoading) return <div className="h-48 flex items-center justify-center text-sm text-slate-400">正在读取事件…</div>;
  if (query.isError) return <div className="h-48 flex items-center justify-center text-sm text-red-500">{query.error instanceof Error ? query.error.message : '读取失败'}</div>;
  if (!query.data?.items.length) return <div className="h-48"><Empty /></div>;
  const th = 'px-3 py-3 font-medium whitespace-nowrap border-r border-slate-100 last:border-r-0';
  const td = 'px-3 py-3 text-slate-600 whitespace-nowrap border-r border-slate-50 last:border-r-0';
  const short = (value: string | null) => value || '—';
  return <div className="w-full overflow-x-scroll pb-2">
    <table className="min-w-[2850px] w-max text-left text-xs">
      <thead className="bg-slate-50 text-slate-500 sticky top-0"><tr>
        <th className={th}>发生时间</th><th className={th}>事件名称</th><th className={th}>事件别名</th>
        <th className={th}>模块</th><th className={th}>来源页面</th><th className={th}>页面路径</th><th className={th}>结果</th>
        <th className={th}>用户 ID</th><th className={th}>匿名访客 ID</th><th className={th}>Session ID</th>
        <th className={th}>设备</th><th className={th}>操作系统</th><th className={th}>浏览器</th><th className={th}>国家</th>
        <th className={th}>屏幕分辨率</th><th className={th}>视窗大小</th><th className={th}>时区</th><th className={th}>应用版本</th><th className={th}>详情</th>
      </tr></thead>
      <tbody className="divide-y divide-slate-100">{query.data.items.map((event) => {
        const result = typeof event.properties?.Result === 'string' ? event.properties.Result : '';
        return <tr key={event.id} className="hover:bg-slate-50/70 align-top">
          <td className={cn(td, 'text-slate-500')}>{dateTime(event.occurredAt)}</td>
          <td className={cn(td, 'font-mono text-slate-700')}>{event.eventName}</td>
          <td className={cn(td, 'font-medium text-slate-800')}>{event.eventAlias}</td>
          <td className={td}>{short(event.module)}</td><td className={td}>{short(event.sourcePage)}</td>
          <td className={cn(td, 'max-w-64 truncate')} title={event.pagePath || ''}>{short(event.pagePath)}</td>
          <td className={td}>{result ? <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', result === 'Success' ? 'bg-emerald-100 text-emerald-700' : result === 'Timeout' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>{result}</span> : '—'}</td>
          <td className={cn(td, 'font-mono text-[10px]')}>{short(event.userId)}</td>
          <td className={cn(td, 'font-mono text-[10px]')}>{short(event.anonymousId)}</td>
          <td className={cn(td, 'font-mono text-[10px]')}>{short(event.sessionId)}</td>
          <td className={td}>{short(event.device)}</td><td className={td}>{[event.os, event.osVersion].filter(Boolean).join(' ') || '—'}</td>
          <td className={td}>{[event.browser, event.browserVersion].filter(Boolean).join(' ') || '—'}</td><td className={td}>{short(event.country)}</td>
          <td className={td}>{short(event.screenResolution)}</td><td className={td}>{short(event.viewportSize)}</td><td className={td}>{short(event.timezone)}</td><td className={td}>{short(event.appVersion)}</td>
          <td className={cn(td, 'min-w-36')}><details><summary className="cursor-pointer select-none text-blue-600">查看详情</summary><pre className="mt-2 max-h-80 w-[480px] overflow-auto whitespace-pre-wrap break-all rounded bg-slate-900 p-3 text-[10px] leading-4 text-slate-100">{JSON.stringify({ eventId: event.eventId, pageUrl: event.pageUrl, pageTitle: event.pageTitle, referrer: event.referrer, browserLanguage: event.browserLanguage, properties: event.properties }, null, 2)}</pre></details></td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

function JourneyList({ query, page, totalPages, onPageChange }: {
  query: ReturnType<typeof useQuery<JourneyPayload>>;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
      <div><h2 className="text-sm font-semibold text-slate-800">用户路径</h2><p className="text-xs text-slate-400 mt-0.5">按会话还原完整事件顺序，共 {number(query.data?.total ?? 0)} 个会话</p></div>
      <span className="text-xs text-slate-500">第 {page} / {totalPages} 页</span>
    </div>
    {query.isLoading ? <div className="h-48 flex items-center justify-center text-sm text-slate-400">正在还原用户路径…</div>
      : query.isError ? <div className="h-48 flex items-center justify-center text-sm text-red-500">{query.error instanceof Error ? query.error.message : '读取失败'}</div>
      : !query.data?.items.length ? <div className="h-48"><Empty /></div>
      : <div className="divide-y divide-slate-100">{query.data.items.map((journey) => <details key={journey.sessionId} className="group">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><Route className="h-4 w-4" /></div>
            <div><div className="flex items-center gap-1.5 text-sm font-medium text-slate-800"><ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" />{journey.userId ? `登录用户 ${journey.userId.slice(0, 8)}` : `匿名访客 ${(journey.anonymousId || '—').slice(0, 8)}`}</div><div className="text-[11px] text-slate-400 font-mono mt-0.5">Session {journey.sessionId}</div></div>
          </div>
          <div className="text-right text-xs text-slate-500"><div>{dateTime(journey.startedAt)} — {dateTime(journey.endedAt)}</div><div className="mt-1">完整路径 {journey.events.length} 个事件 · 命中筛选 {journey.matchedCount} 个</div><div className="mt-1 text-blue-600 group-open:hidden">点击查看完整路径</div><div className="mt-1 hidden text-blue-600 group-open:block">点击收起</div></div>
        </summary>
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4 overflow-x-auto"><div className="flex min-w-max items-stretch">{journey.events.map((event, index) => {
          const result = typeof event.properties?.Result === 'string' ? event.properties.Result : '';
          return <div key={event.id} className="flex items-center"><div className="w-44 rounded-lg border border-slate-200 bg-slate-50 p-3 self-stretch"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-slate-800">{event.eventAlias}</span>{result && <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-medium', result === 'Success' ? 'bg-emerald-100 text-emerald-700' : result === 'Timeout' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>{result}</span>}</div><div className="mt-1 truncate font-mono text-[10px] text-slate-400">{event.eventName}</div><div className="mt-2 text-[10px] text-slate-500">{new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(event.occurredAt))}</div><div className="mt-1 truncate text-[10px] text-slate-400">{event.sourcePage || event.pagePath || '未知页面'}</div></div>{index < journey.events.length - 1 && <div className="h-px w-7 bg-slate-300" />}</div>;
        })}</div></div>
      </details>)}</div>}
    <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="h-4 w-4" />上一页</button>
      <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40">下一页<ChevronRight className="h-4 w-4" /></button>
    </div>
  </section>;
}

function csvCell(value: unknown) {
  let text = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadEventsCsv(payload: ExportPayload) {
  const headers = ['发生时间', '事件ID', '事件名称', '事件别名', '模块', '来源页面', '页面路径', '页面URL', '页面标题', '来源地址', '用户ID', '匿名ID', '会话ID', '结果', '错误', '美元价格', '币种', '设备', '操作系统', '系统版本', '浏览器', '浏览器版本', '浏览器语言', '国家', '屏幕分辨率', '视窗大小', '时区', '应用版本', '完整属性'];
  const rows = payload.items.map((event) => [
    event.occurredAt, event.eventId, event.eventName, event.eventAlias, event.module, event.sourcePage, event.pagePath, event.pageUrl, event.pageTitle, event.referrer,
    event.userId, event.anonymousId, event.sessionId, event.properties?.Result, event.properties?.Error,
    event.properties?.Price_USD, event.properties?.Currency, event.device, event.os, event.osVersion, event.browser, event.browserVersion, event.browserLanguage, event.country,
    event.screenResolution, event.viewportSize, event.timezone, event.appVersion,
    event.properties,
  ]);
  const content = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${content}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = payload.filename; anchor.click();
  URL.revokeObjectURL(url);
}

function Empty() { return <div className="h-full flex items-center justify-center text-sm text-slate-400">当前范围暂无数据</div>; }
