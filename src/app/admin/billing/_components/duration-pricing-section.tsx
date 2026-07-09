'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calculator, Film } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import type { PlanEntitlement, PricingConfigView } from './types';
import { DecimalFactorInput } from './decimal-factor-input';

interface VideoResolution {
  id?: string;
  code: string;
  name: string;
  width: number;
  height: number;
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
  durationPriceFactor: number;
  minPlan: string;
  enabled: boolean;
  sortOrder: number;
}

interface VideoPricingView {
  resolutions: VideoResolution[];
  qualityProfiles: QualityProfile[];
}

const INPUT =
  'w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white';

function estimateCredits(params: {
  seconds: number;
  base: number;
  resolutionFactor: number;
  qualityFactor: number;
  memberFactor: number;
  minCharge: number;
}): { credits: number; creditsPerSecond: number } {
  const creditsPerSecond = params.base * params.resolutionFactor * params.qualityFactor;
  const raw = params.seconds * creditsPerSecond * params.memberFactor;
  const credits = raw > 0 ? Math.max(params.minCharge, Math.ceil(raw)) : 0;
  return { credits, creditsPerSecond };
}

export function DurationPricingSection({ profitFactor }: { profitFactor: number }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [estSeconds, setEstSeconds] = useState(90);
  const [estResolution, setEstResolution] = useState('720p');
  const [estQuality, setEstQuality] = useState('standard');
  const [estPlanCode, setEstPlanCode] = useState('free');

  const { data: pricingConfig, isLoading: cfgLoading } = useQuery<PricingConfigView>({
    queryKey: ['admin', 'billing', 'pricing-config'],
    queryFn: () => apiClient.get('/admin/billing/pricing-config') as any,
  });

  const { data: videoPricing, isLoading: vpLoading, isError, error } = useQuery<VideoPricingView>({
    queryKey: ['admin', 'billing', 'video-pricing'],
    queryFn: () => apiClient.get('/admin/billing/video-pricing') as any,
  });

  const { data: plansData } = useQuery<{ items: PlanEntitlement[] }>({
    queryKey: ['admin', 'billing', 'plans', 1],
    queryFn: () => apiClient.get('/admin/billing/plans?page=1&pageSize=50') as any,
  });

  const baseParam = pricingConfig?.params.find((p) => p.key === 'mvDurationBaseCreditsPerSecond');
  const minChargeParam = pricingConfig?.params.find((p) => p.key === 'minChargeCredits');

  const resolutions = useMemo(
    () =>
      [...(videoPricing?.resolutions ?? [])]
        .filter((r) => r.enabled)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [videoPricing?.resolutions],
  );

  const qualities = useMemo(
    () =>
      [...(videoPricing?.qualityProfiles ?? [])]
        .filter((q) => q.enabled)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [videoPricing?.qualityProfiles],
  );

  const plans = useMemo(
    () =>
      [...(plansData?.items ?? [])]
        .filter((p) => p.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [plansData?.items],
  );

  useEffect(() => {
    if (resolutions.length && !resolutions.some((r) => r.code === estResolution)) {
      setEstResolution(resolutions[0].code);
    }
  }, [resolutions, estResolution]);

  useEffect(() => {
    if (qualities.length && !qualities.some((q) => q.code === estQuality)) {
      setEstQuality(qualities[0].code);
    }
  }, [qualities, estQuality]);

  useEffect(() => {
    if (plans.length && !plans.some((p) => p.planCode === estPlanCode)) {
      setEstPlanCode(plans[0].planCode);
    }
  }, [plans, estPlanCode]);

  const saveResolution = useMutation({
    mutationFn: (body: VideoResolution) =>
      apiClient.post('/admin/billing/video-pricing/resolutions', body) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: '清晰度系数已保存。' });
      qc.invalidateQueries({ queryKey: ['admin', 'billing', 'video-pricing'] });
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请重试。' }),
  });

  const saveQuality = useMutation({
    mutationFn: (body: QualityProfile) =>
      apiClient.post('/admin/billing/video-pricing/quality-profiles', body) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: '品质系数已保存。' });
      qc.invalidateQueries({ queryKey: ['admin', 'billing', 'video-pricing'] });
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请重试。' }),
  });

  const savePlan = useMutation({
    mutationFn: ({ id, videoPriceCoefficient }: { id: string; videoPriceCoefficient: number }) =>
      apiClient.patch(`/admin/billing/plans/${id}`, { videoPriceCoefficient }) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: '会员系数已保存。' });
      qc.invalidateQueries({ queryKey: ['admin', 'billing', 'plans'] });
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请重试。' }),
  });

  const base = Math.max(0, Math.round(Number(baseParam?.value ?? 0)));
  const effectiveBase = base * profitFactor;
  const minCharge = Math.max(0, Math.round(Number(minChargeParam?.value ?? 1)));

  const estResRow = resolutions.find((r) => r.code === estResolution);
  const estQualRow = qualities.find((q) => q.code === estQuality);
  const estPlan = plans.find((p) => p.planCode === estPlanCode);

  const estimate = estimateCredits({
    seconds: Math.max(0, Math.round(estSeconds)),
    base: effectiveBase,
    resolutionFactor: estResRow?.durationPriceFactor ?? 1,
    qualityFactor: estQualRow?.durationPriceFactor ?? 1,
    memberFactor: estPlan?.videoPriceCoefficient ?? 1,
    minCharge,
  });

  const isLoading =
    (cfgLoading && !pricingConfig) || (vpLoading && !videoPricing);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mt-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Film className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">整片按时长定价</h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            MV 创建时按「时长 × 基础秒价 × 盈利系数 × 清晰度系数 × 品质系数 × 会员系数」一次性扣费。
            规划 / 故事板 / 视频各步不再单独计费；创建前的 AI 风格推荐可单独定价。
            需新增 4K 等输出规格时，请到
            <a href="/admin/billing/video-pricing" className="text-blue-600 hover:underline mx-0.5">
              清晰度与品质
            </a>
            页管理。
          </p>
        </div>
      </div>

      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-32">
        {/* 系数表 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
          <FactorTable
            title="清晰度系数"
            subtitle="相对基础秒价的乘数"
            rows={resolutions.map((r) => ({
              key: r.code,
              label: r.name || r.code,
              factor: r.durationPriceFactor,
              meta: r,
            }))}
            saving={saveResolution.isPending}
            onSave={(key, factor) => {
              const row = videoPricing?.resolutions.find((r) => r.code === key);
              if (!row) return;
              setMsg(null);
              saveResolution.mutate({ ...row, durationPriceFactor: factor });
            }}
          />
          <FactorTable
            title="品质系数"
            subtitle="标准 / Ultron 等品质档"
            rows={qualities.map((q) => ({
              key: q.code,
              label: q.name || q.code,
              factor: q.durationPriceFactor,
              meta: q,
            }))}
            saving={saveQuality.isPending}
            onSave={(key, factor) => {
              const row = videoPricing?.qualityProfiles.find((q) => q.code === key);
              if (!row) return;
              setMsg(null);
              saveQuality.mutate({ ...row, durationPriceFactor: factor });
            }}
          />
        </div>

        {/* 会员系数 */}
        <div className="rounded-xl border border-slate-100 overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80">
            <p className="text-sm font-medium text-slate-700">会员系数</p>
            <p className="text-[11px] text-slate-400 mt-0.5">1 = 原价，0.9 = 九折</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-slate-400 uppercase tracking-wider">
                <th className="text-left px-4 py-2 font-medium">会员档</th>
                <th className="text-right px-4 py-2 font-medium w-32">系数</th>
                <th className="px-4 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plans.map((plan) => (
                <MemberFactorRow
                  key={plan.id}
                  plan={plan}
                  saving={savePlan.isPending}
                  onSave={(factor) => {
                    setMsg(null);
                    savePlan.mutate({ id: plan.id, videoPriceCoefficient: factor });
                  }}
                />
              ))}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-xs text-slate-400 text-center">
                    暂无会员计划
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 实时预估 */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-semibold text-slate-700">价格预估器</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <label className="block">
              <span className="text-[11px] text-slate-500">时长（秒）</span>
              <input
                type="number"
                min={1}
                value={estSeconds}
                onChange={(e) => setEstSeconds(Number(e.target.value))}
                className={cn(INPUT, 'mt-1')}
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500">清晰度</span>
              <select
                value={estResolution}
                onChange={(e) => setEstResolution(e.target.value)}
                className={cn(INPUT, 'mt-1')}
              >
                {resolutions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name || r.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500">品质</span>
              <select
                value={estQuality}
                onChange={(e) => setEstQuality(e.target.value)}
                className={cn(INPUT, 'mt-1')}
              >
                {qualities.map((q) => (
                  <option key={q.code} value={q.code}>
                    {q.name || q.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500">会员档</span>
              <select
                value={estPlanCode}
                onChange={(e) => setEstPlanCode(e.target.value)}
                className={cn(INPUT, 'mt-1')}
              >
                {plans.map((p) => (
                  <option key={p.planCode} value={p.planCode}>
                    {p.name || p.planCode}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="rounded-lg bg-white border border-slate-100 p-3 text-xs text-slate-600 leading-relaxed space-y-1">
            <p>
              每秒价 = {base} × {profitFactor} × {estResRow?.durationPriceFactor ?? 1} × {estQualRow?.durationPriceFactor ?? 1} ={' '}
              <span className="font-mono font-semibold text-slate-800">{estimate.creditsPerSecond}</span> 积分/秒
            </p>
            <p>
              总价 = ceil({estSeconds}s × {estimate.creditsPerSecond} × {estPlan?.videoPriceCoefficient ?? 1}) ={' '}
              <span className="text-lg font-bold text-blue-700">{estimate.credits}</span> 积分
              {estimate.credits === minCharge && estSeconds > 0 && (
                <span className="text-slate-400 ml-1">（触达最低收费 {minCharge}）</span>
              )}
            </p>
          </div>
        </div>

        {/* 组合价矩阵预览 */}
        {resolutions.length > 0 && qualities.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/80">
              <p className="text-xs font-medium text-slate-600">
                每秒价矩阵（基础 {base} × 盈利系数 {profitFactor} = {effectiveBase} 积分/秒 · 不含会员系数）
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-slate-400 uppercase">
                  <th className="text-left px-3 py-2">清晰度 \ 品质</th>
                  {qualities.map((q) => (
                    <th key={q.code} className="text-right px-3 py-2">
                      {q.name || q.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resolutions.map((r) => (
                  <tr key={r.code}>
                    <td className="px-3 py-2 text-slate-600 text-xs">{r.name || r.code}</td>
                    {qualities.map((q) => {
                      const cps = effectiveBase * r.durationPriceFactor * q.durationPriceFactor;
                      return (
                        <td key={q.code} className="px-3 py-2 text-right font-medium text-slate-700">
                          {cps}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>

      {msg && (
        <p className={cn('text-xs font-medium mt-3', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

function FactorTable({
  title,
  subtitle,
  rows,
  saving,
  onSave,
}: {
  title: string;
  subtitle: string;
  rows: Array<{ key: string; label: string; factor: number }>;
  saving?: boolean;
  onSave: (key: string, factor: number) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <p className="text-[11px] text-slate-400">{subtitle}</p>
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <FactorRow key={row.key} row={row} saving={saving} onSave={onSave} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FactorRow({
  row,
  saving,
  onSave,
}: {
  row: { key: string; label: string; factor: number };
  saving?: boolean;
  onSave: (key: string, factor: number) => void;
}) {
  return (
    <tr>
      <td className="px-4 py-2.5 text-slate-700">{row.label}</td>
      <td colSpan={2} className="px-4 py-2.5 text-right">
        <DecimalFactorInput
          value={Number(row.factor) || 0}
          saving={saving}
          onSave={(factor) => onSave(row.key, factor)}
          className="justify-end"
          inputClassName={cn(INPUT, 'w-20 text-right')}
        />
      </td>
    </tr>
  );
}

function MemberFactorRow({
  plan,
  saving,
  onSave,
}: {
  plan: PlanEntitlement;
  saving?: boolean;
  onSave: (factor: number) => void;
}) {
  return (
    <tr>
      <td className="px-4 py-2.5">
        <span className="text-slate-700">{plan.name}</span>
        <span className="text-xs text-slate-400 ml-2 font-mono">{plan.planCode}</span>
      </td>
      <td colSpan={2} className="px-4 py-2.5 text-right">
        <DecimalFactorInput
          value={Number(plan.videoPriceCoefficient ?? 1) || 1}
          saving={saving}
          onSave={onSave}
          className="justify-end"
          inputClassName={cn(INPUT, 'w-24 text-right')}
        />
      </td>
    </tr>
  );
}
