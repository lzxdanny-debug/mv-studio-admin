'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download, FileJson, Loader2, ShieldCheck, Upload } from 'lucide-react';
import apiClient from '@/lib/api';
import { useConfirm } from '@/components/ui/dialog-provider';
import { cn } from '@/lib/utils';

type SyncKind =
  | 'ai-providers'
  | 'ai-routing'
  | 'ai-model-concurrency'
  | 'admin-roles';

interface SyncEnvelope {
  schemaVersion: number;
  kind: SyncKind;
  exportedAt: string;
  data: unknown[];
}

type SyncDiff = {
  added: string[];
  changed: string[];
  unchanged: string[];
  targetOnly: string[];
};

function itemKey(kind: SyncKind, item: unknown, index: number): string {
  const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
  if (kind === 'ai-providers') return String(row.provider ?? `第 ${index + 1} 项`);
  if (kind === 'ai-routing') return String(row.capability ?? `第 ${index + 1} 项`);
  if (kind === 'admin-roles') return String(row.code ?? `第 ${index + 1} 项`);
  return [row.provider, row.scope, row.family ?? row.modality]
    .filter(Boolean)
    .map(String)
    .join(' / ') || `第 ${index + 1} 项`;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${stableJson(row[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function compareSyncData(kind: SyncKind, incoming: unknown[], current: unknown[]): SyncDiff {
  const toMap = (items: unknown[]) =>
    new Map(items.map((item, index) => [itemKey(kind, item, index), item]));
  const source = toMap(incoming);
  const target = toMap(current);
  const diff: SyncDiff = { added: [], changed: [], unchanged: [], targetOnly: [] };
  for (const [key, value] of source) {
    if (!target.has(key)) diff.added.push(key);
    else if (stableJson(value) === stableJson(target.get(key))) diff.unchanged.push(key);
    else diff.changed.push(key);
  }
  for (const key of target.keys()) {
    if (!source.has(key)) diff.targetOnly.push(key);
  }
  return diff;
}

function diffDescription(diff: SyncDiff, total: number): string {
  const changedNames = [...diff.added, ...diff.changed].slice(0, 10);
  const more = diff.added.length + diff.changed.length - changedNames.length;
  return [
    `已读取目标环境并完成差异预览：文件 ${total} 项；新增 ${diff.added.length} 项，修改 ${diff.changed.length} 项，无变化 ${diff.unchanged.length} 项。`,
    diff.targetOnly.length > 0
      ? `目标环境另有 ${diff.targetOnly.length} 项不在文件中；当前同步方式会保留这些配置。`
      : '',
    changedNames.length > 0
      ? `将写入：${changedNames.join('、')}${more > 0 ? ` 等 ${more + changedNames.length} 项` : ''}。`
      : '文件与目标环境一致，本次不会产生配置变化。',
    'AI 密钥只参与差异判断，预览不会显示明文。写入后立即生效。',
  ].filter(Boolean).join('\n');
}

export function AdminConfigSync({
  kind,
  title,
  endpoint,
  description,
  securityNote,
  exportWarning,
  importWarning,
  onImported,
}: {
  kind: SyncKind;
  title: string;
  endpoint: string;
  description: string;
  securityNote?: string;
  exportWarning?: string;
  importWarning?: string;
  onImported: () => void;
}) {
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const isLocalDevelopment = process.env.NODE_ENV !== 'production';
  const [visible, setVisible] = useState(isLocalDevelopment);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (isLocalDevelopment) return;
    const value = new URLSearchParams(window.location.search).get('sync');
    setVisible(value === '1');
  }, [isLocalDevelopment]);

  const exportMutation = useMutation({
    mutationFn: () => apiClient.get(`${endpoint}/export`) as Promise<SyncEnvelope>,
    onSuccess: (payload) => {
      if (payload.schemaVersion !== 1 || payload.kind !== kind || !Array.isArray(payload.data)) {
        setMessage({ ok: false, text: '服务器返回的同步文件格式不正确。' });
        return;
      }
      const date = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `mv-studio-${kind}${exportWarning ? '-sensitive' : ''}-${date}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage({ ok: true, text: `已导出 ${payload.data.length} 项配置。` });
    },
    onError: (error: Error) =>
      setMessage({ ok: false, text: error.message || '导出失败，请重试。' }),
  });

  const importMutation = useMutation({
    mutationFn: (payload: SyncEnvelope) =>
      apiClient.put(`${endpoint}/import`, payload) as Promise<unknown>,
    onSuccess: (_result, payload) => {
      setMessage({ ok: true, text: `已导入 ${payload.data.length} 项配置，并刷新当前页面。` });
      onImported();
    },
    onError: (error: Error) =>
      setMessage({ ok: false, text: error.message || '导入失败，目标环境未发生完整同步。' }),
  });

  const selectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ ok: false, text: '同步文件不能超过 2 MB。' });
      return;
    }

    let payload: SyncEnvelope;
    try {
      payload = JSON.parse(await file.text()) as SyncEnvelope;
    } catch {
      setMessage({ ok: false, text: '文件不是有效的 JSON。' });
      return;
    }
    if (
      payload?.schemaVersion !== 1 ||
      payload?.kind !== kind ||
      !Array.isArray(payload?.data)
    ) {
      setMessage({ ok: false, text: `文件类型不匹配，请选择“${title}”导出的文件。` });
      return;
    }

    setPreviewing(true);
    setMessage({ ok: true, text: '正在读取目标环境并生成差异预览…' });
    try {
      const current = await apiClient.get(`${endpoint}/export`) as SyncEnvelope;
      if (current?.schemaVersion !== 1 || current?.kind !== kind || !Array.isArray(current?.data)) {
        throw new Error('目标环境返回的配置格式不正确');
      }
      const diff = compareSyncData(kind, payload.data, current.data);
      const accepted = await confirm({
        title: `确认导入 ${title}？`,
        description: [
          diffDescription(diff, payload.data.length),
          importWarning ?? '',
        ].filter(Boolean).join('\n'),
        confirmText: diff.added.length + diff.changed.length > 0 ? '按以上差异导入' : '仍然导入',
        cancelText: '取消',
        variant: 'danger',
      });
      if (!accepted) {
        setMessage({ ok: true, text: '已取消导入，目标环境没有发生变化。' });
        return;
      }
      setMessage(null);
      importMutation.mutate(payload);
    } catch (error) {
      const text = error instanceof Error ? error.message : '无法生成导入差异预览';
      setMessage({ ok: false, text: `${text}。为避免盲目覆盖，本次未导入。` });
    } finally {
      setPreviewing(false);
    }
  };

  if (!visible) return null;

  const pending = exportMutation.isPending || importMutation.isPending || previewing;
  const handleExport = async () => {
    if (exportWarning) {
      const accepted = await confirm({
        title: `导出${title}？`,
        description: exportWarning,
        confirmText: '确认导出',
        cancelText: '取消',
        variant: 'danger',
      });
      if (!accepted) return;
    }
    setMessage(null);
    exportMutation.mutate();
  };

  return (
    <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <FileJson className="h-4 w-4" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">{title}同步</h2>
              <span className="rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                {isLocalDevelopment ? '开发环境' : '隐藏工具'}
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">{description}</p>
            {securityNote && (
              <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                {securityNote}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 disabled:opacity-50"
          >
            {exportMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            导出
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {importMutation.isPending || previewing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {previewing ? '预览中' : '导入'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={selectFile}
          />
        </div>
      </div>

      {message && (
        <p
          className={cn(
            'mt-3 rounded-xl border px-3 py-2 text-xs font-medium',
            message.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700',
          )}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
