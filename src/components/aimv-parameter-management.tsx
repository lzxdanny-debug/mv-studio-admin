'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CheckCircle2, ChevronDown, ChevronRight, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAdminAuthStore } from '@/stores/admin-auth.store';

type Provider = 'mountsea' | 'apisale' | 'smartfashion' | 'aitokens' | 'google';
type Capability = 'videoSingleRef' | 'videoMultiRef' | 'videoGrok' | 'videoUltron';

interface ModelRoute {
  capability: Capability;
  provider: Provider;
  exactModel: string;
  priority: number;
  timeoutSec: number;
  maxAttempts: number;
  enabled: boolean;
}

interface RoutingGroup {
  aspectRatio: string;
  routes: ModelRoute[];
  source: 'ratio' | 'global';
}

interface RoutingResponse {
  allowedAspectRatios: string[];
  groups: RoutingGroup[];
}

interface Catalog {
  providers: Provider[];
  capabilities: Capability[];
  capabilityModels: Record<Capability, Partial<Record<Provider, string[]>>>;
}

interface EditorState {
  mode: 'create' | 'edit';
  originalAspectRatio?: string;
  aspectRatio: string;
  routes: ModelRoute[];
}

const CAPABILITY_LABELS: Record<Capability, string> = {
  videoSingleRef: '单图生成',
  videoMultiRef: '多图参考',
  videoGrok: 'Grok 视频',
  videoUltron: 'Ultron',
};

function cloneRoutes(routes: ModelRoute[]): ModelRoute[] {
  return routes.map((route, priority) => ({
    ...route,
    capability: route.capability || 'videoSingleRef',
    priority,
    timeoutSec: route.timeoutSec || 900,
    maxAttempts: route.maxAttempts || 1,
    enabled: route.enabled !== false,
  }));
}

export function AimvParameterManagement() {
  const canEdit = useAdminAuthStore((state) => state.hasPermission('aimv.settings.edit'));
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [notice, setNotice] = useState('');
  const routing = useQuery<RoutingResponse>({
    queryKey: ['aimv-aspect-ratio-routing'],
    queryFn: () => apiClient.get('/admin/aimv-generator/aspect-ratio-routing') as Promise<RoutingResponse>,
  });
  const catalog = useQuery<Catalog>({
    queryKey: ['aimv-aspect-ratio-routing-meta'],
    queryFn: () => apiClient.get('/admin/aimv-generator/aspect-ratio-routing/meta') as Promise<Catalog>,
  });
  const standardCatalog = useMemo<Catalog | null>(() => {
    if (!catalog.data) return null;
    return {
      ...catalog.data,
      capabilities: catalog.data.capabilities.filter((item): item is Capability => item !== ('videoLipsync' as Capability)),
    };
  }, [catalog.data]);
  const save = useMutation({
    mutationFn: async (draft: EditorState) => {
      const body = { aspectRatio: draft.aspectRatio.trim(), routes: draft.routes.map((route, priority) => ({ ...route, priority })) };
      if (draft.mode === 'create') return apiClient.post('/admin/aimv-generator/aspect-ratio-routing', body);
      return apiClient.put(`/admin/aimv-generator/aspect-ratio-routing/${encodeURIComponent(draft.originalAspectRatio || draft.aspectRatio)}`, { routes: body.routes });
    },
    onSuccess: async () => {
      setNotice(editor?.mode === 'create' ? '比例已添加' : '比例参数已保存');
      setEditor(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['aimv-aspect-ratio-routing'] }),
        queryClient.invalidateQueries({ queryKey: ['aimv-settings'] }),
      ]);
    },
  });

  const firstRoute = (): ModelRoute | null => {
    if (!standardCatalog) return null;
    for (const capability of standardCatalog.capabilities) {
      for (const provider of standardCatalog.providers) {
        const exactModel = standardCatalog.capabilityModels[capability]?.[provider]?.[0];
        if (exactModel) return { capability, provider, exactModel, priority: 0, timeoutSec: 900, maxAttempts: 1, enabled: true };
      }
    }
    return null;
  };

  const openCreate = () => {
    const route = firstRoute();
    save.reset();
    setNotice('');
    setEditor({ mode: 'create', aspectRatio: '', routes: route ? [route] : [] });
  };

  if (routing.isLoading || catalog.isLoading) return <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-violet-600" /></div>;
  if (routing.isError || catalog.isError) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{(routing.error as Error)?.message || (catalog.error as Error)?.message || '参数加载失败'}</div>;

  return <>
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">比例设置</h2>
            <p className="mt-1 text-sm text-slate-500">页面展示比例与用户选择的模型互不影响，实际生成严格按每个比例的候选顺序执行。</p>
          </div>
          {canEdit && <button type="button" onClick={openCreate} disabled={!firstRoute()} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Plus className="h-4 w-4" />添加比例</button>}
        </div>
        <div className="divide-y divide-slate-100">
          {(routing.data?.groups ?? []).map((group) => {
            const isExpanded = expanded === group.aspectRatio;
            return <div key={group.aspectRatio}>
              <div className="flex items-center gap-3 px-5 py-4">
                <button type="button" onClick={() => setExpanded(isExpanded ? null : group.aspectRatio)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                  <span className="min-w-16 text-base font-semibold text-slate-900">{group.aspectRatio}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${group.source === 'ratio' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{group.source === 'ratio' ? '独立配置' : '继承全局'}</span>
                  <span className="text-sm text-slate-500">{group.routes.length} 个兜底模型</span>
                </button>
                {canEdit && <button type="button" onClick={() => { save.reset(); setNotice(''); setEditor({ mode: 'edit', originalAspectRatio: group.aspectRatio, aspectRatio: group.aspectRatio, routes: cloneRoutes(group.routes) }); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Pencil className="h-4 w-4" />编辑</button>}
              </div>
              {isExpanded && <div className="bg-slate-50/70 px-12 py-4">
                <ol className="space-y-2">
                  {group.routes.map((route, index) => <li key={`${route.capability}-${route.provider}-${route.exactModel}-${index}`} className="grid gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm md:grid-cols-[36px_110px_110px_1fr_auto] md:items-center">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-50 font-semibold text-violet-700">{index + 1}</span>
                    <span className="text-slate-600">{CAPABILITY_LABELS[route.capability] || route.capability}</span>
                    <span className="text-slate-600">{route.provider}</span>
                    <span className="break-all font-medium text-slate-800">{route.exactModel}</span>
                    <span className="text-xs text-slate-400">{route.timeoutSec}s · 重试 {route.maxAttempts}</span>
                  </li>)}
                </ol>
              </div>}
            </div>;
          })}
          {!routing.data?.groups.length && <div className="p-12 text-center text-sm text-slate-400">暂无画面比例，请先添加</div>}
        </div>
      </section>
      {notice && <div className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{notice}</div>}
    </div>
    {editor && standardCatalog && <AspectRatioEditor
      value={editor}
      catalog={standardCatalog}
      saving={save.isPending}
      error={save.isError ? save.error : null}
      onChange={setEditor}
      onClose={() => !save.isPending && setEditor(null)}
      onSave={() => save.mutate(editor)}
    />}
  </>;
}

function AspectRatioEditor({ value, catalog, saving, error, onChange, onClose, onSave }: {
  value: EditorState;
  catalog: Catalog;
  saving: boolean;
  error: unknown;
  onChange: (value: EditorState) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  const options = (capability: Capability, provider: Provider) => catalog.capabilityModels[capability]?.[provider] ?? [];
  const patchRoute = (index: number, patch: Partial<ModelRoute>) => onChange({ ...value, routes: value.routes.map((route, routeIndex) => routeIndex === index ? { ...route, ...patch } : route) });
  const addRoute = () => {
    for (const capability of catalog.capabilities) {
      for (const provider of catalog.providers) {
        const exactModel = options(capability, provider)[0];
        if (exactModel) {
          onChange({ ...value, routes: [...value.routes, { capability, provider, exactModel, priority: value.routes.length, timeoutSec: 900, maxAttempts: 1, enabled: true }] });
          return;
        }
      }
    }
  };
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= value.routes.length) return;
    const routes = [...value.routes];
    [routes[index], routes[target]] = [routes[target], routes[index]];
    onChange({ ...value, routes });
  };
  const valid = /^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(value.aspectRatio.trim()) && value.routes.length > 0 && value.routes.every((route) => route.exactModel);

  return <div role="dialog" aria-modal="true" aria-labelledby="aspect-ratio-editor-title" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <button type="button" aria-label="关闭弹窗" onClick={onClose} className="absolute inset-0 bg-black/60" />
    <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
        <div><h2 id="aspect-ratio-editor-title" className="text-lg font-semibold text-slate-900">{value.mode === 'create' ? '添加画面比例' : `编辑 ${value.aspectRatio}`}</h2><p className="mt-1 text-sm text-slate-500">至少配置一个模型；生成失败或超时后会按顺序尝试下一项。</p></div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="关闭" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
        <label className="block max-w-xs text-sm font-medium text-slate-700">画面比例
          <input value={value.aspectRatio} disabled={value.mode === 'edit' || saving} onChange={(event) => onChange({ ...value, aspectRatio: event.target.value })} placeholder="例如 3:4" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-violet-400 disabled:bg-slate-50" />
          {value.mode === 'create' && value.aspectRatio && !/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(value.aspectRatio.trim()) && <span className="mt-1 block text-xs text-red-600">请输入 16:9、3:4 等格式</span>}
        </label>
        <div className="flex items-center justify-between"><h3 className="font-semibold text-slate-900">兜底模型顺序</h3><button type="button" onClick={addRoute} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Plus className="h-4 w-4" />添加模型</button></div>
        <div className="space-y-3">
          {value.routes.map((route, index) => <div key={`${index}-${route.capability}-${route.provider}-${route.exactModel}`} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 xl:grid-cols-[40px_130px_130px_minmax(240px,1fr)_130px_120px_112px] xl:items-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 font-semibold text-violet-700">{index + 1}</span>
            <select value={route.capability} disabled={saving} onChange={(event) => { const capability = event.target.value as Capability; const provider = catalog.providers.find((item) => options(capability, item).length) || route.provider; patchRoute(index, { capability, provider, exactModel: options(capability, provider)[0] || '' }); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{catalog.capabilities.map((item) => <option key={item} value={item}>{CAPABILITY_LABELS[item]}</option>)}</select>
            <select value={route.provider} disabled={saving} onChange={(event) => { const provider = event.target.value as Provider; patchRoute(index, { provider, exactModel: options(route.capability, provider)[0] || '' }); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{catalog.providers.map((item) => <option key={item} value={item} disabled={!options(route.capability, item).length}>{item}</option>)}</select>
            <select value={route.exactModel} disabled={saving} onChange={(event) => patchRoute(index, { exactModel: event.target.value })} className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{options(route.capability, route.provider).map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <label className="text-xs text-slate-500">超时（秒）<input type="number" min={1} value={route.timeoutSec} disabled={saving} onChange={(event) => patchRoute(index, { timeoutSec: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-500">尝试次数<input type="number" min={1} max={5} value={route.maxAttempts} disabled={saving} onChange={(event) => patchRoute(index, { maxAttempts: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
            <div className="flex justify-end gap-1"><button type="button" onClick={() => move(index, -1)} disabled={saving || index === 0} className="rounded-lg border border-slate-200 bg-white p-2 disabled:opacity-40"><ArrowUp className="h-4 w-4" /></button><button type="button" onClick={() => move(index, 1)} disabled={saving || index === value.routes.length - 1} className="rounded-lg border border-slate-200 bg-white p-2 disabled:opacity-40"><ArrowDown className="h-4 w-4" /></button><button type="button" onClick={() => onChange({ ...value, routes: value.routes.filter((_, routeIndex) => routeIndex !== index) })} disabled={saving} className="rounded-lg border border-red-200 bg-white p-2 text-red-600"><Trash2 className="h-4 w-4" /></button></div>
          </div>)}
          {!value.routes.length && <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">至少添加一个兜底模型</div>}
        </div>
        {error != null && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error instanceof Error ? error.message : '保存失败'}</div>}
      </div>
      <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4"><button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">取消</button><button type="button" onClick={onSave} disabled={saving || !valid} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? '保存中' : '保存'}</button></div>
    </div>
  </div>;
}
