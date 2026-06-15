'use client';

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontal, HelpCircle, Save, Zap, RefreshCw } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import {
  DEFAULT_CNY_PER_USD,
  MOUNTSEA_CNY_PER_CREDIT,
  fetchCnyPerUsd,
  mountseaCreditUsdPerCredit,
} from '@/lib/mountsea-pricing';
import { ModelPricingSection } from '../_components/model-pricing-section';

// ─── 类型 ────────────────────────────────────────────────────────────────

interface PricingParam {
  key: string;
  label: string;
  description: string;
  type: 'number' | 'boolean';
  default: number | boolean;
  value: number | boolean;
  source: 'db' | 'env' | 'default';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

interface PricingConfigView {
  params: PricingParam[];
}

function syncFormFromView(
  setForm: Dispatch<SetStateAction<Record<string, number | boolean>>>,
  view: PricingConfigView,
) {
  setForm(Object.fromEntries(view.params.map((p) => [p.key, p.value])));
}

const SOURCE_LABEL: Record<PricingParam['source'], string> = {
  db: '已配置',
  env: '环境变量',
  default: '默认值',
};

const SOURCE_CLS: Record<PricingParam['source'], string> = {
  db: 'bg-emerald-50 text-emerald-600',
  env: 'bg-sky-50 text-sky-600',
  default: 'bg-slate-100 text-slate-400',
};

// ─── Switch 开关 ──────────────────────────────────────────────────────────

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2',
        checked ? 'bg-emerald-500' : 'bg-slate-300',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────────────

export default function PricingConfigPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, number | boolean>>({});
  const [openHelp, setOpenHelp] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<PricingConfigView>({
    queryKey: ['admin', 'billing', 'pricing-config'],
    queryFn: async () => {
      const res = (await apiClient.get('/admin/billing/pricing-config')) as unknown as PricingConfigView;
      syncFormFromView(setForm, res);
      return res;
    },
  });

  const saveEnabled = useMutation({
    mutationFn: (enabled: boolean) =>
      apiClient.patch('/admin/billing/pricing-config', { enabled }) as Promise<PricingConfigView>,
    onSuccess: (res, enabled) => {
      syncFormFromView(setForm, res);
      setMsg({
        ok: true,
        text: enabled ? '计费已开启。' : '计费已关闭。',
      });
      qc.setQueryData(['admin', 'billing', 'pricing-config'], res);
    },
    onError: () => {
      setMsg({ ok: false, text: '计费开关保存失败，请重试。' });
      qc.invalidateQueries({ queryKey: ['admin', 'billing', 'pricing-config'] });
    },
  });

  const { data: cnyPerUsd = DEFAULT_CNY_PER_USD, isFetching: rateFetching } = useQuery({
    queryKey: ['admin', 'exchange-rate', 'cny-per-usd'],
    queryFn: fetchCnyPerUsd,
    staleTime: 60 * 60 * 1000,
    placeholderData: DEFAULT_CNY_PER_USD,
  });

  const mountseaUsdFromRate = useMemo(
    () => mountseaCreditUsdPerCredit(cnyPerUsd),
    [cnyPerUsd],
  );

  const mountseaParam = data?.params.find((p) => p.key === 'mountseaCreditUsd');
  const rateSource =
    Math.abs(cnyPerUsd - DEFAULT_CNY_PER_USD) > 0.01 ? 'Frankfurter 实时' : '默认兜底';

  const [mountseaSynced, setMountseaSynced] = useState(false);

  // 首次加载：若仍为旧默认值 0.01（误当作 USD）或系统默认，按实时汇率折算为美元
  useEffect(() => {
    if (mountseaSynced || !mountseaParam || rateFetching) return;
    const cur = Number(mountseaParam.value);
    const isLegacyDefault = Math.abs(cur - 0.01) < 1e-9;
    const isSystemDefault = mountseaParam.source === 'default';
    if (isLegacyDefault || isSystemDefault) {
      setForm((f) => ({
        ...f,
        mountseaCreditUsd: Number(mountseaUsdFromRate.toFixed(6)),
      }));
    }
    setMountseaSynced(true);
  }, [mountseaParam, cnyPerUsd, mountseaUsdFromRate, mountseaSynced, rateFetching]);

  const save = useMutation({
    mutationFn: (payload: Record<string, number | boolean>) =>
      apiClient.patch('/admin/billing/pricing-config', payload) as Promise<PricingConfigView>,
    onSuccess: (res) => {
      setMsg({ ok: true, text: '计费全局参数已保存。' });
      syncFormFromView(setForm, res);
      // 全局系数变化会影响步骤价格推荐值，刷新它
      qc.invalidateQueries({ queryKey: ['admin', 'billing', 'step-prices'] });
      qc.setQueryData(['admin', 'billing', 'pricing-config'], res);
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请重试。' }),
  });

  const params = data?.params ?? [];
  const masterParam = params.find((p) => p.key === 'enabled');
  const numberParams = params.filter((p) => p.type === 'number');
  const billingEnabled = form.enabled === true;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-teal-600" />
            定价策略
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            积分计费引擎的全局参数（总开关、盈利系数、积分单价、最低收费）与各渠道模型的单次调用定价。修改后影响预扣、实际结算与步骤价格推荐值。
          </p>
        </div>

        <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            计费全局参数
          </h2>
          {/* 计费总开关 */}
          {masterParam && (
            <div
              className={cn(
                'rounded-2xl border p-5 transition-colors',
                billingEnabled
                  ? 'bg-emerald-50/60 border-emerald-200'
                  : 'bg-amber-50/60 border-amber-200',
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={cn(
                      'h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0',
                      billingEnabled ? 'bg-emerald-500' : 'bg-amber-400',
                    )}
                  >
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      {masterParam.label}
                    </p>
                    <p
                      className={cn(
                        'text-xs mt-0.5 font-medium',
                        billingEnabled ? 'text-emerald-600' : 'text-amber-600',
                      )}
                    >
                      {billingEnabled
                        ? '计费已开启 · 生成会预扣并按实际结算积分'
                        : '计费未开启 · 仅做只读估算，不扣减积分、不阻止生成'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={cn(
                      'text-xs font-medium',
                      billingEnabled ? 'text-emerald-600' : 'text-slate-400',
                    )}
                  >
                    {billingEnabled ? '开启' : '关闭'}
                  </span>
                  <Switch
                    checked={billingEnabled}
                    disabled={saveEnabled.isPending}
                    onChange={(v) => {
                      setForm((f) => ({ ...f, enabled: v }));
                      setMsg(null);
                      saveEnabled.mutate(v);
                    }}
                  />
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                {masterParam.description}
              </p>
            </div>
          )}

          {/* 数值参数 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mt-6">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              计费系数与阈值
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {numberParams.map((p) => {
                const isMountsea = p.key === 'mountseaCreditUsd';
                const displayValue =
                  typeof form[p.key] === 'number' ? (form[p.key] as number) : Number(p.value);

                return (
                <div
                  key={p.key}
                  className={cn(
                    'rounded-xl border p-3.5',
                    isMountsea
                      ? 'border-sky-100 bg-sky-50/50'
                      : 'border-slate-100 bg-slate-50/60',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-medium text-slate-700 truncate">
                        {p.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenHelp(openHelp === p.key ? null : p.key)}
                        className="text-slate-400 hover:text-teal-600 flex-shrink-0"
                        title="查看说明"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0',
                        SOURCE_CLS[p.source],
                      )}
                    >
                      {SOURCE_LABEL[p.source]}
                    </span>
                  </div>

                  {isMountsea && (
                    <p className="mt-2 text-xs leading-relaxed text-sky-800/90">
                      定价基准：1 内部积分 = ¥{MOUNTSEA_CNY_PER_CREDIT.toFixed(2)} CNY
                      <span className="text-sky-600/80">
                        {' '}
                        · 汇率 {cnyPerUsd.toFixed(4)} CNY/USD（{rateSource}）
                      </span>
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 mt-2.5">
                    <input
                      type="number"
                      step={p.step ?? 'any'}
                      min={p.min}
                      max={p.max}
                      value={displayValue}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [p.key]: Number(e.target.value) }))
                      }
                      className="flex-1 min-w-0 px-3 py-1.5 text-sm text-right border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                    />
                    {p.unit && (
                      <span className="text-xs text-slate-400 w-10 flex-shrink-0">
                        {p.unit}
                      </span>
                    )}
                  </div>

                  {isMountsea && (
                    <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[11px] text-slate-500">
                        汇率折算：¥{MOUNTSEA_CNY_PER_CREDIT.toFixed(2)} ÷ {cnyPerUsd.toFixed(4)} ≈{' '}
                        <span className="font-mono text-slate-700">
                          ${mountseaUsdFromRate.toFixed(6)}
                        </span>
                      </p>
                      <button
                        type="button"
                        disabled={rateFetching}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            mountseaCreditUsd: Number(mountseaUsdFromRate.toFixed(6)),
                          }))
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-sky-700 border border-sky-200 bg-white hover:bg-sky-50 disabled:opacity-50"
                      >
                        <RefreshCw
                          className={cn('h-3 w-3', rateFetching && 'animate-spin')}
                        />
                        采用汇率折算
                      </button>
                    </div>
                  )}

                  {openHelp === p.key && (
                    <p className="mt-2.5 text-xs leading-relaxed text-slate-500 bg-white border border-slate-100 rounded-lg p-2.5">
                      {p.description}
                      <span className="block mt-1 text-slate-400">
                        默认值：{String(p.default)}
                        {p.unit ? ` ${p.unit}` : ''}
                        {isMountsea && (
                          <span className="block mt-0.5">
                            （由 ¥{MOUNTSEA_CNY_PER_CREDIT.toFixed(2)}/积分 ÷ 默认汇率{' '}
                            {DEFAULT_CNY_PER_USD} 折算）
                          </span>
                        )}
                      </span>
                    </p>
                  )}
                </div>
                );
              })}
            </div>
          </div>

          {msg && (
            <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
              {msg.text}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setMsg(null);
                const payload = Object.fromEntries(
                  params.map((p) => [p.key, form[p.key] ?? p.value]),
                );
                save.mutate(payload);
              }}
              disabled={save.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              {save.isPending ? '保存中…' : '保存定价参数'}
            </button>
          </div>
        </QueryState>

        {/* 模型定价 */}
        <ModelPricingSection />
      </div>
    </div>
  );
}
