'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Disc3, Save, Wand2, AlertTriangle, ExternalLink } from 'lucide-react';
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

function rowKey(r: { id: string }) {
  return r.id;
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

  if (isLoading || isError || !data) {
    return (
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
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <Disc3 className="h-5 w-5 text-blue-600" />
            音乐模型与定价
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            配置音乐生成模型、各模型积分价与 AI 歌词步价。用户侧 /music-generator 从此处拉取模型列表。
          </p>
        </div>
        <button
          type="button"
          disabled={!dirty || save.isPending || !mountseaReady}
          onClick={() => save.mutate()}
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
            'rounded-lg px-4 py-3 text-sm',
            msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800',
          )}
        >
          {msg.text}
        </div>
      )}

      {/* 渠道状态 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">渠道状态</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {mountseaReady ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              Mountsea 已配置且已启用
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                Mountsea 未配置或未启用
              </span>
              <Link
                href="/admin/ai-providers"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
              >
                前往 AI Provider 凭证
                <ExternalLink className="h-3 w-3" />
              </Link>
            </>
          )}
          <span className="text-xs text-slate-400">
            来源：{data.mountseaProvider.source}
          </span>
        </div>
        {!mountseaReady && (
          <p className="mt-2 text-xs text-slate-500">
            启用音乐模型前需先配置 Mountsea 渠道；保存按钮已禁用直至渠道就绪。
          </p>
        )}
      </section>

      {/* AI 歌词定价 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">AI 歌词定价</h2>
        <p className="mt-1 text-xs text-slate-500">
          音乐创作高级模式内的 AI 歌词生成，仍走 step_prices（music|music_lyrics）。
        </p>
        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm text-slate-600">每次消耗积分</label>
          <input
            type="number"
            min={0}
            step={1}
            value={lyricsPrice}
            onChange={(e) => setLyricsPrice(Number(e.target.value) || 0)}
            className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          />
          <span className="text-xs text-slate-400">cr / 次</span>
        </div>
      </section>

      {/* 模型表 */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-700">音乐模型</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">启用</th>
                <th className="px-3 py-2 font-medium">默认</th>
                <th className="px-3 py-2 font-medium">展示名</th>
                <th className="px-3 py-2 font-medium">code</th>
                <th className="px-3 py-2 font-medium">API</th>
                <th className="px-3 py-2 font-medium">上游 model</th>
                <th className="px-3 py-2 font-medium text-right">标价 USD</th>
                <th className="px-3 py-2 font-medium text-right">成本 USD</th>
                <th className="px-3 py-2 font-medium text-right">积分价</th>
                <th className="px-3 py-2 font-medium text-right">排序</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.models.map((m) => {
                const e = edits[rowKey(m)];
                if (!e) return null;
                return (
                  <tr key={m.id} className={cn(!e.enabled && 'bg-slate-50/80')}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={e.enabled}
                        onChange={(ev) =>
                          setEdits((prev) => ({
                            ...prev,
                            [rowKey(m)]: { ...prev[rowKey(m)], enabled: ev.target.checked },
                          }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="radio"
                        name="defaultModel"
                        checked={e.isDefault}
                        onChange={() =>
                          setEdits((prev) => {
                            const next = { ...prev };
                            for (const row of data.models) {
                              const k = rowKey(row);
                              if (next[k]) next[k] = { ...next[k], isDefault: row.id === m.id };
                            }
                            return next;
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={e.labelZh}
                        onChange={(ev) =>
                          setEdits((prev) => ({
                            ...prev,
                            [rowKey(m)]: { ...prev[rowKey(m)], labelZh: ev.target.value },
                          }))
                        }
                        className="mb-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                        placeholder="中文名"
                      />
                      <input
                        value={e.labelEn}
                        onChange={(ev) =>
                          setEdits((prev) => ({
                            ...prev,
                            [rowKey(m)]: { ...prev[rowKey(m)], labelEn: ev.target.value },
                          }))
                        }
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-500"
                        placeholder="English"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{m.code}</td>
                    <td className="px-3 py-2">
                      <select
                        value={e.apiBackend}
                        onChange={(ev) =>
                          setEdits((prev) => ({
                            ...prev,
                            [rowKey(m)]: { ...prev[rowKey(m)], apiBackend: ev.target.value },
                          }))
                        }
                        className="rounded border border-slate-200 px-2 py-1 text-xs"
                      >
                        <option value="suno">Suno</option>
                        <option value="producer">Producer</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={e.externalModelId}
                        onChange={(ev) =>
                          setEdits((prev) => ({
                            ...prev,
                            [rowKey(m)]: { ...prev[rowKey(m)], externalModelId: ev.target.value },
                          }))
                        }
                        className="w-full min-w-[100px] rounded border border-slate-200 px-2 py-1 font-mono text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step={0.000001}
                        value={e.listUsd}
                        onChange={(ev) =>
                          setEdits((prev) => ({
                            ...prev,
                            [rowKey(m)]: { ...prev[rowKey(m)], listUsd: Number(ev.target.value) || 0 },
                          }))
                        }
                        className="w-20 rounded border border-slate-200 px-2 py-1 text-right text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step={0.000001}
                        value={e.costUsd}
                        onChange={(ev) =>
                          setEdits((prev) => ({
                            ...prev,
                            [rowKey(m)]: { ...prev[rowKey(m)], costUsd: Number(ev.target.value) || 0 },
                          }))
                        }
                        className="w-20 rounded border border-slate-200 px-2 py-1 text-right text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={e.priceCredits}
                          onChange={(ev) =>
                            setEdits((prev) => ({
                              ...prev,
                              [rowKey(m)]: {
                                ...prev[rowKey(m)],
                                priceCredits: Number(ev.target.value) || 0,
                                priceOverridden: true,
                              },
                            }))
                          }
                          className="w-16 rounded border border-slate-200 px-2 py-1 text-right text-xs"
                        />
                        {m.recommendedCredits != null && (
                          <button
                            type="button"
                            title={`推荐 ${m.recommendedCredits} cr`}
                            onClick={() => applyRecommended(m)}
                            className="rounded p-1 text-blue-600 hover:bg-blue-50"
                          >
                            <Wand2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {m.recommendedCredits != null && (
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          推荐 {m.recommendedCredits} cr
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        value={e.sortOrder}
                        onChange={(ev) =>
                          setEdits((prev) => ({
                            ...prev,
                            [rowKey(m)]: { ...prev[rowKey(m)], sortOrder: Number(ev.target.value) || 0 },
                          }))
                        }
                        className="w-14 rounded border border-slate-200 px-2 py-1 text-right text-xs"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
