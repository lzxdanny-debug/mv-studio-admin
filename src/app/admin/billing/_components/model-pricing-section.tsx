'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, Save } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';

interface ModelPriceRow {
  id: string;
  channel: string;
  channelLabel: string;
  modelId: string;
  resolution: string;
  isVideo: boolean;
  capabilities: string[];
  /** 实际价格：渠道单次标价 USD */
  listUsd: number;
  /** 成本价：折后真实单次成本 USD */
  costUsd: number;
  enabled: boolean;
}

interface ModelPricesView {
  channels: Array<{
    channel: string;
    channelLabel: string;
    rows: ModelPriceRow[];
  }>;
}

interface Edit {
  listUsd: number;
  costUsd: number;
  enabled: boolean;
}

const RES_LABEL: Record<string, string> = {
  '': '—',
  '720p': '标清 720p',
  '1080p': '超清 1080p',
};

const CHANNEL_ORDER = ['mountseaMs', 'cloudflare', 'fal', 'mountsea'] as const;

const CHANNEL_DESCRIPTIONS: Record<string, string> = {
  mountseaMs:
    'Mountsea /ms/v1：按 endpoint slug 出图/出视频（如 google/veo-3.1/...）。与下方 Mountsea Hub 是不同 API、不同模型 ID。',
  mountsea:
    'Mountsea Hub：/v1 聊天、Hub 视频/图像名。文本、音频、部分视频走此通道；积分单价与 MS 共用上方「Mountsea 积分成本」。',
  cloudflare: 'Cloudflare Workers AI / AI Gateway。',
  fal: 'Fal.ai，按 USD 结算。',
};

function rowKey(r: { channel: string; modelId: string; resolution: string }) {
  return `${r.channel}|${r.modelId}|${r.resolution}`;
}

/** 折扣率 = 1 − 成本/标价；标价为 0 时无意义 */
function discountText(listUsd: number, costUsd: number): string {
  if (listUsd <= 0) return '—';
  const d = (1 - costUsd / listUsd) * 100;
  if (!Number.isFinite(d)) return '—';
  return `${d.toFixed(0)}%`;
}

export function ModelPricingSection() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>('mountseaMs');
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<ModelPricesView>({
    queryKey: ['admin', 'billing', 'model-prices'],
    queryFn: async () => {
      const res = (await apiClient.get(
        '/admin/billing/model-prices',
      )) as unknown as ModelPricesView;
      const map: Record<string, Edit> = {};
      for (const c of res.channels) {
        for (const r of c.rows) {
          map[rowKey(r)] = {
            listUsd: r.listUsd,
            costUsd: r.costUsd,
            enabled: r.enabled,
          };
        }
      }
      setEdits(map);
      const ordered = [...res.channels].sort((a, b) => {
        const rank = (ch: string) => {
          const i = CHANNEL_ORDER.indexOf(ch as (typeof CHANNEL_ORDER)[number]);
          return i === -1 ? 99 : i;
        };
        return rank(a.channel) - rank(b.channel);
      });
      if (ordered[0] && !ordered.some((c) => c.channel === tab)) {
        setTab(ordered[0].channel);
      }
      return { ...res, channels: ordered };
    },
  });

  const save = useMutation({
    mutationFn: (items: unknown[]) =>
      apiClient.patch('/admin/billing/model-prices', { items }) as Promise<unknown>,
    onSuccess: () => {
      setMsg({ ok: true, text: 'MV 模型定价已保存。' });
      qc.invalidateQueries({ queryKey: ['admin', 'billing', 'model-prices'] });
      // 步骤价格的推荐值依赖模型定价，刷新它
      qc.invalidateQueries({ queryKey: ['admin', 'billing', 'step-prices'] });
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请重试。' }),
  });

  const channels = data?.channels ?? [];
  const activeRows = useMemo(
    () => channels.find((c) => c.channel === tab)?.rows ?? [],
    [channels, tab],
  );

  const handleSave = () => {
    setMsg(null);
    const items = channels.flatMap((c) =>
      c.rows.map((r) => {
        const e = edits[rowKey(r)] ?? {
          listUsd: r.listUsd,
          costUsd: r.costUsd,
          enabled: r.enabled,
        };
        return {
          channel: r.channel,
          modelId: r.modelId,
          resolution: r.resolution,
          listUsd: e.listUsd,
          costUsd: e.costUsd,
          enabled: e.enabled,
        };
      }),
    );
    save.mutate(items);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Boxes className="h-4 w-4 text-teal-600" />
            MV 模型定价（单次调用）
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            按渠道维护各模型的单次调用价格。
            <span className="text-slate-700 font-medium"> Mountsea MS</span>
            与
            <span className="text-slate-700 font-medium"> Mountsea Hub</span>
            是两套 API、模型 ID 不同，需分别维护；二者若按 credits 扣费，成本折算共用上方「Mountsea 积分成本」。
            <span className="text-slate-700 font-medium"> 实际价格</span>
            ＝渠道单次标价；
            <span className="text-slate-700 font-medium"> 成本价</span>
            ＝折后真实成本（毛利/对账）。视频模型按清晰度分档。
          </p>
        </div>
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={false}
        height="h-48"
      >
        {/* 渠道 tab */}
        <div className="flex items-center gap-1 border-b border-slate-200 mt-3">
          {channels.map((c) => (
            <button
              key={c.channel}
              onClick={() => setTab(c.channel)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === c.channel
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              {c.channelLabel}
              <span className="ml-1.5 text-[10px] text-slate-400">
                {c.rows.length}
              </span>
            </button>
          ))}
        </div>

        {CHANNEL_DESCRIPTIONS[tab] && (
          <p className="mt-3 text-xs text-slate-500 leading-relaxed rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
            {CHANNEL_DESCRIPTIONS[tab]}
          </p>
        )}

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wider">
                <th className="text-left px-3 py-2 font-medium w-[30%]">模型</th>
                <th className="text-left px-3 py-2 font-medium w-[22%]">能力</th>
                <th className="text-left px-3 py-2 font-medium w-[10%]">清晰度</th>
                <th className="text-right px-3 py-2 font-medium w-[12%]">
                  实际价格 $/次
                </th>
                <th className="text-right px-3 py-2 font-medium w-[12%]">
                  成本价 $/次
                </th>
                <th className="text-right px-3 py-2 font-medium w-[7%]">折扣</th>
                <th className="text-center px-3 py-2 font-medium w-[7%]">启用</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-xs text-slate-400 py-6">
                    暂无模型
                  </td>
                </tr>
              ) : (
                activeRows.map((r) => {
                  const key = rowKey(r);
                  const e = edits[key] ?? {
                    listUsd: r.listUsd,
                    costUsd: r.costUsd,
                    enabled: r.enabled,
                  };
                  return (
                    <tr key={key}>
                      <td className="px-3 py-2.5 align-top">
                        <span
                          className="font-mono text-xs text-slate-700 break-all"
                          title={r.modelId}
                        >
                          {r.modelId}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="flex flex-wrap gap-1">
                          {r.capabilities.map((c) => (
                            <span
                              key={c}
                              className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px]"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 align-top">
                        {RES_LABEL[r.resolution] ?? r.resolution}
                      </td>
                      <td className="px-3 py-2.5 text-right align-top">
                        <input
                          type="number"
                          min={0}
                          step="0.0001"
                          value={e.listUsd}
                          onChange={(ev) =>
                            setEdits((m) => ({
                              ...m,
                              [key]: {
                                ...e,
                                listUsd: Math.max(0, Number(ev.target.value)),
                              },
                            }))
                          }
                          className="w-24 px-2 py-1 text-sm text-right border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right align-top">
                        <input
                          type="number"
                          min={0}
                          step="0.0001"
                          value={e.costUsd}
                          onChange={(ev) =>
                            setEdits((m) => ({
                              ...m,
                              [key]: {
                                ...e,
                                costUsd: Math.max(0, Number(ev.target.value)),
                              },
                            }))
                          }
                          className="w-24 px-2 py-1 text-sm text-right border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-emerald-50/60"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-slate-500 align-top">
                        {discountText(e.listUsd, e.costUsd)}
                      </td>
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
                          className="accent-teal-600"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4">
          {msg ? (
            <p
              className={cn(
                'text-xs font-medium',
                msg.ok ? 'text-emerald-600' : 'text-red-500',
              )}
            >
              {msg.text}
            </p>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={save.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            {save.isPending ? '保存中…' : '保存 MV 模型定价'}
          </button>
        </div>
      </QueryState>
    </div>
  );
}
