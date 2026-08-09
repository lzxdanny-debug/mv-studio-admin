'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, Save, Wand2, HelpCircle, ExternalLink, ShieldCheck } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';

// ─── 类型 ────────────────────────────────────────────────────────────────

interface RoutingModelInfo {
  key: string;
  label: string;
  primary: { provider: string; model: string };
  secondary: { provider: string; model: string } | null;
  externalLabel?: string;
}

interface StepPriceRow {
  id: string;
  dimension: string;
  step: string;
  resolution: string;
  priceCredits: number | null;
  configured: boolean;
  recommendedPrice: number | null;
  recommendedAt: string | null;
  enabled: boolean;
  label: string;
  description: string;
  unit: 'per_project' | 'per_image' | 'per_shot' | 'per_call' | 'per_second';
  perResolution: boolean;
  sortOrder: number;
  isAddon: boolean;
  frontendStep: string | null;
  billable: boolean;
  nonBillableReason: string | null;
  routingModels: RoutingModelInfo[];
  alwaysBillInPerDuration: boolean;
}

interface StepPricesView {
  dimensions: Array<{ dimension: string; rows: StepPriceRow[] }>;
}

// 视频按秒计费（与 /admin/billing/video-pricing、模型配置联动，本页矩阵可编辑）
interface VPResolution {
  code: string;
  name: string;
  priceFactor: number;
  durationPriceFactor: number;
  enabled: boolean;
  sortOrder: number;
}
interface VPQuality {
  code: string;
  name: string;
  priceFactor: number;
  durationPriceFactor: number;
  enabled: boolean;
  sortOrder: number;
}
interface VideoPricingView {
  resolutions: VPResolution[];
  qualityProfiles: VPQuality[];
  matrix: {
    base: number;
    enabled: boolean;
    memberFactor: number;
    cells: Record<string, number>;
  };
  /** 每格（清晰度×品质）显式每秒价，key 形如 "720p|standard" */
  priceCells: Record<string, number>;
}
interface EngineRoute {
  engine: string;
  capability: string;
  capabilityLabel: string;
  primary: { provider: string; model: string };
  secondary: { provider: string; model: string } | null;
}
interface ModelConfigView {
  stepModelMap: { video_gen: Record<string, string> };
  options: { videoProviders: Array<{ value: string; label: string }> };
  engineRouting?: { standard: EngineRoute; ultron: EngineRoute };
}

const DIM_TABS: Array<{ key: string; label: string }> = [
  { key: 'mv', label: 'MV' },
  { key: 'dance', label: '舞蹈视频' },
  { key: 'karaoke', label: 'Photo Karaoke' },
  { key: 'music', label: '音乐' },
  { key: 'lyrics', label: '歌词' },
];

const UNIT_LABEL: Record<StepPriceRow['unit'], string> = {
  per_project: '整片一次',
  per_image: '每张',
  per_shot: '每镜头',
  per_call: '每次',
  per_second: '每秒',
};

type BudgetDimension = 'mv' | 'dance' | 'karaoke';
type CreationBudgets = Record<BudgetDimension, number>;

const BUDGET_LABEL: Record<BudgetDimension, string> = {
  mv: 'MV',
  dance: '舞蹈视频',
  karaoke: 'Photo Karaoke',
};

const RES_LABEL: Record<string, string> = {
  '': '—',
  '720p': '标清 720p',
  '1080p': '超清 1080p',
};

const PROVIDER_LABEL: Record<string, string> = {
  mountsea: 'Mountsea',
  apisale: 'apisale',
  smartfashion: 'smartfashion',
  aitokens: 'aitokens',
  mountseaMs: 'Mountsea MS（已下线）',
  // 已下线渠道：仅用于渲染历史成本/对账记录
  cloudflare: 'Cloudflare（已下线）',
  fal: 'Fal.ai（已下线）',
};

/** 前端步骤徽标文案：'pre' = 创作前置，'1'..'10' = 流程第 N 步 */
function frontendStepBadge(step: string | null): string | null {
  if (!step) return null;
  if (step === 'pre') return '创作前';
  if (step === 'agent') return 'Agent';
  return `第 ${step} 步`;
}

function rowKey(r: { dimension: string; step: string; resolution: string }) {
  return `${r.dimension}|${r.step}|${r.resolution}`;
}

function rowsMissingConfiguration(rows: StepPriceRow[]): number {
  return rows.filter((row) => row.billable && !row.configured).length;
}

// ─── 路由模型展示 ────────────────────────────────────────────────────────

function RoutingModelsCell({ models }: { models: RoutingModelInfo[] }) {
  if (!models.length) {
    return <span className="text-xs text-slate-300">—</span>;
  }
  return (
    <div className="space-y-2">
      {models.map((m) => {
        if (m.externalLabel) {
          return (
            <p key={m.key} className="text-[11px] text-slate-500">
              {m.externalLabel}
            </p>
          );
        }
        return (
          <div key={m.key} className="text-[11px] leading-relaxed">
            <p className="text-slate-600 font-medium truncate" title={m.label}>
              {m.label}
            </p>
            <p className="text-slate-500 font-mono truncate" title={m.primary.model}>
              主 · {PROVIDER_LABEL[m.primary.provider] ?? m.primary.provider} ·{' '}
              {m.primary.model || '默认'}
            </p>
            {m.secondary && (
              <p className="text-slate-400 font-mono truncate" title={m.secondary.model}>
                兜 · {PROVIDER_LABEL[m.secondary.provider] ?? m.secondary.provider} ·{' '}
                {m.secondary.model || '默认'}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 价格表格 ────────────────────────────────────────────────────────────

function PriceTable({
  rows,
  edits,
  setEdits,
  openHelp,
  setOpenHelp,
  showResolution = true,
  showRecommended = true,
}: {
  rows: StepPriceRow[];
  edits: Record<string, { priceCredits: number | null; enabled: boolean }>;
  setEdits: React.Dispatch<
    React.SetStateAction<Record<string, { priceCredits: number | null; enabled: boolean }>>
  >;
  openHelp: string | null;
  setOpenHelp: (v: string | null) => void;
  showResolution?: boolean;
  showRecommended?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-center text-xs text-slate-400 py-6">暂无计价项</p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wider">
          <th className="text-left px-3 py-2 font-medium w-[8%]">前端步骤</th>
          <th className="text-left px-4 py-2 font-medium w-[22%]">步骤</th>
          {showResolution && (
            <th className="text-left px-3 py-2 font-medium w-[9%]">清晰度</th>
          )}
          <th className="text-left px-3 py-2 font-medium w-[22%]">当前模型</th>
          <th className="text-left px-3 py-2 font-medium w-[7%]">单位</th>
          <th className="text-right px-3 py-2 font-medium w-[12%]">
            实扣价格(积分)
          </th>
          {showRecommended && (
            <th className="text-right px-3 py-2 font-medium w-[12%]">历史成本参考</th>
          )}
          <th className="text-center px-3 py-2 font-medium w-[8%]">启用</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((r) => {
          const key = rowKey(r);
          const e = edits[key] ?? {
            priceCredits: r.priceCredits,
            enabled: r.enabled,
          };
          const badge = frontendStepBadge(r.frontendStep);
          // 不计费行：合并「清晰度?+当前模型+单位」三列展示原因
          const colSpanFree = showResolution ? 3 : 2;
          return (
            <tr key={key} className={cn(!r.billable && 'bg-slate-50/60')}>
              <td className="px-3 py-2.5 align-top">
                {badge ? (
                  <span
                    className={cn(
                      'inline-block px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap',
                      r.frontendStep === 'pre'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-blue-50 text-blue-700',
                    )}
                  >
                    {badge}
                  </span>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 align-top">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'font-medium',
                      r.billable ? 'text-slate-700' : 'text-slate-500',
                    )}
                  >
                    {r.label}
                  </span>
                  {!r.configured && r.billable && (
                    <span className="rounded bg-red-50 px-1 py-0.5 text-[10px] font-medium text-red-600">
                      未配置
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpenHelp(openHelp === key ? null : key)}
                    className="text-slate-400 hover:text-blue-600"
                    title="说明"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
                {openHelp === key && (
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    {r.description}
                  </p>
                )}
              </td>
              {!r.billable ? (
                <td
                  colSpan={colSpanFree}
                  className="px-3 py-2.5 align-top"
                >
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 text-[10px] font-medium">
                      不计费
                    </span>
                    {r.nonBillableReason}
                  </span>
                </td>
              ) : (
                <>
                  {showResolution && (
                    <td className="px-3 py-2.5 text-slate-500 text-xs align-top">
                      {RES_LABEL[r.resolution] ?? r.resolution}
                    </td>
                  )}
                  <td className="px-3 py-2.5 align-top">
                    <RoutingModelsCell models={r.routingModels} />
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs align-top">
                    {UNIT_LABEL[r.unit]}
                  </td>
                </>
              )}
              {r.billable ? (
                <>
                  <td className="px-3 py-2.5 text-right align-top">
                    <input
                      type="number"
                      min={0}
                      value={e.priceCredits ?? ''}
                      placeholder="必填"
                      onChange={(ev) =>
                        setEdits((m) => ({
                          ...m,
                          [key]: {
                            ...e,
                            priceCredits:
                              ev.target.value === ''
                                ? null
                                : Math.max(0, Math.round(Number(ev.target.value))),
                          },
                        }))
                      }
                      className="w-24 px-2 py-1 text-sm text-right border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                    />
                  </td>
                  {showRecommended && (
                    <td className="px-3 py-2.5 text-right align-top">
                      {r.recommendedPrice !== null ? (
                        <button
                          type="button"
                          onClick={() =>
                            setEdits((m) => ({
                              ...m,
                              [key]: {
                                ...e,
                                priceCredits: r.recommendedPrice as number,
                              },
                            }))
                          }
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          title="按历史实际成本计算，仅供运营参考"
                        >
                          {r.recommendedPrice}
                          <span className="text-[10px] text-slate-400">采用</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-center align-top">
                    <input
                      type="checkbox"
                      checked={e.enabled}
                      onChange={(ev) =>
                        setEdits((m) => ({
                          ...m,
                          [key]: { ...e, enabled: ev.target.checked },
                        }))
                      }
                      className="accent-blue-600"
                    />
                  </td>
                </>
              ) : (
                <td colSpan={showRecommended ? 3 : 2} className="px-3 py-2.5 text-center align-top">
                  <span className="text-xs text-slate-300">—</span>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── 视频按秒计费（可编辑 · 清晰度 × 品质）────────────────────────────────────

function VideoPerSecondCard({
  video,
  modelConfig,
}: {
  video: VideoPricingView;
  modelConfig: ModelConfigView | undefined;
}) {
  const qc = useQueryClient();
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const resolutions = [...video.resolutions]
    .filter((r) => r.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const qualities = [...video.qualityProfiles]
    .filter((q) => q.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // 行 = 品质 × 清晰度（品质优先分组，便于第一列合并）
  const rows: Array<{ q: VPQuality; r: VPResolution }> = [];
  for (const q of qualities) for (const r of resolutions) rows.push({ q, r });

  const cellKey = (resCode: string, qCode: string) => `${resCode}|${qCode}`;
  const cells = video.priceCells ?? video.matrix.cells ?? {};
  // 每格秒价初值：取显式格价；缺格回落 base×清晰度系数×品质系数（向上取整）
  const initialFor = (resCode: string, qCode: string, rf: number, qf: number): string => {
    const explicit = cells[cellKey(resCode, qCode)];
    if (typeof explicit === 'number') return String(explicit);
    return String(Math.max(1, Math.ceil((video.matrix.base || 0) * rf * qf)));
  };

  const buildDrafts = (): Record<string, string> => {
    const d: Record<string, string> = {};
    for (const { q, r } of rows) {
      d[cellKey(r.code, q.code)] = initialFor(r.code, q.code, r.priceFactor, q.priceFactor);
    }
    return d;
  };
  const [drafts, setDrafts] = useState<Record<string, string>>(buildDrafts);
  // priceCells 变化（重新拉取/切换）时同步草稿
  const cellsSig = JSON.stringify(cells);
  useEffect(() => {
    setDrafts(buildDrafts());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellsSig, rows.length]);

  const dirty = rows.some(({ q, r }) => {
    const k = cellKey(r.code, q.code);
    return String(cells[k] ?? '') !== String(Math.max(0, Math.round(Number(drafts[k] || 0))));
  });

  const saveCells = useMutation({
    mutationFn: () => {
      const payload: Record<string, number> = {};
      for (const { q, r } of rows) {
        const k = cellKey(r.code, q.code);
        payload[k] = Math.max(0, Math.round(Number(drafts[k] || 0)));
      }
      return apiClient.patch('/admin/billing/video-pricing/cells', {
        cells: payload,
      }) as any;
    },
    onSuccess: () => {
      setSaveMsg({ ok: true, text: '已保存' });
      qc.invalidateQueries({ queryKey: ['admin', 'billing', 'video-pricing'] });
    },
    onError: () => setSaveMsg({ ok: false, text: '保存失败' }),
  });

  // 当前引擎全部由「AI 路由配置」决定：标准=单图模式(videoSingleRef)、Ultron=videoUltron
  const routeFor = (qualityCode: string): EngineRoute | undefined =>
    qualityCode === 'ultron'
      ? modelConfig?.engineRouting?.ultron
      : modelConfig?.engineRouting?.standard;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            ⑨ 视频片段生成
            <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 text-[10px] font-medium">
              按秒计费
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            每格「清晰度 × 品质」的每秒积分可独立设置、互不影响（实际扣费 = 秒数 × 每秒积分 ×
            会员系数，向上取整）。清晰度 / 品质档在
            <Link
              href="/admin/billing/video-pricing"
              className="inline-flex items-center gap-0.5 mx-1 text-blue-600 hover:underline font-medium"
            >
              视频价格
              <ExternalLink className="h-3 w-3" />
            </Link>
            维护；当前引擎（标准=单图模式 / Ultron）全部在
            <Link
              href="/admin/ai-routing"
              className="inline-flex items-center gap-0.5 mx-1 text-blue-600 hover:underline font-medium"
            >
              AI 路由配置
              <ExternalLink className="h-3 w-3" />
            </Link>
            设置。
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!video.matrix.enabled && (
            <span className="px-2 py-1 rounded bg-amber-50 text-amber-700 text-xs whitespace-nowrap">
              计费总开关已关闭
            </span>
          )}
          <button
            onClick={() => {
              setSaveMsg(null);
              saveCells.mutate();
            }}
            disabled={saveCells.isPending || !dirty}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium"
          >
            {saveCells.isPending ? '保存中…' : '保存每秒价'}
          </button>
          {saveMsg && (
            <span
              className={cn(
                'text-[11px] font-medium',
                saveMsg.ok ? 'text-emerald-600' : 'text-red-500',
              )}
            >
              {saveMsg.text}
            </span>
          )}
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wider">
            <th className="text-left px-3 py-2 font-medium w-[10%]">前端步骤</th>
            <th className="text-left px-3 py-2 font-medium w-[16%]">生成品质</th>
            <th className="text-left px-3 py-2 font-medium w-[16%]">清晰度</th>
            <th className="text-left px-3 py-2 font-medium w-[24%]">当前引擎</th>
            <th className="text-left px-3 py-2 font-medium w-[10%]">单位</th>
            <th className="text-right px-3 py-2 font-medium w-[14%]">基础价(积分/秒)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(({ q, r }, idx) => {
            const isUltron = q.code === 'ultron';
            const k = cellKey(r.code, q.code);
            return (
              <tr key={k}>
                {idx === 0 && (
                  <td
                    rowSpan={rows.length}
                    className="px-3 py-2.5 align-top border-r border-slate-100"
                  >
                    <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 whitespace-nowrap">
                      第 9 步
                    </span>
                  </td>
                )}
                <td className="px-3 py-2.5 align-top">
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[11px] font-medium',
                      isUltron
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {q.name || q.code}
                  </span>
                </td>
                <td className="px-3 py-2.5 align-top text-slate-600 text-xs">
                  {r.name || r.code}
                </td>
                <td className="px-3 py-2.5 align-top text-xs">
                  {(() => {
                    const route = routeFor(q.code);
                    if (!route) return <span className="text-slate-300">—</span>;
                    return (
                      <div className="leading-relaxed">
                        <p className="text-slate-600 font-mono truncate" title={route.primary.model}>
                          {PROVIDER_LABEL[route.primary.provider] ?? route.primary.provider} ·{' '}
                          {route.primary.model || '默认'}
                        </p>
                        <p className="text-[10px] text-slate-400">{route.capabilityLabel}</p>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-3 py-2.5 align-top text-slate-500 text-xs">每秒</td>
                <td className="px-3 py-2.5 align-top text-right">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={drafts[k] ?? ''}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [k]: e.target.value }))
                    }
                    className="w-20 px-2 py-1 text-sm font-medium text-right text-slate-800 border border-slate-200 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CreationBudgetCard({
  dimension,
  video,
}: {
  dimension: BudgetDimension;
  video?: VideoPricingView;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('0');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const { data, isLoading } = useQuery<CreationBudgets>({
    queryKey: ['admin', 'billing', 'creation-budgets'],
    queryFn: () => apiClient.get('/admin/billing/creation-budgets') as any,
  });

  useEffect(() => {
    if (data) setDraft(String(data[dimension] ?? 0));
  }, [data, dimension]);

  const saveBudget = useMutation({
    mutationFn: () =>
      apiClient.patch('/admin/billing/creation-budgets', {
        [dimension]: Math.max(0, Number(draft) || 0),
      }) as any,
    onSuccess: (saved: CreationBudgets) => {
      qc.setQueryData(['admin', 'billing', 'creation-budgets'], saved);
      setMessage({ ok: true, text: '创建页预估秒价已保存。' });
    },
    onError: () => setMessage({ ok: false, text: '预算保存失败，请重试。' }),
  });

  const current = data?.[dimension] ?? 0;
  const parsedDraft = Math.max(0, Number(draft) || 0);
  const mvBudgetCells =
    dimension === 'mv' && video
      ? video.resolutions
          .filter((resolution) => resolution.enabled)
          .flatMap((resolution) =>
            video.qualityProfiles
              .filter((quality) => quality.enabled)
              .map((quality) => ({
                key: `${resolution.code}|${quality.code}`,
                label: `${resolution.name || resolution.code} · ${quality.name || quality.code}`,
                creditsPerSecond:
                  parsedDraft *
                  (resolution.durationPriceFactor ?? 1) *
                  (quality.durationPriceFactor ?? 1),
              })),
          )
      : [];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-3.5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                1
              </span>
              <h2 className="text-sm font-semibold text-slate-800">创建页预估价格</h2>
              <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                {BUDGET_LABEL[dimension]} · 展示价
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              决定用户创建前看到的“预计所需积分”，同时用于余额校验；不会按此数值直接扣费
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="text-xs font-medium text-slate-600" htmlFor={`budget-${dimension}`}>
            预估基础秒价
          </label>
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-blue-400">
            <input
              id={`budget-${dimension}`}
              type="number"
              min={0}
              step={0.1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="w-24 border-0 px-3 py-2 text-right text-sm font-semibold text-slate-800 focus:outline-none"
            />
            <span className="flex items-center border-l border-slate-100 bg-slate-50 px-2 text-[11px] text-slate-500">
              积分/秒
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              saveBudget.mutate();
            }}
            disabled={saveBudget.isPending || isLoading || parsedDraft === current}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {saveBudget.isPending ? '保存中…' : '保存'}
          </button>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
          <span className="font-medium text-slate-700">创建页展示公式：</span>
          {dimension === 'mv'
            ? '用户选择时长 × 基础预算秒价 × 清晰度预算系数 × 品质预算系数'
            : '用户选择时长 × 本业务基础预算秒价'}
        </div>
        {message && (
          <p className={cn('mt-2 text-xs font-medium', message.ok ? 'text-emerald-600' : 'text-red-600')}>
            {message.text}
          </p>
        )}
        {mvBudgetCells.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-[11px] font-medium text-slate-400">用户在不同输出组合下看到的预估秒价</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {mvBudgetCells.map((cell) => (
                <div key={cell.key} className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                  <p className="text-[11px] text-slate-500">{cell.label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800">
                    {Number(cell.creditsPerSecond.toFixed(2))}
                    <span className="ml-1 text-[10px] font-normal text-slate-400">积分/秒</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────────────

export default function StepPricesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('mv');
  const [openHelp, setOpenHelp] = useState<string | null>(null);
  const [edits, setEdits] = useState<
    Record<string, { priceCredits: number | null; enabled: boolean }>
  >({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (requested && DIM_TABS.some((item) => item.key === requested)) {
      setTab(requested);
    }
  }, []);

  const { data, isLoading, isError, error } = useQuery<StepPricesView>({
    queryKey: ['admin', 'billing', 'step-prices'],
    queryFn: async () => {
      const res = (await apiClient.get(
        '/admin/billing/step-prices',
      )) as unknown as StepPricesView;
      const map: Record<string, { priceCredits: number | null; enabled: boolean }> = {};
      for (const d of res.dimensions) {
        for (const r of d.rows) {
          map[rowKey(r)] = { priceCredits: r.priceCredits, enabled: r.enabled };
        }
      }
      setEdits(map);
      return res;
    },
  });

  const { data: videoPricing } = useQuery<VideoPricingView>({
    queryKey: ['admin', 'billing', 'video-pricing'],
    queryFn: () => apiClient.get('/admin/billing/video-pricing') as any,
  });
  const { data: modelConfig } = useQuery<ModelConfigView>({
    queryKey: ['admin', 'billing', 'model-config'],
    queryFn: () => apiClient.get('/admin/billing/model-config') as any,
  });
  // 当前统一按步实扣；步骤价格与视频每秒矩阵是唯一售价来源。
  const save = useMutation({
    mutationFn: (items: unknown[]) =>
      apiClient.patch('/admin/billing/step-prices', { items }) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: '步骤价格已保存。' });
      qc.invalidateQueries({ queryKey: ['admin', 'billing', 'step-prices'] });
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请重试。' }),
  });

  const recommend = useMutation({
    mutationFn: (dimension: string) =>
      apiClient.post('/admin/billing/step-prices/recommend', {
        dimension,
      }) as any,
    onSuccess: (res: any) => {
      const n = (res?.results ?? []).filter(
        (r: any) => r.recommendedPrice !== null,
      ).length;
      setMsg({
        ok: true,
        text: `已生成 ${n} 条历史成本对照（显示在推荐价下方，仅供参考）。`,
      });
      qc.invalidateQueries({ queryKey: ['admin', 'billing', 'step-prices'] });
    },
    onError: () => setMsg({ ok: false, text: '推荐价生成失败，请重试。' }),
  });

  const allRows = useMemo(
    () => data?.dimensions.find((d) => d.dimension === tab)?.rows ?? [],
    [data, tab],
  );

  // 视频片段生成改为按秒计费（独立可编辑卡片），从主步骤表中剔除；
  // 第 10 步「最终合成」单独抽出，放在视频矩阵之后展示（与前端流程顺序对齐）。
  const mainRows = useMemo(
    () =>
      allRows.filter(
        (r) =>
          !r.isAddon
          && r.step !== 'video_gen'
          && r.step !== 'final_compose'
          && !(r.alwaysBillInPerDuration ?? false),
      ),
    [allRows],
  );

  const perDurationAddonRows = useMemo(
    () => allRows.filter((r) => r.alwaysBillInPerDuration ?? false),
    [allRows],
  );

  const addonRows = useMemo(
    () => allRows.filter((r) => r.isAddon),
    [allRows],
  );

  // 第 10 步「最终合成」—— 放在视频矩阵之后
  const finalRows = useMemo(
    () => allRows.filter((r) => r.step === 'final_compose'),
    [allRows],
  );

  const handleSave = () => {
    setMsg(null);
    const items = allRows.flatMap((r) => {
      const e = edits[rowKey(r)] ?? {
        priceCredits: r.priceCredits,
        enabled: r.enabled,
      };
      if (e.priceCredits === null) return [];
      return [{
        dimension: r.dimension,
        step: r.step,
        resolution: r.resolution,
        priceCredits: e.priceCredits,
        enabled: e.enabled,
      }];
    });
    save.mutate(items);
  };

  return (
    <div className="admin-page">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Coins className="h-5 w-5 text-blue-600" />
            步骤价格
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            统一管理 MV、舞蹈视频与 Photo Karaoke 的创建页预估价格和实际扣费价格。预估价格决定创建前展示与余额校验，实际扣费价格决定任务成功后的真实积分消耗；渠道成本变化不会自动修改用户售价。「当前模型」读取
            <Link
              href="/admin/ai-routing"
              className="inline-flex items-center gap-0.5 mx-1 text-blue-600 hover:underline font-medium"
            >
              AI 路由配置
              <ExternalLink className="h-3 w-3" />
            </Link>
            ，修改路由后刷新本页即可看到最新模型。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {DIM_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                window.history.replaceState(null, '', `?tab=${t.key}`);
              }}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                tab === t.key
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={false}
          height="h-48"
        >
          <div className="space-y-4">
            {(tab === 'mv' || tab === 'dance' || tab === 'karaoke') && (
              <CreationBudgetCard
                dimension={tab}
                video={tab === 'mv' ? videoPricing : undefined}
              />
            )}
            {tab === 'mv' && (
              <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-800">
                <Coins className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                <div className="leading-relaxed">
                  创建按钮展示上方按时长计算的<strong className="font-semibold">预计所需积分</strong>；创建时不一次性扣除。真实费用仍由下方步骤价格与视频每秒价格决定，并在各步骤成功后分别扣除。
                </div>
              </div>
            )}
            {tab === 'music' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                「音乐生成」已迁移至{' '}
                <Link href="/admin/billing/music-pricing" className="font-medium text-blue-700 underline">
                  音乐定价
                </Link>
                ，按各模型差异化积分扣费；本页仅保留 AI 歌词步价编辑。
              </div>
            )}
            {tab === 'dance' && rowsMissingConfiguration(allRows) > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                还有 {rowsMissingConfiguration(allRows)} 项舞蹈价格未配置。配置完成前，舞蹈报价和生成会被服务端暂停，不会回退到代码默认价。
              </div>
            )}
            {(tab === 'mv' || tab === 'dance' || tab === 'karaoke') && (
              <div className="flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                    2
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-emerald-950">实际扣费价格</h2>
                    <p className="mt-0.5 text-xs leading-relaxed text-emerald-800/80">
                      下方配置会真实影响用户积分扣减。任务成功后按实际完成的步骤和数量分别扣费，失败步骤不结算。
                    </p>
                  </div>
                </div>
                <span className="self-start rounded-md border border-emerald-200 bg-white px-2 py-1 text-[10px] font-medium text-emerald-700 sm:self-auto">
                  {tab === 'mv'
                    ? '步骤单价 + 视频秒价矩阵'
                    : '步骤单价 × 实际数量/秒数'}
                </span>
              </div>
            )}
            {/* A. 创建相关（AI 推荐、Agent 对话 — 始终生效） */}
            {(tab === 'mv' || tab === 'dance') && perDurationAddonRows.length > 0 && (
              <div className="bg-white border border-blue-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-blue-100 bg-blue-50/60">
                  <h2 className="text-sm font-semibold text-blue-900">
                    {tab === 'mv' ? 'A. 创建相关（始终生效）' : '独立操作价格'}
                  </h2>
                  <p className="text-xs text-blue-800/80 mt-0.5 leading-relaxed">
                    {tab === 'mv'
                      ? 'AI 推荐、Agent 对话等与主流程独立计费。AI 推荐单价在「AI 推荐方向」行编辑。'
                      : 'Agent 对话等操作不属于首次创建预算，触发成功后按次独立扣费。'}
                  </p>
                </div>
                <PriceTable
                  rows={perDurationAddonRows}
                  edits={edits}
                  setEdits={setEdits}
                  openHelp={openHelp}
                  setOpenHelp={setOpenHelp}
                  showResolution={false}
                  showRecommended={false}
                />
              </div>
            )}
            {/* B. MV 主流程 Step ②–⑧ */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-semibold text-slate-700">
                    {tab === 'mv' ? 'B. MV 主流程 Step ②–⑧' : `${DIM_TABS.find((t) => t.key === tab)?.label} 步骤`}
                  </h2>
                  <span className="text-xs text-slate-400">
                    共 {mainRows.length} 项 · 每步完成后实扣
                  </span>
                </div>
                <button
                  onClick={() => {
                    setMsg(null);
                    recommend.mutate(tab);
                  }}
                  disabled={recommend.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50 text-xs font-medium"
                >
                  <Wand2
                    className={cn(
                      'h-3.5 w-3.5',
                      recommend.isPending && 'animate-pulse',
                    )}
                  />
                  {recommend.isPending ? '生成中…' : '生成历史成本对照'}
                </button>
              </div>
              <PriceTable
                rows={mainRows}
                edits={edits}
                setEdits={setEdits}
                openHelp={openHelp}
                setOpenHelp={setOpenHelp}
                showResolution={tab === 'mv' || tab === 'dance' || tab === 'karaoke'}
              />
            </div>

            {/* C. 视频按秒矩阵（Step ⑨） */}
            {tab === 'mv' && videoPricing && (
              <VideoPerSecondCard video={videoPricing} modelConfig={modelConfig} />
            )}

            {/* D. 对口型附加（实扣已含在视频按秒价内，此处为运营参考/预留） */}
            {addonRows.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-700">
                    {tab === 'mv' ? 'D. 对口型附加' : `${DIM_TABS.find((t) => t.key === tab)?.label} 附加项`}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    {tab === 'mv'
                      ? '当前实扣已合并入 Step ⑨ 视频按秒价（对口型镜头不另扣本表单价）。本表仅供运营对照或后续独立计价扩展。'
                      : '附加项仅在对应业务模式开放且启用后参与报价；尚未开放的模式会明确标记为不计费。'}
                  </p>
                </div>
                <PriceTable
                  rows={addonRows}
                  edits={edits}
                  setEdits={setEdits}
                  openHelp={openHelp}
                  setOpenHelp={setOpenHelp}
                  showResolution
                  showRecommended={false}
                />
              </div>
            )}

            {/* E. 最终合成（Step ⑩） */}
            {finalRows.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-700">E. 最终合成（Step ⑩）</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    用户点击「开始合成」时按下方价格预扣；合成成功结算，失败退回。
                  </p>
                </div>
                <PriceTable
                  rows={finalRows}
                  edits={edits}
                  setEdits={setEdits}
                  openHelp={openHelp}
                  setOpenHelp={setOpenHelp}
                  showResolution={tab === 'mv' || tab === 'dance' || tab === 'karaoke'}
                />
              </div>
            )}
          </div>
        </QueryState>

        {msg && (
          <p
            className={cn(
              'text-xs font-medium',
              msg.ok ? 'text-emerald-600' : 'text-red-500',
            )}
          >
            {msg.text}
          </p>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={save.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            {save.isPending ? '保存中…' : '保存步骤价格'}
          </button>
        </div>
      </div>
    </div>
  );
}
