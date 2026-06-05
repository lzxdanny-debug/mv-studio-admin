/**
 * CSV 导出工具：把 stats payload 的明细数据扁平化成 CSV，浏览器侧直接下载。
 * 由于这是从已 fetch 到的 payload 派生，不再请求后端，无需后端额外接口。
 */

import { CostStatsPayload, providerLabel, stepLabel } from './types';

/** 把字段值转为 CSV 安全的单元格（包含 , " \n 时用双引号包裹并转义） */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(rows: Array<Array<unknown>>): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

/**
 * 生成一份"按渠道 / 按步骤 / 按模型 / 失败分类"四个 sheet-like 块的 CSV。
 * Excel 用一个文件打开即可，每块顶部一行标题做分隔。
 */
export function buildCostStatsCsv(payload: CostStatsPayload): string {
  const lines: string[] = [];

  lines.push(`# 成本统计导出  ${payload.range.fromIso} ~ ${payload.range.toIso}`);
  lines.push('');

  // 总览
  lines.push('# 总览');
  lines.push(
    rowsToCsv([
      ['指标', '值'],
      ['总调用次数', payload.summary.totalCalls],
      ['成功', payload.summary.successCalls],
      ['失败', payload.summary.failedCalls],
      ['估算 Mountsea credits', payload.summary.estimated.mountseaCredits],
      ['估算 Fal USD', payload.summary.estimated.falUsd],
      ['估算 Cloudflare neuron', payload.summary.estimated.cloudflareNeuron],
      ['对账后 Mountsea credits', payload.summary.reconciled.mountseaCredits],
      ['对账后 Fal USD', payload.summary.reconciled.falUsd],
      ['对账覆盖率', `${(payload.summary.reconciliation.ratio * 100).toFixed(1)}%`],
    ]),
  );
  lines.push('');

  // 按渠道
  lines.push('# 按渠道');
  lines.push(
    rowsToCsv([
      ['渠道', '调用次数', '成功', '失败', '估算金额(原币)', '原币单位', '已对账金额'],
      ...payload.byProvider.map((r) => [
        providerLabel(r.provider),
        r.calls,
        r.success,
        r.failed,
        r.estAmount,
        r.estUnit ?? '',
        r.reconciledAmount,
      ]),
    ]),
  );
  lines.push('');

  // 按步骤
  lines.push('# 按步骤');
  lines.push(
    rowsToCsv([
      ['步骤', '调用次数', '成功', '失败', '估算金额(USD)'],
      ...payload.byStep.map((r) => [
        stepLabel(r.step),
        r.calls,
        r.success,
        r.failed,
        r.estAmountUsd,
      ]),
    ]),
  );
  lines.push('');

  // 按模型
  lines.push('# 按模型 (Top 20)');
  lines.push(
    rowsToCsv([
      ['渠道', '模型', '调用次数', '成功', '失败', '估算金额(USD)'],
      ...payload.byModel.map((r) => [
        providerLabel(r.provider),
        r.model,
        r.calls,
        r.success,
        r.failed,
        r.estAmountUsd,
      ]),
    ]),
  );
  lines.push('');

  // 失败分类
  lines.push('# 失败分类');
  lines.push(
    rowsToCsv([
      ['错误类型', '错误名称', '次数', '估算浪费(USD)', '平均耗时(ms)', '是否计费', '说明'],
      ...payload.failureBreakdown.map((r) => [
        r.errorKind,
        r.label,
        r.calls,
        r.estCostWastedUsd,
        r.avgElapsedMs,
        r.likelyBilled ? '可能计费' : '不计费',
        r.note,
      ]),
    ]),
  );
  lines.push('');

  return lines.join('\n');
}

/** 浏览器下载触发：构造 Blob → a.click → revokeObjectURL */
export function downloadCsv(filename: string, content: string): void {
  // Excel 中文兼容：加 UTF-8 BOM
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
