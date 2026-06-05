'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import {
  CostStatsPayload,
  FAILURE_COLORS,
  formatCount,
  formatUsd,
} from '../_lib/types';

/**
 * 「失败分析」面板（核心）：把失败按 errorKind 分组，明确标注每一类
 *   "是否会被上游计费（likelyBilled）"——让运营一眼看到"白花钱"的真正大头。
 *
 * 颜色语义：
 *   - 红色 = 多半会扣费（content_safety / timeout）
 *   - 灰色 = 多半不扣费（server_error / rate_limit / auth_failed / bad_request）
 *
 * 度量：
 *   - 横向条形图按"次数"绘制（用户更关心频率）
 *   - 旁边表格补全"估算浪费金额"和"平均耗时"两列
 */
export function FailureBar({ payload }: { payload: CostStatsPayload }) {
  const data = payload.failureBreakdown;

  const totalFailedCalls = data.reduce((acc, r) => acc + r.calls, 0);
  const totalWastedUsd = data
    .filter((r) => r.likelyBilled)
    .reduce((acc, r) => acc + r.estCostWastedUsd, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-500" />
          <h3 className="text-sm font-semibold text-slate-900">失败分析</h3>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <Legend color={FAILURE_COLORS.billed} label="多半计费" />
          <Legend color={FAILURE_COLORS.notBilled} label="不计费" />
        </div>
      </div>

      {totalFailedCalls === 0 ? (
        <div className="h-48 flex items-center justify-center text-xs text-slate-400">
          时间窗内无失败调用 — 系统稳定运行 ✓
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={(v) => formatCount(Number(v))}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#475569' }}
                    width={130}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(241,245,249,0.5)' }}
                    formatter={(v: any) => formatCount(Number(v))}
                    labelFormatter={(label) => String(label)}
                  />
                  <Bar dataKey="calls" radius={[0, 4, 4, 0]}>
                    {data.map((row) => (
                      <Cell
                        key={row.errorKind}
                        fill={
                          row.likelyBilled
                            ? FAILURE_COLORS.billed
                            : FAILURE_COLORS.notBilled
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-100">
                    <th className="font-normal py-1.5">类型</th>
                    <th className="font-normal py-1.5 text-right">次数</th>
                    <th className="font-normal py-1.5 text-right">估算浪费</th>
                    <th className="font-normal py-1.5 text-right">耗时</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r) => (
                    <tr
                      key={r.errorKind}
                      className="border-b border-slate-50 last:border-0"
                      title={r.note}
                    >
                      <td className="py-1.5">
                        <span
                          className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                          style={{
                            backgroundColor: r.likelyBilled
                              ? FAILURE_COLORS.billed
                              : FAILURE_COLORS.notBilled,
                          }}
                        />
                        <span className="text-slate-700">{r.label}</span>
                      </td>
                      <td className="py-1.5 text-right text-slate-700">
                        {formatCount(r.calls)}
                      </td>
                      <td className="py-1.5 text-right">
                        {r.likelyBilled ? (
                          <span className="text-red-600 font-medium">
                            {formatUsd(r.estCostWastedUsd)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right text-slate-500">
                        {r.avgElapsedMs > 0 ? `${(r.avgElapsedMs / 1000).toFixed(1)}s` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalWastedUsd > 0 && (
            <div className="mt-3 rounded-xl bg-red-50 border border-red-100 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-red-800 leading-relaxed">
                <strong>预计浪费 {formatUsd(totalWastedUsd)}</strong>
                ：内容审核拦截 / 超时类失败上游通常已计费。
                建议关注「内容审核拦截」类——可通过 prompt 安全重写或风险词预过滤降低发生率。
                <span className="text-red-600 ml-1">
                  实际是否扣费请等下次对账（cron 每小时）以 reconciled_amount 为准。
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-slate-500">
      <span
        className="w-2.5 h-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
