'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Cable,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Sparkles,
  ServerCog,
  ChevronRight,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';

type RoutingProvider = 'cloudflare' | 'fal' | 'mountsea';
type AiCapability =
  | 'textGpt'
  | 'textGemini'
  | 'imageNanoBanana'
  | 'videoSingleRef'
  | 'videoMultiRef'
  | 'audioTranscribe'
  | 'audioAnalyze';

interface ResolvedRouting {
  capability: AiCapability;
  primary: { provider: RoutingProvider; model: string };
  secondary: { provider: RoutingProvider; model: string } | null;
  isActive: boolean;
  source: 'db' | 'code';
}

interface ListResp {
  rows: ResolvedRouting[];
  capabilities: AiCapability[];
  labels: Record<AiCapability, string>;
  /** Day 4 总开关：env AI_ROUTER_ENABLED 是否打开（启动期读取，不可在 admin 改） */
  routerGloballyEnabled: boolean;
}

interface MetaResp {
  capabilities: AiCapability[];
  labels: Record<AiCapability, string>;
  support: Record<AiCapability, RoutingProvider[]>;
  defaultModels: Record<AiCapability, Partial<Record<RoutingProvider, string>>>;
}

const PROVIDER_META: Record<
  RoutingProvider,
  { label: string; icon: typeof Cloud; iconWrap: string; iconColor: string }
> = {
  cloudflare: {
    label: 'Cloudflare',
    icon: Cloud,
    iconWrap: 'bg-orange-50',
    iconColor: 'text-orange-600',
  },
  fal: {
    label: 'Fal.ai',
    icon: Sparkles,
    iconWrap: 'bg-pink-50',
    iconColor: 'text-pink-600',
  },
  mountsea: {
    label: 'Mountsea',
    icon: ServerCog,
    iconWrap: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
};

export default function AiRoutingPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AiCapability | null>(null);

  const listQ = useQuery<ListResp>({
    queryKey: ['admin', 'ai-routing'],
    queryFn: () => apiClient.get('/admin/ai-routing') as Promise<ListResp>,
  });
  const metaQ = useQuery<MetaResp>({
    queryKey: ['admin', 'ai-routing', 'meta'],
    queryFn: () => apiClient.get('/admin/ai-routing/meta') as Promise<MetaResp>,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'ai-routing'] });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4 max-w-5xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Cable className="h-5 w-5 text-purple-600" />
              AI 路由配置
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              为每个 AI 能力配置主备 provider 和模型。任何主 provider 失败时（除内容审核 / 凭证错误），
              路由器会自动 fallback 到备用。修改后立即生效，无须重启。
            </p>
          </div>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </button>
        </div>

        {listQ.data && (
          <div
            className={cn(
              'rounded-xl border px-4 py-3 text-sm',
              listQ.data.routerGloballyEnabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-900',
            )}
          >
            <div className="flex items-start gap-3">
              {listQ.data.routerGloballyEnabled ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
              )}
              <div className="space-y-1 leading-relaxed">
                {listQ.data.routerGloballyEnabled ? (
                  <>
                    <div className="font-semibold">
                      Day 4 总开关已开启（AI_ROUTER_ENABLED=true）
                    </div>
                    <div className="text-xs text-emerald-800/80">
                      业务侧 PromptSafetyRewriter / 故事板 / 视频生成（单图&amp;多图）会优先走以下路由配置；
                      未支持的能力（流式规划 / 音频）仍走 Mountsea。任何 capability 的「启用」开关关闭时该
                      能力直接 fallback 到 Mountsea 老路径。
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-semibold">
                      Day 4 总开关未开启（AI_ROUTER_ENABLED=false / 未设置）
                    </div>
                    <div className="text-xs text-amber-800/80">
                      目前业务侧所有 AI 调用走原 Mountsea 直调路径，下方路由配置仅作展示&amp;预热，
                      <strong>不生效</strong>。在服务器 .env 中设 <code className="px-1 py-0.5 rounded bg-amber-100">AI_ROUTER_ENABLED=true</code>{' '}
                      并重启 API 后生效。
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <QueryState
          isLoading={listQ.isLoading || metaQ.isLoading}
          isError={listQ.isError || metaQ.isError}
          error={listQ.error ?? metaQ.error}
          isEmpty={false}
          height="h-64"
        >
          {listQ.data && metaQ.data && (
            <div className="space-y-3">
              {listQ.data.capabilities.map((cap) => {
                const row = listQ.data!.rows.find((r) => r.capability === cap);
                if (!row) return null;
                return (
                  <CapabilityRow
                    key={cap}
                    row={row}
                    meta={metaQ.data!}
                    label={listQ.data!.labels[cap]}
                    editing={editing === cap}
                    onEnterEdit={() => setEditing(cap)}
                    onExitEdit={() => setEditing(null)}
                  />
                );
              })}
            </div>
          )}
        </QueryState>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 单 capability 行
// ──────────────────────────────────────────────────────────────────────

function CapabilityRow({
  row,
  meta,
  label,
  editing,
  onEnterEdit,
  onExitEdit,
}: {
  row: ResolvedRouting;
  meta: MetaResp;
  label: string;
  editing: boolean;
  onEnterEdit: () => void;
  onExitEdit: () => void;
}) {
  const qc = useQueryClient();
  const supportedProviders = meta.support[row.capability];
  const defaultModelsForCap = meta.defaultModels[row.capability];

  const [primary, setPrimary] = useState<RoutingProvider>(row.primary.provider);
  const [secondary, setSecondary] = useState<RoutingProvider | null>(row.secondary?.provider ?? null);
  const [modelPrimary, setModelPrimary] = useState('');   // 留空 = 默认
  const [modelSecondary, setModelSecondary] = useState('');
  const [isActive, setIsActive] = useState(row.isActive);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = useMutation({
    mutationFn: () =>
      apiClient.put(`/admin/ai-routing/${row.capability}`, {
        primaryProvider: primary,
        secondaryProvider: secondary,
        modelPrimary: modelPrimary.trim() || null,
        modelSecondary: modelSecondary.trim() || null,
        isActive,
      }) as Promise<ResolvedRouting>,
    onSuccess: () => {
      setMsg({ ok: true, text: '已保存，下次调用立即生效。' });
      qc.invalidateQueries({ queryKey: ['admin', 'ai-routing'] });
      setTimeout(() => {
        setMsg(null);
        onExitEdit();
      }, 1200);
    },
    onError: (e: any) =>
      setMsg({ ok: false, text: e?.message ?? '保存失败' }),
  });

  // 候选 provider list（排除已选 primary 后给 secondary 选）
  const secondaryCandidates = useMemo(
    () => supportedProviders.filter((p) => p !== primary),
    [supportedProviders, primary],
  );

  const onlyOneProvider = supportedProviders.length === 1;
  const PrimaryIcon = PROVIDER_META[row.primary.provider].icon;
  const SecondaryIcon = row.secondary
    ? PROVIDER_META[row.secondary.provider].icon
    : null;

  if (!editing) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-800">{label}</p>
              {!row.isActive && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-600">
                  已禁用
                </span>
              )}
              {row.source === 'code' && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700">
                  默认配置
                </span>
              )}
              {onlyOneProvider && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                  锁 {PROVIDER_META[supportedProviders[0]].label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <ProviderChip provider={row.primary.provider} model={row.primary.model} role="主" />
              {row.secondary && (
                <>
                  <ChevronRight className="h-3 w-3 text-slate-300" />
                  <ProviderChip
                    provider={row.secondary.provider}
                    model={row.secondary.model}
                    role="兜底"
                  />
                </>
              )}
              {!row.secondary && (
                <span className="text-[11px] text-slate-400">（无兜底）</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onEnterEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50 text-xs font-medium text-slate-700"
          >
            <Pencil className="h-3 w-3" />
            编辑
          </button>
        </div>
      </div>
    );
  }

  // 编辑模式
  return (
    <div className="bg-white border-2 border-purple-300 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <button
          type="button"
          onClick={onExitEdit}
          className="text-slate-400 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 主 */}
        <div className="space-y-2 rounded-xl bg-slate-50 p-3 border border-slate-100">
          <p className="text-[11px] font-semibold text-slate-500">主 Provider</p>
          <select
            value={primary}
            onChange={(e) => {
              const p = e.target.value as RoutingProvider;
              setPrimary(p);
              if (secondary === p) setSecondary(null);
            }}
            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
          >
            {supportedProviders.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_META[p].label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={modelPrimary}
            onChange={(e) => setModelPrimary(e.target.value)}
            placeholder={`模型（默认 ${defaultModelsForCap[primary] ?? '-'}）`}
            className="w-full px-2 py-1.5 text-xs font-mono border border-slate-200 rounded-lg bg-white"
          />
        </div>

        {/* 备 */}
        <div className="space-y-2 rounded-xl bg-slate-50 p-3 border border-slate-100">
          <p className="text-[11px] font-semibold text-slate-500">备 Provider（兜底）</p>
          <select
            value={secondary ?? ''}
            onChange={(e) => setSecondary((e.target.value || null) as RoutingProvider | null)}
            disabled={secondaryCandidates.length === 0}
            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white disabled:bg-slate-100"
          >
            <option value="">无兜底</option>
            {secondaryCandidates.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_META[p].label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={modelSecondary}
            onChange={(e) => setModelSecondary(e.target.value)}
            disabled={!secondary}
            placeholder={
              secondary
                ? `模型（默认 ${defaultModelsForCap[secondary] ?? '-'}）`
                : '需先选 Provider'
            }
            className="w-full px-2 py-1.5 text-xs font-mono border border-slate-200 rounded-lg bg-white disabled:bg-slate-100"
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
        <div>
          <p className="text-xs font-medium text-slate-700">启用此 capability</p>
          <p className="text-[11px] text-slate-400">关闭后路由器调用该 capability 会直接抛错</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <div className="w-9 h-5 bg-slate-300 peer-checked:bg-emerald-500 rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
        </label>
      </div>

      {msg && (
        <div
          className={cn(
            'rounded-xl px-3 py-2 text-xs border flex items-start gap-2',
            msg.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700',
          )}
        >
          {msg.ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          )}
          {msg.text}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onExitEdit}
          disabled={save.isPending}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-medium text-slate-700"
        >
          取消
        </button>
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-medium"
        >
          {save.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          保存
        </button>
      </div>
    </div>
  );
}

function ProviderChip({
  provider,
  model,
  role,
}: {
  provider: RoutingProvider;
  model: string;
  role: '主' | '兜底';
}) {
  const meta = PROVIDER_META[provider];
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg border border-slate-200 bg-white">
      <span className={cn('h-4 w-4 rounded flex items-center justify-center', meta.iconWrap)}>
        <Icon className={cn('h-2.5 w-2.5', meta.iconColor)} />
      </span>
      <span className="text-[11px] font-medium text-slate-700">{meta.label}</span>
      <span className="text-[10px] text-slate-400">·</span>
      <span className="text-[10px] font-mono text-slate-500">{model || '默认'}</span>
      <span className="text-[10px] text-slate-300">·</span>
      <span className="text-[10px] text-slate-400">{role}</span>
    </span>
  );
}
