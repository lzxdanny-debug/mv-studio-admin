'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { CheckCircle2, Download, Eye, Film, Loader2, RefreshCw, X } from 'lucide-react';
import apiClient from '@/lib/api';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { SearchBar } from '@/components/search-bar';
import { StatusBadge } from '@/components/status-badge';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn, formatDate } from '@/lib/utils';
import { createTimeRange, TimeRangeFilter, type TimeRangeSelection } from '@/components/time-range-filter';

type ProjectRow = {
  id: string;
  mvId: string;
  title: string;
  status: string;
  stage: string;
  progressPercent: number;
  productModelCode: string;
  actualModels: string;
  durationSec: number;
  actualDurationSec: number | string;
  aspectRatio: string;
  resolution: string;
  videoFormat: string;
  reservedCredits: number;
  chargedCredits: number;
  upstreamCostUsd: string | null;
  usdPerCredit: string | null;
  pendingReconciliationCount: number | string;
  actionableReconciliationCount: number | string;
  resultUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  userDisplayName: string | null;
  userEmail: string | null;
};
type ListResponse = { items: ProjectRow[]; total: number; page: number; pageSize: number; usdPerCredit: number; averageGrossMarginRatio: number | null; grossMarginProjectCount: number };
type FilterOptions = { productModels: string[]; actualModels: string[]; resolutions: string[] };
type ReconcileProgress = {
  running: boolean;
  total: number;
  completed: number;
  currentMvId: string | null;
  matched: number;
  unmatched: number;
  failed: number;
  firstError: string;
};

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '排队中', value: 'queued' },
  { label: '生成中', value: 'generating' },
  { label: '合成中', value: 'composing' },
  { label: '已完成', value: 'succeeded' },
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'cancelled' },
];

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ label: string; value: string }>; onChange: (value: string) => void }) {
  return <label className="space-y-1"><span className="text-[11px] font-medium text-slate-500">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100">{options.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}</select></label>;
}

function actualModelFilterLabel(value: string) {
  return /^alibaba\/wan(?:-|\/|$)/i.test(value) ? 'wan' : value;
}

export default function AiMusicVideoProjectsPage() {
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [status, setStatus] = useState('succeeded');
  const [reconciliation, setReconciliation] = useState<'all' | 'pending'>('all');
  const [search, setSearch] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRangeSelection>(() => createTimeRange('all'));
  const [productModelCode, setProductModelCode] = useState('');
  const [actualModel, setActualModel] = useState('');
  const [durationFrom, setDurationFrom] = useState('');
  const [durationTo, setDurationTo] = useState('');
  const [resolution, setResolution] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [reconcileProgress, setReconcileProgress] = useState<ReconcileProgress | null>(null);
  const reconcileLockRef = useRef(false);
  const filterOptions = useQuery<FilterOptions>({
    queryKey: ['admin', 'ai-music-video', 'projects', 'filter-options'],
    queryFn: () => apiClient.get('/admin/aimv-generator/projects/filter-options') as any,
    staleTime: 5 * 60 * 1000,
  });
  const appendFilters = (params: URLSearchParams) => {
    if (status) params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    if (reconciliation === 'pending') params.set('reconciliation', 'pending');
    if (timeRange.fromMs != null) params.set('dateFrom', new Date(timeRange.fromMs).toISOString());
    if (timeRange.toMs != null) params.set('dateTo', new Date(timeRange.toMs).toISOString());
    if (productModelCode) params.set('productModelCode', productModelCode);
    if (actualModel) params.set('actualModel', actualModel);
    if (durationFrom.trim()) params.set('durationFrom', durationFrom.trim());
    if (durationTo.trim()) params.set('durationTo', durationTo.trim());
    if (resolution) params.set('resolution', resolution);
  };
  const query = useQuery<ListResponse>({
    queryKey: ['admin', 'ai-music-video', 'projects', { page, pageSize, status, search, reconciliation, timeRange, productModelCode, actualModel, durationFrom, durationTo, resolution }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      appendFilters(params);
      return apiClient.get(`/admin/aimv-generator/projects?${params.toString()}`) as any;
    },
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, pageSize, status, search, reconciliation, timeRange, productModelCode, actualModel, durationFrom, durationTo, resolution]);

  const actionableRows = (query.data?.items ?? []).filter((row) => Number(row.actionableReconciliationCount) > 0);
  const allPendingRowsSelected = actionableRows.length > 0 && actionableRows.every((row) => selectedIds.has(row.mvId));

  const toggleCurrentPage = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allPendingRowsSelected) actionableRows.forEach((row) => next.delete(row.mvId));
      else actionableRows.forEach((row) => next.add(row.mvId));
      return next;
    });
  };

  const toggleProject = (mvId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(mvId)) next.delete(mvId);
      else next.add(mvId);
      return next;
    });
  };

  const reconcileProjects = async (mvIds: string[]) => {
    const uniqueMvIds = [...new Set(mvIds)];
    if (!uniqueMvIds.length || reconcileLockRef.current) return;
    reconcileLockRef.current = true;
    setReconciling(true);
    setReconcileResult(null);
    setReconcileProgress({ running: true, total: uniqueMvIds.length, completed: 0, currentMvId: uniqueMvIds[0], matched: 0, unmatched: 0, failed: 0, firstError: '' });
    let matched = 0;
    let unmatched = 0;
    let failed = 0;
    let firstError = '';
    for (let index = 0; index < uniqueMvIds.length; index += 1) {
      const mvId = uniqueMvIds[index];
      setReconcileProgress((current) => current ? { ...current, currentMvId: mvId } : current);
      try {
        const result = await apiClient.post(`/admin/aimv-generator/projects/${encodeURIComponent(mvId)}/reconcile-cost`) as unknown as { matched?: number; unmatched?: number };
        matched += Number(result.matched ?? 0);
        unmatched += Number(result.unmatched ?? 0);
      } catch (error) {
        failed += 1;
        const failure = error as { response?: { data?: { message?: string } }; message?: string };
        firstError ||= failure.response?.data?.message || failure.message || '对账失败';
      }
      setReconcileProgress((current) => current ? {
        ...current,
        completed: index + 1,
        matched,
        unmatched,
        failed,
        firstError,
      } : current);
    }
    setSelectedIds(new Set());
    setReconcileResult({
      ok: failed === 0,
      text: failed === 0
        ? `已处理 ${uniqueMvIds.length} 个项目：匹配 ${matched} 条，未匹配 ${unmatched} 条。`
        : `已处理 ${uniqueMvIds.length} 个项目：匹配 ${matched} 条，${failed} 个项目失败。${firstError}`,
    });
    await query.refetch();
    setReconcileProgress((current) => current ? { ...current, running: false, currentMvId: null } : current);
    setReconciling(false);
    reconcileLockRef.current = false;
  };

  const exportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError('');
    try {
      const params = new URLSearchParams();
      appendFilters(params);
      const suffix = params.size ? `?${params.toString()}` : '';
      const blob = await apiClient.get(`/admin/aimv-generator/projects/export.xlsx${suffix}`, {
        responseType: 'blob',
      }) as unknown as Blob;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `aimv-projects-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  const columns: DataTableColumn<ProjectRow>[] = [
    { key: 'select', header: <input type="checkbox" aria-label="选择本页可自动对账项目" checked={allPendingRowsSelected} disabled={!actionableRows.length || reconciling} onChange={toggleCurrentPage} className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />, width: 'w-12', align: 'center', render: (row) => <input type="checkbox" aria-label={`选择 ${row.mvId}`} title={Number(row.actionableReconciliationCount) > 0 ? '选择自动对账' : '历史记录缺少 Mountsea Trace ID，无法自动对账'} checked={selectedIds.has(row.mvId)} disabled={Number(row.actionableReconciliationCount) <= 0 || reconciling} onChange={() => toggleProject(row.mvId)} className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 disabled:opacity-30" /> },
    { key: 'title', header: '视频名', width: 'w-64', render: (row) => <div className="min-w-0"><p className="max-w-56 truncate font-medium text-slate-900" title={row.title}>{row.title || '(未命名)'}</p><p className="max-w-56 truncate font-mono text-xs text-slate-400" title={row.mvId}>{row.mvId}</p></div> },
    { key: 'user', header: '用户', width: 'w-56', render: (row) => <div className="min-w-0"><p className="max-w-48 truncate text-sm text-slate-700">{row.userDisplayName || '—'}</p><p className="max-w-48 truncate text-xs text-slate-400">{row.userEmail || '—'}</p></div> },
    { key: 'status', header: '状态', width: 'w-32', render: (row) => <div className="space-y-1"><StatusBadge status={row.status} kind="mvProject" /><p className="text-[10px] text-slate-400">{row.stage} · {row.progressPercent}%</p></div> },
    { key: 'productModelCode', header: 'AI 模型-展示', width: 'w-44', render: (row) => <span className="text-xs text-slate-600">{row.productModelCode || '—'}</span> },
    { key: 'actualModels', header: 'AI 模型-实际', width: 'w-64', render: (row) => <span className="block max-w-60 whitespace-normal break-words text-xs text-slate-600" title={row.actualModels}>{row.actualModels || '—'}</span> },
    { key: 'durationSec', header: '设定时长', width: 'w-24', render: (row) => <span className="whitespace-nowrap text-xs text-slate-600">{row.durationSec ? `${row.durationSec}s` : '—'}</span> },
    { key: 'actualDurationSec', header: '真实时长', width: 'w-28', render: (row) => <span className="whitespace-nowrap text-xs font-medium text-slate-700">{`${row.actualDurationSec || 0}s`}</span> },
    { key: 'resolution', header: '分辨率', width: 'w-28', render: (row) => <div className="whitespace-nowrap text-xs text-slate-600"><p>{row.resolution || '—'}</p><p className="text-slate-400">{row.aspectRatio || '—'}</p></div> },
    { key: 'videoFormat', header: '视频格式', width: 'w-24', render: (row) => <span className="text-xs uppercase text-slate-600">{row.videoFormat || '—'}</span> },
    { key: 'reservedCredits', header: '预扣积分', width: 'w-28', render: (row) => <span className="whitespace-nowrap text-xs text-slate-600">{Number(row.reservedCredits || 0).toLocaleString()}</span> },
    { key: 'chargedCredits', header: '实扣积分', width: 'w-28', render: (row) => <span className="whitespace-nowrap text-xs font-medium text-slate-700">{Number(row.chargedCredits || 0).toLocaleString()}</span> },
    { key: 'upstreamCostUsd', header: '上游成本', width: 'w-48', render: (row) => { const pending = Number(row.pendingReconciliationCount); const actionable = Number(row.actionableReconciliationCount); const missingTrace = Math.max(0, pending - actionable); return <div className="whitespace-nowrap text-xs text-slate-600"><p>{row.upstreamCostUsd == null ? '待上报' : `$${Number(row.upstreamCostUsd).toFixed(6)}`}</p>{pending > 0 && <p className="text-amber-600">待对账 {pending} 条{missingTrace ? `（${missingTrace} 条缺少 Trace ID）` : ''}</p>}</div>; } },
    { key: 'grossMarginRatio', header: query.data?.averageGrossMarginRatio == null ? '毛利率（暂无均值）' : `毛利率（平均 ${(query.data.averageGrossMarginRatio * 100).toFixed(2)}%）`, width: 'w-44', render: (row) => { const usdPerCredit = Number(row.usdPerCredit) > 0 ? Number(row.usdPerCredit) : Number(query.data?.usdPerCredit || 0.01); const chargedUsd = Number(row.chargedCredits || 0) * usdPerCredit; const upstreamUsd = row.upstreamCostUsd == null ? null : Number(row.upstreamCostUsd); const pending = Number(row.pendingReconciliationCount) > 0; const margin = chargedUsd > 0 && upstreamUsd != null && !pending ? (chargedUsd - upstreamUsd) / chargedUsd : null; return <span className={cn('whitespace-nowrap text-xs font-medium', margin == null ? 'text-slate-400' : margin < 0 ? 'text-rose-600' : 'text-emerald-600')} title={`实扣收入 $${chargedUsd.toFixed(2)}（$${usdPerCredit}/积分）；上游成本 ${upstreamUsd == null ? '待上报' : `$${upstreamUsd.toFixed(6)}`}`}>{pending ? '待对账' : margin == null ? '—' : `${(margin * 100).toFixed(2)}%`}</span>; } },
    { key: 'createdAt', header: '创建时间', width: 'w-40', render: (row) => <span className="text-xs text-slate-500">{formatDate(row.createdAt)}</span> },
    { key: 'actions', header: '操作', width: 'w-52', headerClassName: 'sticky right-0 z-20 border-l border-slate-200 bg-slate-100 shadow-[-6px_0_10px_-8px_rgba(15,23,42,0.45)]', cellClassName: 'sticky right-0 z-10 border-l border-slate-100 bg-white shadow-[-6px_0_10px_-8px_rgba(15,23,42,0.35)]', render: (row) => <div className="flex items-center gap-3">{Number(row.actionableReconciliationCount) > 0 ? <button type="button" disabled={reconciling} onClick={() => void reconcileProjects([row.mvId])} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50"><RefreshCw className={reconciling ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />对账</button> : Number(row.pendingReconciliationCount) > 0 ? <span title="历史记录没有保存 Mountsea Trace ID，无法自动匹配账单" className="whitespace-nowrap text-[11px] text-slate-400">缺少 Trace ID</span> : null}<Link href={`/admin/ai-music-video/projects/${row.mvId}`} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-violet-600 hover:text-violet-700"><Eye className="h-3 w-3" />查看详情</Link></div> },
  ];

  return <div className="admin-page p-6 space-y-4">
    <div><h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Film className="h-5 w-5 text-violet-600" />AI Music Video 生成内容</h1><p className="mt-1 text-sm text-slate-500">管理 AI Music Video 工作台生成的项目、状态与成片，共 {query.data?.total ?? 0} 条。</p></div>
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar value={search} onChange={(value) => { setPage(1); setSearch(value); }} placeholder="搜索标题 / 用户名 / 邮箱" width="w-72" />
        <TimeRangeFilter value={timeRange} onChange={(value) => { setTimeRange(value); setPage(1); }} tone="violet" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <FilterSelect label="状态" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={STATUS_OPTIONS} />
        <FilterSelect label="展示模型" value={productModelCode} onChange={(value) => { setProductModelCode(value); setPage(1); }} options={[{ label: '全部展示模型', value: '' }, ...(filterOptions.data?.productModels ?? []).map((value) => ({ label: value, value }))]} />
        <FilterSelect label="实际模型" value={actualModel} onChange={(value) => { setActualModel(value); setPage(1); }} options={[{ label: '全部实际模型', value: '' }, ...(filterOptions.data?.actualModels ?? []).map((value) => ({ label: actualModelFilterLabel(value), value }))]} />
        <FilterSelect label="分辨率" value={resolution} onChange={(value) => { setResolution(value); setPage(1); }} options={[{ label: '全部分辨率', value: '' }, ...(filterOptions.data?.resolutions ?? []).map((value) => ({ label: value, value }))]} />
        <label className="space-y-1"><span className="text-[11px] font-medium text-slate-500">设定时长（秒）</span><div className="flex items-center gap-1"><input type="number" min="0" step="1" value={durationFrom} onChange={(event) => { setDurationFrom(event.target.value); setPage(1); }} placeholder="最小" className="h-9 min-w-0 w-full rounded-lg border border-slate-200 px-2 text-xs" /><span className="text-xs text-slate-400">至</span><input type="number" min="0" step="1" value={durationTo} onChange={(event) => { setDurationTo(event.target.value); setPage(1); }} placeholder="最大" className="h-9 min-w-0 w-full rounded-lg border border-slate-200 px-2 text-xs" /></div></label>
        <FilterSelect label="成本对账" value={reconciliation} onChange={(value) => { setReconciliation(value as 'all' | 'pending'); if (value === 'pending') setStatus(''); setPage(1); }} options={[{ label: '全部对账状态', value: 'all' }, { label: '待对账', value: 'pending' }]} />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button type="button" onClick={() => { setStatus('succeeded'); setReconciliation('all'); setSearch(''); setTimeRange(createTimeRange('all')); setProductModelCode(''); setActualModel(''); setDurationFrom(''); setDurationTo(''); setResolution(''); setPage(1); }} className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">重置筛选</button>
        <button type="button" onClick={() => void reconcileProjects([...selectedIds])} disabled={!selectedIds.size || reconciling} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">{reconciling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{reconciling ? '对账中…' : `批量对账${selectedIds.size ? `（${selectedIds.size}）` : ''}`}</button>
        <span className="text-xs text-slate-400">平均毛利基于 {query.data?.grossMarginProjectCount ?? 0} 个成本完整的筛选结果</span>
        <button type="button" onClick={() => void exportExcel()} disabled={exporting || !query.data?.total} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}{exporting ? '导出中…' : '导出 Excel'}</button>
        {exportError ? <span className="w-full text-right text-xs text-red-500">{exportError}</span> : null}
        {reconcileResult ? <span className={reconcileResult.ok ? 'w-full text-right text-xs text-emerald-600' : 'w-full text-right text-xs text-red-500'}>{reconcileResult.text}</span> : null}
      </div>
    </section>
    <DataTable<ProjectRow> columns={columns} rows={query.data?.items} rowKey={(row) => row.id} tableClassName="min-w-[2320px]" isLoading={query.isLoading} isError={query.isError} error={query.error} emptyMessage={reconciliation === 'pending' ? '暂无待对账的 AI Music Video 项目' : '暂无 AI Music Video 生成内容'} page={query.data?.page ?? page} pageSize={query.data?.pageSize ?? pageSize} total={query.data?.total} onPageChange={setPage} onPageSizeChange={onPageSizeChange} />
    {reconcileProgress ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="aimv-reconcile-progress-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id="aimv-reconcile-progress-title" className="text-lg font-semibold text-slate-900">{reconcileProgress.running ? '正在同步上游账单' : '对账处理完成'}</h2><p className="mt-1 text-xs text-slate-500">Mountsea Trace ID 精确对账</p></div><button type="button" aria-label="关闭对账进度" disabled={reconcileProgress.running} onClick={() => setReconcileProgress(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"><X className="h-4 w-4" /></button></div><div className="mt-6"><div className="mb-2 flex items-center justify-between text-xs text-slate-500"><span>{reconcileProgress.running && reconcileProgress.currentMvId ? `当前：${reconcileProgress.currentMvId}` : '全部项目已处理'}</span><span>{reconcileProgress.completed}/{reconcileProgress.total}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-500 transition-all duration-300" style={{ width: `${reconcileProgress.total ? reconcileProgress.completed / reconcileProgress.total * 100 : 0}%` }} /></div></div><div className="mt-5 grid grid-cols-3 gap-3"><div className="rounded-xl bg-emerald-50 p-3 text-center"><p className="text-[11px] text-emerald-600">成功匹配</p><p className="mt-1 text-xl font-semibold text-emerald-700">{reconcileProgress.matched}</p></div><div className="rounded-xl bg-amber-50 p-3 text-center"><p className="text-[11px] text-amber-600">未匹配</p><p className="mt-1 text-xl font-semibold text-amber-700">{reconcileProgress.unmatched}</p></div><div className="rounded-xl bg-rose-50 p-3 text-center"><p className="text-[11px] text-rose-600">处理失败</p><p className="mt-1 text-xl font-semibold text-rose-700">{reconcileProgress.failed}</p></div></div>{reconcileProgress.firstError ? <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-700">{reconcileProgress.firstError}</p> : null}<div className="mt-6 flex justify-end">{reconcileProgress.running ? <div className="inline-flex items-center gap-2 text-sm font-medium text-violet-600"><Loader2 className="h-4 w-4 animate-spin" />请勿重复操作</div> : <button type="button" onClick={() => setReconcileProgress(null)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-700"><CheckCircle2 className="h-4 w-4" />完成</button>}</div></section></div> : null}
  </div>;
}
