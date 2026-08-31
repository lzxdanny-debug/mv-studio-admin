'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, BrainCircuit, CheckCircle2, Eye, Image as ImageIcon, Loader2, LockKeyhole, Mic2, Plus, Route, Save, Trash2 } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { useAdminAuthStore } from '@/stores/admin-auth.store';

type Provider = 'mountsea' | 'apisale' | 'smartfashion' | 'aitokens' | 'google';
type Capability = 'videoSingleRef' | 'videoMultiRef' | 'videoGrok' | 'videoUltron' | 'videoLipsync' | 'audioAnalyze' | 'imageNanoBanana';

interface Catalog {
  providers: Provider[];
  models: Partial<Record<Provider, string[]>>;
  capabilities: Capability[];
  capabilityModels: Record<Capability, Partial<Record<Provider, string[]>>>;
  auxiliaryCapabilities: Capability[];
  auxiliaryCapabilityModels: Record<Capability, Partial<Record<Provider, string[]>>>;
}

interface ModelRoute {
  id?: string;
  capability: Capability;
  provider: Provider;
  exactModel: string;
  priority: number;
  timeoutSec: number;
  maxAttempts: number;
  enabled: boolean;
}

interface ProductModel {
  id: string;
  code: string;
  nameEn: string;
  descriptionEn: string;
  sortOrder: number;
  enabled: boolean;
  translationStatus: string;
  price: { enabled: boolean } | null;
  routes: ModelRoute[];
}

const CAPABILITY_LABELS: Record<Capability, string> = {
  videoSingleRef: '单图生成',
  videoMultiRef: '多图参考',
  videoGrok: 'Grok 视频',
  videoUltron: 'Ultron',
  videoLipsync: '对口型',
  audioAnalyze: '音乐分析',
  imageNanoBanana: '分镜图片',
};

function familyOf(model: string) {
  const value = model.toLowerCase();
  const known = ['seedance', 'veo', 'kling', 'grok', 'runway', 'minimax', 'hailuo', 'wan', 'pixverse', 'luma', 'hunyuan'];
  const matched = known.find((name) => value.includes(name));
  if (matched) return matched === 'hailuo' ? 'minimax' : matched;
  const parts = model.split('/').filter(Boolean);
  const base = parts.length > 1 ? parts[1] : parts[0] ?? model;
  return base.replace(/-(?:v)?\d+(?:\.\d+)*(?:-.*)?$/i, '').replace(/-(?:fast|pro|turbo)$/i, '');
}

function displayName(code: string) {
  const labels: Record<string, string> = { seedance: 'Seedance', veo: 'Veo', kling: 'Kling', grok: 'Grok', runway: 'Runway', minimax: 'MiniMax', wan: 'Wan', pixverse: 'PixVerse', luma: 'Luma', hunyuan: 'Hunyuan' };
  return labels[code] ?? code.split('-').map((item) => item.charAt(0).toUpperCase() + item.slice(1)).join(' ');
}

export function AimvModelConfig() {
  const [tab, setTab] = useState<'display' | 'routing' | 'analysis' | 'image' | 'lipsync'>('display');
  return <div className="space-y-5">
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
      <Tab active={tab === 'display'} icon={Eye} onClick={() => setTab('display')}>展示模型</Tab>
      <Tab active={tab === 'routing'} icon={Route} onClick={() => setTab('routing')}>路由优先级</Tab>
      <Tab active={tab === 'analysis'} icon={BrainCircuit} onClick={() => setTab('analysis')}>LLM / 音乐分析</Tab>
      <Tab active={tab === 'image'} icon={ImageIcon} onClick={() => setTab('image')}>分镜图片</Tab>
      <Tab active={tab === 'lipsync'} icon={Mic2} onClick={() => setTab('lipsync')}>对口型优先级</Tab>
    </div>
    {tab === 'display' ? <DisplayModels /> : tab === 'routing' ? <RoutingPriority /> : tab === 'analysis' ? <AuxiliaryPriority kind="analysis" /> : tab === 'image' ? <AuxiliaryPriority kind="image" /> : <LipsyncPriority />}
  </div>;
}

function DisplayModels() {
  const qc = useQueryClient();
  const canEdit = useAdminAuthStore((state) => state.hasPermission('aimv.routing.edit'));
  const catalog = useQuery<Catalog>({ queryKey: ['aimv-model-meta'], queryFn: () => apiClient.get('/admin/aimv-generator/models/meta') as Promise<Catalog> });
  const models = useQuery<ProductModel[]>({ queryKey: ['aimv-models'], queryFn: () => apiClient.get('/admin/aimv-generator/models') as Promise<ProductModel[]> });
  const candidates = useMemo(() => {
    const rows: Array<{ family: string; provider: Provider; exactModel: string; capability: Capability }> = [];
    const seen = new Set<string>();
    if (!catalog.data) return rows;
    for (const capability of catalog.data.capabilities) for (const provider of catalog.data.providers) {
      for (const exactModel of catalog.data.capabilityModels[capability]?.[provider] ?? []) {
        const key = `${provider}:${exactModel}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ family: familyOf(exactModel), provider, exactModel, capability });
      }
    }
    return rows;
  }, [catalog.data]);
  const families = [...new Set(candidates.map((item) => item.family))].sort();
  const existing = new Set((models.data ?? []).map((item) => item.code));
  const available = families.filter((family) => !existing.has(family));
  const [family, setFamily] = useState('');
  useEffect(() => {
    if (!available.includes(family)) setFamily(available[0] ?? '');
  }, [available.join('|'), family]);
  const create = useMutation({
    mutationFn: (selectedFamily: string) => apiClient.post('/admin/aimv-generator/models', { code: selectedFamily, nameEn: displayName(selectedFamily), descriptionEn: `${displayName(selectedFamily)} video model` }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['aimv-models'] }); },
  });
  if (catalog.isLoading || models.isLoading) return <Loading />;
  return <>
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[280px] max-w-xl flex-1"><Label>展示模型</Label><select disabled={create.isPending} value={family} onChange={(event) => setFamily(event.target.value)} className="control"><option value="">暂无可添加模型</option>{available.map((item) => <option key={item} value={item}>{displayName(item)}</option>)}</select></div>
        {canEdit && <button disabled={!family || create.isPending} onClick={() => { if (!create.isPending) create.mutate(family); }} className="primary-button h-10">{create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{create.isPending ? '添加中' : '加入展示'}</button>}
      </div>
      <p className="mt-3 text-xs text-slate-500">展示模型只决定用户端看到的名称，与实际调用渠道没有绑定关系。候选名称来自已配置渠道中的视频模型，并合并 fast、版本号和生成方式。</p>
      {create.isError && <ErrorText error={create.error} />}
    </section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">用户端展示列表</h2><p className="mt-1 text-xs text-slate-500">展示开关与路由开关相互独立；产品开放还需要至少一条全局路由和有效计价。</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-5 py-3">模型</th><th className="px-3 py-3">英文展示名称</th><th className="px-3 py-3">展示顺序</th><th className="px-3 py-3">首选执行</th><th className="px-3 py-3">计价</th><th className="px-5 py-3 text-right">展示开关 / 保存</th></tr></thead><tbody className="divide-y divide-slate-100">{(models.data ?? []).map((model) => <DisplayRow key={model.id} model={model} catalog={catalog.data!} canEdit={canEdit} />)}</tbody></table></div>
      {!models.data?.length && <Empty text="尚未添加展示模型" />}
    </section>
  </>;
}

function DisplayRow({ model, catalog, canEdit }: { model: ProductModel; catalog: Catalog; canEdit: boolean }) {
  const qc = useQueryClient();
  const [nameEn, setNameEn] = useState(model.nameEn);
  const [sortOrder, setSortOrder] = useState(model.sortOrder);
  const [enabled, setEnabled] = useState(model.enabled);
  const routeOptions = useMemo(() => catalog.capabilities.filter((capability) => capability !== 'videoLipsync').flatMap((capability) => catalog.providers.flatMap((provider) =>
    (catalog.capabilityModels[capability]?.[provider] ?? []).filter((exactModel) => familyOf(exactModel) === model.code).map((exactModel) => ({ capability, provider, exactModel })),
  )), [catalog, model.code]);
  const routeKey = (route: Pick<ModelRoute, 'capability' | 'provider' | 'exactModel'>) => `${route.capability}|${route.provider}|${route.exactModel}`;
  const [primaryKey, setPrimaryKey] = useState(model.routes[0] ? routeKey(model.routes[0]) : '');
  useEffect(() => { setNameEn(model.nameEn); setSortOrder(model.sortOrder); setEnabled(model.enabled); setPrimaryKey(model.routes[0] ? routeKey(model.routes[0]) : ''); }, [model]);
  const selectedRoute = routeOptions.find((route) => routeKey(route) === primaryKey);
  const save = useMutation({ mutationFn: () => Promise.all([
    apiClient.patch(`/admin/aimv-generator/models/${model.id}`, { nameEn, sortOrder, enabled }),
    apiClient.put(`/admin/aimv-generator/models/${model.id}/routes`, { routes: selectedRoute ? [{ ...selectedRoute, priority: 0, timeoutSec: 900, maxAttempts: 1, enabled: true }] : [] }),
  ]), onSuccess: () => qc.invalidateQueries({ queryKey: ['aimv-models'] }) });
  return <tr><td className="px-5 py-4"><div className="font-semibold text-slate-900">{displayName(model.code)}</div><code className="text-xs text-slate-400">{model.code}</code></td><td className="px-3 py-4"><input disabled={!canEdit || save.isPending} value={nameEn} onChange={(event) => setNameEn(event.target.value)} className="control max-w-[220px]" /></td><td className="px-3 py-4"><input disabled={!canEdit || save.isPending} type="number" value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} className="control w-20" /></td><td className="px-3 py-4"><select disabled={!canEdit || save.isPending} value={primaryKey} onChange={(event) => setPrimaryKey(event.target.value)} className="control min-w-[300px]"><option value="">请选择首选渠道</option>{routeOptions.map((route) => <option key={routeKey(route)} value={routeKey(route)}>{route.provider} · {route.exactModel} · {CAPABILITY_LABELS[route.capability]}</option>)}</select></td><td className="px-3 py-4"><Status ok={!!model.price?.enabled}>{model.price?.enabled ? '已配置' : '待配置'}</Status></td><td className="px-5 py-4"><div className="flex items-center justify-end gap-4"><Switch checked={enabled} onChange={setEnabled} disabled={!canEdit || save.isPending} label={`${model.nameEn} 展示开关`} />{canEdit && <button disabled={save.isPending || !nameEn.trim() || !selectedRoute} onClick={() => { if (!save.isPending) save.mutate(); }} className="secondary-button"><Save className="h-4 w-4" />保存</button>}</div>{save.isError && <ErrorText error={save.error} />}</td></tr>;
}

function RoutingPriority() {
  const canEdit = useAdminAuthStore((state) => state.hasPermission('aimv.routing.edit'));
  const routing = useQuery<{ routes: ModelRoute[] }>({ queryKey: ['aimv-routing'], queryFn: () => apiClient.get('/admin/aimv-generator/routing') as Promise<{ routes: ModelRoute[] }> });
  const catalog = useQuery<Catalog>({ queryKey: ['aimv-model-meta'], queryFn: () => apiClient.get('/admin/aimv-generator/models/meta') as Promise<Catalog> });
  if (routing.isLoading || catalog.isLoading) return <Loading />;
  const standardCatalog = { ...catalog.data!, capabilities: catalog.data!.capabilities.filter((capability) => capability !== 'videoLipsync') };
  return <div className="space-y-4">
    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">路由与展示模型完全独立。系统严格按照优先级 1、2、3…依次调用；上一项失败或超时才进入下一项，全部失败后退款。</div>
    <RouteCard initialRows={routing.data?.routes ?? []} catalog={standardCatalog} canEdit={canEdit} endpoint="/admin/aimv-generator/routing" queryKey="aimv-routing" title="AI MV 全局调用链" description="每个优先级可以独立选择视频能力、渠道和精确模型" />
  </div>;
}

function LipsyncPriority() {
  const canEdit = useAdminAuthStore((state) => state.hasPermission('aimv.routing.edit'));
  const routing = useQuery<{ routes: ModelRoute[] }>({ queryKey: ['aimv-lipsync-routing'], queryFn: () => apiClient.get('/admin/aimv-generator/lipsync-routing') as Promise<{ routes: ModelRoute[] }> });
  const catalog = useQuery<Catalog>({ queryKey: ['aimv-model-meta'], queryFn: () => apiClient.get('/admin/aimv-generator/models/meta') as Promise<Catalog> });
  if (routing.isLoading || catalog.isLoading) return <Loading />;
  const lipsyncCatalog = { ...catalog.data!, capabilities: ['videoLipsync' as Capability] };
  return <div className="space-y-4">
    <div className="rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-4 py-3 text-sm text-fuchsia-800">仅在人声分镜且用户启用 Lip Sync 时使用。普通视频路由与对口型路由相互独立，失败时只在本优先级链内降级。</div>
    <RouteCard initialRows={routing.data?.routes ?? []} catalog={lipsyncCatalog} canEdit={canEdit} endpoint="/admin/aimv-generator/lipsync-routing" queryKey="aimv-lipsync-routing" title="对口型模型调用链" description="严格按照优先级依次调用支持音频驱动口型的视频模型" />
  </div>;
}

function AuxiliaryPriority({ kind }: { kind: 'analysis' | 'image' }) {
  const canEdit = useAdminAuthStore((state) => state.hasPermission('aimv.routing.edit'));
  const capability: Capability = kind === 'analysis' ? 'audioAnalyze' : 'imageNanoBanana';
  const endpoint = kind === 'analysis' ? '/admin/aimv-generator/analysis-routing' : '/admin/aimv-generator/image-routing';
  const queryKey = kind === 'analysis' ? 'aimv-analysis-routing' : 'aimv-image-routing';
  const routing = useQuery<{ routes: ModelRoute[]; source?: string }>({ queryKey: [queryKey], queryFn: () => apiClient.get(endpoint) as Promise<{ routes: ModelRoute[]; source?: string }> });
  const catalog = useQuery<Catalog>({ queryKey: ['aimv-model-meta'], queryFn: () => apiClient.get('/admin/aimv-generator/models/meta') as Promise<Catalog> });
  if (routing.isLoading || catalog.isLoading) return <Loading />;
  const auxiliaryCatalog: Catalog = {
    ...catalog.data!,
    capabilities: [capability],
    capabilityModels: catalog.data!.auxiliaryCapabilityModels,
  };
  const copy = kind === 'analysis'
    ? { title: 'AI MV 分析 / LLM 调用链', description: '用于读取音乐、识别人声区间并生成四阶段分镜规划', notice: '这是 AI MV 产品自己的音乐理解模型配置。支持 Mountsea 和 Google，失败后按优先级自动切换。' }
    : { title: 'AI MV 分镜图片调用链', description: '用于人物一致性锚点和每个分镜的故事板图片', notice: '这是 AI MV 产品自己的图片模型配置。图片余额不足或渠道失败时，会按这里的优先级 fallback。' };
  return <div className="space-y-4">
    <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">{copy.notice}{routing.data?.source === 'global-default' ? ' 当前显示的是从全局路由继承的初始值，保存后即成为产品独立配置。' : ''}</div>
    <RouteCard initialRows={routing.data?.routes ?? []} catalog={auxiliaryCatalog} canEdit={canEdit} endpoint={endpoint} queryKey={queryKey} title={copy.title} description={copy.description} />
  </div>;
}

function RouteCard({ initialRows, catalog, canEdit, endpoint, queryKey, title, description }: { initialRows: ModelRoute[]; catalog: Catalog; canEdit: boolean; endpoint: string; queryKey: string; title: string; description: string }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<ModelRoute[]>(initialRows.map((item) => ({ ...item, capability: item.capability || 'videoSingleRef' })));
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => setRows(initialRows.map((item) => ({ ...item, capability: item.capability || 'videoSingleRef' }))), [initialRows]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const options = (capability: Capability, provider: Provider) => catalog.capabilityModels[capability]?.[provider] ?? [];
  const add = () => {
    const capability = catalog.capabilities[0] ?? 'videoSingleRef';
    const provider = catalog.providers.find((item) => options(capability, item).length) ?? catalog.providers[0];
    if (!provider) return;
    setRows([...rows, { capability, provider, exactModel: options(capability, provider)[0] ?? '', priority: rows.length, timeoutSec: 900, maxAttempts: 1, enabled: true }]);
  };
  const move = (index: number, delta: number) => { const target = index + delta; if (target < 0 || target >= rows.length) return; const next = [...rows]; [next[index], next[target]] = [next[target], next[index]]; setRows(next); };
  const save = useMutation({
    mutationFn: () => apiClient.put(endpoint, { routes: rows.map((row, index) => ({ ...row, priority: index })) }),
    onSuccess: () => { setNotice('路由优先级已保存'); qc.invalidateQueries({ queryKey: [queryKey] }); },
  });
  const locked = save.isPending;
  return <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-busy={locked}>
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-1 text-xs text-slate-500">{description}</p></div>{canEdit && <button onClick={add} disabled={locked || !catalog.providers.length} className="secondary-button"><Plus className="h-4 w-4" />添加优先级</button>}</div>
    <div className="space-y-2 p-4">{rows.map((row, index) => <div key={`${index}-${row.capability}-${row.provider}-${row.exactModel}`} className="grid items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 xl:grid-cols-[44px_130px_130px_minmax(280px,520px)_190px_90px]">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 font-semibold text-violet-700">{index + 1}</div>
      <select disabled={!canEdit || locked} value={row.capability} onChange={(event) => { const capability = event.target.value as Capability; const provider = catalog.providers.find((item) => options(capability, item).length) ?? row.provider; const next = [...rows]; next[index] = { ...row, capability, provider, exactModel: options(capability, provider)[0] ?? '' }; setRows(next); }} className="control">{catalog.capabilities.map((item) => <option key={item} value={item}>{CAPABILITY_LABELS[item]}</option>)}</select>
      <select disabled={!canEdit || locked} value={row.provider} onChange={(event) => { const provider = event.target.value as Provider; const next = [...rows]; next[index] = { ...row, provider, exactModel: options(row.capability, provider)[0] ?? '' }; setRows(next); }} className="control">{catalog.providers.map((item) => <option key={item} disabled={!options(row.capability, item).length}>{item}</option>)}</select>
      <select disabled={!canEdit || locked} value={row.exactModel} onChange={(event) => { const next = [...rows]; next[index] = { ...row, exactModel: event.target.value }; setRows(next); }} className="control">{options(row.capability, row.provider).map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <label className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-500"><span>超时（秒）</span><input disabled={!canEdit || locked} type="number" min={1} value={row.timeoutSec} onChange={(event) => { const next = [...rows]; next[index] = { ...row, timeoutSec: Number(event.target.value) }; setRows(next); }} className="control w-24" /></label>
      <div className="flex items-center justify-end gap-1"><button onClick={() => move(index, -1)} disabled={!canEdit || locked || index === 0} className="icon-button"><ArrowUp className="h-4 w-4" /></button><button onClick={() => move(index, 1)} disabled={!canEdit || locked || index === rows.length - 1} className="icon-button"><ArrowDown className="h-4 w-4" /></button><button onClick={() => setRows(rows.filter((_, itemIndex) => itemIndex !== index))} disabled={!canEdit || locked} className="icon-button text-red-600"><Trash2 className="h-4 w-4" /></button></div>
    </div>)}{!rows.length && <Empty text="暂无候选渠道" />}</div>
    {notice && <div role="status" className="fixed right-6 top-6 z-50 flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-700 shadow-xl"><CheckCircle2 className="h-4 w-4" />{notice}</div>}
    {save.isError && <div className="px-5 pt-4"><ErrorText error={save.error} /></div>}
    {canEdit && <div className="flex justify-end border-t border-slate-100 px-5 py-4"><button disabled={locked || !rows.length} onClick={() => { setNotice(null); save.mutate(); }} className="primary-button">{locked ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{locked ? '正在保存，请勿重复提交' : '保存优先级'}</button></div>}
    {locked && <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/45 backdrop-blur-[1px]"><div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-4 py-2 text-sm font-medium text-violet-700 shadow"><LockKeyhole className="h-4 w-4" />配置保存中，已锁定编辑</div></div>}
  </section>;
}

function Tab({ active, icon: Icon, children, onClick }: { active: boolean; icon: typeof Eye; children: React.ReactNode; onClick: () => void }) { return <button onClick={onClick} className={cn('inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium', active ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500')}><Icon className="h-4 w-4" />{children}</button>; }
function Label({ children }: { children: React.ReactNode }) { return <label className="mb-1.5 block text-xs font-medium text-slate-600">{children}</label>; }
function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) { return <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{children}</span>; }
function Loading() { return <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /></div>; }
function Empty({ text }: { text: string }) { return <div className="p-10 text-center text-sm text-slate-400">{text}</div>; }
function ErrorText({ error }: { error: unknown }) { return <p className="mt-2 text-xs text-red-600">{error instanceof Error ? error.message : '操作失败'}</p>; }
