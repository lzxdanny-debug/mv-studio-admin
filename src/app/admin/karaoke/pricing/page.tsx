'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, Save, HelpCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { useAdminAuthStore } from '@/stores/admin-auth.store';

interface KaraokePriceRow {
  step: string;
  priceCredits: number;
  enabled: boolean;
  unit: 'per_project' | 'per_image' | 'per_segment' | 'per_call';
}

interface KaraokePricingView {
  rows: KaraokePriceRow[];
}

/** 与后端 KARAOKE_COST_STEPS 常量一一对应的展示元信息 */
const STEP_META: Record<string, { label: string; description: string; order: number }> = {
  karaoke_scene_image: {
    label: '场景图生成',
    description: '根据用户照片 + 场景 prompt 生成演唱场景静态图。',
    order: 1,
  },
  karaoke_lrc_transcribe: {
    label: 'LRC 歌词转录',
    description: '从音乐音频转录出带时间轴的 LRC 歌词（用于字幕同步）。',
    order: 2,
  },
  karaoke_audio_analyze: {
    label: '音频分析',
    description: '分析音乐节拍、人声区间，用于片段切分与口型同步参考。',
    order: 3,
  },
  karaoke_video: {
    label: '片段视频生成',
    description: '按片段调用视频模型生成唱演视频，通常按片段数计费。',
    order: 4,
  },
  karaoke_frame_extract: {
    label: '末帧抽取',
    description: '从上一片段视频中抽取末帧，用于下一片段的连续性参考图。',
    order: 5,
  },
  karaoke_compose: {
    label: '最终合成',
    description: '拼接全部片段、叠加字幕水印，生成最终成片。',
    order: 6,
  },
};

const UNIT_LABEL: Record<KaraokePriceRow['unit'], string> = {
  per_project: '整片一次',
  per_image: '每张',
  per_segment: '每片段',
  per_call: '每次',
};

function rowKey(r: { step: string }) {
  return r.step;
}

export default function AdminKaraokePricingPage() {
  const qc = useQueryClient();
  const canEdit = useAdminAuthStore((s) => s.hasPermission('karaoke.pricing.edit'));
  const [edits, setEdits] = useState<Record<string, { priceCredits: number; enabled: boolean }>>({});
  const [openHelp, setOpenHelp] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<KaraokePricingView>({
    queryKey: ['admin', 'karaoke', 'pricing'],
    queryFn: () => apiClient.get('/admin/karaoke/pricing') as any,
  });

  const rows = useMemo(
    () =>
      [...(data?.rows ?? [])].sort(
        (a, b) => (STEP_META[a.step]?.order ?? 99) - (STEP_META[b.step]?.order ?? 99),
      ),
    [data],
  );

  useEffect(() => {
    if (!data) return;
    const map: Record<string, { priceCredits: number; enabled: boolean }> = {};
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
      const items = rows.map((r) => {
        const e = edits[rowKey(r)] ?? { priceCredits: r.priceCredits, enabled: r.enabled };
        return { step: r.step, priceCredits: e.priceCredits, enabled: e.enabled };
      });
      return apiClient.patch('/admin/karaoke/pricing', { items }) as any;
    },
    onSuccess: () => {
      setMsg({ ok: true, text: 'Karaoke 步骤价格已保存。' });
      qc.invalidateQueries({ queryKey: ['admin', 'karaoke', 'pricing'] });
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '保存失败，请重试。' }),
  });

  const totalCredits = rows.reduce((sum, r) => {
    const e = edits[rowKey(r)] ?? { priceCredits: r.priceCredits, enabled: r.enabled };
    return e.enabled ? sum + e.priceCredits : sum;
  }, 0);

  return (
    <div className="admin-page">
      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Coins className="h-5 w-5 text-blue-600" />
              Karaoke 步骤价格
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              各步骤完成后按下方价格实扣积分；「片段视频生成」按项目实际片段数逐段计费。
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-500">
            单次全流程预估 <span className="font-semibold text-slate-800">{totalCredits}</span> 积分
            <span className="text-slate-400">（不含多片段叠加）</span>
          </div>
        </div>

        <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5 font-medium w-[30%]">步骤</th>
                  <th className="text-left px-3 py-2.5 font-medium w-[12%]">单位</th>
                  <th className="text-right px-3 py-2.5 font-medium w-[16%]">价格（积分）</th>
                  <th className="text-center px-3 py-2.5 font-medium w-[10%]">启用</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const key = rowKey(r);
                  const meta = STEP_META[r.step];
                  const e = edits[key] ?? { priceCredits: r.priceCredits, enabled: r.enabled };
                  return (
                    <tr key={key}>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-700">{meta?.label ?? r.step}</span>
                          <button
                            type="button"
                            onClick={() => setOpenHelp(openHelp === key ? null : key)}
                            className="text-slate-400 hover:text-blue-600"
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">{r.step}</p>
                        {openHelp === key && meta && (
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-500 max-w-md">
                            {meta.description}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-slate-500 text-xs">
                        {UNIT_LABEL[r.unit] ?? r.unit}
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        <input
                          type="number"
                          min={0}
                          value={e.priceCredits}
                          disabled={!canEdit}
                          onChange={(ev) =>
                            setEdits((m) => ({
                              ...m,
                              [key]: { ...e, priceCredits: Math.max(0, Math.round(Number(ev.target.value))) },
                            }))
                          }
                          className="w-24 px-2 py-1 text-sm text-right border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 disabled:opacity-60"
                        />
                      </td>
                      <td className="px-3 py-3 align-top text-center">
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
          <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>{msg.text}</p>
        )}

        {!canEdit && (
          <p className="text-xs text-amber-600">
            当前账号仅有 karaoke.pricing.view，无法保存（需 karaoke.pricing.edit）。
          </p>
        )}

        <div className="flex justify-end">
          <button
            onClick={() => {
              setMsg(null);
              save.mutate();
            }}
            disabled={save.isPending || !dirty || !canEdit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            {save.isPending ? '保存中…' : '保存步骤价格'}
          </button>
        </div>
      </div>
    </div>
  );
}
