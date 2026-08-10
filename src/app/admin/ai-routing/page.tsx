'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Cable,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  ServerCog,
  Layers,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
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
  Sparkles,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { PaginationBar } from '@/components/pagination-bar';
import { SimpleSelect } from '@/components/ui/select';

type RoutingProvider = 'mountsea' | 'apisale' | 'smartfashion' | 'aitokens' | 'google';
type AiCapability =
  | 'textGpt'
  | 'textGemini'
  | 'textAgent'
  | 'dancePlanning'
  | 'danceVision'
  | 'danceImage'
  | 'danceVideoSingleRef'
  | 'danceVideo'
  | 'visionAnalyze'
  | 'imageNanoBanana'
  | 'videoSingleRef'
  | 'videoGrok'
  | 'videoUltron'
  | 'videoMultiRef'
  | 'videoLipsync'
  | 'karaokeSceneImage'
  | 'karaokeVideoSolo'
  | 'karaokeVideoPet'
  | 'karaokeVideoDuet'
  | 'effectVideoI2V'
  | 'effectImageEdit'
  | 'effectVideoMultiRef'
  | 'audioTranscribe'
  | 'audioAnalyze';

interface ResolvedRouting {
  capability: AiCapability;
  chain: Array<{ provider: RoutingProvider; model: string }>;
  primary: { provider: RoutingProvider; model: string };
  secondary: { provider: RoutingProvider; model: string } | null;
  isActive: boolean;
  timeoutMs: number | null;
  source: 'db' | 'code';
}

interface ChainEntryDraft {
  provider: RoutingProvider;
  model: string;
}

function buildChainDraft(
  row: ResolvedRouting,
  defaultModelsForCap: Partial<Record<RoutingProvider, string>>,
): ChainEntryDraft[] {
  const source = row.chain.length > 0 ? row.chain : [row.primary];
  return source.map((entry) => {
    const defaultModel = defaultModelsForCap[entry.provider] ?? '';
    return {
      provider: entry.provider,
      // 与保存逻辑一致：留空表示使用默认 model
      model: entry.model === defaultModel ? '' : entry.model,
    };
  });
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

type ProviderMetaItem = {
  label: string;
  icon: typeof Cloud;
  iconWrap: string;
  iconColor: string;
};

const PROVIDER_META: Record<RoutingProvider, ProviderMetaItem> = {
  mountsea: {
    label: 'Mountsea',
    icon: ServerCog,
    iconWrap: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  apisale: {
    label: 'apisale',
    icon: Layers,
    iconWrap: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  smartfashion: {
    label: 'smartfashion',
    icon: Cloud,
    iconWrap: 'bg-cyan-50',
    iconColor: 'text-cyan-700',
  },
  aitokens: {
    label: 'aitokens',
    icon: Cloud,
    iconWrap: 'bg-teal-50',
    iconColor: 'text-teal-700',
  },
  google: {
    label: 'Google Gemini',
    icon: Cloud,
    iconWrap: 'bg-amber-50',
    iconColor: 'text-amber-700',
  },
};

/** 历史调用记录里可能仍出现已下线渠道（mountseaMs / fal / cloudflare / minimax） */
const LEGACY_PROVIDER_META: Record<string, ProviderMetaItem> = {
  mountseaMs: {
    label: 'Mountsea MS（已下线）',
    icon: Layers,
    iconWrap: 'bg-slate-100',
    iconColor: 'text-slate-500',
  },
  fal: {
    label: 'Fal.ai（已下线）',
    icon: Cloud,
    iconWrap: 'bg-slate-100',
    iconColor: 'text-slate-500',
  },
  cloudflare: {
    label: 'Cloudflare（已下线）',
    icon: Cloud,
    iconWrap: 'bg-slate-100',
    iconColor: 'text-slate-500',
  },
  minimax: {
    label: 'MiniMax（已下线）',
    icon: Film,
    iconWrap: 'bg-slate-100',
    iconColor: 'text-slate-500',
  },
};

function getProviderMeta(provider: string | null | undefined): ProviderMetaItem {
  if (!provider) {
    return {
      label: '-',
      icon: Cloud,
      iconWrap: 'bg-slate-100',
      iconColor: 'text-slate-400',
    };
  }
  if (provider in PROVIDER_META) {
    return PROVIDER_META[provider as RoutingProvider];
  }
  return (
    LEGACY_PROVIDER_META[provider] ?? {
      label: provider,
      icon: Cloud,
      iconWrap: 'bg-slate-100',
      iconColor: 'text-slate-500',
    }
  );
}

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
    caps: ['textGpt', 'textGemini', 'textAgent'],
    inline: true,
  },
  {
    key: 'dance',
    title: 'Dance Video',
    icon: Sparkles,
    caps: [
      'dancePlanning',
      'danceVision',
      'danceImage',
      'danceVideoSingleRef',
      'danceVideo',
    ],
    tabbed: true,
  },
  { key: 'vision', title: '视觉理解', icon: Eye, caps: ['visionAnalyze'] },
  { key: 'image', title: '图像生成', icon: ImageIcon, caps: ['imageNanoBanana'] },
  {
    key: 'video',
    title: '视频生成',
    icon: Film,
    caps: ['videoUltron', 'videoMultiRef', 'videoSingleRef', 'videoGrok', 'videoLipsync'],
    tabbed: true,
  },
  {
    key: 'karaoke',
    title: 'Photo Karaoke',
    icon: Mic,
    caps: ['karaokeSceneImage', 'karaokeVideoSolo', 'karaokeVideoPet', 'karaokeVideoDuet'],
    tabbed: true,
  },
  {
    key: 'video-effects',
    title: '视频特效',
    icon: Sparkles,
    caps: ['effectVideoI2V', 'effectImageEdit', 'effectVideoMultiRef'],
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
  videoGrok: 'Grok 长镜头',
  videoLipsync: '对口型',
  karaokeSceneImage: '场景图',
  karaokeVideoSolo: 'Solo',
  karaokeVideoPet: 'Pet',
  karaokeVideoDuet: 'Duet',
  dancePlanning: '策划',
  danceVision: '人物识别',
  danceImage: '图片',
  danceVideoSingleRef: '单图视频',
  danceVideo: '多图视频',
  effectVideoI2V: '单图直出 I2V',
  effectImageEdit: '图编辑',
  effectVideoMultiRef: '多图参考',
};

const INLINE_SUB_LABEL: Partial<Record<AiCapability, string>> = {
  textGpt: 'GPT',
  textGemini: 'Gemini',
  textAgent: 'Agent 对话',
  dancePlanning: '导演与编舞',
  danceVision: '人物参考图分析',
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
    <div className="admin-page">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Cable className="h-5 w-5 text-blue-600" />
              AI 路由配置
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              为每个 AI 能力配置优先级路由链（可添加多条）。按顺序依次尝试，全部失败后提示联系管理人员。
              修改后立即生效，无须重启。
            </p>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed rounded-lg border border-slate-200 bg-white px-3 py-2 max-w-3xl">
              <strong className="text-slate-700">Mountsea</strong>（Hub）走 /v1 聊天与 Hub 视频/图像名，负责
              <strong className="text-slate-700"> 文本、音频、视觉理解</strong> 等能力。
              <strong className="text-slate-700"> Mountsea MS</strong> 走 /ms/v1 按 endpoint slug 调用，仅开放给
              <strong className="text-slate-700"> 图像 / 视频 / 对口型</strong>——因此「文本生成」等不会出现 MS 选项，这是 API 能力边界，不是遗漏。
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
            <Activity className="h-4 w-4 text-blue-600" />
            调用埋点（Day 8）
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            每次 router 调用都会写一条记录（best-effort，DB 异常不影响业务）。
            数据每 30 秒自动刷新。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SimpleSelect
            size="sm"
            className="w-[7.5rem]"
            value={String(rangeHours)}
            onValueChange={(v) => setRangeHours(parseInt(v, 10))}
            options={[
              { value: '1', label: '近 1 小时' },
              { value: '6', label: '近 6 小时' },
              { value: '24', label: '近 24 小时' },
              { value: '72', label: '近 3 天' },
              { value: '168', label: '近 7 天' },
              { value: '720', label: '近 30 天' },
            ]}
          />
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
                            {getProviderMeta(r.provider).label}
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
        <SimpleSelect
          size="sm"
          className="min-w-[10rem]"
          value={filterCap || 'all'}
          onValueChange={(v) => {
            setFilterCap(v === 'all' ? '' : (v as AiCapability));
            setInvPage(1);
          }}
          options={[
            { value: 'all', label: '全部 capability' },
            ...Object.entries(labels).map(([cap, label]) => ({
              value: cap,
              label,
            })),
          ]}
        />
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
                          {getProviderMeta(row.usedProvider).label}
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
                            {getProviderMeta(a.provider).label}
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
        <div className="px-4 py-3 bg-blue-100 border-b border-blue-200 flex items-center gap-2.5">
          <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-white/90 border border-blue-200 shadow-sm">
            <Icon className="h-4 w-4 text-blue-700" />
          </span>
          <h2 className="text-sm font-bold text-blue-950 tracking-wide">
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
                  ? 'bg-white text-blue-700 shadow-sm'
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
              key={activeCap}
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

  const [chain, setChain] = useState<ChainEntryDraft[]>(() =>
    buildChainDraft(row, defaultModelsForCap),
  );
  const [isActive, setIsActive] = useState(row.isActive);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // 进入编辑时用最新 row 回填（避免 tab 切换或数据刷新后 state 与展示不一致）
  useEffect(() => {
    if (!editing) return;
    setChain(buildChainDraft(row, defaultModelsForCap));
    setIsActive(row.isActive);
    setMsg(null);
  }, [editing, row.capability]);

  const save = useMutation({
    mutationFn: () =>
      apiClient.put(`/admin/ai-routing/${row.capability}`, {
        chain: chain.map((entry) => ({
          provider: entry.provider,
          model: entry.model.trim() || null,
        })),
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

  const effectiveModel = (provider: RoutingProvider, model: string) =>
    model.trim() || (defaultModelsForCap[provider] ?? '');

  const handleSave = () => {
    if (chain.length === 0) {
      setMsg({ ok: false, text: '至少需要 1 条优先级路由' });
      return;
    }
    const seen = new Set<string>();
    for (const entry of chain) {
      const key = `${entry.provider}::${effectiveModel(entry.provider, entry.model)}`;
      if (seen.has(key)) {
        setMsg({ ok: false, text: '路由链中存在重复的 provider + 模型组合' });
        return;
      }
      seen.add(key);
    }
    save.mutate();
  };

  const updateEntry = (index: number, patch: Partial<ChainEntryDraft>) => {
    setChain((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    );
  };

  const moveEntry = (index: number, direction: -1 | 1) => {
    setChain((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const onlyOneProvider = supportedProviders.length === 1;

  if (!editing) {
    const displayChain = row.chain.length > 0 ? row.chain : [row.primary];
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
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50 text-[10px] font-medium text-slate-700 flex-shrink-0"
          >
            <Pencil className="h-2.5 w-2.5" />
            编辑
          </button>
        </div>

        <div className="space-y-1.5">
          {displayChain.map((entry, index) => (
            <div key={`${entry.provider}-${entry.model}-${index}`}>
              {index > 0 && (
                <div className="flex justify-center py-0.5">
                  <ChevronRight className="h-3 w-3 text-slate-300 rotate-90" />
                </div>
              )}
              <ProviderBlock
                provider={entry.provider}
                model={entry.model}
                role={index === 0 ? '优先' : `#${index + 1}`}
                prominent={index === 0}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'space-y-3',
        bare
          ? 'rounded-xl border border-blue-200 bg-blue-50/40 p-3'
          : 'bg-white border-2 border-blue-300 rounded-2xl p-4',
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">{subLabel ?? label}</p>
        <button type="button" onClick={onExitEdit} className="text-slate-400 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2.5">
        {chain.map((entry, index) => {
          const providerMeta = getProviderMeta(entry.provider);
          return (
            <div
              key={`draft-${index}`}
              className={cn(
                'space-y-3 rounded-[14px] border bg-white p-3.5',
                'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
                index === 0
                  ? 'border-blue-200 ring-1 ring-blue-100'
                  : 'border-slate-200/90',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                      index === 0
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {index + 1}
                  </span>
                  <p className="text-xs font-semibold text-slate-700">
                    {index === 0 ? '最高优先级' : `优先级 #${index + 1}`}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveEntry(index, -1)}
                    className="rounded-[8px] p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30"
                    title="上移"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === chain.length - 1}
                    onClick={() => moveEntry(index, 1)}
                    className="rounded-[8px] p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30"
                    title="下移"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={chain.length <= 1}
                    onClick={() => setChain((prev) => prev.filter((_, i) => i !== index))}
                    className="rounded-[8px] p-1.5 text-rose-500 transition-colors hover:bg-rose-50 disabled:opacity-30"
                    title="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-500">
                  供应商
                </label>
                <SimpleSelect
                  size="md"
                  value={entry.provider}
                  onValueChange={(v) => {
                    updateEntry(index, {
                      provider: v as RoutingProvider,
                      model: '',
                    });
                  }}
                  options={supportedProviders.map((p) => {
                    const m = PROVIDER_META[p];
                    const Icon = m.icon;
                    return {
                      value: p,
                      label: m.label,
                      leading: (
                        <span
                          className={cn(
                            'inline-flex h-5 w-5 items-center justify-center rounded-[6px]',
                            m.iconWrap,
                          )}
                        >
                          <Icon className={cn('h-3 w-3', m.iconColor)} />
                        </span>
                      ),
                    };
                  })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-500">
                  模型 · {providerMeta.label}
                </label>
                <ModelSelect
                  inputId={`model-${row.capability}-${index}`}
                  value={entry.model}
                  onChange={(model) => updateEntry(index, { model })}
                  options={modelOptionsForCap[entry.provider] ?? []}
                  defaultModel={defaultModelsForCap[entry.provider]}
                />
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() =>
            setChain((prev) => [
              ...prev,
              { provider: supportedProviders[0], model: '' },
            ])
          }
          disabled={chain.length >= 12}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-slate-300 px-3 py-2.5 text-xs font-medium text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          添加优先级路由
        </button>
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
              : 'border-rose-200 bg-rose-50 text-rose-700',
          )}
        >
          {msg.ok ? (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onExitEdit}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={save.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          保存
        </button>
      </div>
    </div>
  );
}

const MODEL_DEFAULT_VALUE = '__default__';

/** 模型：纯下拉（默认项 + 候选列表，不再手输） */
function ModelSelect({
  value,
  onChange,
  options,
  defaultModel,
  disabled = false,
  disabledPlaceholder,
  inputId,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  defaultModel?: string;
  disabled?: boolean;
  disabledPlaceholder?: string;
  inputId: string;
}) {
  if (disabled) {
    return (
      <SimpleSelect
        id={inputId}
        size="md"
        mono
        disabled
        value="unavailable"
        onValueChange={() => undefined}
        options={[
          {
            value: 'unavailable',
            label: disabledPlaceholder ?? '不可用',
          },
        ]}
      />
    );
  }

  const models = Array.from(
    new Set([
      ...options,
      // 已保存但不在候选里的值仍展示，避免回显丢失
      ...(value.trim() && value.trim() !== defaultModel ? [value.trim()] : []),
    ]),
  );

  const selectValue = value.trim() ? value.trim() : MODEL_DEFAULT_VALUE;

  return (
    <SimpleSelect
      id={inputId}
      size="md"
      mono
      value={selectValue}
      onValueChange={(v) => onChange(v === MODEL_DEFAULT_VALUE ? '' : v)}
      options={[
        {
          value: MODEL_DEFAULT_VALUE,
          label: defaultModel ? `默认 · ${defaultModel}` : '使用默认模型',
        },
        ...models.map((m) => ({
          value: m,
          label: m,
        })),
      ]}
    />
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
  role: string;
  prominent?: boolean;
}) {
  const meta = getProviderMeta(provider);
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        'rounded-lg border px-2 py-1.5',
        prominent
          ? 'border-blue-200 bg-white'
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
