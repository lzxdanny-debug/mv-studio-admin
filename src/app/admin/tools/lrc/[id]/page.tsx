'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText } from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { StatusBadge } from '@/components/status-badge';
import { formatDate, cn } from '@/lib/utils';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { canAccessTab, firstAllowedTab } from '@/lib/admin-permissions';

interface DetailResponse {
  job: {
    id: string;
    projectId: string;
    status: string;
    attempts: number;
    progress: Record<string, unknown> | null;
    lrc: string | null;
    errorMsg: string | null;
    errorCode: string | null;
    createdAt: string;
    updatedAt: string;
  };
  project: {
    id: string;
    title: string;
    userId: string;
    mvType: string;
    status: string;
  } | null;
  user: {
    id: string;
    email: string | null;
    displayName: string;
  } | null;
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
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface CostsResponse {
  totals: {
    calls: number;
    success: number;
    failure: number;
    mountsea_credits: number;
  };
  records: CostRecord[];
}

const TABS = [
  { key: 'costs' as const, label: '成本明细' },
  { key: 'overview' as const, label: '概览' },
];

export default function AdminLrcTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const permissions = useAdminAuthStore((s) => s.permissions);
  const [tab, setTab] = useState<'overview' | 'costs'>('costs');
  const visibleTabs = useMemo(
    () => TABS.filter((t) => canAccessTab(permissions, 'tools.lrc.detail', t.key)),
    [permissions],
  );

  useEffect(() => {
    if (!visibleTabs.length) return;
    if (!visibleTabs.some((t) => t.key === tab)) {
      const first = firstAllowedTab(permissions, 'tools.lrc.detail') as
        | 'overview'
        | 'costs'
        | null;
      if (first) setTab(first);
    }
  }, [visibleTabs, tab, permissions]);

  const { data: detail, isLoading, isError, error } = useQuery<DetailResponse>({
    queryKey: ['admin', 'lrc', 'task', id],
    queryFn: () => apiClient.get(`/admin/tools/lrc/tasks/${id}`) as any,
  });

  const { data: costs, isLoading: costsLoading } = useQuery<CostsResponse>({
    queryKey: ['admin', 'lrc', 'task', id, 'costs'],
    queryFn: () => apiClient.get(`/admin/tools/lrc/tasks/${id}/costs`) as any,
  });

  return (
    <div className="admin-page">
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/tools/lrc"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Link>
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={false}
          height="h-48"
        >
          {detail && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    {detail.project?.title || 'LRC 任务'}
                  </h1>
                  <p className="text-xs text-slate-400 font-mono mt-1">{detail.job.id}</p>
                </div>
                <StatusBadge status={detail.job.status} kind="generic" />
              </div>

              <div className="flex gap-1 border-b border-slate-200">
                {visibleTabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                      tab === t.key
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {tab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 text-sm">
                    <h2 className="font-semibold text-slate-800">任务信息</h2>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
                      <dt className="text-slate-400">状态</dt>
                      <dd><StatusBadge status={detail.job.status} kind="generic" /></dd>
                      <dt className="text-slate-400">重试次数</dt>
                      <dd>{detail.job.attempts}</dd>
                      <dt className="text-slate-400">创建</dt>
                      <dd>{formatDate(new Date(detail.job.createdAt))}</dd>
                      <dt className="text-slate-400">更新</dt>
                      <dd>{formatDate(new Date(detail.job.updatedAt))}</dd>
                      {detail.job.errorCode && (
                        <>
                          <dt className="text-slate-400">错误码</dt>
                          <dd className="font-mono text-red-600">{detail.job.errorCode}</dd>
                        </>
                      )}
                      {detail.job.errorMsg && (
                        <>
                          <dt className="text-slate-400">错误</dt>
                          <dd className="text-red-600">{detail.job.errorMsg}</dd>
                        </>
                      )}
                    </dl>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 text-sm">
                    <h2 className="font-semibold text-slate-800">关联项目</h2>
                    {detail.project ? (
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
                        <dt className="text-slate-400">项目</dt>
                        <dd className="font-medium">{detail.project.title}</dd>
                        <dt className="text-slate-400">MV 类型</dt>
                        <dd>{detail.project.mvType}</dd>
                        <dt className="text-slate-400">项目状态</dt>
                        <dd><StatusBadge status={detail.project.status} kind="mvProject" /></dd>
                        <dt className="text-slate-400">用户</dt>
                        <dd>
                          {detail.user?.displayName || '—'}
                          {detail.user?.email && (
                            <span className="text-slate-400 ml-1">({detail.user.email})</span>
                          )}
                        </dd>
                      </dl>
                    ) : (
                      <p className="text-xs text-slate-400">项目已删除</p>
                    )}
                  </div>

                  {detail.job.lrc && (
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
                      <h2 className="font-semibold text-slate-800 text-sm mb-2">LRC 预览</h2>
                      <pre className="text-xs text-slate-600 bg-slate-50 rounded-xl p-4 overflow-x-auto max-h-64 whitespace-pre-wrap">
                        {detail.job.lrc.slice(0, 4000)}
                        {detail.job.lrc.length > 4000 ? '\n…（已截断）' : ''}
                      </pre>
                    </div>
                  )}

                  {detail.job.progress && (
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
                      <h2 className="font-semibold text-slate-800 text-sm mb-2">转写进度</h2>
                      <pre className="text-xs text-slate-600 bg-slate-50 rounded-xl p-4 overflow-x-auto max-h-48">
                        {JSON.stringify(detail.job.progress, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {tab === 'costs' && (
                <QueryState
                  isLoading={costsLoading}
                  isError={false}
                  error={null}
                  isEmpty={!costs?.records.length}
                  emptyMessage="暂无 lrc_transcribe 成本记录"
                  height="h-32"
                >
                  {costs && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-3 text-xs">
                        <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200">
                          调用 {costs.totals.calls} 次
                        </span>
                        <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-emerald-700">
                          成功 {costs.totals.success}
                        </span>
                        <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-red-600">
                          失败 {costs.totals.failure}
                        </span>
                        <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200">
                          Mountsea credits ≈ {costs.totals.mountsea_credits.toFixed(2)}
                        </span>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-xs text-slate-500">
                              <th className="px-4 py-3 text-left">时间</th>
                              <th className="px-4 py-3 text-left">Provider</th>
                              <th className="px-4 py-3 text-left">模型</th>
                              <th className="px-4 py-3 text-left">数量</th>
                              <th className="px-4 py-3 text-left">成本</th>
                              <th className="px-4 py-3 text-left">耗时</th>
                              <th className="px-4 py-3 text-left">结果</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {costs.records.map((r) => (
                              <tr key={r.id} className="hover:bg-slate-50 text-xs">
                                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                                  {formatDate(new Date(r.createdAt))}
                                </td>
                                <td className="px-4 py-3 font-mono">{r.provider}</td>
                                <td className="px-4 py-3 font-mono">{r.model}</td>
                                <td className="px-4 py-3">
                                  {r.quantity} {r.quantityUnit}
                                </td>
                                <td className="px-4 py-3">
                                  {r.costNativeAmount != null
                                    ? `${r.costNativeAmount} ${r.costNativeUnit ?? ''}`
                                    : '—'}
                                </td>
                                <td className="px-4 py-3">
                                  {r.elapsedMs != null ? `${r.elapsedMs}ms` : '—'}
                                </td>
                                <td className="px-4 py-3">
                                  <StatusBadge
                                    status={r.success ? 'succeeded' : 'failed'}
                                    kind="generic"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </QueryState>
              )}
            </>
          )}
        </QueryState>
      </div>
    </div>
  );
}
