'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Film, Save, Plus, Trash2, HelpCircle } from 'lucide-react';
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
  durationPriceFactor: number;
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
  durationPriceFactor: number;
  minPlan: string;
  providerHint: string;
  enabled: boolean;
  sortOrder: number;
}

interface VideoPricingView {
  resolutions: VideoResolution[];
  qualityProfiles: QualityProfile[];
}

const INPUT =
  'w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50';
const PLAN_OPTIONS = ['free', 'creator', 'pro'];

const NEW_RES: VideoResolution = {
  code: '',
  name: '',
  width: 0,
  height: 0,
  priceFactor: 1,
  durationPriceFactor: 1,
  minPlan: 'free',
  enabled: true,
  sortOrder: 99,
};
const NEW_QUALITY: QualityProfile = {
  code: '',
  name: '',
  description: '',
  priceFactor: 1,
  durationPriceFactor: 1,
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

  const { data, isLoading, isError, error } = useQuery<VideoPricingView>({
    queryKey: ['admin', 'billing', 'video-pricing'],
    queryFn: () => apiClient.get('/admin/billing/video-pricing') as any,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['admin', 'billing', 'video-pricing'] });

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

  return (
    <div className="admin-page">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Film className="h-5 w-5 text-blue-600" />
            清晰度与品质
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            管理 C 端可选的清晰度与生成品质档：输出规格、会员门槛、启用状态与排序。
          </p>
        </div>

        <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
          {/* 清晰度 */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">清晰度（输出规格 · 可新增 4K 等）</h2>
              <button
                onClick={() => setResDraft({ ...NEW_RES })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
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
                  title="Ultron 需同时满足「会员权益 → Ultron 模式」开关开启，且会员档位 ≥ 此处设置的最低档位。"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </span>
              </h2>
              <button
                onClick={() => setQDraft({ ...NEW_QUALITY })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
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
    <tr className={cn(isNew && 'bg-blue-50/40')}>
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
        <input type="checkbox" checked={local.enabled} onChange={(e) => patch({ enabled: e.target.checked })} className="accent-blue-600" />
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
        <button onClick={() => onSave(local)} disabled={saving} className="ml-1 px-2.5 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white inline-flex items-center gap-1">
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
    <tr className={cn(isNew && 'bg-blue-50/40')}>
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
        <input type="checkbox" checked={local.enabled} onChange={(e) => patch({ enabled: e.target.checked })} className="accent-blue-600" />
      </td>
      <td className="px-3 py-2 text-right">
        <input type="number" className={cn(INPUT, 'text-right w-16')} value={local.sortOrder} onChange={(e) => patch({ sortOrder: Number(e.target.value) })} />
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {isNew && onCancel && (
          <button onClick={onCancel} className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded">取消</button>
        )}
        <button onClick={() => onSave(local)} disabled={saving} className="ml-1 px-2.5 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white inline-flex items-center gap-1">
          <Save className="h-3.5 w-3.5" /> 保存
        </button>
      </td>
    </tr>
  );
}
