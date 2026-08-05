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
import { DecimalFieldInput } from './decimal-factor-input';
import type { PlanEntitlement } from './types';

const NEW_TAB = '__new__';

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
  monthlyPriceCents: 0,
  monthlyCredits: 0,
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

const RESOLUTION_OPTIONS = [
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
];

/** 折扣/系数输入：复用 Input 视觉 */
const DECIMAL_INPUT_CLS = cn(
  'w-full border bg-white text-slate-800',
  'rounded-[10px] border-slate-200/90',
  'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
  'transition-[border-color,box-shadow,background-color] duration-150',
  'hover:border-slate-300 hover:bg-slate-50/70',
  'focus:outline-none focus-visible:border-blue-400 focus-visible:ring-[3px] focus-visible:ring-blue-500/15',
  'h-8 px-2.5 text-xs text-right',
);

/** 只提交可写字段，避免 id / createdAt 等污染 PATCH */
function planBodyForSave(local: Partial<PlanEntitlement>): Partial<PlanEntitlement> {
  return {
    planCode: local.planCode,
    name: local.name,
    monthlyPriceCents: local.monthlyPriceCents,
    monthlyCredits: local.monthlyCredits,
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
      [...(data?.items ?? [])].sort(
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
          </FieldGroup>
        )}

        {showPricing && (
          <FieldGroup title="价格与折扣">
            <FormField label="月费" description="订阅月价格，单位美元。">
              <NumberInput
                size="sm"
                unit="USD"
                min={0}
                step={0.01}
                value={(local.monthlyPriceCents ?? 0) / 100}
                onChange={(n) => patch({ monthlyPriceCents: Math.round(n * 100) })}
              />
            </FormField>
            <FormField label="月度赠送积分" description="订阅周期发放的积分数。">
              <NumberInput
                size="sm"
                unit="积分"
                min={0}
                value={local.monthlyCredits ?? 0}
                onChange={(n) => patch({ monthlyCredits: Math.round(n) })}
              />
            </FormField>
            <FormField
              label="积分充值折扣"
              description="1 = 原价；如 0.9 表示九折。"
            >
              <DecimalFieldInput
                className={DECIMAL_INPUT_CLS}
                value={local.creditPurchaseDiscount ?? 1}
                min={0}
                max={1}
                onChange={(n) => patch({ creditPurchaseDiscount: n })}
              />
            </FormField>
            <FormField
              label="会员购买折扣"
              description="开通该档订阅时的折扣；定价页仅展示付费档。"
            >
              <DecimalFieldInput
                className={DECIMAL_INPUT_CLS}
                value={local.subscriptionPurchaseDiscount ?? 1}
                min={0}
                max={1}
                onChange={(n) => patch({ subscriptionPurchaseDiscount: n })}
              />
            </FormField>
            {variant === 'pricing' && (
              <FormField label="排序" description="越小越靠前。">
                <NumberInput
                  size="sm"
                  value={local.sortOrder ?? 0}
                  onChange={(n) => patch({ sortOrder: Math.round(n) })}
                />
              </FormField>
            )}
          </FieldGroup>
        )}

        {showEntitlements && (
          <>
            {variant === 'entitlements' && (
              <FieldGroup title="额度与折扣">
                <FormField
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
                </FormField>
                <FormField label="积分充值折扣" description="1 = 无折扣，不在 C 端展示。">
                  <DecimalFieldInput
                    className={DECIMAL_INPUT_CLS}
                    value={local.creditPurchaseDiscount ?? 1}
                    min={0}
                    max={1}
                    onChange={(n) => patch({ creditPurchaseDiscount: n })}
                  />
                </FormField>
                <FormField
                  label="会员购买折扣"
                  description="开通会员订阅时的折扣；定价页仅展示付费档。"
                >
                  <DecimalFieldInput
                    className={DECIMAL_INPUT_CLS}
                    value={local.subscriptionPurchaseDiscount ?? 1}
                    min={0}
                    max={1}
                    onChange={(n) => patch({ subscriptionPurchaseDiscount: n })}
                  />
                </FormField>
              </FieldGroup>
            )}

            <FieldGroup title="产能与队列">
              <FormField label="最高分辨率" description="该档会员可导出的最高清晰度。">
                <SimpleSelect
                  size="sm"
                  value={local.maxResolution || '720p'}
                  onValueChange={(v) => patch({ maxResolution: v })}
                  options={RESOLUTION_OPTIONS}
                />
              </FormField>
              <FormField label="并发任务数" description="同时进行的生成任务上限。">
                <NumberInput
                  size="sm"
                  unit="路"
                  min={1}
                  value={local.maxConcurrentJobs ?? 1}
                  onChange={(n) => patch({ maxConcurrentJobs: Math.max(1, Math.round(n)) })}
                />
              </FormField>
              <FormField label="队列优先级" description="数值越小优先级越高。">
                <NumberInput
                  size="sm"
                  value={local.queuePriority ?? 10}
                  onChange={(n) => patch({ queuePriority: Math.round(n) })}
                />
              </FormField>
              <FormField
                label="视频价格系数"
                description="1 = 原价，0.9 = 九折。"
              >
                <DecimalFieldInput
                  className={DECIMAL_INPUT_CLS}
                  value={local.videoPriceCoefficient ?? 1}
                  min={0}
                  onChange={(n) => patch({ videoPriceCoefficient: n })}
                />
              </FormField>
            </FieldGroup>

            <FieldGroup title="功能权益">
              <FormField label="无水印" description="开启后成片默认不带平台水印。">
                <Switch
                  checked={!local.watermarkRequired}
                  onChange={(v) => patch({ watermarkRequired: !v })}
                  label="无水印"
                />
              </FormField>
              <FormField label="Ultron 模式" description="是否开放 Ultron 画质档。">
                <Switch
                  checked={!!local.allowUltron}
                  onChange={(v) => patch({ allowUltron: v })}
                  label="Ultron 模式"
                />
              </FormField>
              <FormField label="Seedance 引擎" description="是否允许使用 Seedance 视频引擎。">
                <Switch
                  checked={!!local.allowSeedance}
                  onChange={(v) => patch({ allowSeedance: v })}
                  label="Seedance 引擎"
                />
              </FormField>
              <FormField label="多角色" description="是否支持多角色参考图。">
                <Switch
                  checked={!!local.allowMultiCharacter}
                  onChange={(v) => patch({ allowMultiCharacter: v })}
                  label="多角色"
                />
              </FormField>
              <FormField label="商业授权" description="是否授予商业使用权益。">
                <Switch
                  checked={!!local.allowCommercialUse}
                  onChange={(v) => patch({ allowCommercialUse: v })}
                  label="商业授权"
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
