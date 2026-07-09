'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Film, Save, Sparkles, ExternalLink } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PricingConfigView } from './types';

interface DurationPricingTopProps {
  profitFactor: number;
  minChargeCredits: number;
  baseCreditsPerSecond: number;
  aiRecommendCredits: number;
  onConfigSaved?: (view: PricingConfigView) => void;
}

export function DurationPricingTop({
  profitFactor,
  baseCreditsPerSecond,
  onConfigSaved,
}: DurationPricingTopProps) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [baseDraft, setBaseDraft] = useState(String(baseCreditsPerSecond));

  useEffect(() => {
    setBaseDraft(String(baseCreditsPerSecond));
  }, [baseCreditsPerSecond]);

  const saveConfig = useMutation({
    mutationFn: (payload: Record<string, number | string>) =>
      apiClient.patch('/admin/billing/pricing-config', payload) as Promise<PricingConfigView>,
    onSuccess: (res) => {
      setMsg({ ok: true, text: '整片估算秒价已保存。' });
      qc.setQueryData(['admin', 'billing', 'pricing-config'], res);
      onConfigSaved?.(res);
      qc.invalidateQueries({ queryKey: ['admin', 'billing', 'step-prices'] });
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请重试。' }),
  });

  const base = Math.max(0, Math.round(Number(baseDraft) || 0));

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-9 w-9 rounded-xl bg-teal-600 flex items-center justify-center flex-shrink-0">
          <Film className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">创建估算 · 整片秒价</h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            用于创建页「~N 积分」展示与余额预检（创建时不实扣）。公式：时长 × 基础秒价 × 盈利系数 × 清晰度 × 品质 × 会员系数。
            各步骤完成后按「步骤价格」实扣。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-4">
          <p className="text-sm font-medium text-slate-700">整片基础秒价</p>
          <p className="text-[11px] text-slate-400 mt-1">
            720p · 标准品质 · 普通会员的基准（积分/秒，盈利系数前）
          </p>
          <div className="flex items-center gap-2 mt-3">
            <input
              type="number"
              min={0}
              step={1}
              value={baseDraft}
              onChange={(e) => setBaseDraft(e.target.value)}
              className="flex-1 px-3 py-2 text-2xl font-bold text-slate-900 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <span className="text-xs text-slate-400 flex-shrink-0">基础积分/秒</span>
          </div>
          {base > 0 && (
            <p className="mt-2 text-xs text-teal-700/90">
              估算秒价 = {base} × {profitFactor} ={' '}
              <span className="font-semibold">{base * profitFactor}</span> 积分/秒
            </p>
          )}
          <button
            type="button"
            disabled={saveConfig.isPending || baseDraft === String(baseCreditsPerSecond)}
            onClick={() => {
              setMsg(null);
              saveConfig.mutate({
                mvDurationBaseCreditsPerSecond: base,
              });
            }}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-xs font-medium"
          >
            <Save className="h-3.5 w-3.5" />
            {saveConfig.isPending ? '保存中…' : '保存基础秒价'}
          </button>
        </div>

        <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <p className="text-sm font-medium text-slate-700">AI 风格推荐</p>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            单价已迁移至
            <Link
              href="/admin/billing/step-prices"
              className="inline-flex items-center gap-0.5 mx-1 text-violet-700 font-medium underline"
            >
              步骤价格 · AI 推荐方向
              <ExternalLink className="h-3 w-3" />
            </Link>
            。用户点击推荐时实扣；手动选风格不计入创建估算。
          </p>
        </div>
      </div>

      {msg && (
        <p className={cn('text-xs font-medium mt-3', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
