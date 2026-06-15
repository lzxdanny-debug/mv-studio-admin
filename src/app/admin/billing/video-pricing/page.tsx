'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Film, Save, Plus, Trash2, HelpCircle, ExternalLink } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';

interface VideoResolution {
  id?: string;
  code: string;
  name: string;
  width: number;
  height: number;
  priceFactor: number;
  minPlan: string;
  enabled: boolean;
  sortOrder: number;
}

interface QualityProfile {
  id?: string;
  code: string;
  name: string;
  description: string;
  priceFactor: number;
  minPlan: string;
  providerHint: string;
  enabled: boolean;
  sortOrder: number;
}

interface VideoPricingView {
  resolutions: VideoResolution[];
  qualityProfiles: QualityProfile[];
  matrix: {
    base: number;
    enabled: boolean;
    memberFactor: number;
    cells: Record<string, number>;
  };
  /** 每格（清晰度×品质）显式每秒价，key 形如 "720p|standard" */
  priceCells: Record<string, number>;
}

const INPUT =
  'w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50';
const PLAN_OPTIONS = ['free', 'creator', 'pro'];

const NEW_RES: VideoResolution = {
  code: '',
  name: '',
  width: 0,
  height: 0,
  priceFactor: 1,
  minPlan: 'free',
  enabled: true,
  sortOrder: 99,
};
const NEW_QUALITY: QualityProfile = {
  code: '',
  name: '',
  description: '',
  priceFactor: 1,
  minPlan: 'free',
  providerHint: '',
  enabled: true,
  sortOrder: 99,
};

export default function VideoPricingPage() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [resDraft, setResDraft] = useState<VideoResolution | null>(null);
  const [qDraft, setQDraft] = useState<QualityProfile | null>(null);
  const [baseDraft, setBaseDraft] = useState<string>('');

  const { data, isLoading, isError, error } = useQuery<VideoPricingView>({
    queryKey: ['admin', 'billing', 'video-pricing'],
    queryFn: () => apiClient.get('/admin/billing/video-pricing') as any,
  });

  useEffect(() => {
    if (data) setBaseDraft(String(data.matrix.base));
  }, [data]);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['admin', 'billing', 'video-pricing'] });

  const saveBase = useMutation({
    mutationFn: (value: number) =>
      apiClient.patch('/admin/billing/pricing-config', {
        videoBaseCreditsPerSecond: value,
      }) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: '基础秒价已保存。' });
      invalidate();
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请重试。' }),
  });

  const saveRes = useMutation({
    mutationFn: (body: VideoResolution) =>
      apiClient.post('/admin/billing/video-pricing/resolutions', body) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: '清晰度已保存。' });
      setResDraft(null);
      invalidate();
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请重试。' }),
  });
  const delRes = useMutation({
    mutationFn: (code: string) =>
      apiClient.delete(`/admin/billing/video-pricing/resolutions/${code}`) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: '清晰度已删除。' });
      invalidate();
    },
  });
  const saveQuality = useMutation({
    mutationFn: (body: QualityProfile) =>
      apiClient.post('/admin/billing/video-pricing/quality-profiles', body) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: '品质档已保存。' });
      setQDraft(null);
      invalidate();
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请重试。' }),
  });

  const base = data?.matrix.base ?? 0;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Film className="h-5 w-5 text-teal-600" />
            视频价格
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            定义「清晰度 / 生成品质」的可选项与会员门槛。每秒积分矩阵由「基础秒价 × 清晰度系数 × 品质系数」自动算出：
            改动基础秒价、清晰度系数或品质系数后，下方矩阵会全量重算同步。最终扣费 = 秒数 × 每秒积分 × 会员系数，向上取整。会员系数在
            <Link
              href="/admin/billing/membership/entitlements"
              className="inline-flex items-center gap-0.5 mx-1 text-teal-600 hover:underline font-medium"
            >
              会员权益
              <ExternalLink className="h-3 w-3" />
            </Link>
            中按档位配置。
          </p>
        </div>

        <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
          {/* 基础秒价（主控：保存后全量重算每秒价矩阵） */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-6 flex-wrap">
            <div>
              <p className="text-xs text-slate-400 mb-1">
                基础秒价（主控 · 保存后重算整个矩阵）
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={baseDraft}
                  onChange={(e) => setBaseDraft(e.target.value)}
                  className="w-28 px-3 py-2 text-2xl font-bold text-slate-900 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <span className="text-sm text-slate-400">积分 / 秒</span>
                <button
                  onClick={() => {
                    setMsg(null);
                    saveBase.mutate(Math.max(0, Math.round(Number(baseDraft) || 0)));
                  }}
                  disabled={saveBase.isPending || baseDraft === String(base)}
                  className="ml-1 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-xs font-medium"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saveBase.isPending ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
            <div className="text-xs text-slate-500 leading-relaxed max-w-md">
              基础秒价是视频计费的主控开关。保存后会按「基础秒价 × 清晰度系数 × 品质系数」
              全量重算下方每秒价矩阵（向上取整），所有依赖它的视频计费随之同步更新。
              <span className="text-amber-600">注意：重算会覆盖单格手工改价。</span>
            </div>
            {data && !data.matrix.enabled && (
              <span className="ml-auto px-2 py-1 rounded bg-amber-50 text-amber-700 text-xs">
                计费总开关已关闭（仅估算，不扣费）
              </span>
            )}
          </div>

          {/* 每秒价矩阵预览（只读，编辑在「步骤价格」） */}
          {data && (
            <PerSecondMatrixPreview
              resolutions={data.resolutions}
              qualities={data.qualityProfiles}
              cells={data.priceCells ?? data.matrix.cells ?? {}}
            />
          )}

          {/* 清晰度 */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mt-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">清晰度（输出规格 · 动态可加 4K）</h2>
              <button
                onClick={() => setResDraft({ ...NEW_RES })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium"
              >
                <Plus className="h-3.5 w-3.5" /> 新增清晰度
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wider">
                  <th className="text-left px-3 py-2 font-medium">Code</th>
                  <th className="text-left px-3 py-2 font-medium">名称</th>
                  <th className="text-left px-3 py-2 font-medium">宽×高</th>
                  <th className="text-left px-3 py-2 font-medium">最低会员</th>
                  <th className="text-center px-3 py-2 font-medium">启用</th>
                  <th className="text-right px-3 py-2 font-medium">排序</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resDraft && (
                  <ResolutionRow
                    row={resDraft}
                    isNew
                    saving={saveRes.isPending}
                    onChange={setResDraft}
                    onSave={() => saveRes.mutate(resDraft)}
                    onCancel={() => setResDraft(null)}
                  />
                )}
                {(data?.resolutions ?? []).map((r) => (
                  <ResolutionRow
                    key={r.code}
                    row={r}
                    saving={saveRes.isPending}
                    onSave={(body) => saveRes.mutate(body)}
                    onDelete={() => delRes.mutate(r.code)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* 品质档 */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mt-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                生成品质（标准 / Ultron）
                <span
                  className="text-slate-400 cursor-help"
                  title="品质档最低会员（sortOrder 门槛）：Ultron 需同时满足「会员权益 → Ultron 模式」开关开启，且会员档位 ≥ 此处设置的最低档位。C 端定价页按两者综合展示。"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </span>
              </h2>
              <button
                onClick={() => setQDraft({ ...NEW_QUALITY })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium"
              >
                <Plus className="h-3.5 w-3.5" /> 新增品质
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wider">
                  <th className="text-left px-3 py-2 font-medium">Code</th>
                  <th className="text-left px-3 py-2 font-medium">名称</th>
                  <th className="text-left px-3 py-2 font-medium">最低会员</th>
                  <th className="text-center px-3 py-2 font-medium">启用</th>
                  <th className="text-right px-3 py-2 font-medium">排序</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {qDraft && (
                  <QualityRow
                    row={qDraft}
                    isNew
                    saving={saveQuality.isPending}
                    onChange={setQDraft}
                    onSave={() => saveQuality.mutate(qDraft)}
                    onCancel={() => setQDraft(null)}
                  />
                )}
                {(data?.qualityProfiles ?? []).map((q) => (
                  <QualityRow
                    key={q.code}
                    row={q}
                    saving={saveQuality.isPending}
                    onSave={(body) => saveQuality.mutate(body)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </QueryState>

        {msg && (
          <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}

function PerSecondMatrixPreview({
  resolutions,
  qualities,
  cells,
}: {
  resolutions: VideoResolution[];
  qualities: QualityProfile[];
  cells: Record<string, number>;
}) {
  const res = [...resolutions].filter((r) => r.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
  const qs = [...qualities].filter((q) => q.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
  if (res.length === 0 || qs.length === 0) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mt-4">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">每秒价矩阵（积分/秒 · 只读）</h2>
        <Link
          href="/admin/billing/step-prices"
          className="inline-flex items-center gap-1 text-xs text-teal-600 hover:underline font-medium"
        >
          去步骤价格编辑
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wider">
            <th className="text-left px-3 py-2 font-medium">清晰度 \ 品质</th>
            {qs.map((q) => (
              <th key={q.code} className="text-right px-3 py-2 font-medium">
                {q.name || q.code}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {res.map((r) => (
            <tr key={r.code}>
              <td className="px-3 py-2.5 text-slate-600 text-xs">{r.name || r.code}</td>
              {qs.map((q) => {
                const v = cells[`${r.code}|${q.code}`];
                return (
                  <td key={q.code} className="px-3 py-2.5 text-right font-medium text-slate-700">
                    {typeof v === 'number' ? v : <span className="text-slate-300">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlanSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select className={INPUT} value={value} onChange={(e) => onChange(e.target.value)}>
      {PLAN_OPTIONS.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}

function ResolutionRow({
  row,
  isNew,
  saving,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  row: VideoResolution;
  isNew?: boolean;
  saving?: boolean;
  onChange?: (r: VideoResolution) => void;
  onSave: (body: VideoResolution) => void;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  const [local, setLocal] = useState(row);
  useEffect(() => setLocal(row), [row]);
  const patch = (p: Partial<VideoResolution>) => {
    const next = { ...local, ...p };
    setLocal(next);
    onChange?.(next);
  };
  return (
    <tr className={cn(isNew && 'bg-teal-50/40')}>
      <td className="px-3 py-2">
        <input className={INPUT} value={local.code} disabled={!isNew} placeholder="4k" onChange={(e) => patch({ code: e.target.value })} />
      </td>
      <td className="px-3 py-2">
        <input className={INPUT} value={local.name} placeholder="4K" onChange={(e) => patch({ name: e.target.value })} />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input type="number" className={INPUT} value={local.width} onChange={(e) => patch({ width: Number(e.target.value) })} />
          <span className="text-slate-300">×</span>
          <input type="number" className={INPUT} value={local.height} onChange={(e) => patch({ height: Number(e.target.value) })} />
        </div>
      </td>
      <td className="px-3 py-2">
        <PlanSelect value={local.minPlan} onChange={(v) => patch({ minPlan: v })} />
      </td>
      <td className="px-3 py-2 text-center">
        <input type="checkbox" checked={local.enabled} onChange={(e) => patch({ enabled: e.target.checked })} className="accent-teal-600" />
      </td>
      <td className="px-3 py-2 text-right">
        <input type="number" className={cn(INPUT, 'text-right w-16')} value={local.sortOrder} onChange={(e) => patch({ sortOrder: Number(e.target.value) })} />
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {isNew && onCancel && (
          <button onClick={onCancel} className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded">取消</button>
        )}
        {!isNew && onDelete && (
          <button onClick={onDelete} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded inline-flex items-center gap-1">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        <button onClick={() => onSave(local)} disabled={saving} className="ml-1 px-2.5 py-1 text-xs rounded bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white inline-flex items-center gap-1">
          <Save className="h-3.5 w-3.5" /> 保存
        </button>
      </td>
    </tr>
  );
}

function QualityRow({
  row,
  isNew,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  row: QualityProfile;
  isNew?: boolean;
  saving?: boolean;
  onChange?: (q: QualityProfile) => void;
  onSave: (body: QualityProfile) => void;
  onCancel?: () => void;
}) {
  const [local, setLocal] = useState(row);
  useEffect(() => setLocal(row), [row]);
  const patch = (p: Partial<QualityProfile>) => {
    const next = { ...local, ...p };
    setLocal(next);
    onChange?.(next);
  };
  return (
    <tr className={cn(isNew && 'bg-teal-50/40')}>
      <td className="px-3 py-2">
        <input className={INPUT} value={local.code} disabled={!isNew} placeholder="director" onChange={(e) => patch({ code: e.target.value })} />
      </td>
      <td className="px-3 py-2">
        <input className={INPUT} value={local.name} placeholder="导演模式" onChange={(e) => patch({ name: e.target.value })} />
      </td>
      <td className="px-3 py-2">
        <PlanSelect value={local.minPlan} onChange={(v) => patch({ minPlan: v })} />
      </td>
      <td className="px-3 py-2 text-center">
        <input type="checkbox" checked={local.enabled} onChange={(e) => patch({ enabled: e.target.checked })} className="accent-teal-600" />
      </td>
      <td className="px-3 py-2 text-right">
        <input type="number" className={cn(INPUT, 'text-right w-16')} value={local.sortOrder} onChange={(e) => patch({ sortOrder: Number(e.target.value) })} />
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {isNew && onCancel && (
          <button onClick={onCancel} className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded">取消</button>
        )}
        <button onClick={() => onSave(local)} disabled={saving} className="ml-1 px-2.5 py-1 text-xs rounded bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white inline-flex items-center gap-1">
          <Save className="h-3.5 w-3.5" /> 保存
        </button>
      </td>
    </tr>
  );
}
