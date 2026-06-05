'use client';

import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  CostStatsPayload,
  PROVIDER_COLORS,
  formatCount,
  providerLabel,
} from '../_lib/types';

/**
 * 「按渠道分布」面板：
 *   - 左侧饼图（按调用次数）
 *   - 右侧表格（次数 / 估算金额 / 已对账金额，三家货币不同所以用各自原币）
 *
 * 选择"调用次数"作为饼图度量而非"金额"，是因为三家货币异构，
 * 强行折算 USD 反而会误导（Mountsea credit 折算系数有套餐弹性）。
 */
export function ProviderPie({ payload }: { payload: CostStatsPayload }) {
  const data = payload.byProvider;

  const totalCalls = useMemo(
    () => data.reduce((acc, r) => acc + r.calls, 0),
    [data],
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900">按渠道分布</h3>
        <span className="text-[11px] text-slate-400">按调用次数</span>
      </div>

      {totalCalls === 0 ? (
        <EmptyHint>
          当前时间窗内无任何调用记录
        </EmptyHint>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="calls"
                  nameKey="provider"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                  label={(p: any) => {
                    const ratio = totalCalls > 0 ? p.calls / totalCalls : 0;
                    return ratio >= 0.05 ? `${providerLabel(p.provider)} ${(ratio * 100).toFixed(0)}%` : '';
                  }}
                  labelLine={false}
                >
                  {data.map((row) => (
                    <Cell
                      key={row.provider}
                      fill={PROVIDER_COLORS[row.provider] ?? '#94a3b8'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any) => formatCount(Number(v))}
                  labelFormatter={(name) => providerLabel(String(name))}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="font-normal py-1.5">渠道</th>
                  <th className="font-normal py-1.5 text-right">调用</th>
                  <th className="font-normal py-1.5 text-right">估算</th>
                  <th className="font-normal py-1.5 text-right">已对账</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-3 text-center text-slate-400">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  data.map((row) => (
                    <tr key={row.provider} className="border-b border-slate-50 last:border-0">
                      <td className="py-1.5">
                        <span
                          className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                          style={{
                            backgroundColor: PROVIDER_COLORS[row.provider] ?? '#94a3b8',
                          }}
                        />
                        <span className="text-slate-700 font-medium">
                          {providerLabel(row.provider)}
                        </span>
                      </td>
                      <td className="py-1.5 text-right text-slate-700">
                        {formatCount(row.calls)}
                        {row.failed > 0 && (
                          <span className="text-red-500 ml-1">
                            ({row.failed} 失败)
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-right text-slate-700">
                        {formatNative(row.estAmount, row.estUnit)}
                      </td>
                      <td className="py-1.5 text-right">
                        {row.reconciledAmount > 0 ? (
                          <span className="text-emerald-600">
                            {/* 真实账单单位由 reconciled_source 决定，跟估算单位解耦
                                （例：CF 估算单位=null 但真实账单是 USD）*/}
                            {formatNative(row.reconciledAmount, row.reconciledUnit)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function formatNative(value: number, unit: string | null): string {
  if (!Number.isFinite(value) || value === 0) return '—';
  if (unit === 'usd') {
    return value >= 1 ? `$${value.toFixed(2)}` : `$${value.toFixed(4)}`;
  }
  if (unit === 'credits') {
    return `${Math.round(value).toLocaleString('en-US')} credits`;
  }
  if (unit === 'neuron') {
    return `${Math.round(value).toLocaleString('en-US')} neuron`;
  }
  return String(value);
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-48 flex items-center justify-center text-xs text-slate-400">
      {children}
    </div>
  );
}
