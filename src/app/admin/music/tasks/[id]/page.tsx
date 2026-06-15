'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Disc3, DollarSign, ExternalLink, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { StatusBadge } from '@/components/status-badge';
import { MountseaCostAmount } from '@/components/mountsea-cost-amount';
import { formatDate, cn } from '@/lib/utils';
import {
  DEFAULT_CNY_PER_USD,
  fetchCnyPerUsd,
  formatCnyAmount,
  mountseaCreditsToCny,
} from '@/lib/mountsea-pricing';
import { useAlert } from '@/components/ui/dialog-provider';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { canAccessTab, firstAllowedTab } from '@/lib/admin-permissions';

/** 与 mv-studio-api CREDIT_COSTS 保持一致（100 积分 = ¥1） */
const MUSIC_CREATE_CREDITS: Record<string, number> = {
  'chirp-v55': 40,
  'chirp-v50': 40,
  'Lyria 3 Pro': 80,
};

function musicCreateCreditsCost(model: string, fallback?: number): number {
  return MUSIC_CREATE_CREDITS[model] ?? fallback ?? 40;
}

interface CostRecord {
  id: string;
  step: string;
  provider: string;
  model: string;
  quantity: number;
  quantityUnit: string;
  costNativeAmount: number | null;
  costNativeUnit: string | null;
  elapsedMs: number | null;
  success: boolean;
  providerRequestId: string | null;
  reconciledAt: string | null;
  reconciledAmount: number | null;
  reconciledSource: string | null;
  reconciledDiffPct: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface CostsResponse {
  task: {
    id: string;
    prompt: string | null;
    model: string;
    status: string;
    userId: string;
    createdAt: string;
    costSummary: Record<string, unknown> | null;
  };
  totals: {
    calls: number;
    success: number;
    failure: number;
    mountsea_credits: number;
  };
  byStep: Record<string, { calls: number; mountsea_credits: number }>;
  records: CostRecord[];
  reconcileHints?: {
    mountseaConfigured: boolean;
    pendingMountsea: number;
    warnings: string[];
  };
}

interface DetailResponse {
  task: {
    id: string;
    userId: string;
    model: string;
    status: string;
    prompt: string | null;
    subType: string | null;
    inputParams: Record<string, unknown>;
    externalTaskId: string | null;
    resultUrls: string[] | null;
    creditsCost: number;
    errorMessage: string | null;
    createdAt: string;
    completedAt: string | null;
  };
  user: {
    id: string;
    email: string | null;
    displayName: string;
  } | null;
}

const STEP_LABELS: Record<string, string> = {
  music_create: '音乐生成',
  music_lyrics: 'AI 歌词',
  music_lrc: 'LRC 时间轴',
};

const TABS = [
  { key: 'costs' as const, label: '成本明细' },
  { key: 'overview' as const, label: '概览' },
];

export default function AdminMusicTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const alert = useAlert();
  const queryClient = useQueryClient();
  const permissions = useAdminAuthStore((s) => s.permissions);
  const canReconcile = useAdminAuthStore((s) =>
    s.hasPermission('billing.cost.view') && s.hasPermission('project.manage'),
  );
  const [tab, setTab] = useState<'overview' | 'costs'>('costs');
  const visibleTabs = TABS.filter((t) =>
    canAccessTab(permissions, 'music.task.detail', t.key),
  );

  useEffect(() => {
    if (!visibleTabs.length) return;
    if (!visibleTabs.some((t) => t.key === tab)) {
      const first = firstAllowedTab(permissions, 'music.task.detail') as
        | 'overview'
        | 'costs'
        | null;
      if (first) setTab(first);
    }
  }, [visibleTabs, tab, permissions]);

  const { data: detail, isLoading, isError, error } = useQuery<DetailResponse>({
    queryKey: ['admin', 'music', 'task', id],
    queryFn: () => apiClient.get(`/admin/music/tasks/${id}`) as any,
  });

  const { data: costs, isLoading: costsLoading } = useQuery<CostsResponse>({
    queryKey: ['admin', 'music', 'task', id, 'costs'],
    queryFn: () => apiClient.get(`/admin/music/tasks/${id}/costs`) as any,
  });

  const { data: cnyPerUsd = DEFAULT_CNY_PER_USD } = useQuery({
    queryKey: ['cny-per-usd'],
    queryFn: fetchCnyPerUsd,
    staleTime: 3600_000,
  });

  const reconcileMutation = useMutation({
    mutationFn: () => apiClient.post(`/admin/music/tasks/${id}/reconcile`, {}) as any,
    onSuccess: async (summary: any) => {
      const reconciled = summary?.reconciled ?? 0;
      const total = summary?.total ?? 0;
      const warnings: string[] = summary?.warnings ?? [];
      const hasWarnings = warnings.length > 0;
      const allFailed = total > 0 && reconciled === 0;

      await alert({
        title: allFailed && hasWarnings ? '对账未完成' : '对账完成',
        description: (
          <div className="space-y-1.5">
            <p>成功 {reconciled}/{total} 条</p>
            {warnings.flatMap((warning) =>
              warning.split('\n').map((line, i) => (
                <p key={`${warning}-${i}`} className="text-red-600">
                  {line}
                </p>
              )),
            )}
          </div>
        ),
        variant: allFailed && hasWarnings ? 'danger' : hasWarnings ? 'danger' : 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'music', 'task', id, 'costs'] });
    },
    onError: async (err: any) => {
      await alert({ title: '对账失败', description: err?.message, variant: 'danger' });
    },
  });

  const reconStats = useMemo(() => {
    if (!costs?.records.length) return null;
    let reconciled = 0;
    let mountseaEst = 0;
    let mountseaRec = 0;
    for (const r of costs.records) {
      if (r.reconciledAt && r.reconciledSource === 'mountsea_usage' && r.reconciledAmount != null) {
        reconciled++;
        mountseaRec += r.reconciledAmount;
        mountseaEst += r.reconciledAmount;
      } else if (r.costNativeUnit === 'credits' && r.costNativeAmount) {
        mountseaEst += r.costNativeAmount;
      }
    }
    const displayCredits = mountseaRec > 0 ? mountseaRec : mountseaEst;
    return {
      reconciled,
      total: costs.records.length,
      mountseaEst,
      mountseaRec,
      displayCredits,
      displayCny: mountseaCreditsToCny(displayCredits),
      allReconciled: reconciled === costs.records.length && mountseaRec > 0,
    };
  }, [costs]);

  const task = detail?.task;
  const audioUrl = task?.resultUrls?.[0];
  const userChargeCredits = task ? musicCreateCreditsCost(task.model, task.creditsCost) : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4 w-full">
        <Link
          href="/admin/music/tasks"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回列表
        </Link>

        <QueryState isLoading={isLoading} isError={isError} error={error} height="h-32">
          {task && (
            <>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Disc3 className="h-5 w-5 text-teal-600" />
                      {task.prompt || '音乐任务'}
                    </h1>
                    <p className="text-xs text-slate-400 font-mono mt-1">{task.id}</p>
                  </div>
                  <StatusBadge status={task.status} kind="generic" />
                </div>

                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-500">模型：</span>{task.model}</div>
                  <div>
                    <span className="text-slate-500">用户扣费：</span>
                    {userChargeCredits} 积分
                    <span className="text-slate-400 text-xs ml-1">
                      （{formatCnyAmount(mountseaCreditsToCny(userChargeCredits))}）
                    </span>
                  </div>
                  <div><span className="text-slate-500">用户：</span>{detail?.user?.displayName || task.userId}</div>
                  <div><span className="text-slate-500">邮箱：</span>{detail?.user?.email || '—'}</div>
                  <div><span className="text-slate-500">创建：</span>{formatDate(new Date(task.createdAt))}</div>
                  <div><span className="text-slate-500">外部任务：</span>
                    <span className="font-mono text-xs">{task.externalTaskId || '—'}</span>
                  </div>
                </div>

                {task.errorMessage && (
                  <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{task.errorMessage}</div>
                )}

                {audioUrl && (
                  <div className="flex items-center gap-3 pt-2">
                    <audio controls src={audioUrl} className="flex-1 h-10" />
                    <a
                      href={audioUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      打开
                    </a>
                  </div>
                )}
              </div>

              <div className="flex gap-1 border-b border-slate-200">
                {visibleTabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                      tab === t.key
                        ? 'border-teal-600 text-teal-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {tab === 'costs' && (
                <div className="space-y-4">
                  {costs?.reconcileHints?.warnings?.map((warning) => (
                    <div
                      key={warning}
                      className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                      <div className="space-y-1 text-red-600">
                        {warning.split('\n').map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    </div>
                  ))}

                  {reconStats && reconStats.displayCredits > 0 && (
                    <div className="rounded-xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800/70 mb-1">
                        音乐成本合计（人民币）
                      </p>
                      <p className="text-3xl font-bold tabular-nums text-emerald-900 leading-none">
                        {formatCnyAmount(reconStats.displayCny)}
                      </p>
                      <p className="text-sm text-emerald-800/85 mt-2 tabular-nums">
                        {reconStats.displayCredits.toFixed(1)} credits
                        {reconStats.allReconciled ? (
                          <span className="text-emerald-700/80"> · 已对账真实账单</span>
                        ) : reconStats.mountseaRec > 0 ? (
                          <span className="text-emerald-700/80">
                            {' '}
                            · 真实 {reconStats.mountseaRec.toFixed(1)} / 估算 {reconStats.mountseaEst.toFixed(1)} credits
                          </span>
                        ) : (
                          <span className="text-emerald-700/60 text-xs ml-1">（价格表估算）</span>
                        )}
                      </p>
                      <p className="text-[10px] text-emerald-700/60 mt-1.5">
                        100 credits = ¥1 CNY
                      </p>
                    </div>
                  )}

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-slate-600">
                      {reconStats ? (
                        <>
                          <span className="font-semibold text-emerald-700">{reconStats.reconciled}</span>
                          <span> / {reconStats.total} 已对账</span>
                        </>
                      ) : (
                        '暂无成本记录'
                      )}
                    </div>
                    {canReconcile && (
                    <button
                      onClick={() => reconcileMutation.mutate()}
                      disabled={reconcileMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                    >
                      {reconcileMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <DollarSign className="h-3.5 w-3.5" />
                      )}
                      立即对账
                    </button>
                    )}
                  </div>

                  {costsLoading ? (
                    <div className="h-32 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left">时间</th>
                            <th className="px-3 py-2 text-left">步骤</th>
                            <th className="px-3 py-2 text-left">Provider / 模型</th>
                            <th className="px-3 py-2 text-right">估算 Cost</th>
                            <th className="px-3 py-2 text-right">真实账单</th>
                            <th className="px-3 py-2 text-center">状态</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {costs?.records.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                                {new Date(r.createdAt).toLocaleString(undefined, {
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </td>
                              <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                                {STEP_LABELS[r.step] || r.step}
                              </td>
                              <td className="px-3 py-2 text-slate-600 min-w-0">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-1.5 bg-teal-50 text-teal-700">
                                  {r.provider}
                                </span>
                                <span className="font-mono text-[11px]">{r.model}</span>
                              </td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">
                                {r.costNativeAmount != null && r.costNativeUnit === 'credits' ? (
                                  <MountseaCostAmount
                                    credits={r.costNativeAmount}
                                    cnyPerUsd={cnyPerUsd}
                                    amountClassName="text-teal-700 font-medium text-[11px]"
                                  />
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">
                                {r.reconciledAmount != null && r.reconciledSource === 'mountsea_usage' ? (
                                  <span
                                    title={
                                      r.reconciledDiffPct != null
                                        ? `估算 ${r.costNativeAmount} → 实际 ${r.reconciledAmount} credits`
                                        : undefined
                                    }
                                  >
                                    <MountseaCostAmount
                                      credits={r.reconciledAmount}
                                      cnyPerUsd={cnyPerUsd}
                                      amountClassName="font-semibold text-emerald-700 text-[11px]"
                                    />
                                    {r.reconciledDiffPct != null && Math.abs(r.reconciledDiffPct) >= 5 && (
                                      <span
                                        className={cn(
                                          'ml-1 px-1 py-0.5 rounded text-[9px] font-mono align-top inline-block',
                                          r.reconciledDiffPct > 0
                                            ? 'bg-rose-100 text-rose-700'
                                            : 'bg-emerald-100 text-emerald-700',
                                        )}
                                      >
                                        {r.reconciledDiffPct > 0 ? '+' : ''}
                                        {r.reconciledDiffPct}%
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-blue-600">待 Mountsea 对账</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {r.success ? (
                                  <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                                    OK
                                  </span>
                                ) : (
                                  <span className="inline-block px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-medium">
                                    FAIL
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {!costs?.records.length && (
                            <tr>
                              <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                                暂无成本埋点记录
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {tab === 'overview' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">输入参数</h3>
                  <pre className="text-xs bg-slate-50 rounded-xl p-3 overflow-auto max-h-64">
                    {JSON.stringify(task.inputParams, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </QueryState>
      </div>
    </div>
  );
}
