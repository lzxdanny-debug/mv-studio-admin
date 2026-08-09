'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  LineChart,
  RefreshCw,
  Film,
  Music,
  FileText,
  ExternalLink,
  Gift,
  Mic2,
  PersonStanding,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import {
  usdAmount,
  usdAmountCompact,
  pct,
  RANGE_LABEL,
  RangePreset,
  computeRange,
} from '../_lib/format';

type CostLineId = 'mv' | 'music' | 'lyrics' | 'karaoke' | 'dance' | 'video_effect';
type SelectableLine = CostLineId | 'bonus';

interface CostLine {
  line: CostLineId;
  label: string;
  usd: number;
  calls: number;
  successCalls: number;
  failedCalls: number;
  reconciledCalls: number;
  failedUsd?: number;
}

interface CostHealth {
  calls: number;
  reconciledCalls: number;
  reconcileRate: number;
  estUsd: number;
  estOnReconciledUsd: number;
  recUsd: number;
  deltaUsd: number;
  failedCalls: number;
  failedUsd: number;
}

interface CostSummary {
  range: { fromMs: number; toMs: number };
  usdCnyRate: number;
  rateAsOf: string | null;
  rateSource: 'live' | 'cache' | 'default';
  timelineGranularity?: 'hour' | 'day';
  lines: CostLine[];
  totalUsd: number;
  health?: CostHealth;
  byProvider: { provider: string; usd: number; calls: number }[];
  byModelText?: { model: string; usd: number; calls: number }[];
  byModelVideo?: { model: string; usd: number; calls: number }[];
  timeline: {
    date: string;
    mvUsd: number;
    musicUsd: number;
    lyricsUsd: number;
    karaokeUsd: number;
    danceUsd: number;
    videoEffectUsd: number;
    mvCalls: number;
    musicCalls: number;
    lyricsCalls: number;
    karaokeCalls: number;
    danceCalls: number;
    videoEffectCalls: number;
  }[];
  timelineByProvider: {
    date: string;
    mountseaUsd: number;
    apisaleUsd: number;
    otherUsd: number;
  }[];
  topUsers?: Array<{
    userId: string;
    displayName: string;
    email: string | null;
    usd: number;
    calls: number;
  }>;
  topCountries?: Array<{
    country: string;
    usd: number;
    calls: number;
  }>;
}

const PIE_COLORS = [
  '#3b82f6',
  '#f59e0b',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#64748b',
  '#94a3b8',
];

interface BonusSummary {
  creditUsdRate: number;
  totalCredits: number;
  totalCount: number;
  totalUsd: number;
  bySource: { source: string; credits: number; count: number; usd: number }[];
  timeline: { date: string; credits: number; usd: number }[];
}

interface BreakdownRow {
  key: string;
  calls: number;
  usd: number;
}

interface CostDetailRecord {
  id: string;
  createdAt: string;
  step: string;
  provider: string;
  model: string;
  quantity: number | null;
  quantityUnit: string | null;
  success: boolean;
  estUsd: number | null;
  recUsd: number | null;
  reconciledAt: string | null;
  reconciledSource: string | null;
}

interface ProjectCostRow {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  durationSec: number;
  usd: number;
  usdPerSec: number | null;
  calls: number;
  successCalls: number;
  /** 赠送流水：积分数量 */
  credits?: number;
  userId?: string | null;
}

interface CostDetail {
  line: SelectableLine;
  label: string;
  range: { fromMs: number; toMs: number };
  hasReconcile: boolean;
  amountNote: string | null;
  summary: {
    usd: number;
    calls: number;
    successCalls: number;
    failedCalls: number;
    reconciledCalls: number;
    failedUsd?: number;
    estOnReconciledUsd?: number;
    recUsd?: number;
    deltaUsd?: number;
  };
  byStep: BreakdownRow[];
  byProvider: BreakdownRow[];
  byModel: BreakdownRow[];
  projectStats?: {
    projectCount: number;
    totalUsd: number;
    totalDurationSec: number;
    totalCalls: number;
    avgUsdPerSec: number;
    totalCredits?: number;
  } | null;
  durationBuckets?: Array<{
    key: string;
    label: string;
    count: number;
    usd: number;
  }>;
  projects?: {
    page: number;
    pageSize: number;
    total: number;
    items: ProjectCostRow[];
  } | null;
  records: {
    page: number;
    pageSize: number;
    total: number;
    items: CostDetailRecord[];
  };
  creditUsdRate?: number;
  totalCredits?: number;
  topUsers?: Array<{
    userId: string;
    displayName: string;
    email: string | null;
    usd: number;
    calls: number;
    credits?: number;
  }>;
  topCountries?: Array<{
    country: string;
    usd: number;
    calls: number;
    credits?: number;
  }>;
}

const BONUS_SOURCE_LABEL: Record<string, string> = {
  signup: '注册',
  daily_check_in: '每日签到',
  referral: '邀请',
  membership: '会员月赠',
  manual: '手动',
  other: '其它',
};

const COUNTRY_LABEL: Record<string, string> = {
  unknown: '未知',
  CN: '中国',
  US: '美国',
  JP: '日本',
  KR: '韩国',
  GB: '英国',
  HK: '香港',
  TW: '台湾',
  SG: '新加坡',
  AU: '澳大利亚',
  CA: '加拿大',
  DE: '德国',
  FR: '法国',
};

const PROJECT_ENTITY_META: Record<
  SelectableLine,
  {
    entityLabel: string;
    listTitle: string;
    emptyHint: string;
    href: (id: string) => string | null;
    /** 无可靠时长时隐藏时长/$/秒 KPI 与列 */
    hasDuration: boolean;
  }
> = {
  mv: {
    entityLabel: 'MV',
    listTitle: 'MV 项目列表',
    emptyHint: '时间窗内暂无带成本的 MV',
    href: (id) => `/admin/mv/projects/${id}`,
    hasDuration: true,
  },
  music: {
    entityLabel: '任务',
    listTitle: '音乐任务列表',
    emptyHint: '时间窗内暂无带成本的音乐任务',
    href: (id) => `/admin/music/tasks/${id}`,
    hasDuration: true,
  },
  lyrics: {
    entityLabel: '任务',
    listTitle: '歌词任务列表',
    emptyHint: '时间窗内暂无带成本的歌词任务',
    href: (id) => `/admin/music/tasks/${id}`,
    hasDuration: false,
  },
  karaoke: {
    entityLabel: '项目',
    listTitle: 'Karaoke 项目列表',
    emptyHint: '时间窗内暂无带成本的 Karaoke',
    href: (id) => `/admin/karaoke/projects/${id}`,
    hasDuration: true,
  },
  dance: {
    entityLabel: '项目',
    listTitle: '舞蹈项目列表',
    emptyHint: '时间窗内暂无带成本的舞蹈项目',
    href: () => '/admin/dance/projects',
    hasDuration: true,
  },
  video_effect: {
    entityLabel: '任务',
    listTitle: '特效任务列表',
    emptyHint: '时间窗内暂无带成本的特效任务',
    href: (id) => `/admin/video-effects/tasks/${id}`,
    hasDuration: true,
  },
  bonus: {
    entityLabel: '笔',
    listTitle: '赠送流水',
    emptyHint: '时间窗内暂无赠送记录',
    href: () => null,
    hasDuration: false,
  },
};

function formatDurationSec(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '—';
  if (sec < 60) return `${sec.toFixed(sec >= 10 ? 0 : 1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

const PRESETS: RangePreset[] = ['today', '7d', '30d', '90d', '12m'];

const LINE_META: Record<
  CostLineId,
  { icon: typeof Film; tint: string; stroke: string; chartKey: string }
> = {
  mv: { icon: Film, tint: 'text-blue-600 bg-blue-50', stroke: '#8b5cf6', chartKey: 'MV' },
  music: { icon: Music, tint: 'text-rose-600 bg-rose-50', stroke: '#ec4899', chartKey: '音乐' },
  lyrics: { icon: FileText, tint: 'text-cyan-600 bg-cyan-50', stroke: '#06b6d4', chartKey: '歌词' },
  karaoke: { icon: Mic2, tint: 'text-violet-600 bg-violet-50', stroke: '#7c3aed', chartKey: 'Karaoke' },
  dance: { icon: PersonStanding, tint: 'text-orange-600 bg-orange-50', stroke: '#f97316', chartKey: '舞蹈' },
  video_effect: { icon: Sparkles, tint: 'text-fuchsia-600 bg-fuchsia-50', stroke: '#d946ef', chartKey: '特效' },
};

const DETAIL_LINKS: Partial<Record<SelectableLine, { href: string; label: string }>> = {
  mv: { href: '/admin/mv/cost-stats', label: '打开 MV 调用明细' },
  karaoke: { href: '/admin/karaoke/cost', label: '打开 Karaoke 成本页' },
  dance: { href: '/admin/dance/cost', label: '打开舞蹈成本页' },
  bonus: { href: '/admin/billing/bonus', label: '打开赠送明细' },
};

const PROVIDER_LABEL: Record<string, string> = {
  mountsea: 'Mountsea',
  apisale: 'apisale',
  smartfashion: 'smartfashion',
  aitokens: 'aitokens',
  mountseaMs: 'Mountsea MS（已下线）',
  cloudflare: 'Cloudflare（已下线）',
  fal: 'Fal.ai（已下线）',
  platform: '平台',
  local: 'local',
  worker: 'worker',
  unknown: 'unknown',
};

const VALID_LINES = new Set<string>([
  'mv',
  'music',
  'lyrics',
  'karaoke',
  'dance',
  'video_effect',
  'bonus',
]);

function parseLineParam(raw: string | null): SelectableLine | null {
  if (!raw || raw === 'none' || raw === 'overview') return null; // 默认总成本总览
  return VALID_LINES.has(raw) ? (raw as SelectableLine) : null;
}

export default function BillingCostPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-page flex-1 flex items-center justify-center text-sm text-slate-500">
          加载中…
        </div>
      }
    >
      <BillingCostPageContent />
    </Suspense>
  );
}

function BillingCostPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [preset, setPreset] = useState<RangePreset>('today');
  const [selectedLine, setSelectedLine] = useState<SelectableLine | null>(() =>
    parseLineParam(searchParams.get('line')),
  );
  const [detailPage, setDetailPage] = useState(1);

  const range = useMemo(() => computeRange(preset), [preset]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set('from', new Date(range.fromMs).toISOString());
    p.set('to', new Date(range.toMs).toISOString());
    return p.toString();
  }, [range]);

  // URL ?line= 同步（进入 / 浏览器前进后退）
  useEffect(() => {
    const fromUrl = parseLineParam(searchParams.get('line'));
    setSelectedLine(fromUrl);
    setDetailPage(1);
  }, [searchParams]);

  const syncLineToUrl = useCallback(
    (line: SelectableLine | null) => {
      const p = new URLSearchParams(searchParams.toString());
      // overview 显式写入，避免「无 line」被解析成默认 MV
      p.set('line', line ?? 'overview');
      const next = p.toString();
      router.replace(`${pathname}?${next}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // 首次进入无 line 时写入 ?line=overview（总成本）
  useEffect(() => {
    if (!searchParams.has('line')) {
      syncLineToUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首屏补齐 URL
  }, []);

  /** 切换业务线；再次点击当前线不取消选中 */
  const selectLine = (line: SelectableLine) => {
    if (selectedLine === line) return;
    setSelectedLine(line);
    setDetailPage(1);
    syncLineToUrl(line);
  };

  /** 回总成本总览；已在总览时再点不重复跳转 */
  const clearSelection = () => {
    if (selectedLine == null) return;
    setSelectedLine(null);
    setDetailPage(1);
    syncLineToUrl(null);
  };

  const summary = useQuery<CostSummary>({
    queryKey: ['admin', 'billing', 'cost', preset],
    queryFn: () => apiClient.get(`/admin/billing/cost/summary?${qs}`) as any,
    placeholderData: (p) => p,
  });

  const bonus = useQuery<BonusSummary>({
    queryKey: ['admin', 'billing', 'bonus', 'summary', preset],
    queryFn: () => apiClient.get(`/admin/billing/bonus/summary?${qs}`) as any,
    placeholderData: (p) => p,
  });

  const detailQs = useMemo(() => {
    if (!selectedLine) return '';
    const p = new URLSearchParams();
    p.set('line', selectedLine);
    p.set('from', new Date(range.fromMs).toISOString());
    p.set('to', new Date(range.toMs).toISOString());
    p.set('page', String(detailPage));
    p.set('pageSize', '20');
    return p.toString();
  }, [selectedLine, range, detailPage]);

  const detail = useQuery<CostDetail>({
    queryKey: ['admin', 'billing', 'cost', 'detail', selectedLine, preset, detailPage],
    queryFn: () => apiClient.get(`/admin/billing/cost/detail?${detailQs}`) as any,
    enabled: !!selectedLine && !!detailQs,
    placeholderData: (p) => p,
  });

  const d = summary.data;
  const b = bonus.data;
  const bonusUsd = b?.totalUsd ?? 0;
  const grandTotalUsd = (d?.totalUsd ?? 0) + bonusUsd;
  const shareOfGrand = (amount: number) =>
    pct(grandTotalUsd > 0 ? amount / grandTotalUsd : 0);
  const bonusSourceLine = useMemo(() => {
    if (!b?.bySource?.length) return null;
    const order = [
      'signup',
      'daily_check_in',
      'referral',
      'membership',
      'manual',
      'other',
    ];
    const parts = order
      .map((src) => b.bySource.find((s) => s.source === src))
      .filter((s): s is NonNullable<typeof s> => !!s && s.credits > 0)
      .map(
        (s) =>
          `${BONUS_SOURCE_LABEL[s.source] ?? s.source} ${s.credits.toLocaleString()}`,
      );
    return parts.length ? parts.join(' · ') : null;
  }, [b?.bySource]);
  const rateText =
    d?.rateSource === 'live'
      ? '实时'
      : d?.rateSource === 'cache'
        ? '缓存'
        : '默认';

  return (
    <div className="admin-page">
      <div className="px-6 pt-6 pb-16 space-y-5 max-w-[1600px]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <LineChart className="h-5 w-5 text-blue-600" />
              成本统计
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              点击业务线卡片查看具体消耗 · 统一美元 USD
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPreset(p);
                    setDetailPage(1);
                  }}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    preset === p
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  {RANGE_LABEL[p]}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                summary.refetch();
                bonus.refetch();
                if (selectedLine) detail.refetch();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw
                className={cn(
                  'h-3.5 w-3.5',
                  (summary.isFetching || bonus.isFetching || detail.isFetching) &&
                    'animate-spin',
                )}
              />
              刷新
            </button>
            <Link
              href="/admin/billing/bonus"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Gift className="h-3.5 w-3.5" />
              赠送明细
            </Link>
            <Link
              href="/admin/mv/cost-stats"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              MV 调用明细
            </Link>
          </div>
        </div>

        <QueryState
          isLoading={summary.isLoading}
          isError={summary.isError}
          error={summary.error}
          isEmpty={false}
          height="h-32"
        >
          {d && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={clearSelection}
                  className={cn(
                    'rounded-lg px-4 pt-4 pb-5 text-left transition border',
                    selectedLine == null
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-amber-600/90 text-white border-amber-700 hover:bg-amber-600',
                  )}
                  aria-pressed={selectedLine == null}
                  title="显示全业务线总览"
                >
                  <span className="text-xs font-medium text-amber-50/90">
                    总成本（含赠送）
                  </span>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <p className="text-2xl font-bold tabular-nums">
                      {usdAmount(grandTotalUsd)}
                    </p>
                    <span className="text-sm font-semibold tabular-nums text-amber-50/90">
                      {shareOfGrand(grandTotalUsd)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-amber-50/75">
                    AI {usdAmount(d.totalUsd)} + 赠送 {usdAmount(bonusUsd)}
                    {selectedLine == null ? ' · 总览' : ' · 点击回总览'}
                  </p>
                </button>

                {d.lines.map((l) => {
                  const meta = LINE_META[l.line] ?? {
                    icon: Film,
                    tint: 'text-slate-600 bg-slate-50',
                    stroke: '#94a3b8',
                    chartKey: l.label,
                  };
                  const successRate = l.calls > 0 ? l.successCalls / l.calls : 0;
                  const active = selectedLine === l.line;
                  return (
                    <button
                      key={l.line}
                      type="button"
                      onClick={() => selectLine(l.line)}
                      aria-pressed={active}
                      className={cn(
                        'rounded-lg border p-4 text-left transition',
                        active
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'text-xs',
                            active ? 'text-blue-100' : 'text-slate-500',
                          )}
                        >
                          {l.label} 成本
                        </span>
                        <span
                          className={cn(
                            'p-1.5 rounded-lg',
                            active ? 'bg-white/15 text-white' : meta.tint,
                          )}
                        >
                          <meta.icon className="h-3.5 w-3.5" />
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between gap-2">
                        <p
                          className={cn(
                            'text-xl font-bold tabular-nums',
                            active ? 'text-white' : 'text-slate-900',
                          )}
                        >
                          {usdAmount(l.usd)}
                        </p>
                        <span
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            active ? 'text-blue-100' : 'text-slate-500',
                          )}
                        >
                          {shareOfGrand(l.usd)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          'mt-0.5 text-[11px]',
                          active ? 'text-blue-100/90' : 'text-slate-400',
                        )}
                      >
                        {l.calls} 次调用 · 成功率 {pct(successRate)}
                        {(l.failedUsd ?? 0) > 0
                          ? ` · 失败浪费 ${usdAmount(l.failedUsd)}`
                          : ''}
                      </p>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => selectLine('bonus')}
                  aria-pressed={selectedLine === 'bonus'}
                  className={cn(
                    'rounded-lg border p-4 text-left transition',
                    selectedLine === 'bonus'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'text-xs',
                        selectedLine === 'bonus' ? 'text-blue-100' : 'text-slate-500',
                      )}
                    >
                      赠送积分成本
                    </span>
                    <span
                      className={cn(
                        'p-1.5 rounded-lg',
                        selectedLine === 'bonus'
                          ? 'bg-white/15 text-white'
                          : 'text-emerald-600 bg-emerald-50',
                      )}
                    >
                      <Gift className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <p
                      className={cn(
                        'text-xl font-bold tabular-nums',
                        selectedLine === 'bonus' ? 'text-white' : 'text-slate-900',
                      )}
                    >
                      {usdAmount(bonusUsd)}
                    </p>
                    <span
                      className={cn(
                        'text-sm font-semibold tabular-nums',
                        selectedLine === 'bonus' ? 'text-blue-100' : 'text-slate-500',
                      )}
                    >
                      {shareOfGrand(bonusUsd)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      'mt-0.5 text-[11px] line-clamp-2',
                      selectedLine === 'bonus' ? 'text-blue-100/90' : 'text-slate-400',
                    )}
                    title={bonusSourceLine ?? undefined}
                  >
                    {(b?.totalCredits ?? 0).toLocaleString()} 积分 · {b?.totalCount ?? 0}{' '}
                    笔
                    {bonusSourceLine ? ` · ${bonusSourceLine}` : ''}
                  </p>
                </button>
              </div>

              {selectedLine ? (
                <LineDetailPanel
                  line={selectedLine}
                  detail={detail.data}
                  isLoading={detail.isLoading}
                  isError={detail.isError}
                  error={detail.error}
                  page={detailPage}
                  onPageChange={setDetailPage}
                />
              ) : (
                <div className="space-y-4 mt-1">
                  <CostTrend
                    timeline={d.timeline}
                    bonusTimeline={b?.timeline ?? []}
                    fromMs={d.range.fromMs}
                    toMs={d.range.toMs}
                    granularity={
                      d.timelineGranularity ??
                      (d.range.toMs - d.range.fromMs <= 36 * 3600 * 1000
                        ? 'hour'
                        : 'day')
                    }
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <CostPieCard
                      title="按渠道"
                      subtitle="费用 USD"
                      rows={d.byProvider.map((p) => ({
                        key: p.provider,
                        name: PROVIDER_LABEL[p.provider] ?? p.provider,
                        value: p.usd,
                        sub: `${p.calls} 次`,
                      }))}
                      formatValue={usdAmount}
                    />
                    <CostPieCard
                      title="按调用量"
                      subtitle="业务线次数"
                      rows={d.lines
                        .filter((l) => l.calls > 0)
                        .map((l) => ({
                          key: l.line,
                          name: l.label,
                          value: l.calls,
                          sub: usdAmount(l.usd),
                        }))}
                      formatValue={(v) => `${Math.round(v).toLocaleString()} 次`}
                    />
                    <CostPieCard
                      title="文本模型"
                      subtitle="费用 USD · 含图/音频"
                      rows={(d.byModelText ?? []).map((m) => ({
                        key: m.model,
                        name: shortModelName(m.model),
                        value: m.usd,
                        sub: `${m.calls} 次`,
                      }))}
                      formatValue={usdAmount}
                    />
                    <CostPieCard
                      title="视频模型"
                      subtitle="费用 USD"
                      rows={(d.byModelVideo ?? []).map((m) => ({
                        key: m.model,
                        name: shortModelName(m.model),
                        value: m.usd,
                        sub: `${m.calls} 次`,
                      }))}
                      formatValue={usdAmount}
                    />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <TopRankTable
                      title="Top 10 用户"
                      emptyHint="暂无用户成本数据"
                      rows={(d.topUsers ?? []).map((u, i) => ({
                        rank: i + 1,
                        name: u.displayName,
                        sub: u.email || u.userId.slice(0, 8),
                        value: usdAmount(u.usd),
                        meta: `${u.calls} 次`,
                        href: u.userId ? `/admin/users/${u.userId}` : null,
                      }))}
                    />
                    <TopRankTable
                      title="Top 10 国家"
                      emptyHint="暂无国家数据（无成功支付卡 BIN 时归为未知）"
                      rows={(d.topCountries ?? []).map((c, i) => ({
                        rank: i + 1,
                        name: c.country === 'unknown' ? '未知' : c.country,
                        value: usdAmount(c.usd),
                        meta: `${c.calls} 次`,
                        href: null,
                      }))}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </QueryState>

        <p className="text-[11px] text-slate-400 leading-relaxed pt-2">
          <strong className="text-slate-500">口径说明：</strong>
          全部金额统一为美元 USD。明细优先真实账单，否则价格表估算；特效表暂无对账字段。
          赠送含注册 / 每日签到 / 邀请 / 其它（会员·手动·活动）。Top 国家取用户最近成功支付的卡
          BIN（无支付记为未知）。Mountsea credits（100 credits = 1 CNY）按汇率 1 USD = ¥
          {(d?.usdCnyRate ?? 7.2).toFixed(2)}（{rateText}
          {d?.rateAsOf ? ` · ${new Date(d.rateAsOf).toLocaleString('zh-CN')}` : ''}
          ）折算。模型饼图：视频按秒计费/视频 step·slug，其余归文本（含图/音频）。
        </p>
      </div>
    </div>
  );
}

function LineDetailPanel({
  line,
  detail,
  isLoading,
  isError,
  error,
  page,
  onPageChange,
}: {
  line: SelectableLine;
  detail?: CostDetail;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  page: number;
  onPageChange: (p: number) => void;
}) {
  const link = DETAIL_LINKS[line];
  const meta = PROJECT_ENTITY_META[line];
  const s = detail?.summary;
  const ps = detail?.projectStats;
  const hasProjects = !!detail?.projects;
  const isBonus = line === 'bonus';
  const reconRate =
    s && s.calls > 0 && detail?.hasReconcile
      ? s.reconciledCalls / s.calls
      : null;
  const listTotal = detail?.projects?.total ?? 0;
  const listPageSize = detail?.projects?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(listTotal / listPageSize));

  return (
    <div className="mt-1 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {detail?.label ?? line} · {isBonus ? '赠送流水' : '按项目消耗'}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            与上方时间窗一致
            {line === 'music'
              ? ' · 时长优先 Suno 回写 durationSec，否则按成本 quantity 秒；下方为分桶分布'
              : meta.hasDuration
                ? ' · 时长取制作区间（end−start）；下方为分桶分布（非仅平均）'
                : isBonus
                  ? ' · 按用户赠送流水汇总'
                  : ' · 按任务聚合成本（无可靠成片时长时 $/秒为空）'}
            {detail?.amountNote ? ` · ${detail.amountNote}` : ''}
          </p>
        </div>
        {link && (
          <Link
            href={link.href}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            {link.label} <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      <QueryState
        isLoading={isLoading && !detail}
        isError={isError}
        error={error}
        isEmpty={false}
        height="h-40"
      >
        {detail && s && hasProjects && ps ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiMini
                label={
                  isBonus
                    ? '赠送笔数'
                    : `${meta.entityLabel}数量`
                }
                value={String(ps.projectCount)}
                sub={
                  isBonus
                    ? `合计 ${(detail.totalCredits ?? ps.totalCredits ?? 0).toLocaleString()} 积分`
                    : `调用 ${ps.totalCalls} 次`
                }
              />
              <KpiMini
                label="总成本 USD"
                value={usdAmount(ps.totalUsd)}
                sub={
                  isBonus
                    ? '营销成本'
                    : `对账覆盖 ${reconRate != null ? pct(reconRate) : detail.hasReconcile ? '—' : '仅估算'}`
                }
              />
              {isBonus ? (
                <>
                  <KpiMini
                    label="总赠送积分"
                    value={(detail.totalCredits ?? ps.totalCredits ?? 0).toLocaleString()}
                    sub={
                      detail.creditUsdRate != null
                        ? `≈ $${detail.creditUsdRate.toFixed(4)}/积分`
                        : undefined
                    }
                  />
                  <KpiMini
                    label="平均每笔 USD"
                    value={
                      ps.projectCount > 0
                        ? usdAmount(ps.totalUsd / ps.projectCount)
                        : '$0.00'
                    }
                    sub="总成本 ÷ 笔数"
                  />
                </>
              ) : meta.hasDuration ? (
                <>
                  <KpiMini
                    label="总制作时长"
                    value={formatDurationSec(ps.totalDurationSec)}
                    sub={`${ps.totalDurationSec.toFixed(0)} 秒合计`}
                  />
                  <KpiMini
                    label="整体平均 $/秒"
                    value={
                      ps.avgUsdPerSec > 0
                        ? `$${ps.avgUsdPerSec.toFixed(4)}`
                        : '$0.00'
                    }
                    sub="总成本 ÷ 总时长"
                  />
                </>
              ) : (
                <>
                  <KpiMini
                    label="调用"
                    value={String(s.calls)}
                    sub={`成功 ${s.successCalls} / 失败 ${s.failedCalls}`}
                  />
                  <KpiMini
                    label="成功率"
                    value={pct(s.calls > 0 ? s.successCalls / s.calls : 0)}
                    sub={
                      detail.hasReconcile
                        ? `对账 ${s.reconciledCalls}/${s.calls}`
                        : '无成片时长'
                    }
                  />
                </>
              )}
            </div>

            {(line === 'mv' || line === 'music') &&
              (detail.durationBuckets?.length ?? 0) > 0 && (
                <DurationBucketChart
                  buckets={detail.durationBuckets ?? []}
                  lineLabel={detail.label}
                />
              )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TopRankTable
                title="Top 10 用户"
                emptyHint="暂无用户成本数据"
                rows={(detail.topUsers ?? []).map((u, i) => ({
                  rank: i + 1,
                  name: u.displayName,
                  sub: u.email || u.userId.slice(0, 8),
                  value: usdAmount(u.usd),
                  meta: isBonus
                    ? `${(u.credits ?? 0).toLocaleString()} 积分`
                    : `${u.calls} 次`,
                  href: u.userId ? `/admin/users/${u.userId}` : null,
                }))}
              />
              <TopRankTable
                title="Top 10 国家"
                emptyHint="暂无国家数据（无成功支付卡 BIN 时归为未知）"
                rows={(detail.topCountries ?? []).map((c, i) => ({
                  rank: i + 1,
                  name: COUNTRY_LABEL[c.country] ?? c.country,
                  sub: c.country === 'unknown' ? undefined : c.country,
                  value: usdAmount(c.usd),
                  meta: isBonus
                    ? `${(c.credits ?? 0).toLocaleString()} 积分`
                    : `${c.calls} 次`,
                  href: null,
                }))}
              />
            </div>

            <ProjectCostTable
              line={line}
              meta={meta}
              items={detail.projects?.items ?? []}
              page={page}
              totalPages={totalPages}
              total={listTotal}
              onPageChange={onPageChange}
            />
          </>
        ) : null}
      </QueryState>
    </div>
  );
}

function DurationBucketChart({
  buckets,
  lineLabel,
}: {
  buckets: Array<{ key: string; label: string; count: number; usd: number }>;
  lineLabel: string;
}) {
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const data = buckets.map((b) => ({
    ...b,
    pct: total > 0 ? Math.round((b.count / total) * 1000) / 10 : 0,
  }));

  return (
    <div className="rounded-lg border border-slate-100 overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-700">
          {lineLabel} · 时长分布
        </h3>
        <span className="text-[10px] text-slate-400">
          按项目/任务个数 · 共 {total} 个
        </span>
      </div>
      <div className="h-52 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <Tooltip
              formatter={(v: number | string, name: string) => {
                if (name === 'count') return [`${v} 个`, '数量'];
                if (name === 'usd') return [usdAmount(Number(v)), '成本'];
                return [String(v), name];
              }}
              labelFormatter={(label, payload) => {
                const p = payload?.[0]?.payload as { pct?: number } | undefined;
                return `${label}${p?.pct != null ? ` · ${p.pct}%` : ''}`;
              }}
              contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#e2e8f0' }}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="px-3 pb-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
        {data.map((b) => (
          <li key={b.key}>
            {b.label} {b.count}（{b.pct}% · {usdAmount(b.usd)}）
          </li>
        ))}
      </ul>
    </div>
  );
}

function TopRankTable({
  title,
  emptyHint,
  rows,
}: {
  title: string;
  emptyHint: string;
  rows: Array<{
    rank: number;
    name: string;
    sub?: string;
    value: string;
    meta: string;
    href: string | null;
  }>;
}) {
  return (
    <div className="rounded-lg border border-slate-100 overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
        <h3 className="text-xs font-semibold text-slate-700">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div className="px-3 py-8 text-center text-[11px] text-slate-400">
          {emptyHint}
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-[10px] text-slate-400 bg-white border-b border-slate-50">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium w-8">#</th>
              <th className="text-left px-3 py-1.5 font-medium">名称</th>
              <th className="text-right px-3 py-1.5 font-medium">成本</th>
              <th className="text-right px-3 py-1.5 font-medium">明细</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((r) => (
              <tr key={`${r.rank}-${r.name}`} className="hover:bg-slate-50/80">
                <td className="px-3 py-1.5 text-slate-400 tabular-nums">{r.rank}</td>
                <td className="px-3 py-1.5 text-slate-800 min-w-0">
                  {r.href ? (
                    <Link
                      href={r.href}
                      className="font-medium text-blue-700 hover:underline line-clamp-1"
                      title={r.name}
                    >
                      {r.name}
                    </Link>
                  ) : (
                    <span className="font-medium line-clamp-1" title={r.name}>
                      {r.name}
                    </span>
                  )}
                  {r.sub && (
                    <div className="text-[10px] text-slate-400 truncate">{r.sub}</div>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-slate-900">
                  {r.value}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                  {r.meta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ProjectCostTable({
  line,
  meta,
  items,
  page,
  totalPages,
  total,
  onPageChange,
}: {
  line: SelectableLine;
  meta: (typeof PROJECT_ENTITY_META)[SelectableLine];
  items: ProjectCostRow[];
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const isBonus = line === 'bonus';
  const showDuration = meta.hasDuration;

  return (
    <div className="rounded-lg border border-slate-100 overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-700">
          {meta.listTitle}
          <span className="font-normal text-slate-400 ml-1.5">共 {total} 个</span>
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[11px] text-slate-500 tabular-nums px-1">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-white"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="px-3 py-8 text-center text-[11px] text-slate-400">
          {meta.emptyHint}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] text-slate-400 bg-white border-b border-slate-50">
              <tr>
                <th className="text-left px-3 py-1.5 font-medium">
                  {isBonus ? '用户' : meta.entityLabel}
                </th>
                <th className="text-left px-3 py-1.5 font-medium">
                  {isBonus ? '来源' : '状态'}
                </th>
                {showDuration && (
                  <th className="text-right px-3 py-1.5 font-medium">时长</th>
                )}
                {isBonus && (
                  <th className="text-right px-3 py-1.5 font-medium">积分</th>
                )}
                <th className="text-right px-3 py-1.5 font-medium">成本 USD</th>
                {showDuration && (
                  <th className="text-right px-3 py-1.5 font-medium">$/秒</th>
                )}
                {!isBonus && (
                  <th className="text-right px-3 py-1.5 font-medium">调用</th>
                )}
                <th className="text-right px-3 py-1.5 font-medium">创建</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((r) => {
                const href = meta.href(r.id);
                return (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2 text-slate-800">
                      {href ? (
                        <Link
                          href={href}
                          className="font-medium text-blue-700 hover:underline line-clamp-1 max-w-[240px]"
                          title={r.title}
                        >
                          {r.title}
                        </Link>
                      ) : (
                        <span
                          className="font-medium text-slate-800 line-clamp-1 max-w-[240px]"
                          title={r.title}
                        >
                          {r.title}
                        </span>
                      )}
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {(r.userId ?? r.id).slice(0, 8)}…
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                      {r.status}
                    </td>
                    {showDuration && (
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {formatDurationSec(r.durationSec)}
                      </td>
                    )}
                    {isBonus && (
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {(r.credits ?? 0).toLocaleString()}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                      {usdAmount(r.usd)}
                    </td>
                    {showDuration && (
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-700 font-medium">
                        {r.usdPerSec != null && r.usdPerSec > 0
                          ? `$${r.usdPerSec.toFixed(4)}`
                          : '—'}
                      </td>
                    )}
                    {!isBonus && (
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                        {r.calls}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right text-slate-400 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KpiMini({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/** 按本地日补齐 [fromMs, toMs] 内每一天的 YYYY-MM-DD */
function eachDateKey(fromMs: number, toMs: number): string[] {
  const cur = new Date(fromMs);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(toMs);
  end.setHours(0, 0, 0, 0);
  const out: string[] = [];
  while (cur.getTime() <= end.getTime()) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const day = String(cur.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${day}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** UTC 整点 ISO 键，与 API hour 桶一致 */
function eachHourKey(fromMs: number, toMs: number): string[] {
  const hourMs = 3600 * 1000;
  let t = Math.floor(fromMs / hourMs) * hourMs;
  const out: string[] = [];
  while (t <= toMs) {
    out.push(`${new Date(t).toISOString().slice(0, 13)}:00:00.000Z`);
    t += hourMs;
  }
  return out;
}

function bucketAxisLabel(key: string, granularity: 'hour' | 'day'): string {
  if (granularity === 'hour') {
    const d = new Date(key);
    if (Number.isNaN(d.getTime())) return key;
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  }
  return key.length >= 10 ? key.slice(5) : key;
}

function shortModelName(model: string): string {
  if (!model || model === '其它' || model === '未标记') return model || '未标记';
  const parts = model.split('/');
  const tail = parts[parts.length - 1] || model;
  return tail.length > 28 ? `${tail.slice(0, 26)}…` : tail;
}

function CostTrend({
  timeline,
  bonusTimeline,
  fromMs,
  toMs,
  granularity,
  className,
}: {
  timeline: CostSummary['timeline'];
  bonusTimeline: BonusSummary['timeline'];
  fromMs: number;
  toMs: number;
  granularity: 'hour' | 'day';
  className?: string;
}) {
  const { data, series } = useMemo(() => {
    const dates =
      granularity === 'hour' ? eachHourKey(fromMs, toMs) : eachDateKey(fromMs, toMs);
    const lineByDate = new Map(timeline.map((t) => [t.date, t]));
    const bonusByDate = new Map(bonusTimeline.map((t) => [t.date, t]));

    const rows = dates.map((date) => {
      const t = lineByDate.get(date);
      const mv = Number(t?.mvUsd ?? 0);
      const music = Number(t?.musicUsd ?? 0);
      const lyrics = Number(t?.lyricsUsd ?? 0);
      const karaoke = Number(t?.karaokeUsd ?? 0);
      const dance = Number(t?.danceUsd ?? 0);
      const ve = Number(t?.videoEffectUsd ?? 0);
      const bonus = Number(bonusByDate.get(date)?.usd ?? 0);
      return {
        label: bucketAxisLabel(date, granularity),
        date,
        MV: Number(mv.toFixed(2)),
        音乐: Number(music.toFixed(2)),
        歌词: Number(lyrics.toFixed(2)),
        Karaoke: Number(karaoke.toFixed(2)),
        舞蹈: Number(dance.toFixed(2)),
        特效: Number(ve.toFixed(2)),
        赠送: Number(bonus.toFixed(2)),
        合计: Number((mv + music + lyrics + karaoke + dance + ve + bonus).toFixed(2)),
      };
    });
    return {
      data: rows,
      series: [
        { key: 'MV', stroke: LINE_META.mv.stroke, dashed: false },
        { key: '音乐', stroke: LINE_META.music.stroke, dashed: false },
        { key: '歌词', stroke: LINE_META.lyrics.stroke, dashed: false },
        { key: 'Karaoke', stroke: LINE_META.karaoke.stroke, dashed: false },
        { key: '舞蹈', stroke: LINE_META.dance.stroke, dashed: false },
        { key: '特效', stroke: LINE_META.video_effect.stroke, dashed: false },
        { key: '赠送', stroke: '#10b981', dashed: false },
        { key: '合计', stroke: '#0f172a', dashed: true },
      ],
    };
  }, [timeline, bonusTimeline, fromMs, toMs, granularity]);

  const hasSignal = data.some((row) =>
    series.some((s) => Number((row as Record<string, unknown>)[s.key] ?? 0) > 0),
  );

  return (
    <div className={cn('admin-card p-5', className)}>
      <h3 className="text-sm font-semibold text-slate-900 mb-3">
        成本趋势（{granularity === 'hour' ? '按小时' : '按天'}）
      </h3>
      {!hasSignal ? (
        <div className="h-64 flex items-center justify-center text-xs text-slate-400">
          时间窗内暂无成本
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={{ stroke: '#e2e8f0' }}
                interval={granularity === 'hour' ? 1 : 0}
                minTickGap={granularity === 'hour' ? 8 : 4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickFormatter={(v) => usdAmountCompact(Number(v))}
              />
              <Tooltip
                formatter={(v: number | string, name: string) => [
                  usdAmount(Number(v)),
                  name,
                ]}
                labelFormatter={(_, payload) => {
                  const d = payload?.[0]?.payload?.date as string | undefined;
                  if (!d) return '';
                  if (granularity === 'hour') {
                    const dt = new Date(d);
                    if (Number.isNaN(dt.getTime())) return d;
                    return dt.toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                  }
                  return d;
                }}
                contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#e2e8f0' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.stroke}
                  strokeWidth={s.dashed ? 2.25 : 1.75}
                  strokeDasharray={s.dashed ? '5 4' : undefined}
                  dot={false}
                  activeDot={{ r: 3.5, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              ))}
            </RechartsLineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function CostPieCard({
  title,
  subtitle,
  rows,
  formatValue,
}: {
  title: string;
  subtitle: string;
  rows: Array<{ key: string; name: string; value: number; sub?: string }>;
  formatValue: (v: number) => string;
}) {
  const data = rows.filter((r) => r.value > 0);
  const total = data.reduce((s, r) => s + r.value, 0);

  return (
    <div className="admin-card p-4">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="text-[10px] text-slate-400">{subtitle}</span>
      </div>
      {total <= 0 ? (
        <div className="h-44 flex items-center justify-center text-xs text-slate-400">
          暂无数据
        </div>
      ) : (
        <>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={62}
                  paddingAngle={1.5}
                >
                  {data.map((row, i) => (
                    <Cell
                      key={row.key}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number | string, name: string) => [
                    formatValue(Number(v)),
                    name,
                  ]}
                  contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-1 space-y-1 max-h-28 overflow-y-auto">
            {data.map((r, i) => {
              const pctVal = total > 0 ? (r.value / total) * 100 : 0;
              return (
                <li
                  key={r.key}
                  className="flex items-center justify-between gap-2 text-[11px]"
                >
                  <span className="flex items-center gap-1.5 min-w-0 text-slate-600">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="truncate" title={r.name}>
                      {r.name}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-800 font-medium">
                    {formatValue(r.value)}
                    <span className="text-slate-400 font-normal ml-1">
                      {pctVal.toFixed(0)}%
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
