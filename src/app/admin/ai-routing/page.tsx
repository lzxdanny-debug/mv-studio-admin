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
  Layers,
  ChevronRight,
  Pencil,
  Save,
  X,
  Activity,
  TrendingUp,
  Clock,
  Type,
  Eye,
  Image as ImageIcon,
  Film,
  Mic,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { PaginationBar } from '@/components/pagination-bar';

type RoutingProvider = 'cloudflare' | 'fal' | 'mountsea' | 'mountseaMs';
type AiCapability =
  | 'textGpt'
  | 'textGemini'
  | 'visionAnalyze'
  | 'imageNanoBanana'
  | 'videoSingleRef'
  | 'videoUltron'
  | 'videoMultiRef'
  | 'videoLipsync'
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
  modelOptions: Record<AiCapability, Partial<Record<RoutingProvider, string[]>>>;
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
  mountseaMs: {
    label: 'Mountsea MS',
    icon: Layers,
    iconWrap: 'bg-teal-50',
    iconColor: 'text-teal-600',
  },
};

// 能力分组：双 capability 一行并排；视频用 tab（多图/单图/对口型）
interface CapGroup {
  key: string;
  title: string;
  icon: typeof Cloud;
  caps: AiCapability[];
  /** 一行并排展示（文本、音频等 2 个子类） */
  inline?: boolean;
  /** tab 切换（视频 3 个子类） */
  tabbed?: boolean;
}

const CAP_GROUPS: CapGroup[] = [
  {
    key: 'text',
    title: '文本生成',
    icon: Type,
    caps: ['textGpt', 'textGemini'],
    inline: true,
  },
  { key: 'vision', title: '视觉理解', icon: Eye, caps: ['visionAnalyze'] },
  { key: 'image', title: '图像生成', icon: ImageIcon, caps: ['imageNanoBanana'] },
  {
    key: 'video',
    title: '视频生成',
    icon: Film,
    caps: ['videoUltron', 'videoMultiRef', 'videoSingleRef', 'videoLipsync'],
    tabbed: true,
  },
  {
    key: 'audio',
    title: '音频',
    icon: Mic,
    caps: ['audioTranscribe', 'audioAnalyze'],
    inline: true,
  },
];

const VIDEO_TAB_LABEL: Partial<Record<AiCapability, string>> = {
  videoUltron: 'Ultron 高质量',
  videoMultiRef: '多图参考',
  videoSingleRef: '单图',
  videoLipsync: '对口型',
};

const INLINE_SUB_LABEL: Partial<Record<AiCapability, string>> = {
  textGpt: 'GPT',
  textGemini: 'Gemini',
  audioTranscribe: '转写',
  audioAnalyze: '分析',
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
      <div className="p-6 space-y-4">
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
            <div className="space-y-5">
              {(() => {
                const data = listQ.data!;
                const meta = metaQ.data!;
                const grouped = new Set(CAP_GROUPS.flatMap((g) => g.caps));
                const leftover = data.capabilities.filter(
                  (c) => !grouped.has(c),
                );
                const groups: CapGroup[] = [...CAP_GROUPS];
                if (leftover.length > 0) {
                  groups.push({
                    key: 'other',
                    title: '其他',
                    icon: ServerCog,
                    caps: leftover,
                  });
                }
                return groups.map((g) => (
                  <CapabilityGroup
                    key={g.key}
                    group={g}
                    listData={data}
                    meta={meta}
                    editing={editing}
                    setEditing={setEditing}
                  />
                ));
              })()}
            </div>
          )}
        </QueryState>

        {listQ.data && (
          <RouterTelemetrySection labels={listQ.data.labels} />
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Day 8: Telemetry —— 最近调用 + capability × provider 汇总
// ──────────────────────────────────────────────────────────────────────

interface TelemetrySummaryResp {
  rangeHours: number;
  rows: Array<{
    capability: AiCapability;
    provider: RoutingProvider | null;
    total: number;
    success: number;
    fellBack: number;
    avgElapsedMs: number;
    p50ElapsedMs: number;
    p95ElapsedMs: number;
  }>;
  topErrors: Array<{ kind: string; count: number }>;
}

interface InvocationRow {
  id: string;
  capability: AiCapability;
  finalSuccess: boolean;
  fellBack: boolean;
  streaming: boolean;
  totalElapsedMs: number;
  usedProvider: RoutingProvider | null;
  usedModel: string | null;
  errorKind: string | null;
  errorMessage: string | null;
  attempts: Array<{
    provider: RoutingProvider;
    model: string;
    ok: boolean;
    elapsedMs: number;
    errorKind?: string;
    errorMessage?: string;
  }>;
  createdAt: string;
}

interface InvocationsResp {
  items: InvocationRow[];
  total: number;
  page: number;
  pageSize: number;
  capability: AiCapability | null;
}

function RouterTelemetrySection({
  labels,
}: {
  labels: Record<AiCapability, string>;
}) {
  const qc = useQueryClient();
  const [rangeHours, setRangeHours] = useState<number>(24);
  const [filterCap, setFilterCap] = useState<AiCapability | ''>('');
  const {
    page: invPage,
    setPage: setInvPage,
    pageSize: invPageSize,
    onPageSizeChange: onInvPageSizeChange,
  } = useServerPagination();

  const summaryQ = useQuery<TelemetrySummaryResp>({
    queryKey: ['admin', 'ai-routing', 'summary', rangeHours],
    queryFn: () =>
      apiClient.get(
        `/admin/ai-routing/summary?rangeHours=${rangeHours}`,
      ) as Promise<TelemetrySummaryResp>,
    refetchInterval: 30_000,
  });

  const invocationsQ = useQuery<InvocationsResp>({
    queryKey: ['admin', 'ai-routing', 'invocations', filterCap, invPage],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(invPage),
        pageSize: String(invPageSize),
      });
      if (filterCap) qs.set('capability', filterCap);
      const raw = (await apiClient.get(
        `/admin/ai-routing/invocations?${qs.toString()}`,
      )) as InvocationsResp & { rows?: InvocationRow[]; limit?: number };
      const items = raw.items ?? raw.rows ?? [];
      return {
        items,
        total: raw.total ?? items.length,
        page: raw.page ?? invPage,
        pageSize: raw.pageSize ?? invPageSize,
        capability: raw.capability ?? null,
      };
    },
    refetchInterval: 30_000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'ai-routing', 'summary'] });
    qc.invalidateQueries({ queryKey: ['admin', 'ai-routing', 'invocations'] });
  };

  return (
    <div className="space-y-4 pt-6 border-t border-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-600" />
            调用埋点（Day 8）
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            每次 router 调用都会写一条记录（best-effort，DB 异常不影响业务）。
            数据每 30 秒自动刷新。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={rangeHours}
            onChange={(e) => setRangeHours(parseInt(e.target.value, 10))}
            className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
          >
            <option value={1}>近 1 小时</option>
            <option value={6}>近 6 小时</option>
            <option value={24}>近 24 小时</option>
            <option value={72}>近 3 天</option>
            <option value={168}>近 7 天</option>
            <option value={720}>近 30 天</option>
          </select>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700"
          >
            <RefreshCw className="h-3 w-3" />
            刷新
          </button>
        </div>
      </div>

      <QueryState
        isLoading={summaryQ.isLoading}
        isError={summaryQ.isError}
        error={summaryQ.error}
        isEmpty={!summaryQ.data?.rows.length}
        emptyMessage={`近 ${rangeHours}h 还没有调用记录（业务侧未触发或 router 未启用）`}
        height="h-32"
      >
        {summaryQ.data && summaryQ.data.rows.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Capability</th>
                  <th className="text-left px-3 py-2 font-medium">Provider</th>
                  <th className="text-right px-3 py-2 font-medium">总数</th>
                  <th className="text-right px-3 py-2 font-medium">成功</th>
                  <th className="text-right px-3 py-2 font-medium">成功率</th>
                  <th className="text-right px-3 py-2 font-medium">fallback</th>
                  <th className="text-right px-3 py-2 font-medium">p50</th>
                  <th className="text-right px-3 py-2 font-medium">p95</th>
                  <th className="text-right px-3 py-2 font-medium">均值</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaryQ.data.rows.map((r, i) => {
                  const successRate = r.total > 0 ? r.success / r.total : 0;
                  return (
                    <tr key={`${r.capability}-${r.provider ?? 'fail'}-${i}`}>
                      <td className="px-3 py-2 font-medium text-slate-700">
                        {labels[r.capability] ?? r.capability}
                      </td>
                      <td className="px-3 py-2">
                        {r.provider ? (
                          <span className="text-slate-600">
                            {PROVIDER_META[r.provider].label}
                          </span>
                        ) : (
                          <span className="text-red-500">全部失败</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">
                        {r.total}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">
                        {r.success}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        <span
                          className={cn(
                            successRate >= 0.95
                              ? 'text-emerald-600'
                              : successRate >= 0.8
                                ? 'text-amber-600'
                                : 'text-red-600',
                          )}
                        >
                          {(successRate * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-500">
                        {r.fellBack > 0 ? r.fellBack : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-500">
                        {fmtMs(r.p50ElapsedMs)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-500">
                        {fmtMs(r.p95ElapsedMs)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-500">
                        {fmtMs(r.avgElapsedMs)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>

      {summaryQ.data && summaryQ.data.topErrors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
            <TrendingUp className="h-3.5 w-3.5" />
            近 {rangeHours}h 错误分类 TOP {summaryQ.data.topErrors.length}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {summaryQ.data.topErrors.map((e) => (
              <span
                key={e.kind}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-white border border-amber-300 text-amber-900"
              >
                <span className="font-mono">{e.kind}</span>
                <span className="text-amber-600">×{e.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          调用记录
        </h3>
        <select
          value={filterCap}
          onChange={(e) => { setFilterCap(e.target.value as AiCapability | ''); setInvPage(1); }}
          className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
        >
          <option value="">全部 capability</option>
          {Object.entries(labels).map(([cap, label]) => (
            <option key={cap} value={cap}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <QueryState
        isLoading={invocationsQ.isLoading}
        isError={invocationsQ.isError}
        error={invocationsQ.error}
        isEmpty={!(invocationsQ.data?.items?.length)}
        emptyMessage="暂无调用记录"
        height="h-32"
      >
        {(invocationsQ.data?.items?.length ?? 0) > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">时间</th>
                  <th className="text-left px-3 py-2 font-medium">Capability</th>
                  <th className="text-left px-3 py-2 font-medium">结果</th>
                  <th className="text-left px-3 py-2 font-medium">Provider · Model</th>
                  <th className="text-right px-3 py-2 font-medium">耗时</th>
                  <th className="text-left px-3 py-2 font-medium">轨迹</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invocationsQ.data!.items.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-mono text-slate-500 whitespace-nowrap">
                      {fmtRelative(row.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {labels[row.capability] ?? row.capability}
                      {row.streaming && (
                        <span className="ml-1 px-1 py-0.5 rounded text-[9px] font-medium bg-blue-50 text-blue-700">
                          stream
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.finalSuccess ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          成功
                          {row.fellBack && (
                            <span className="px-1 rounded text-[9px] bg-amber-100 text-amber-700">
                              fallback
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700">
                          <AlertTriangle className="h-3 w-3" />
                          失败
                          {row.errorKind && (
                            <span className="font-mono text-[10px] text-red-600">
                              {row.errorKind}
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.usedProvider ? (
                        <span className="text-slate-600">
                          {PROVIDER_META[row.usedProvider].label}
                          <span className="text-slate-400 mx-1">·</span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {row.usedModel}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-500">
                      {fmtMs(row.totalElapsedMs)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {row.attempts.map((a, i) => (
                          <span
                            key={i}
                            className={cn(
                              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border',
                              a.ok
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-red-200 bg-red-50 text-red-700',
                            )}
                            title={a.errorMessage ?? ''}
                          >
                            {PROVIDER_META[a.provider]?.label ?? a.provider}
                            <span className="font-mono text-[9px] opacity-70">
                              {fmtMs(a.elapsedMs)}
                            </span>
                            {a.errorKind && (
                              <span className="font-mono text-[9px]">
                                {a.errorKind}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar
              page={invPage}
              pageSize={invPageSize}
              total={invocationsQ.data?.total}
              onPageChange={setInvPage}
              onPageSizeChange={onInvPageSizeChange}
            />
          </div>
        )}
      </QueryState>
    </div>
  );
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${min}m${s}s`;
}

function fmtRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

// ──────────────────────────────────────────────────────────────────────
// 能力分组（视频用 tab 切换多图/单图）
// ──────────────────────────────────────────────────────────────────────

function CapabilityGroup({
  group,
  listData,
  meta,
  editing,
  setEditing,
}: {
  group: CapGroup;
  listData: ListResp;
  meta: MetaResp;
  editing: AiCapability | null;
  setEditing: (c: AiCapability | null) => void;
}) {
  const caps = group.caps.filter((c) => listData.capabilities.includes(c));
  const [activeTab, setActiveTab] = useState<AiCapability>(caps[0] ?? group.caps[0]);
  const Icon = group.icon;

  if (caps.length === 0) return null;

  const cardShell = (children: React.ReactNode) => (
    <section className="w-full">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-purple-100 border-b border-purple-200 flex items-center gap-2.5">
          <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-white/90 border border-purple-200 shadow-sm">
            <Icon className="h-4 w-4 text-purple-700" />
          </span>
          <h2 className="text-sm font-bold text-purple-950 tracking-wide">
            {group.title}
          </h2>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </section>
  );

  /** 子 capability 固定占 50% 宽，不平铺整行 */
  const capGrid = (items: React.ReactNode) => (
    <div className="grid grid-cols-2 gap-4 items-start">{items}</div>
  );

  const renderCap = (c: AiCapability, opts?: { compact?: boolean; subLabel?: string }) => {
    const row = listData.rows.find((r) => r.capability === c);
    if (!row) return null;
    return (
      <CapabilityRow
        key={c}
        bare
        compact={opts?.compact}
        row={row}
        meta={meta}
        label={listData.labels[c]}
        subLabel={opts?.subLabel ?? INLINE_SUB_LABEL[c]}
        editing={editing === c}
        onEnterEdit={() => setEditing(c)}
        onExitEdit={() => setEditing(null)}
      />
    );
  };

  if (group.tabbed) {
    const activeCap = caps.includes(activeTab) ? activeTab : caps[0];
    const row = listData.rows.find((r) => r.capability === activeCap);
    return cardShell(
      <>
        <div className="flex gap-1 mb-3 bg-slate-100 p-1 rounded-xl max-w-[50%]">
          {caps.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveTab(c)}
              className={cn(
                'flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-center',
                activeCap === c
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {VIDEO_TAB_LABEL[c] ?? listData.labels[c]}
            </button>
          ))}
        </div>
        {row && (
          <div className="w-1/2">
            <CapabilityRow
              bare
              row={row}
              meta={meta}
              label={listData.labels[activeCap]}
              subLabel={VIDEO_TAB_LABEL[activeCap]}
              editing={editing === activeCap}
              onEnterEdit={() => setEditing(activeCap)}
              onExitEdit={() => setEditing(null)}
            />
          </div>
        )}
      </>,
    );
  }

  if (group.inline && caps.length >= 2) {
    return cardShell(
      capGrid(caps.map((c) => renderCap(c, { compact: true }))),
    );
  }

  return cardShell(capGrid(caps.map((c) => renderCap(c))));
}

// ──────────────────────────────────────────────────────────────────────
// 单 capability 行
// ──────────────────────────────────────────────────────────────────────

function CapabilityRow({
  row,
  meta,
  label,
  subLabel,
  editing,
  onEnterEdit,
  onExitEdit,
  bare = false,
  compact = false,
}: {
  row: ResolvedRouting;
  meta: MetaResp;
  label: string;
  subLabel?: string;
  editing: boolean;
  onEnterEdit: () => void;
  onExitEdit: () => void;
  bare?: boolean;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const supportedProviders = meta.support[row.capability];
  const defaultModelsForCap = meta.defaultModels[row.capability];
  const modelOptionsForCap = meta.modelOptions?.[row.capability] ?? {};

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

  if (!editing) {
    return (
      <div
        className={cn(
          'flex flex-col',
          bare
            ? compact
              ? 'rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 h-full'
              : 'rounded-xl border border-slate-100 bg-slate-50/50 p-3'
            : 'bg-white border border-slate-200 rounded-2xl p-4',
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className={cn('font-semibold text-slate-800', compact ? 'text-xs' : 'text-sm')}>
                {subLabel ?? label}
              </p>
              {!row.isActive && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-600">
                  已禁用
                </span>
              )}
              {onlyOneProvider && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                  锁 {PROVIDER_META[supportedProviders[0]].label}
                </span>
              )}
            </div>
            {subLabel && !compact && (
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{label}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onEnterEdit}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50 text-[10px] font-medium text-slate-700 flex-shrink-0"
          >
            <Pencil className="h-2.5 w-2.5" />
            编辑
          </button>
        </div>

        <div className="space-y-1.5">
          <ProviderBlock provider={row.primary.provider} model={row.primary.model} role="主" prominent />
          {row.secondary ? (
            <>
              <div className="flex justify-center py-0.5">
                <ChevronRight className="h-3 w-3 text-slate-300 rotate-90" />
              </div>
              <ProviderBlock
                provider={row.secondary.provider}
                model={row.secondary.model}
                role="兜底"
              />
            </>
          ) : (
            <p className="text-[10px] text-slate-400 text-center pt-1">无兜底</p>
          )}
        </div>
      </div>
    );
  }

  // 编辑模式：主在上、备在下，层次分明
  return (
    <div
      className={cn(
        'space-y-3',
        bare
          ? 'rounded-xl border border-purple-200 bg-purple-50/40 p-3'
          : 'bg-white border-2 border-purple-300 rounded-2xl p-4',
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">{subLabel ?? label}</p>
        <button type="button" onClick={onExitEdit} className="text-slate-400 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        {/* 主 Provider — 强调 */}
        <div className="space-y-2 rounded-xl bg-white p-3 border-2 border-purple-200 shadow-sm">
          <p className="text-xs font-semibold text-purple-700">主 Provider</p>
          <select
            value={primary}
            onChange={(e) => {
              const p = e.target.value as RoutingProvider;
              setPrimary(p);
              setModelPrimary(''); // 切换 provider 重置模型选择
              if (secondary === p) setSecondary(null);
            }}
            className="w-full px-2 py-2 text-sm border border-slate-200 rounded-lg bg-white"
          >
            {supportedProviders.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_META[p].label}
              </option>
            ))}
          </select>
          <ModelSelect
            value={modelPrimary}
            onChange={setModelPrimary}
            options={modelOptionsForCap[primary] ?? []}
            defaultModel={defaultModelsForCap[primary]}
          />
        </div>

        <div className="flex justify-center">
          <ChevronRight className="h-4 w-4 text-slate-300 rotate-90" />
        </div>

        {/* 备 Provider — 次级 */}
        <div className="space-y-2 rounded-xl bg-slate-50/80 p-3 border border-slate-200">
          <p className="text-[11px] font-medium text-slate-500">备 Provider（兜底）</p>
          <select
            value={secondary ?? ''}
            onChange={(e) => {
              setSecondary((e.target.value || null) as RoutingProvider | null);
              setModelSecondary(''); // 切换 provider 重置模型选择
            }}
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
          <ModelSelect
            value={modelSecondary}
            onChange={setModelSecondary}
            options={secondary ? (modelOptionsForCap[secondary] ?? []) : []}
            defaultModel={secondary ? defaultModelsForCap[secondary] : undefined}
            disabled={!secondary}
            disabledPlaceholder="需先选 Provider"
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

/** 模型 ID 下拉框：第一项为「默认」(空值)，其余为候选模型；当前自定义值不在候选时自动并入。 */
function ModelSelect({
  value,
  onChange,
  options,
  defaultModel,
  disabled = false,
  disabledPlaceholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  defaultModel?: string;
  disabled?: boolean;
  disabledPlaceholder?: string;
}) {
  // 当前值若是自定义（不在候选里），并入列表以免丢失
  const merged = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-2 py-1.5 text-xs font-mono border border-slate-200 rounded-lg bg-slate-50 disabled:bg-slate-100"
    >
      {disabled && disabledPlaceholder ? (
        <option value="">{disabledPlaceholder}</option>
      ) : (
        <option value="">默认（{defaultModel ?? '-'}）</option>
      )}
      {merged.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  );
}

function ProviderBlock({
  provider,
  model,
  role,
  prominent = false,
}: {
  provider: RoutingProvider;
  model: string;
  role: '主' | '兜底';
  prominent?: boolean;
}) {
  const meta = PROVIDER_META[provider];
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        'rounded-lg border px-2 py-1.5',
        prominent
          ? 'border-purple-200 bg-white'
          : 'border-slate-100 bg-slate-50/80',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn('h-4 w-4 rounded flex items-center justify-center', meta.iconWrap)}>
          <Icon className={cn('h-2.5 w-2.5', meta.iconColor)} />
        </span>
        <span className={cn('font-medium text-slate-700', prominent ? 'text-[11px]' : 'text-[10px]')}>
          {meta.label}
        </span>
        <span className="text-[9px] text-slate-400 ml-auto">{role}</span>
      </div>
      <p className="text-[10px] font-mono text-slate-500 mt-1 truncate pl-5">
        {model || '默认模型'}
      </p>
    </div>
  );
}
