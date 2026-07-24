'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Disc3,
  Save,
  Wand2,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Mic2,
  Music2,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';

interface MusicModelFeatures {
  supportsVocalGender?: boolean;
  supportsInstrumental?: boolean;
}

interface AdminMusicModelRow {
  id: string;
  code: string;
  provider: string;
  apiBackend: string;
  externalModelId: string;
  labelZh: string;
  labelEn: string;
  listUsd: number;
  costUsd: number;
  priceCredits: number;
  priceOverridden: boolean;
  recommendedCredits: number | null;
  enabled: boolean;
  isDefault: boolean;
  sortOrder: number;
  features: MusicModelFeatures;
}

interface MusicModelAdminView {
  mountseaProvider: {
    configured: boolean;
    isActive: boolean;
    source: string;
  };
  lyricsPrice: number;
  lyricsEnabled: boolean;
  models: AdminMusicModelRow[];
}

interface RowEdit {
  enabled: boolean;
  isDefault: boolean;
  labelZh: string;
  labelEn: string;
  listUsd: number;
  costUsd: number;
  priceCredits: number;
  priceOverridden: boolean;
  sortOrder: number;
  externalModelId: string;
  apiBackend: string;
}

const INPUT =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100';
const INPUT_NUM =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-right text-sm tabular-nums text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100';
const LABEL = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400';

function rowKey(r: { id: string }) {
  return r.id;
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-blue-600' : 'bg-slate-200',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

function marginPct(listUsd: number, costUsd: number): number | null {
  if (!listUsd || listUsd <= 0) return null;
  return ((listUsd - costUsd) / listUsd) * 100;
}

export default function MusicPricingPage() {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [lyricsPrice, setLyricsPrice] = useState<number>(2);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<MusicModelAdminView>({
    queryKey: ['admin', 'billing', 'music-models'],
    queryFn: async () =>
      (await apiClient.get('/admin/billing/music-models')) as unknown as MusicModelAdminView,
  });

  useEffect(() => {
    if (!data) return;
    const map: Record<string, RowEdit> = {};
    for (const m of data.models) {
      map[rowKey(m)] = {
        enabled: m.enabled,
        isDefault: m.isDefault,
        labelZh: m.labelZh,
        labelEn: m.labelEn,
        listUsd: m.listUsd,
        costUsd: m.costUsd,
        priceCredits: m.priceCredits,
        priceOverridden: m.priceOverridden,
        sortOrder: m.sortOrder,
        externalModelId: m.externalModelId,
        apiBackend: m.apiBackend,
      };
    }
    setEdits(map);
    setLyricsPrice(data.lyricsPrice);
  }, [data]);

  const mountseaReady =
    !!data?.mountseaProvider?.configured && !!data?.mountseaProvider?.isActive;

  const save = useMutation({
    mutationFn: async () => {
      const models = (data?.models ?? []).map((m) => {
        const e = edits[rowKey(m)];
        if (!e) return { id: m.id };
        return {
          id: m.id,
          enabled: e.enabled,
          isDefault: e.isDefault,
          labelZh: e.labelZh,
          labelEn: e.labelEn,
          listUsd: e.listUsd,
          costUsd: e.costUsd,
          priceCredits: e.priceCredits,
          priceOverridden: e.priceOverridden,
          sortOrder: e.sortOrder,
          externalModelId: e.externalModelId,
          apiBackend: e.apiBackend,
        };
      });
      return apiClient.patch('/admin/billing/music-models', { models, lyricsPrice });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'billing', 'music-models'] });
      setMsg({ ok: true, text: '音乐定价已保存，前台将立即生效。' });
    },
    onError: (e: Error) => {
      setMsg({ ok: false, text: e.message || '保存失败' });
    },
  });

  const applyRecommended = (m: AdminMusicModelRow) => {
    if (m.recommendedCredits == null) return;
    setEdits((prev) => ({
      ...prev,
      [rowKey(m)]: {
        ...prev[rowKey(m)],
        priceCredits: m.recommendedCredits!,
        priceOverridden: false,
      },
    }));
  };

  const updateRow = (id: string, patch: Partial<RowEdit>) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const setDefault = (id: string) => {
    setEdits((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = { ...next[key], isDefault: key === id };
      }
      return next;
    });
  };

  const dirty = useMemo(() => {
    if (!data) return false;
    if (lyricsPrice !== data.lyricsPrice) return true;
    return data.models.some((m) => {
      const e = edits[rowKey(m)];
      if (!e) return false;
      return (
        e.enabled !== m.enabled
        || e.isDefault !== m.isDefault
        || e.labelZh !== m.labelZh
        || e.labelEn !== m.labelEn
        || e.listUsd !== m.listUsd
        || e.costUsd !== m.costUsd
        || e.priceCredits !== m.priceCredits
        || e.priceOverridden !== m.priceOverridden
        || e.sortOrder !== m.sortOrder
        || e.externalModelId !== m.externalModelId
        || e.apiBackend !== m.apiBackend
      );
    });
  }, [data, edits, lyricsPrice]);

  const stats = useMemo(() => {
    if (!data) return { enabled: 0, total: 0, defaultLabel: '—' };
    const enabled = data.models.filter((m) => edits[rowKey(m)]?.enabled).length;
    const def = data.models.find((m) => edits[rowKey(m)]?.isDefault);
    return {
      enabled,
      total: data.models.length,
      defaultLabel: def ? (edits[rowKey(def)]?.labelZh || def.code) : '—',
    };
  }, [data, edits]);

  if (isLoading || isError || !data) {
    return (
      <div className="admin-page">
        <div className="p-6">
          <QueryState
            isLoading={isLoading}
            isError={isError}
            error={error}
            isEmpty={false}
            height="h-48"
          >
            {data ? null : <span />}
          </QueryState>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="space-y-5 p-6 pb-28">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Disc3 className="h-5 w-5 text-blue-600" />
              音乐模型与定价
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              配置音乐生成模型、各模型积分价与 AI 歌词步价。用户侧 /music-generator 从此处拉取模型列表。
            </p>
          </div>
          <button
            type="button"
            disabled={!dirty || save.isPending || !mountseaReady}
            onClick={() => {
              setMsg(null);
              save.mutate();
            }}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors',
              dirty && mountseaReady
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'cursor-not-allowed bg-slate-300',
            )}
          >
            <Save className="h-4 w-4" />
            {save.isPending ? '保存中…' : '保存'}
          </button>
        </div>

        {msg && (
          <div
            className={cn(
              'rounded-xl px-4 py-3 text-sm',
              msg.ok
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border border-red-200 bg-red-50 text-red-800',
            )}
          >
            {msg.text}
          </div>
        )}

        {/* Summary + channel */}
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">渠道状态</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  来源：{data.mountseaProvider.source || '—'}
                </p>
              </div>
              {mountseaReady ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mountsea 已就绪
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-100">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  未配置或未启用
                </span>
              )}
            </div>
            {!mountseaReady && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50/80 px-3 py-2.5 text-xs text-amber-900">
                <span>启用音乐模型前需先配置 Mountsea 渠道；保存已禁用。</span>
                <Link
                  href="/admin/ai-providers"
                  className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                >
                  前往 AI Provider 凭证
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] text-slate-400">已启用</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-800">
                  {stats.enabled}
                  <span className="text-sm font-normal text-slate-400"> / {stats.total}</span>
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] text-slate-400">默认模型</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">
                  {stats.defaultLabel}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] text-slate-400">AI 歌词</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-800">
                  {lyricsPrice}
                  <span className="text-sm font-normal text-slate-400"> cr</span>
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <Mic2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-800">AI 歌词定价</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                  高级模式内 AI 歌词，走 step_prices（music|music_lyrics）。
                </p>
              </div>
            </div>
            <div className="mt-4">
              <label className={LABEL}>每次消耗积分</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={lyricsPrice}
                  onChange={(e) => setLyricsPrice(Number(e.target.value) || 0)}
                  className={cn(INPUT_NUM, 'w-28')}
                />
                <span className="text-xs text-slate-400">cr / 次</span>
              </div>
            </div>
          </section>
        </div>

        {/* Models */}
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3 px-0.5">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">音乐模型</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                每张卡片独立配置展示名、上游映射与积分价；改积分后视为覆盖推荐价。
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {data.models.map((m) => {
              const e = edits[rowKey(m)];
              if (!e) return null;
              const margin = marginPct(e.listUsd, e.costUsd);
              const creditsDiff =
                m.recommendedCredits != null ? e.priceCredits - m.recommendedCredits : null;

              return (
                <article
                  key={m.id}
                  className={cn(
                    'overflow-hidden rounded-2xl border bg-white shadow-sm transition',
                    e.enabled
                      ? 'border-slate-200'
                      : 'border-slate-200/80 bg-slate-50/60 opacity-80',
                    e.isDefault && e.enabled && 'ring-1 ring-blue-100',
                  )}
                >
                  {/* Card header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                          e.enabled ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400',
                        )}
                      >
                        <Music2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-slate-800">
                            {e.labelZh || m.code}
                          </h3>
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
                            {m.code}
                          </code>
                          {e.isDefault && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-100">
                              默认
                            </span>
                          )}
                          {!e.enabled && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                              已停用
                            </span>
                          )}
                          {e.priceOverridden && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-100">
                              已覆盖
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500">
                            {m.provider}
                          </span>
                          {m.features?.supportsVocalGender && (
                            <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] text-violet-600">
                              人声性别
                            </span>
                          )}
                          {m.features?.supportsInstrumental && (
                            <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[11px] text-teal-600">
                              纯音乐
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <Toggle
                          checked={e.enabled}
                          onChange={(v) => updateRow(rowKey(m), { enabled: v })}
                          label="启用"
                        />
                        启用
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="radio"
                          name="defaultModel"
                          checked={e.isDefault}
                          onChange={() => setDefault(rowKey(m))}
                          className="h-3.5 w-3.5 accent-blue-600"
                        />
                        设为默认
                      </label>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-12">
                    <div className="space-y-3 xl:col-span-3">
                      <div>
                        <label className={LABEL}>中文名</label>
                        <input
                          value={e.labelZh}
                          onChange={(ev) => updateRow(rowKey(m), { labelZh: ev.target.value })}
                          className={INPUT}
                          placeholder="中文展示名"
                        />
                      </div>
                      <div>
                        <label className={LABEL}>English</label>
                        <input
                          value={e.labelEn}
                          onChange={(ev) => updateRow(rowKey(m), { labelEn: ev.target.value })}
                          className={INPUT}
                          placeholder="English label"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 xl:col-span-3">
                      <div>
                        <label className={LABEL}>API Backend</label>
                        <select
                          value={e.apiBackend}
                          onChange={(ev) => updateRow(rowKey(m), { apiBackend: ev.target.value })}
                          className={INPUT}
                        >
                          <option value="suno">Suno</option>
                          <option value="producer">Producer</option>
                        </select>
                      </div>
                      <div>
                        <label className={LABEL}>上游 model id</label>
                        <input
                          value={e.externalModelId}
                          onChange={(ev) =>
                            updateRow(rowKey(m), { externalModelId: ev.target.value })
                          }
                          className={cn(INPUT, 'font-mono text-xs')}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 xl:col-span-3">
                      <div>
                        <label className={LABEL}>标价 USD</label>
                        <input
                          type="number"
                          min={0}
                          step={0.000001}
                          value={e.listUsd}
                          onChange={(ev) =>
                            updateRow(rowKey(m), { listUsd: Number(ev.target.value) || 0 })
                          }
                          className={INPUT_NUM}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>成本 USD</label>
                        <input
                          type="number"
                          min={0}
                          step={0.000001}
                          value={e.costUsd}
                          onChange={(ev) =>
                            updateRow(rowKey(m), { costUsd: Number(ev.target.value) || 0 })
                          }
                          className={INPUT_NUM}
                        />
                      </div>
                      <div className="col-span-2">
                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                          毛利率{' '}
                          <span
                            className={cn(
                              'font-semibold tabular-nums',
                              margin == null
                                ? 'text-slate-400'
                                : margin >= 40
                                  ? 'text-emerald-600'
                                  : margin >= 20
                                    ? 'text-amber-600'
                                    : 'text-red-600',
                            )}
                          >
                            {margin == null ? '—' : `${margin.toFixed(1)}%`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 xl:col-span-3">
                      <div>
                        <label className={LABEL}>积分价</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={e.priceCredits}
                            onChange={(ev) =>
                              updateRow(rowKey(m), {
                                priceCredits: Number(ev.target.value) || 0,
                                priceOverridden: true,
                              })
                            }
                            className={cn(INPUT_NUM, 'flex-1')}
                          />
                          <span className="text-xs text-slate-400">cr</span>
                          {m.recommendedCredits != null && (
                            <button
                              type="button"
                              title={`应用推荐 ${m.recommendedCredits} cr`}
                              onClick={() => applyRecommended(m)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 text-blue-600 transition hover:bg-blue-50"
                            >
                              <Wand2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {m.recommendedCredits != null && (
                          <p className="mt-1.5 text-[11px] text-slate-400">
                            推荐 {m.recommendedCredits} cr
                            {creditsDiff != null && creditsDiff !== 0 && (
                              <span
                                className={cn(
                                  'ml-1.5',
                                  creditsDiff > 0 ? 'text-amber-600' : 'text-emerald-600',
                                )}
                              >
                                ({creditsDiff > 0 ? '+' : ''}
                                {creditsDiff})
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className={LABEL}>排序</label>
                        <input
                          type="number"
                          value={e.sortOrder}
                          onChange={(ev) =>
                            updateRow(rowKey(m), { sortOrder: Number(ev.target.value) || 0 })
                          }
                          className={cn(INPUT_NUM, 'w-24')}
                        />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {/* Sticky save bar */}
      {dirty && (
        <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              有未保存的更改
              {!mountseaReady && (
                <span className="ml-2 text-amber-700">· Mountsea 未就绪，暂不可保存</span>
              )}
            </p>
            <button
              type="button"
              disabled={save.isPending || !mountseaReady}
              onClick={() => {
                setMsg(null);
                save.mutate();
              }}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors',
                mountseaReady
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'cursor-not-allowed bg-slate-300',
              )}
            >
              <Save className="h-4 w-4" />
              {save.isPending ? '保存中…' : '保存更改'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
