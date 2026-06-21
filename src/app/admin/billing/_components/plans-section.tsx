'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { PaginationBar } from '@/components/pagination-bar';
import { DecimalFieldInput } from './decimal-factor-input';
import type { PlanEntitlement } from './types';

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
  videoPriceCoefficient: 1,
  allowMultiCharacter: false,
  allowCommercialUse: false,
  sortOrder: 0,
  isActive: true,
};

const PLAN_INPUT_CLS =
  'w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50';

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
  const [savingId, setSavingId] = useState<string | 'new' | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();

  const { data, isLoading, isError, error } = useQuery<{
    items: PlanEntitlement[];
    total: number;
    page: number;
    pageSize: number;
  }>({
    queryKey: ['admin', 'billing', 'plans', page],
    queryFn: () =>
      apiClient.get(`/admin/billing/plans?page=${page}&pageSize=${pageSize}`) as any,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'billing', 'plans'] });

  const create = useMutation({
    mutationFn: (body: Partial<PlanEntitlement>) =>
      apiClient.post('/admin/billing/plans', planBodyForSave(body)) as any,
    onMutate: () => setSavingId('new'),
    onSuccess: () => {
      setDraft(null);
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
    onSuccess: invalidate,
  });

  return (
    <section>
      <div className={cn('mb-3', showHeader ? 'flex items-center justify-between' : 'flex justify-end')}>
        {showHeader && (
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {SECTION_TITLE[variant]}
          </h2>
        )}
        <button
          onClick={() => setDraft({ ...EMPTY_PLAN })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium"
        >
          <Plus className="h-3.5 w-3.5" /> 新建计划
        </button>
      </div>
      {toast && (
        <p
          className={cn(
            'text-xs font-medium mb-3',
            toast.ok ? 'text-emerald-600' : 'text-red-500',
          )}
        >
          {toast.text}
        </p>
      )}
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-32">
        <div className="space-y-4">
          {draft && (
            <PlanCard
              plan={draft}
              variant={variant}
              isNew
              saving={savingId === 'new'}
              onSave={() => create.mutate(draft)}
              onCancel={() => setDraft(null)}
              onChange={setDraft}
            />
          )}
          {(data?.items ?? []).map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              variant={variant}
              saving={savingId === plan.id}
              onSave={(body) => update.mutate({ id: plan.id, body })}
              onDelete={variant === 'full' || variant === 'pricing' ? () => remove.mutate(plan.id) : undefined}
            />
          ))}
          {(data?.items ?? []).length === 0 && !draft && (
            <p className="text-xs text-slate-400 py-6 text-center">暂无计划</p>
          )}
          {data && (
            <PaginationBar
              page={page}
              pageSize={pageSize}
              total={data.total}
              onPageChange={setPage}
              onPageSizeChange={onPageSizeChange}
            />
          )}
        </div>
      </QueryState>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function PlanCard({
  plan,
  variant,
  isNew,
  saving,
  onSave,
  onCancel,
  onDelete,
  onChange,
}: {
  plan: Partial<PlanEntitlement>;
  variant: PlansSectionVariant;
  isNew?: boolean;
  saving?: boolean;
  onSave: (body: Partial<PlanEntitlement>) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onChange?: (p: Partial<PlanEntitlement>) => void;
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

  return (
    <div className={cn('bg-white border rounded-2xl p-4', isNew ? 'border-teal-300' : 'border-slate-200')}>
      {variant === 'entitlements' && !isNew && (
        <div className="flex items-baseline gap-2 mb-3 pb-3 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-900">{local.name || '—'}</span>
          <span className="text-xs text-slate-400 font-mono">{local.planCode}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {(variant === 'full' || variant === 'pricing' || (variant === 'entitlements' && isNew)) && (
          <>
            <Field label="Plan Code">
              <input
                className={PLAN_INPUT_CLS}
                value={local.planCode ?? ''}
                disabled={!isNew}
                placeholder="creator"
                onChange={(e) => patch({ planCode: e.target.value })}
              />
            </Field>
            <Field label="名称">
              <input
                className={PLAN_INPUT_CLS}
                value={local.name ?? ''}
                disabled={variant === 'entitlements' && !isNew}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </Field>
          </>
        )}

        {showPricing && (
          <>
            <Field label="月费 (USD)">
              <input
                type="number"
                step="0.01"
                className={PLAN_INPUT_CLS}
                value={((local.monthlyPriceCents ?? 0) / 100).toString()}
                onChange={(e) => patch({ monthlyPriceCents: Math.round(Number(e.target.value) * 100) })}
              />
            </Field>
            <Field label="月度赠送积分">
              <input
                type="number"
                className={PLAN_INPUT_CLS}
                value={local.monthlyCredits ?? 0}
                onChange={(e) => patch({ monthlyCredits: Number(e.target.value) })}
              />
            </Field>
            <Field label="积分充值折扣（1=原价）">
              <DecimalFieldInput
                className={PLAN_INPUT_CLS}
                value={local.creditPurchaseDiscount ?? 1}
                min={0}
                max={1}
                onChange={(n) => patch({ creditPurchaseDiscount: n })}
              />
            </Field>
            <Field label="会员购买折扣（1=原价）">
              <DecimalFieldInput
                className={PLAN_INPUT_CLS}
                value={local.subscriptionPurchaseDiscount ?? 1}
                min={0}
                max={1}
                onChange={(n) => patch({ subscriptionPurchaseDiscount: n })}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                开通该档会员订阅时的折扣；定价页仅展示付费档（creator / pro）
              </p>
            </Field>
            {variant === 'pricing' && (
              <Field label="排序">
                <input
                  type="number"
                  className={PLAN_INPUT_CLS}
                  value={local.sortOrder ?? 0}
                  onChange={(e) => patch({ sortOrder: Number(e.target.value) })}
                />
              </Field>
            )}
          </>
        )}

        {showEntitlements && (
          <>
            <Field label="月度赠送积分">
              <input
                type="number"
                min={0}
                className={PLAN_INPUT_CLS}
                value={local.monthlyCredits ?? 0}
                onChange={(e) => patch({ monthlyCredits: Number(e.target.value) })}
              />
              <p className="text-[10px] text-slate-400 mt-1">0 = C 端不展示；订阅续费仍按此值发放</p>
            </Field>
            <Field label="积分充值折扣（1=原价）">
              <DecimalFieldInput
                className={PLAN_INPUT_CLS}
                value={local.creditPurchaseDiscount ?? 1}
                min={0}
                max={1}
                onChange={(n) => patch({ creditPurchaseDiscount: n })}
              />
              <p className="text-[10px] text-slate-400 mt-1">1 = 无折扣，不在 C 端展示</p>
            </Field>
            <Field label="会员购买折扣（1=原价）">
              <DecimalFieldInput
                className={PLAN_INPUT_CLS}
                value={local.subscriptionPurchaseDiscount ?? 1}
                min={0}
                max={1}
                onChange={(n) => patch({ subscriptionPurchaseDiscount: n })}
              />
              <p className="text-[10px] text-slate-400 mt-1">开通会员订阅时的折扣；定价页仅展示付费档</p>
            </Field>
            <Field label="最高分辨率">
              <input
                className={PLAN_INPUT_CLS}
                value={local.maxResolution ?? '720p'}
                onChange={(e) => patch({ maxResolution: e.target.value })}
              />
            </Field>
            <Field label="并发任务数">
              <input
                type="number"
                className={PLAN_INPUT_CLS}
                value={local.maxConcurrentJobs ?? 1}
                onChange={(e) => patch({ maxConcurrentJobs: Number(e.target.value) })}
              />
            </Field>
            <Field label="队列优先级 (小=高)">
              <input
                type="number"
                className={PLAN_INPUT_CLS}
                value={local.queuePriority ?? 10}
                onChange={(e) => patch({ queuePriority: Number(e.target.value) })}
              />
            </Field>
            <Field label="视频价格系数 (1=原价, 0.9=9折)">
              <DecimalFieldInput
                className={PLAN_INPUT_CLS}
                value={local.videoPriceCoefficient ?? 1}
                min={0}
                onChange={(n) => patch({ videoPriceCoefficient: n })}
              />
            </Field>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-600">
        {showEntitlements && (
          <>
            <Toggle label="无水印" checked={!local.watermarkRequired} onChange={(v) => patch({ watermarkRequired: !v })} />
            <Toggle label="Ultron 模式" checked={!!local.allowUltron} onChange={(v) => patch({ allowUltron: v })} />
            <Toggle label="多角色" checked={!!local.allowMultiCharacter} onChange={(v) => patch({ allowMultiCharacter: v })} />
            <Toggle label="商业授权" checked={!!local.allowCommercialUse} onChange={(v) => patch({ allowCommercialUse: v })} />
          </>
        )}
        {(variant === 'full' || variant === 'pricing' || variant === 'entitlements') && (
          <Toggle label="启用" checked={local.isActive ?? true} onChange={(v) => patch({ isActive: v })} />
        )}
      </div>

      <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
        {isNew && onCancel && (
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100">
            取消
          </button>
        )}
        {!isNew && onDelete && (
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> 删除
          </button>
        )}
        <button
          type="button"
          onClick={() => onSave(local)}
          disabled={saving || (!isNew && !dirty)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium"
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

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-teal-600" />
      {label}
    </label>
  );
}
