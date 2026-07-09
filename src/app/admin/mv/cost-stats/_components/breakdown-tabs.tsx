'use client';

import { useState } from 'react';
import {
  CostStatsPayload,
  formatCount,
  formatUsd,
  providerLabel,
  stepLabel,
  PROVIDER_COLORS,
} from '../_lib/types';

/**
 * 按"步骤" / "模型" 维度的明细表（Tab 切换）。
 * 数据来自后端 byStep / byModel；模型 Tab 取 Top 20，已在后端 LIMIT。
 */
export function BreakdownTabs({ payload }: { payload: CostStatsPayload }) {
  const [tab, setTab] = useState<'step' | 'model'>('step');

  return (
    <div className="admin-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900">按维度明细</h3>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          <TabBtn active={tab === 'step'} onClick={() => setTab('step')}>
            按步骤
          </TabBtn>
          <TabBtn active={tab === 'model'} onClick={() => setTab('model')}>
            按模型 (Top 20)
          </TabBtn>
        </div>
      </div>

      {tab === 'step' ? (
        <StepTable rows={payload.byStep} />
      ) : (
        <ModelTable rows={payload.byModel} />
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'px-3 py-1 rounded-md text-xs font-medium bg-white text-slate-900 shadow-sm'
          : 'px-3 py-1 rounded-md text-xs font-medium text-slate-500 hover:text-slate-700'
      }
    >
      {children}
    </button>
  );
}

function StepTable({ rows }: { rows: CostStatsPayload['byStep'] }) {
  if (rows.length === 0) {
    return <EmptyHint>当前时间窗内无数据</EmptyHint>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-100">
            <th className="font-normal py-2 pl-1">步骤</th>
            <th className="font-normal py-2 text-right">总调用</th>
            <th className="font-normal py-2 text-right">成功</th>
            <th className="font-normal py-2 text-right">失败</th>
            <th className="font-normal py-2 text-right">成功率</th>
            <th className="font-normal py-2 text-right pr-1">估算金额 (USD)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rate = r.calls > 0 ? r.success / r.calls : 0;
            return (
              <tr
                key={r.step}
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50"
              >
                <td className="py-2 pl-1 text-slate-700 font-medium">
                  {stepLabel(r.step)}
                </td>
                <td className="py-2 text-right text-slate-700">
                  {formatCount(r.calls)}
                </td>
                <td className="py-2 text-right text-emerald-600">
                  {formatCount(r.success)}
                </td>
                <td className="py-2 text-right text-red-500">
                  {formatCount(r.failed)}
                </td>
                <td className="py-2 text-right">
                  <span
                    className={
                      rate >= 0.95
                        ? 'text-emerald-600'
                        : rate >= 0.8
                          ? 'text-amber-600'
                          : 'text-red-600'
                    }
                  >
                    {(rate * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="py-2 text-right pr-1 text-slate-700 font-mono">
                  {r.estAmountUsd > 0 ? formatUsd(r.estAmountUsd) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ModelTable({ rows }: { rows: CostStatsPayload['byModel'] }) {
  if (rows.length === 0) {
    return <EmptyHint>当前时间窗内无数据</EmptyHint>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-100">
            <th className="font-normal py-2 pl-1">渠道</th>
            <th className="font-normal py-2">模型</th>
            <th className="font-normal py-2 text-right">总调用</th>
            <th className="font-normal py-2 text-right">失败</th>
            <th className="font-normal py-2 text-right">成功率</th>
            <th className="font-normal py-2 text-right pr-1">估算金额 (USD)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rate = r.calls > 0 ? r.success / r.calls : 0;
            return (
              <tr
                key={`${r.provider}/${r.model}`}
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50"
              >
                <td className="py-2 pl-1">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                    style={{
                      backgroundColor: PROVIDER_COLORS[r.provider] ?? '#94a3b8',
                    }}
                  />
                  <span className="text-slate-600">{providerLabel(r.provider)}</span>
                </td>
                <td className="py-2 text-slate-800 font-mono text-[11px]">
                  {r.model}
                </td>
                <td className="py-2 text-right text-slate-700">
                  {formatCount(r.calls)}
                </td>
                <td className="py-2 text-right text-red-500">
                  {r.failed > 0 ? formatCount(r.failed) : '—'}
                </td>
                <td className="py-2 text-right">
                  <span
                    className={
                      rate >= 0.95
                        ? 'text-emerald-600'
                        : rate >= 0.8
                          ? 'text-amber-600'
                          : 'text-red-600'
                    }
                  >
                    {(rate * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="py-2 text-right pr-1 text-slate-700 font-mono">
                  {r.estAmountUsd > 0 ? formatUsd(r.estAmountUsd) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-32 flex items-center justify-center text-xs text-slate-400">
      {children}
    </div>
  );
}
