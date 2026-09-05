'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { SimpleSelect } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { PlanEntitlement } from './types';

const NEW_TAB = '__new__';
const VISIBLE_PLAN_CODES = new Set(['weekly', 'monthly', 'yearly']);
const FIXED_BILLING_CYCLES: Record<string, 'week' | 'month' | 'year'> = {
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

interface PublicPlanCapacity {
  planCode: string;
  mvCapacity: {
    count: number;
    durationSeconds: number;
    creditsPerMv: number;
    label: string;
  } | null;
}

export type PlansSectionVariant = 'full' | 'pricing' | 'entitlements';

const EMPTY_PLAN: Partial<PlanEntitlement> = {
  planCode: '',
  name: '',
  tagline: '',
  weeklyPriceCents: 0,
  monthlyPriceCents: 0,
  yearlyPriceCents: 0,
  availableBillingCycles: ['month'],
  defaultBillingCycle: 'month',
  marketingBadge: 'none',
  weeklyCredits: 0,
  monthlyCredits: 0,
  yearlyCredits: 0,
  creditPurchaseDiscount: 1,
  subscriptionPurchaseDiscount: 1,
  maxConcurrentJobs: 1,
  queuePriority: 10,
  maxResolution: '720p',
  watermarkRequired: true,
  allowUltron: false,
  allowSeedance: false,
  videoPriceCoefficient: 1,
  allowMultiCharacter: false,
  allowCommercialUse: false,
  sortOrder: 0,
  isActive: true,
};

/** 只提交可写字段，避免 id / createdAt 等污染 PATCH */
function planBodyForSave(local: Partial<PlanEntitlement>): Partial<PlanEntitlement> {
  const fixedCycle = FIXED_BILLING_CYCLES[local.planCode?.trim().toLowerCase() ?? ''];
  return {
    planCode: local.planCode,
    name: local.name,
    tagline: local.tagline,
    weeklyPriceCents: local.weeklyPriceCents,
    monthlyPriceCents: local.monthlyPriceCents,
    yearlyPriceCents: local.yearlyPriceCents,
    availableBillingCycles: fixedCycle ? [fixedCycle] : local.availableBillingCycles,
    defaultBillingCycle: fixedCycle ?? local.defaultBillingCycle,
    marketingBadge: local.marketingBadge,
    weeklyCredits: local.weeklyCredits,
    monthlyCredits: local.monthlyCredits,
    yearlyCredits: local.yearlyCredits,
    creditPurchaseDiscount: local.creditPurchaseDiscount,
    subscriptionPurchaseDiscount: local.subscriptionPurchaseDiscount,
    maxConcurrentJobs: local.maxConcurrentJobs,
    queuePriority: local.queuePriority,
    maxResolution: local.maxResolution,
    watermarkRequired: local.watermarkRequired,
    allowUltron: local.allowUltron,
    allowSeedance: local.allowSeedance,
    videoPriceCoefficient: local.videoPriceCoefficient,
    allowMultiCharacter: local.allowMultiCharacter,
    allowCommercialUse: local.allowCommercialUse,
    stripePriceId: local.stripePriceId,
    stripeWeeklyPriceId: local.stripeWeeklyPriceId,
    stripeWeeklyCouponId: local.stripeWeeklyCouponId,
    stripeCouponId: local.stripeCouponId,
    stripeYearlyPriceId: local.stripeYearlyPriceId,
    stripeYearlyCouponId: local.stripeYearlyCouponId,
    sortOrder: local.sortOrder,
    isActive: local.isActive,
  };
}

function saveErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (Array.isArray(msg) && msg.length > 0) return msg.join('，');
  }
  return '保存失败，请稍后再试';
}

const SECTION_TITLE: Record<PlansSectionVariant, string> = {
  full: '会员计划',
  pricing: '会员套餐',
  entitlements: '会员权益',
};

export function PlansSection({
  variant = 'full',
  showHeader = true,
}: {
  variant?: PlansSectionVariant;
  showHeader?: boolean;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Partial<PlanEntitlement> | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | 'new' | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  // 会员档通常很少，一次拉全量做 Tab；不做分页
  const { data, isLoading, isError, error } = useQuery<{
    items: PlanEntitlement[];
    total: number;
  }>({
    queryKey: ['admin', 'billing', 'plans', 'all'],
    queryFn: () =>
      apiClient.get('/admin/billing/plans?page=1&pageSize=100') as any,
  });
  const { data: publicPlans } = useQuery<PublicPlanCapacity[]>({
    queryKey: ['billing', 'public-plans'],
    queryFn: () => apiClient.get('/billing/plans') as any,
  });

  const plans = useMemo(
    () =>
      [...(data?.items ?? [])]
        .filter((plan) => VISIBLE_PLAN_CODES.has(plan.planCode.trim().toLowerCase()))
        .sort(
          (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.planCode.localeCompare(b.planCode),
        ),
    [data],
  );

  // 列表变化时校正 activeTab（删除/首载）
  useEffect(() => {
    if (draft) {
      setActiveTab(NEW_TAB);
      return;
    }
    if (!plans.length) {
      setActiveTab(null);
      return;
    }
    setActiveTab((prev) => {
      if (prev && prev !== NEW_TAB && plans.some((p) => p.id === prev)) return prev;
      return plans[0].id;
    });
  }, [plans, draft]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'billing', 'plans'] });
    void qc.invalidateQueries({ queryKey: ['billing', 'public-plans'] });
  };

  const create = useMutation({
    mutationFn: (body: Partial<PlanEntitlement>) =>
      apiClient.post('/admin/billing/plans', planBodyForSave(body)) as any,
    onMutate: () => setSavingId('new'),
    onSuccess: (created: PlanEntitlement) => {
      setDraft(null);
      if (created?.id) setActiveTab(created.id);
      setToast({ ok: true, text: '计划已创建' });
      invalidate();
    },
    onError: (e) => setToast({ ok: false, text: saveErrorMessage(e) }),
    onSettled: () => setSavingId(null),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<PlanEntitlement> }) =>
      apiClient.patch(`/admin/billing/plans/${id}`, planBodyForSave(body)) as any,
    onMutate: ({ id }) => setSavingId(id),
    onSuccess: () => {
      setToast({ ok: true, text: '已保存' });
      invalidate();
    },
    onError: (e) => setToast({ ok: false, text: saveErrorMessage(e) }),
    onSettled: () => setSavingId(null),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/billing/plans/${id}`) as any,
    onSuccess: (_res, id) => {
      setActiveTab((prev) => {
        if (prev !== id) return prev;
        const rest = plans.filter((p) => p.id !== id);
        return rest[0]?.id ?? null;
      });
      invalidate();
    },
  });

  const activePlan =
    activeTab && activeTab !== NEW_TAB
      ? plans.find((p) => p.id === activeTab) ?? null
      : null;

  const startCreate = () => {
    setDraft({ ...EMPTY_PLAN });
    setActiveTab(NEW_TAB);
  };

  const cancelCreate = () => {
    setDraft(null);
    setActiveTab(plans[0]?.id ?? null);
  };

  return (
    <section>
      <div className={cn('mb-3', showHeader ? 'flex items-center justify-between' : 'flex justify-end')}>
        {showHeader && (
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {SECTION_TITLE[variant]}
          </h2>
        )}
        <button
          type="button"
          onClick={startCreate}
          disabled={!!draft}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> 新建计划
        </button>
      </div>
      {toast && (
        <p
          className={cn(
            'mb-3 text-xs font-medium',
            toast.ok ? 'text-emerald-600' : 'text-red-500',
          )}
        >
          {toast.text}
        </p>
      )}
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-32">
        {plans.length === 0 && !draft ? (
          <p className="py-8 text-center text-sm text-slate-400">暂无计划</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-end gap-1 border-b border-slate-200 bg-slate-50/80 px-3 pt-2">
              {plans.map((plan) => {
                const selected = activeTab === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => {
                      if (draft) setDraft(null);
                      setActiveTab(plan.id);
                    }}
                    className={cn(
                      'relative -mb-px inline-flex items-center gap-1.5 rounded-t-xl px-3.5 py-2.5 text-sm transition-colors',
                      selected
                        ? 'bg-white font-semibold text-blue-600'
                        : 'font-medium text-slate-500 hover:bg-white/70 hover:text-slate-800',
                    )}
                  >
                    <span className="max-w-[140px] truncate">{plan.name || plan.planCode}</span>
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        plan.isActive ? 'bg-emerald-500' : 'bg-slate-300',
                      )}
                      title={plan.isActive ? '已启用' : '已停用'}
                    />
                    {selected && (
                      <span className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-blue-600" />
                    )}
                  </button>
                );
              })}
              {draft && (
                <button
                  type="button"
                  onClick={() => setActiveTab(NEW_TAB)}
                  className={cn(
                    'relative -mb-px inline-flex items-center gap-1.5 rounded-t-xl px-3.5 py-2.5 text-sm',
                    activeTab === NEW_TAB
                      ? 'bg-white font-semibold text-blue-600'
                      : 'font-medium text-slate-500',
                  )}
                >
                  新建计划
                  {activeTab === NEW_TAB && (
                    <span className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-blue-600" />
                  )}
                </button>
              )}
            </div>

            <div className="p-0">
              {draft && activeTab === NEW_TAB && (
                <PlanCard
                  plan={draft}
                  variant={variant}
                  isNew
                  embedded
                  saving={savingId === 'new'}
                  onSave={() => create.mutate(draft)}
                  onCancel={cancelCreate}
                  onChange={setDraft}
                />
              )}
              {activePlan && (
                <PlanCard
                  key={activePlan.id}
                  plan={activePlan}
                  variant={variant}
                  embedded
                  mvCapacity={
                    publicPlans?.find((item) => item.planCode === activePlan.planCode)
                      ?.mvCapacity ?? null
                  }
                  saving={savingId === activePlan.id}
                  onSave={(body) => update.mutate({ id: activePlan.id, body })}
                  onDelete={
                    variant === 'full' || variant === 'pricing'
                      ? () => remove.mutate(activePlan.id)
                      : undefined
                  }
                />
              )}
            </div>
          </div>
        )}
      </QueryState>
    </section>
  );
}

function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/40 px-4 py-3">
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h3>
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  );
}

function PlanCard({
  plan,
  variant,
  isNew,
  embedded,
  saving,
  onSave,
  onCancel,
  onDelete,
  onChange,
  mvCapacity,
}: {
  plan: Partial<PlanEntitlement>;
  variant: PlansSectionVariant;
  isNew?: boolean;
  /** 嵌在 Tab 容器内时去掉外层边框，避免双层卡片 */
  embedded?: boolean;
  saving?: boolean;
  onSave: (body: Partial<PlanEntitlement>) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onChange?: (p: Partial<PlanEntitlement>) => void;
  mvCapacity?: PublicPlanCapacity['mvCapacity'];
}) {
  const [local, setLocal] = useState<Partial<PlanEntitlement>>(plan);
  useEffect(() => setLocal(plan), [plan]);

  const dirty = JSON.stringify(planBodyForSave(local)) !== JSON.stringify(planBodyForSave(plan));

  const patch = (p: Partial<PlanEntitlement>) => {
    const next = { ...local, ...p };
    setLocal(next);
    onChange?.(next);
  };

  const showPricing = variant === 'full' || variant === 'pricing';
  const showEntitlements = variant === 'full' || variant === 'entitlements';
  const showIdentity =
    variant === 'full' || variant === 'pricing' || (variant === 'entitlements' && isNew);
  const active = local.isActive ?? true;
  const billingCycle = FIXED_BILLING_CYCLES[
    local.planCode?.trim().toLowerCase() ?? ''
  ] ?? 'month';
  const hasWeekly = billingCycle === 'week';
  const hasMonthly = billingCycle === 'month';
  const hasYearly = billingCycle === 'year';

  return (
    <div
      className={cn(
        'overflow-hidden bg-white',
        embedded
          ? ''
          : cn(
              'rounded-2xl border shadow-sm',
              isNew ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200',
            ),
      )}
    >
      {/* 卡片头：名称 + 启用开关 */}
      <div
        className={cn(
          'flex items-center justify-between gap-4 border-b px-5 py-4',
          active
            ? 'border-emerald-100 bg-gradient-to-r from-emerald-50/80 to-white'
            : 'border-slate-100 bg-gradient-to-r from-slate-50 to-white',
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-slate-900">
              {isNew ? '新建会员计划' : local.name || '未命名计划'}
            </p>
            {!isNew && local.planCode && (
              <span className="rounded-md bg-white/80 px-1.5 py-0.5 font-mono text-[11px] text-slate-500 ring-1 ring-slate-200">
                {local.planCode}
              </span>
            )}
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600',
              )}
            >
              {active ? '已启用' : '已停用'}
            </span>
            {isNew && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                草稿
              </span>
            )}
          </div>
          {!isNew && mvCapacity && (
            <p className="mt-1 text-xs text-emerald-700">
              C 端产能：{mvCapacity.label}
              <span className="text-emerald-600/70">
                {' '}
                · 约 {mvCapacity.creditsPerMv} 积分 / 个
              </span>
            </p>
          )}
        </div>
        <Switch
          checked={active}
          onChange={(v) => patch({ isActive: v })}
          label="启用计划"
          size="lg"
        />
      </div>

      <div className="space-y-3 px-5 py-4">
        {showIdentity && (
          <FieldGroup title="基础信息">
            <FormField label="Plan Code" description={isNew ? '创建后不可修改，建议用小写英文。' : '唯一标识，不可修改。'}>
              <Input
                size="sm"
                mono
                value={local.planCode ?? ''}
                disabled={!isNew}
                placeholder="creator"
                onChange={(e) => patch({ planCode: e.target.value })}
              />
            </FormField>
            <FormField label="显示名称" description="前台与后台展示用的套餐名。">
              <Input
                size="sm"
                value={local.name ?? ''}
                disabled={variant === 'entitlements' && !isNew}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </FormField>
            <FormField label="一句话定位" description="定价页套餐名称下方的用户定位文案。">
              <Input
                size="sm"
                value={local.tagline ?? ''}
                placeholder="例如：1080P 电影感 MV 的主力创作方案"
                onChange={(e) => patch({ tagline: e.target.value })}
              />
            </FormField>
          </FieldGroup>
        )}

        {showPricing && (
          <>
          <FieldGroup title="售卖方式与营销展示">
            <FormField label="套餐徽标" description="由后台控制最受欢迎和最佳性价比，不再依赖 Plan Code。">
              <SimpleSelect
                size="sm"
                value={local.marketingBadge ?? 'none'}
                onValueChange={(value) => patch({ marketingBadge: value as 'none' | 'popular' | 'best_value' })}
                options={[
                  { value: 'none', label: '无徽标' },
                  { value: 'popular', label: '最受欢迎' },
                  { value: 'best_value', label: '最佳性价比' },
                ]}
              />
            </FormField>
          </FieldGroup>
          <FieldGroup title="价格、积分与折扣">
            {hasWeekly && <FormField label="周费" description="周付订阅每周收取的原价。">
              <NumberInput
                size="sm"
                unit="USD"
                min={0}
                step={0.01}
                value={(local.weeklyPriceCents ?? 0) / 100}
                onChange={(n) => patch({ weeklyPriceCents: Math.round(n * 100) })}
              />
            </FormField>}
            {hasMonthly && <FormField label="月费" description="月付订阅每月收取的原价。">
              <NumberInput
                size="sm"
                unit="USD"
                min={0}
                step={0.01}
                value={(local.monthlyPriceCents ?? 0) / 100}
                onChange={(n) => patch({ monthlyPriceCents: Math.round(n * 100) })}
              />
            </FormField>}
            {hasYearly && <FormField label="年费" description="年付订阅每年一次性收取的原价。">
              <NumberInput
                size="sm"
                unit="USD"
                min={0}
                step={0.01}
                value={(local.yearlyPriceCents ?? 0) / 100}
                onChange={(n) => patch({ yearlyPriceCents: Math.round(n * 100) })}
              />
            </FormField>}
            {hasWeekly && <FormField label="Stripe 周付 Price ID" description="对应 interval=week；正式环境建议填写固定原价 Price ID。">
              <Input
                size="sm"
                mono
                value={local.stripeWeeklyPriceId ?? ''}
                placeholder="price_..."
                onChange={(e) => patch({ stripeWeeklyPriceId: e.target.value.trim() || null })}
              />
            </FormField>}
            {hasWeekly && <FormField label="首期优惠 Coupon ID" description="折扣比例动态读取 Stripe Coupon 的 percent_off；关闭购买弹窗并接受优惠后应用。必须为 Duration=Once。">
              <Input
                size="sm"
                mono
                value={local.stripeWeeklyCouponId ?? ''}
                placeholder="coupon_... 或自定义 Coupon ID"
                onChange={(e) => patch({ stripeWeeklyCouponId: e.target.value.trim() || null })}
              />
            </FormField>}
            {hasMonthly && <FormField label="Stripe 月付 Price ID" description="对应 interval=month；填写固定原价 Price ID。">
              <Input
                size="sm"
                mono
                value={local.stripePriceId ?? ''}
                placeholder="price_..."
                onChange={(e) => patch({ stripePriceId: e.target.value.trim() || null })}
              />
            </FormField>}
            {hasMonthly && <FormField label="首期优惠 Coupon ID" description="折扣比例动态读取 Stripe Coupon 的 percent_off；关闭购买弹窗并接受优惠后应用。必须为 Duration=Once。">
              <Input
                size="sm"
                mono
                value={local.stripeCouponId ?? ''}
                placeholder="coupon_... 或自定义 Coupon ID"
                onChange={(e) => patch({ stripeCouponId: e.target.value.trim() || null })}
              />
            </FormField>}
            {hasYearly && <FormField label="Stripe 年付 Price ID" description="对应 interval=year；填写固定原价 Price ID。">
              <Input
                size="sm"
                mono
                value={local.stripeYearlyPriceId ?? ''}
                placeholder="price_..."
                onChange={(e) => patch({ stripeYearlyPriceId: e.target.value.trim() || null })}
              />
            </FormField>}
            {hasYearly && <FormField label="首期优惠 Coupon ID" description="折扣比例动态读取 Stripe Coupon 的 percent_off；关闭购买弹窗并接受优惠后应用。必须为 Duration=Once。">
              <Input
                size="sm"
                mono
                value={local.stripeYearlyCouponId ?? ''}
                placeholder="coupon_... 或自定义 Coupon ID"
                onChange={(e) => patch({ stripeYearlyCouponId: e.target.value.trim() || null })}
              />
            </FormField>}
            {hasWeekly && <FormField label="周度赠送积分" description="周付订阅每次成功扣款后发放。">
              <NumberInput
                size="sm"
                unit="积分"
                min={0}
                value={local.weeklyCredits ?? 0}
                onChange={(n) => patch({ weeklyCredits: Math.round(n) })}
              />
            </FormField>}
            {hasMonthly && <FormField label="月度赠送积分" description="月付订阅每次成功扣款后发放。">
              <NumberInput
                size="sm"
                unit="积分"
                min={0}
                value={local.monthlyCredits ?? 0}
                onChange={(n) => patch({ monthlyCredits: Math.round(n) })}
              />
            </FormField>}
            {hasYearly && <FormField label="年度赠送积分" description="年付成功后一次性发放全年额度。">
              <NumberInput
                size="sm"
                unit="积分"
                min={0}
                value={local.yearlyCredits ?? 0}
                onChange={(n) => patch({ yearlyCredits: Math.round(n) })}
              />
            </FormField>}
            {(variant === 'pricing' || variant === 'full') && (
              <FormField label="排序" description="越小越靠前。">
                <NumberInput
                  size="sm"
                  value={local.sortOrder ?? 0}
                  onChange={(n) => patch({ sortOrder: Math.round(n) })}
                />
              </FormField>
            )}
          </FieldGroup>
          </>
        )}

        {showEntitlements && (
          <>
            {variant === 'entitlements' && (
              <FieldGroup title="额度与折扣">
                {hasWeekly && <FormField
                  label="周度赠送积分"
                  description="周付订阅每次成功扣款后发放。"
                >
                  <NumberInput
                    size="sm"
                    unit="积分"
                    min={0}
                    value={local.weeklyCredits ?? 0}
                    onChange={(n) => patch({ weeklyCredits: Math.round(n) })}
                  />
                </FormField>}
                {hasMonthly && <FormField
                  label="月度赠送积分"
                  description="0 = C 端不展示；订阅续费仍按此值发放。"
                >
                  <NumberInput
                    size="sm"
                    unit="积分"
                    min={0}
                    value={local.monthlyCredits ?? 0}
                    onChange={(n) => patch({ monthlyCredits: Math.round(n) })}
                  />
                </FormField>}
                {hasYearly && <FormField
                  label="年度赠送积分"
                  description="年付成功后一次性发放全年额度。"
                >
                  <NumberInput
                    size="sm"
                    unit="积分"
                    min={0}
                    value={local.yearlyCredits ?? 0}
                    onChange={(n) => patch({ yearlyCredits: Math.round(n) })}
                  />
                </FormField>}
              </FieldGroup>
            )}

            <FieldGroup title="产能与队列">
              <FormField label="同时合成任务上限" description="只限制最终成片合成任务，不限制 AI 图片或视频生成任务。">
                <NumberInput
                  size="sm"
                  unit="路"
                  min={1}
                  value={local.maxConcurrentJobs ?? 1}
                  onChange={(n) => patch({ maxConcurrentJobs: Math.max(1, Math.round(n)) })}
                />
              </FormField>
              <FormField label="成片合成队列优先级" description="只作用于合成队列，数值越小优先级越高。">
                <NumberInput
                  size="sm"
                  value={local.queuePriority ?? 10}
                  onChange={(n) => patch({ queuePriority: Math.round(n) })}
                />
              </FormField>
            </FieldGroup>
          </>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
        {isNew && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100"
          >
            取消
          </button>
        )}
        {!isNew && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="mr-auto inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-red-500 transition-colors hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> 删除
          </button>
        )}
        <button
          type="button"
          onClick={() => onSave(local)}
          disabled={saving || (!isNew && !dirty)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saving ? '保存中…' : dirty || isNew ? '保存' : '已保存'}
        </button>
      </div>
    </div>
  );
}
