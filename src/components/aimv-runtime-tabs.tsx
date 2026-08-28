'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CircleHelp, Loader2, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { Switch } from '@/components/ui/switch';

type Provider = 'mountsea' | 'apisale' | 'smartfashion' | 'aitokens' | 'google';
type VideoCapability = 'videoSingleRef' | 'videoMultiRef' | 'videoGrok' | 'videoUltron' | 'videoLipsync';
interface Catalog { providers: Provider[]; models: Partial<Record<Provider, string[]>>; capabilities: VideoCapability[]; capabilityModels: Record<VideoCapability, Partial<Record<Provider, string[]>>> }
interface RouteRow { id?: string; capability: VideoCapability; provider: Provider; exactModel: string; priority: number; timeoutSec: number; maxAttempts: number; enabled: boolean }
interface ProductModel { id: string; code: string; nameEn: string; enabled: boolean; routes: RouteRow[]; translationStatus: string }
const CAPABILITY_LABELS: Record<VideoCapability, string> = { videoSingleRef: '单图生成', videoMultiRef: '多图参考', videoGrok: 'Grok 视频', videoUltron: 'Ultron', videoLipsync: '对口型' };

export function ModelRoutingTab() {
  const qc = useQueryClient();
  const canEdit = useAdminAuthStore((s) => s.hasPermission('aimv.routing.edit'));
  const models = useQuery<ProductModel[]>({ queryKey: ['aimv-models'], queryFn: () => apiClient.get('/admin/aimv-generator/models') as Promise<ProductModel[]> });
  const catalog = useQuery<Catalog>({ queryKey: ['aimv-model-meta'], queryFn: () => apiClient.get('/admin/aimv-generator/models/meta') as Promise<Catalog> });
  const [draft, setDraft] = useState({ code: '', nameEn: '', descriptionEn: '' });
  const create = useMutation({ mutationFn: () => apiClient.post('/admin/aimv-generator/models', draft), onSuccess: () => { setDraft({ code: '', nameEn: '', descriptionEn: '' }); qc.invalidateQueries({ queryKey: ['aimv-models'] }); } });
  if (models.isLoading || catalog.isLoading) return <Loading />;
  return <div className="w-full space-y-5">
    <Info>用户端只展示一级模型，例如 Veo。候选链只能选择现有渠道目录中的精确视频模型，按从上到下依次 fallback。</Info>
    {canEdit && <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">新增一级模型</h2><div className="mt-3 grid gap-3 md:grid-cols-3"><Input disabled={create.isPending} value={draft.code} onChange={(v) => setDraft({ ...draft, code: v })} placeholder="code，例如 veo" /><Input disabled={create.isPending} value={draft.nameEn} onChange={(v) => setDraft({ ...draft, nameEn: v })} placeholder="Name (English)" /><Input disabled={create.isPending} value={draft.descriptionEn} onChange={(v) => setDraft({ ...draft, descriptionEn: v })} placeholder="Description (English)" /></div><div className="mt-3 flex justify-end"><Action disabled={create.isPending || !draft.code || !draft.nameEn} onClick={() => { if (!create.isPending) create.mutate(); }}><Plus className="h-4 w-4" />保存并自动翻译</Action></div>{create.isError && <ErrorText error={create.error} />}</section>}
    {(models.data ?? []).map((model) => <RouteEditor key={model.id} model={model} catalog={catalog.data!} canEdit={canEdit} />)}
    {!models.data?.length && <Empty text="尚未配置一级模型" />}
  </div>;
}

function RouteEditor({ model, catalog, canEdit }: { model: ProductModel; catalog: Catalog; canEdit: boolean }) {
  const qc = useQueryClient();
  const normalizeRows = (routes: RouteRow[]) => routes.map((row) => ({ ...row, capability: row.capability ?? 'videoSingleRef' as VideoCapability }));
  const [rows, setRows] = useState<RouteRow[]>(normalizeRows(model.routes));
  useEffect(() => setRows(normalizeRows(model.routes)), [model.routes]);
  const save = useMutation({ mutationFn: () => apiClient.put(`/admin/aimv-generator/models/${model.id}/routes`, { routes: rows.map((row, priority) => ({ ...row, priority })) }), onSuccess: () => qc.invalidateQueries({ queryKey: ['aimv-models'] }) });
  const locked = save.isPending;
  const move = (index: number, delta: number) => { if (locked) return; const next = [...rows]; const target = index + delta; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; setRows(next); };
  const add = () => { if (locked) return; const capability = catalog.capabilities[0] ?? 'videoSingleRef'; const provider = catalog.providers.find((item) => (catalog.capabilityModels[capability]?.[item] ?? []).length > 0) ?? catalog.providers[0]; const exactModel = catalog.capabilityModels[capability]?.[provider]?.[0] ?? ''; setRows([...rows, { capability, provider, exactModel, priority: rows.length, timeoutSec: 900, maxAttempts: 1, enabled: true }]); };
  return <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">{model.nameEn} <span className="font-mono text-xs text-slate-400">{model.code}</span></h2><p className="mt-1 text-xs text-slate-500">翻译：{model.translationStatus} · 用户端不会看到以下真实模型</p></div>{canEdit && <button disabled={locked} onClick={add} className="text-sm text-violet-700 disabled:opacity-50">+ 添加候选</button>}</div><div className="mt-4 space-y-2">{rows.map((row, index) => <div key={`${index}-${row.capability}-${row.provider}-${row.exactModel}`} className="grid items-center gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[36px_130px_130px_1fr_100px_70px_50px]"><span className="text-center font-semibold text-slate-400">{index + 1}</span><select disabled={!canEdit || locked} value={row.capability} onChange={(e) => { const capability = e.target.value as VideoCapability; const provider = catalog.providers.find((item) => (catalog.capabilityModels[capability]?.[item] ?? []).length > 0) ?? row.provider; const next = [...rows]; next[index] = { ...row, capability, provider, exactModel: catalog.capabilityModels[capability]?.[provider]?.[0] ?? '' }; setRows(next); }} className="rounded border border-slate-200 bg-white px-2 py-2 text-sm">{catalog.capabilities.map((capability) => <option key={capability} value={capability}>{CAPABILITY_LABELS[capability]}</option>)}</select><select disabled={!canEdit || locked} value={row.provider} onChange={(e) => { const provider = e.target.value as Provider; const next = [...rows]; next[index] = { ...row, provider, exactModel: catalog.capabilityModels[row.capability]?.[provider]?.[0] ?? '' }; setRows(next); }} className="rounded border border-slate-200 bg-white px-2 py-2 text-sm">{catalog.providers.map((p) => <option key={p} disabled={!(catalog.capabilityModels[row.capability]?.[p] ?? []).length}>{p}</option>)}</select><select disabled={!canEdit || locked} value={row.exactModel} onChange={(e) => { const next = [...rows]; next[index] = { ...row, exactModel: e.target.value }; setRows(next); }} className="min-w-0 rounded border border-slate-200 bg-white px-2 py-2 text-sm">{(catalog.capabilityModels[row.capability]?.[row.provider] ?? []).map((m) => <option key={m}>{m}</option>)}</select><input disabled={!canEdit || locked} type="number" value={row.timeoutSec} onChange={(e) => { const next = [...rows]; next[index] = { ...row, timeoutSec: Number(e.target.value) }; setRows(next); }} className="rounded border border-slate-200 px-2 py-2 text-sm" title="超时秒数" /><div className="flex gap-1"><button disabled={locked} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></button><button disabled={locked} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></button></div><button disabled={!canEdit || locked} onClick={() => setRows(rows.filter((_, i) => i !== index))} className="text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}</div>{canEdit && rows.length > 0 && <div className="mt-4 flex justify-end"><Action disabled={save.isPending} onClick={() => { if (!save.isPending) save.mutate(); }}><Save className="h-4 w-4" />保存候选链</Action></div>}{save.isError && <ErrorText error={save.error} />}</section>;
}

interface Capacity { id: string; provider: Provider; exactModel: string; globalConcurrency: number; projectConcurrency: number; userConcurrency: number; submissionsPerMinute: number; burstSize: number; maxQueueSize: number; queueTimeoutSec: number; capacityGroup: string | null; capacityGroupConcurrency: number | null; paused: boolean; enabled: boolean }

function modelFamily(exactModel: string): string {
  const segments = exactModel.split('/').filter(Boolean);
  const modelName = segments.length > 1 ? segments[1] : segments[0] ?? exactModel;
  return modelName.replace(/-(?:v)?\d+(?:\.\d+)*(?:-.*)?$/i, '');
}

function isTextModel(exactModel: string): boolean {
  return /(?:^|[\/_-])text(?:[\/_-]|$)/i.test(exactModel) || /(?:^|[\/_-])t2v(?:[\/_-]|$)/i.test(exactModel);
}

export function CapacityTab() {
  const canEdit = useAdminAuthStore((s) => s.hasPermission('aimv.routing.edit'));
  const catalog = useQuery<Catalog>({ queryKey: ['aimv-model-meta'], queryFn: () => apiClient.get('/admin/aimv-generator/models/meta') as Promise<Catalog> });
  const query = useQuery<Capacity[]>({ queryKey: ['aimv-capacities'], queryFn: () => apiClient.get('/admin/aimv-generator/capacities') as Promise<Capacity[]> });
  const [activeProvider, setActiveProvider] = useState<Provider>('mountsea');
  useEffect(() => {
    if (catalog.data && !catalog.data.providers.includes(activeProvider)) setActiveProvider(catalog.data.providers[0]);
  }, [activeProvider, catalog.data]);
  if (catalog.isLoading || query.isLoading) return <Loading />;
  const videoModels = (catalog.data?.models[activeProvider] ?? []).filter((model) => !isTextModel(model));
  const families = [...new Set(videoModels.map(modelFamily))];
  return <div className="w-full space-y-5">
    <Info>按渠道配置一级模型容量。页面只开放全局并发和排队超时；更细的限流字段继续由系统保留。</Info>
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {catalog.data?.providers.map((provider) => <button key={provider} type="button" onClick={() => setActiveProvider(provider)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium capitalize ${activeProvider === provider ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{provider}</button>)}
    </div>
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4"><h2 className="font-semibold capitalize text-slate-900">{activeProvider}</h2><p className="mt-1 text-sm text-slate-500">同一一级模型下的内部版本统一应用该配置。</p></div>
      <div className="grid gap-4 xl:grid-cols-2">
        {families.map((family) => <CapacityFamilyEditor key={`${activeProvider}-${family}`} provider={activeProvider} family={family} exactModels={videoModels.filter((model) => modelFamily(model) === family)} rows={query.data ?? []} canEdit={canEdit} />)}
      </div>
      {!families.length && <Empty text="该渠道暂无可用视频模型" />}
    </section>
  </div>;
}

function CapacityFamilyEditor({ provider, family, exactModels, rows, canEdit }: { provider: Provider; family: string; exactModels: string[]; rows: Capacity[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const configured = rows.filter((row) => row.provider === provider && exactModels.includes(row.exactModel));
  const configuredGlobalConcurrency = configured[0]?.globalConcurrency ?? 8;
  const configuredQueueTimeoutSec = configured[0]?.queueTimeoutSec ?? 3600;
  const [globalConcurrency, setGlobalConcurrency] = useState(configuredGlobalConcurrency);
  const [queueTimeoutSec, setQueueTimeoutSec] = useState(configuredQueueTimeoutSec);
  useEffect(() => {
    setGlobalConcurrency(configuredGlobalConcurrency);
    setQueueTimeoutSec(configuredQueueTimeoutSec);
  }, [provider, family, configuredGlobalConcurrency, configuredQueueTimeoutSec]);
  const save = useMutation({
    mutationFn: () => Promise.all(exactModels.map((exactModel) => {
      const current = configured.find((row) => row.exactModel === exactModel);
      return apiClient.put('/admin/aimv-generator/capacities', {
        provider, exactModel, globalConcurrency, queueTimeoutSec,
        projectConcurrency: Math.min(current?.projectConcurrency ?? 3, globalConcurrency),
        userConcurrency: Math.min(current?.userConcurrency ?? 3, globalConcurrency),
        submissionsPerMinute: current?.submissionsPerMinute ?? 30,
        burstSize: current?.burstSize ?? 5,
        maxQueueSize: current?.maxQueueSize ?? 1000,
        capacityGroup: current?.capacityGroup ?? null,
        capacityGroupConcurrency: current?.capacityGroupConcurrency ?? null,
        paused: current?.paused ?? false,
        enabled: current?.enabled ?? true,
      });
    })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aimv-capacities'] }),
  });
  return <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
    <div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900">{family}</h3><span className="text-xs text-slate-400">{configured.length ? '已配置' : '未配置'}</span></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <NumberInput disabled={save.isPending} label="全局并发" value={globalConcurrency} onChange={setGlobalConcurrency} />
      <NumberInput disabled={save.isPending} label="排队超时（秒）" value={queueTimeoutSec} onChange={setQueueTimeoutSec} />
    </div>
    {canEdit && <div className="mt-4 flex justify-end"><Action disabled={save.isPending || globalConcurrency < 1 || queueTimeoutSec < 1} onClick={() => { if (!save.isPending) save.mutate(); }}><Save className="h-4 w-4" />保存</Action></div>}
    {save.isError && <ErrorText error={save.error} />}
  </div>;
}

type PricingModality = 'text' | 'image' | 'video';
interface CatalogPrice {
  baseUsdPerUnit: number;
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  profitMultiplier: number;
  resolutionFactors: Record<string, number>;
  enabled: boolean;
  isMarketDefault?: boolean;
  referenceDate?: string;
}
interface PricingData {
  config: { usdPerCredit: number; minimumReservedCredits: number; reservationTimeoutMinutes: number; profitMultiplier: number; resolutionFactors: Record<string, number>; enabled: boolean };
  providers: Array<{ provider: string; configured: boolean; active: boolean }>;
  resolutions: string[];
  models: Array<{ modality: PricingModality; modelKey: string; providers: string[]; aliases: Array<{ provider: string; exactModel: string }>; price: CatalogPrice | null }>;
}
interface PricingSettings {
  settings: {
    allowedResolutions: string[];
    defaultResolution: string;
  };
}
const PRICING_MODALITIES: Array<{ key: PricingModality; label: string; hint: string }> = [
  { key: 'text', label: '文本模型', hint: '输入、输出分别按 USD/百万 Tokens 配置' },
  { key: 'image', label: '图片模型', hint: '模型只配置 USD/张，盈利和分辨率系数使用全局策略' },
  { key: 'video', label: '视频模型', hint: '模型只配置 USD/秒，盈利和分辨率系数使用全局策略' },
];

export function PricingTab() {
  const qc = useQueryClient();
  const canEdit = useAdminAuthStore((s) => s.hasPermission('aimv.pricing.edit'));
  const query = useQuery<PricingData>({ queryKey: ['aimv-pricing'], queryFn: () => apiClient.get('/admin/aimv-generator/pricing') as Promise<PricingData> });
  const settingsQuery = useQuery<PricingSettings>({ queryKey: ['aimv-settings'], queryFn: () => apiClient.get('/admin/aimv-generator/settings') as Promise<PricingSettings> });
  const [config, setConfig] = useState<PricingData['config'] | null>(null);
  const [modality, setModality] = useState<PricingModality>('video');
  const [newResolution, setNewResolution] = useState('');
  useEffect(() => { if (query.data) setConfig(query.data.config); }, [query.data]);
  const saveConfig = useMutation({ mutationFn: async () => {
    await apiClient.put('/admin/aimv-generator/pricing/config', config);
    const settings = settingsQuery.data?.settings;
    if (settings) {
      const resolutions = Object.keys(config?.resolutionFactors ?? {}).filter((resolution) => (config?.resolutionFactors[resolution] ?? 0) > 0);
      const defaultResolution = resolutions.includes(settings.defaultResolution) ? settings.defaultResolution : resolutions[0];
      await apiClient.put('/admin/aimv-generator/settings', { ...settings, allowedResolutions: resolutions, defaultResolution });
    }
  }, onSuccess: () => { qc.invalidateQueries({ queryKey: ['aimv-pricing'] }); qc.invalidateQueries({ queryKey: ['aimv-settings'] }); } });
  if (query.isLoading || settingsQuery.isLoading || !config) return <Loading />;
  if (query.isError) return <ErrorText error={query.error} />;
  const models = (query.data?.models ?? []).filter((model) => model.modality === modality);
  const enabledResolutions = Object.keys(config.resolutionFactors).filter((resolution) => config.resolutionFactors[resolution] > 0);
  const addResolution = () => {
    const resolution = newResolution.trim().toLowerCase();
    if (!resolution || config.resolutionFactors[resolution] !== undefined) return;
    setConfig({ ...config, resolutionFactors: { ...config.resolutionFactors, [resolution]: 1 } });
    setNewResolution('');
  };
  const disableResolution = (resolution: string) => {
    if (enabledResolutions.length <= 1) return;
    const next = { ...config.resolutionFactors };
    delete next[resolution];
    setConfig({ ...config, resolutionFactors: next });
  };
  return <div className="w-full space-y-5">
    <Info>本页只作用于 AI MV Generator。当前按模型家族合并计价，例如 Gemini Flash/Pro 统一显示为 Gemini；精确版本字段继续保留，方便后续恢复细分配置。不会读取或修改旧产品计费。</Info>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div><div className="flex items-center gap-2"><h2 className="font-semibold text-slate-900">全局计费策略</h2><span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">AI MV 专属</span></div><p className="mt-1 text-xs text-slate-500">售价 = 模型基础价 × 全局盈利系数 × 对应分辨率系数</p></div>
        <div className="flex items-center gap-4"><label className="flex items-center gap-2 text-sm font-medium text-slate-600"><span className={`h-2 w-2 rounded-full ${config.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />{config.enabled ? '计费已启用' : '计费未启用'}<Switch checked={config.enabled} onChange={(enabled) => setConfig({ ...config, enabled })} disabled={!canEdit || saveConfig.isPending} label="启用 AI MV 计费" size="lg" /></label>{canEdit && <Action disabled={saveConfig.isPending} onClick={() => { if (!saveConfig.isPending) saveConfig.mutate(); }}><Save className="h-4 w-4" />{saveConfig.isPending ? '保存中…' : '保存策略'}</Action>}</div>
      </div>
      <div className="grid gap-4 p-5 xl:grid-cols-[minmax(420px,0.85fr)_minmax(640px,1.15fr)]">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><div className="mb-4"><h3 className="text-sm font-semibold text-slate-800">积分与预扣</h3><p className="mt-1 text-xs text-slate-500">控制美元换算、最低扣款和订单占用时间</p></div><div className="grid gap-3 sm:grid-cols-3"><NumberInput label="1 Credit 对应 USD" value={config.usdPerCredit} step={0.001} onChange={(v) => setConfig({ ...config, usdPerCredit: v })} /><NumberInput label="最低预扣 Credits" value={config.minimumReservedCredits} onChange={(v) => setConfig({ ...config, minimumReservedCredits: v })} /><NumberInput label="预扣超时（分钟）" value={config.reservationTimeoutMinutes} onChange={(v) => setConfig({ ...config, reservationTimeoutMinutes: v })} /></div></div>
        <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4"><div className="mb-4 flex items-start justify-between gap-3"><div><div className="flex items-center gap-1"><h3 className="text-sm font-semibold text-slate-800">统一价格倍率</h3><span title="分辨率启用后才会出现在用户端；禁用不会影响已创建项目的计费快照。"><CircleHelp className="h-3.5 w-3.5 text-slate-400" /></span></div><p className="mt-1 text-xs text-slate-500">盈利系数适用于全部模型，分辨率系数适用于图片与视频</p></div><span className="whitespace-nowrap rounded-md bg-white px-2 py-1 text-[11px] font-medium text-violet-700 shadow-sm">所有模型共享</span></div><div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]"><div className="rounded-lg border border-violet-100 bg-white p-3"><NumberInput label="全局盈利系数" hint="基础成本乘以该系数后，得到面向用户的售价。" value={config.profitMultiplier} step={0.1} onChange={(v) => setConfig({ ...config, profitMultiplier: v })} /></div><div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{enabledResolutions.map((resolution) => <div key={resolution} className="relative rounded-lg border border-violet-100 bg-white p-3"><button type="button" disabled={!canEdit || enabledResolutions.length <= 1} onClick={() => disableResolution(resolution)} className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" title={enabledResolutions.length <= 1 ? '至少保留一个可用分辨率' : `禁用 ${resolution}`}><X className="h-3.5 w-3.5" /></button><NumberInput label={`${resolution} 系数`} hint="仅对图片和视频模型生效。" value={config.resolutionFactors[resolution] ?? 1} step={0.05} onChange={(value) => setConfig({ ...config, resolutionFactors: { ...config.resolutionFactors, [resolution]: value } })} /></div>)}</div>{canEdit && <div className="mt-3 flex items-center gap-2"><input value={newResolution} onChange={(event) => setNewResolution(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addResolution(); } }} placeholder="新增，例如 1440p" className="w-44 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500" /><button type="button" disabled={!newResolution.trim() || config.resolutionFactors[newResolution.trim().toLowerCase()] !== undefined} onClick={addResolution} className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-medium text-violet-700 disabled:opacity-50"><Plus className="h-4 w-4" />增加分辨率</button></div>}<p className="mt-2 text-xs text-slate-500">删除图标表示禁用。保存后，新用户创建页面和模板编辑中的可选分辨率会同步隐藏该项。</p></div></div></div>
      </div>
      {saveConfig.isError && <div className="px-5 pb-4"><ErrorText error={saveConfig.error} /></div>}
    </section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 pt-4"><div className="flex gap-1">{PRICING_MODALITIES.map((item) => <button key={item.key} type="button" onClick={() => setModality(item.key)} className={`border-b-2 px-4 py-3 text-sm font-medium ${modality === item.key ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500'}`}>{item.label}<span className="ml-1 text-xs text-slate-400">{query.data?.models.filter((model) => model.modality === item.key).length ?? 0}</span></button>)}</div><p className="pb-3 text-xs text-slate-500">{PRICING_MODALITIES.find((item) => item.key === modality)?.hint}</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">模型家族 / 渠道</th>{modality === 'text' ? <><th className="px-4 py-3">输入 USD/百万 Tokens</th><th className="px-4 py-3">输出 USD/百万 Tokens</th></> : <><th className="px-4 py-3">基础 USD/{modality === 'image' ? '张' : '秒'}</th><th className="px-4 py-3">应用盈利后的基础售价</th></>}<th className="px-4 py-3 text-center">状态</th><th className="px-5 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-100">{models.map((model) => <CatalogModelPriceRow key={`${model.modality}:${model.modelKey}`} model={model} canEdit={canEdit} globalProfitMultiplier={config.profitMultiplier} />)}</tbody></table>{!models.length && <Empty text="已配置的 AI Provider 暂无该类型模型" />}</div>
    </section>
  </div>;
}

function CatalogModelPriceRow({ model, canEdit, globalProfitMultiplier }: { model: PricingData['models'][number]; canEdit: boolean; globalProfitMultiplier: number }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CatalogPrice>({ baseUsdPerUnit: 0, inputUsdPerMillionTokens: 0, outputUsdPerMillionTokens: 0, profitMultiplier: 1, resolutionFactors: {}, enabled: true, ...model.price });
  useEffect(() => setForm({ baseUsdPerUnit: 0, inputUsdPerMillionTokens: 0, outputUsdPerMillionTokens: 0, profitMultiplier: 1, resolutionFactors: {}, enabled: true, ...model.price }), [model.price]);
  const save = useMutation({ mutationFn: () => apiClient.put('/admin/aimv-generator/pricing/catalog-model', { modality: model.modality, modelKey: model.modelKey, baseUsdPerUnit: form.baseUsdPerUnit, inputUsdPerMillionTokens: form.inputUsdPerMillionTokens, outputUsdPerMillionTokens: form.outputUsdPerMillionTokens, enabled: form.enabled }), onSuccess: () => qc.invalidateQueries({ queryKey: ['aimv-pricing'] }) });
  const unit = model.modality === 'image' ? '张' : '秒';
  const inputClass = 'w-full min-w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400';
  return <tr className="align-middle hover:bg-slate-50/70">
    <td className="px-5 py-4"><div className="flex items-center gap-2"><div className="font-semibold capitalize text-slate-900">{model.modelKey}</div>{form.isMarketDefault && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">市场参考初始值</span>}</div><div className="mt-1 max-w-80 truncate text-xs text-slate-400" title={model.providers.join('、')}>{model.providers.join('、') || '当前渠道已移除'}</div></td>
    {model.modality === 'text' ? <><td className="px-4 py-4"><input aria-label={`${model.modelKey} 输入价格`} disabled={!canEdit} type="number" min={0} step={0.01} value={form.inputUsdPerMillionTokens} onChange={(e) => setForm({ ...form, inputUsdPerMillionTokens: Number(e.target.value) })} className={inputClass} /></td><td className="px-4 py-4"><input aria-label={`${model.modelKey} 输出价格`} disabled={!canEdit} type="number" min={0} step={0.01} value={form.outputUsdPerMillionTokens} onChange={(e) => setForm({ ...form, outputUsdPerMillionTokens: Number(e.target.value) })} className={inputClass} /></td></> : <><td className="px-4 py-4"><input aria-label={`${model.modelKey} 基础价格`} disabled={!canEdit} type="number" min={0} step={0.001} value={form.baseUsdPerUnit} onChange={(e) => setForm({ ...form, baseUsdPerUnit: Number(e.target.value) })} className={inputClass} /></td><td className="px-4 py-4 font-medium text-slate-700">${(form.baseUsdPerUnit * globalProfitMultiplier).toFixed(6)}/{unit}</td></>}
    <td className="px-4 py-4"><div className="flex justify-center"><Switch checked={form.enabled} onChange={(enabled) => setForm({ ...form, enabled })} disabled={!canEdit} label={`启用 ${model.modelKey} 计费`} /></div></td>
    <td className="px-5 py-4 text-right">{canEdit && <button type="button" disabled={save.isPending} onClick={() => { if (!save.isPending) save.mutate(); }} className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"><Save className="h-3.5 w-3.5" />{save.isPending ? '保存中…' : '保存'}</button>}{save.isError && <ErrorText error={save.error} />}</td>
  </tr>;
}

interface QueueData { items: Array<{ id: string; productModelCode: string; provider: string; exactModel: string; status: string; priority: number; retryCount: number; queuedAt: string; submittedAt: string | null; errorCode?: string | null }>; total: number }
export function QueueTab() {
  const qc = useQueryClient(); const canManage = useAdminAuthStore((s) => s.hasPermission('aimv.queue.manage')); const [status, setStatus] = useState('');
  const query = useQuery<QueueData>({ queryKey: ['aimv-queue', status], queryFn: () => apiClient.get(`/admin/aimv-generator/dispatch-jobs?page=1&pageSize=50${status ? `&status=${status}` : ''}`) as Promise<QueueData>, refetchInterval: 10000 });
  const action = useMutation({ mutationFn: ({ id, kind, body }: { id: string; kind: string; body?: object }) => kind === 'priority' ? apiClient.patch(`/admin/aimv-generator/dispatch-jobs/${id}/priority`, body) : apiClient.post(`/admin/aimv-generator/dispatch-jobs/${id}/${kind}`, body ?? {}), onSuccess: () => qc.invalidateQueries({ queryKey: ['aimv-queue'] }) });
  const runAction = (payload: { id: string; kind: string; body?: object }) => {
    if (!action.isPending) action.mutate(payload);
  };
  const actionClass = 'disabled:cursor-not-allowed disabled:opacity-45';
  return <div className="mx-auto max-w-6xl space-y-4"><div className="flex items-center justify-between"><Info>只有尚未提交渠道的任务可以直接取消并进入退款流程；提交状态未知时禁止直接重试，必须先人工对账。</Info><select value={status} onChange={(e) => setStatus(e.target.value)} className="ml-4 rounded border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">全部状态</option>{['queued','claimed','ready_to_submit','submit_started','submitted','polling','succeeded','failed','cancelled','submission_unknown'].map((s) => <option key={s}>{s}</option>)}</select></div>{query.isLoading ? <Loading /> : <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">一级模型</th><th className="p-3">渠道 / 精确模型</th><th className="p-3">状态</th><th className="p-3">优先级</th><th className="p-3">排队时间</th><th className="p-3 text-right">操作</th></tr></thead><tbody className="divide-y">{query.data?.items.map((row) => <tr key={row.id}><td className="p-3 font-medium">{row.productModelCode}</td><td className="p-3">{row.provider}<div className="text-xs text-slate-500">{row.exactModel}</div></td><td className="p-3">{row.status}</td><td className="p-3">{row.priority}</td><td className="p-3">{new Date(row.queuedAt).toLocaleString()}</td><td className="p-3 text-right">{canManage && row.status === 'queued' && <><button disabled={action.isPending} onClick={() => runAction({ id: row.id, kind: 'priority', body: { priority: Math.min(100, row.priority + 10), note: '后台人工加急' } })} className={`mr-3 text-violet-700 ${actionClass}`}>加急</button><button disabled={action.isPending} onClick={() => runAction({ id: row.id, kind: 'cancel', body: { note: '后台取消未提交任务' } })} className={`text-red-600 ${actionClass}`}>取消</button></>}{canManage && row.status === 'failed' && !row.submittedAt && <button disabled={action.isPending} onClick={() => runAction({ id: row.id, kind: 'retry' })} className={`text-violet-700 ${actionClass}`}><RefreshCw className="inline h-4 w-4" /> 重试</button>}{canManage && row.status === 'submission_unknown' && <><button disabled={action.isPending} onClick={() => runAction({ id: row.id, kind: 'reconcile', body: { outcome: 'not_submitted', note: '后台对账确认未提交渠道' } })} className={`mr-3 text-emerald-700 ${actionClass}`}>确认未提交</button><button disabled={action.isPending} onClick={() => runAction({ id: row.id, kind: 'reconcile', body: { outcome: 'failed', note: '后台对账确认渠道失败' } })} className={`text-amber-700 ${actionClass}`}>确认失败</button></>}</td></tr>)}</tbody></table>{!query.data?.items.length && <Empty text="当前没有排队任务" />}</section>}</div>;
}

function Info({ children }: { children: React.ReactNode }) { return <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">{children}</div>; }
function Input({ value, onChange, placeholder, disabled }: { value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) { return <input disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="rounded border border-slate-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100" />; }
function NumberInput({ label, hint, value, onChange, step = 1, disabled }: { label: string; hint?: string; value: number; onChange: (v: number) => void; step?: number; disabled?: boolean }) { return <label className="text-xs text-slate-500"><span className="flex items-center gap-1">{label}{hint && <span title={hint} aria-label={hint}><CircleHelp className="h-3.5 w-3.5 text-slate-400" /></span>}</span><input disabled={disabled} type="number" min={0} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full rounded border border-slate-200 px-2 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100" /></label>; }
function Action({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) { return <button disabled={disabled} onClick={onClick} className="inline-flex items-center justify-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-sm text-white disabled:opacity-50">{disabled && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{children}</button>; }
function Loading() { return <div className="flex justify-center p-12"><Loader2 className="h-5 w-5 animate-spin text-violet-600" /></div>; }
function Empty({ text }: { text: string }) { return <div className="p-10 text-center text-sm text-slate-400">{text}</div>; }
function ErrorText({ error }: { error: unknown }) { return <p className="mt-2 text-sm text-red-600">{error instanceof Error ? error.message : '操作失败'}</p>; }
