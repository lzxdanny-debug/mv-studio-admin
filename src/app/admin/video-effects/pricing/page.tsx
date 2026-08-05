'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, HelpCircle, Save } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { useAdminAuthStore } from '@/stores/admin-auth.store';

interface PriceRow {
  step: string;
  label: string;
  description: string;
  unit: string;
  resolution: string;
  perResolution: boolean;
  priceCredits: number | null;
  enabled: boolean;
  configured: boolean;
  sortOrder: number;
}

interface PricingView {
  dimension: string;
  rows: PriceRow[];
}

const UNIT_LABEL: Record<string, string> = {
  per_project: '整次任务',
  per_image: '每张',
  per_second: '每秒',
  per_shot: '每片段',
  per_call: '每次',
};

const RESOLUTION_LABEL: Record<string, string> = {
  '': '—',
  '720p': '标清 720p',
  '1080p': '超清 1080p',
};

function rowKey(r: PriceRow) {
  return `${r.step}|${r.resolution}`;
}

export default function AdminVideoEffectPricingPage() {
  const qc = useQueryClient();
  const canEdit = useAdminAuthStore((s) => s.hasPermission('effects.pricing.edit'));
  const [edits, setEdits] = useState<
    Record<string, { priceCredits: number | null; enabled: boolean }>
  >({});
  const [openHelp, setOpenHelp] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<PricingView>({
    queryKey: ['admin', 'video-effects', 'pricing'],
    queryFn: () => apiClient.get('/admin/video-effects/pricing') as any,
  });

  const rows = useMemo(
    () => [...(data?.rows ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [data],
  );

  useEffect(() => {
    if (!data) return;
    const map: Record<string, { priceCredits: number | null; enabled: boolean }> = {};
    for (const r of data.rows) {
      map[rowKey(r)] = { priceCredits: r.priceCredits, enabled: r.enabled };
    }
    setEdits(map);
  }, [data]);

  const dirty = useMemo(
    () =>
      rows.some((r) => {
        const e = edits[rowKey(r)];
        if (!e) return false;
        return e.priceCredits !== r.priceCredits || e.enabled !== r.enabled;
      }),
    [rows, edits],
  );

  const save = useMutation({
    mutationFn: () => {
      const items = rows.flatMap((r) => {
        const e = edits[rowKey(r)] ?? { priceCredits: r.priceCredits, enabled: r.enabled };
        if (e.priceCredits === null) return [];
        return [
          {
            step: r.step,
            resolution: r.resolution,
            priceCredits: e.priceCredits,
            enabled: e.enabled,
          },
        ];
      });
      return apiClient.patch('/admin/video-effects/pricing', { items }) as any;
    },
    onSuccess: () => {
      setMsg({ ok: true, text: '视频特效步骤价格已保存。' });
      qc.invalidateQueries({ queryKey: ['admin', 'video-effects', 'pricing'] });
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '保存失败，请重试。' }),
  });

  return (
    <div className="admin-page">
      <div className="space-y-5 p-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Coins className="h-5 w-5 text-blue-600" />
            视频特效步骤价格
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            dimension=video_effects 的步骤价格，与 MV / Dance / Karaoke 共用 step_prices 表。未配置的步骤会阻止报价与生成。
          </p>
        </div>

        {rows.some((row) => !row.configured) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            还有 {rows.filter((row) => !row.configured).length} 项价格未配置。请填写价格并启用。
          </div>
        )}

        <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="w-[36%] px-4 py-2.5 text-left font-medium">步骤</th>
                  <th className="w-[12%] px-3 py-2.5 text-left font-medium">单位</th>
                  <th className="w-[14%] px-3 py-2.5 text-left font-medium">分辨率</th>
                  <th className="w-[16%] px-3 py-2.5 text-right font-medium">价格（积分）</th>
                  <th className="w-[10%] px-3 py-2.5 text-center font-medium">启用</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const key = rowKey(r);
                  const e = edits[key] ?? { priceCredits: r.priceCredits, enabled: r.enabled };
                  return (
                    <tr key={key}>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-700">{r.label}</span>
                          {!r.configured && (
                            <span className="rounded bg-red-50 px-1 py-0.5 text-[10px] font-medium text-red-600">
                              未配置
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setOpenHelp(openHelp === key ? null : key)}
                            className="text-slate-400 hover:text-blue-600"
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-400">{r.step}</p>
                        {openHelp === key && (
                          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">
                            {r.description}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-xs text-slate-500">
                        {UNIT_LABEL[r.unit] ?? r.unit}
                      </td>
                      <td className="px-3 py-3 align-top text-xs text-slate-500">
                        {RESOLUTION_LABEL[r.resolution] ?? r.resolution}
                      </td>
                      <td className="px-3 py-3 text-right align-top">
                        <input
                          type="number"
                          min={0}
                          value={e.priceCredits ?? ''}
                          placeholder="必填"
                          disabled={!canEdit}
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
                          className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                        />
                      </td>
                      <td className="px-3 py-3 text-center align-top">
                        <input
                          type="checkbox"
                          checked={e.enabled}
                          disabled={!canEdit}
                          onChange={(ev) =>
                            setEdits((m) => ({ ...m, [key]: { ...e, enabled: ev.target.checked } }))
                          }
                          className="accent-blue-600 disabled:opacity-60"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </QueryState>

        {msg && (
          <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
            {msg.text}
          </p>
        )}

        {!canEdit && (
          <p className="text-xs text-amber-600">
            当前账号仅有 effects.pricing.view，无法保存（需 effects.pricing.edit）。
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setMsg(null);
              save.mutate();
            }}
            disabled={save.isPending || !dirty || !canEdit}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            {save.isPending ? '保存中…' : '保存步骤价格'}
          </button>
        </div>
      </div>
    </div>
  );
}
