'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CostStatsPayload, formatCount, formatUsd } from '../_lib/types';

/**
 * 时间趋势折线图（双 Y 轴）：
 *   - 左轴：调用次数（成功/失败两条线，用绿/红区分）
 *   - 右轴：估算成本（USD），紫色单线
 *
 * X 轴粒度：bucket=hour 时显示 HH:00；bucket=day 时显示 MM-DD
 */
export function TimelineChart({ payload }: { payload: CostStatsPayload }) {
  const data = payload.timeline.map((p) => ({
    ...p,
    tsLabel: formatTsLabel(p.ts, payload.range.bucket),
  }));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900">时间趋势</h3>
        <span className="text-[11px] text-slate-400">
          {payload.range.bucket === 'hour' ? '按小时聚合' : '按天聚合'}
        </span>
      </div>

      {data.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-xs text-slate-400">
          时间窗内无数据
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 32, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="tsLabel"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickFormatter={(v) => formatCount(Number(v))}
                label={{
                  value: '调用次数',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#94a3b8',
                  fontSize: 11,
                  offset: 10,
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickFormatter={(v) => `$${Number(v).toFixed(1)}`}
                label={{
                  value: '估算 USD',
                  angle: 90,
                  position: 'insideRight',
                  fill: '#94a3b8',
                  fontSize: 11,
                  offset: 0,
                }}
              />
              <Tooltip
                formatter={(v: any, name) => {
                  if (name === '估算成本') return formatUsd(Number(v));
                  return formatCount(Number(v));
                }}
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  borderColor: '#e2e8f0',
                }}
              />
              <Legend
                iconType="line"
                wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="success"
                name="成功"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="failed"
                name="失败"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="estAmountUsd"
                name="估算成本"
                stroke="#a855f7"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/**
 * 把 ISO 时间戳格式化成 X 轴 label：
 *   - hour bucket: "06-05 14:00"（如果只有当天可省略日期）
 *   - day bucket:  "06-05"
 */
function formatTsLabel(ts: string, bucket: 'hour' | 'day'): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  if (bucket === 'day') return `${mm}-${dd}`;
  const hh = String(d.getHours()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:00`;
}
