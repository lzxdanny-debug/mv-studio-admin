'use client';

import { useRef, useState } from 'react';
import { Download, Loader2, Upload } from 'lucide-react';
import apiClient from '@/lib/api';
import { useConfirm } from '@/components/ui/dialog-provider';

type ImportSummary = { total?: number; created?: number; updated?: number };

export function AdminDataTransferActions({ exportUrl, importUrl, filename, resourceLabel, canImport, onImported }: {
  exportUrl: string;
  importUrl: string;
  filename: string;
  resourceLabel: string;
  canImport: boolean;
  onImported?: (summary: ImportSummary) => void;
}) {
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [message, setMessage] = useState('');

  const download = async () => {
    setBusy('export');
    setMessage('');
    try {
      const payload = await apiClient.get(exportUrl);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${filename}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage(`${resourceLabel}已导出`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导出失败');
    } finally {
      setBusy(null);
    }
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    if (inputRef.current) inputRef.current.value = '';
    let payload: unknown;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      setMessage('文件不是有效的 JSON');
      return;
    }
    const ok = await confirm({
      title: `导入${resourceLabel}？`,
      description: '将按稳定标识更新同名记录，并新增缺失记录；不会删除目标环境中的额外记录。媒体文件不重复上传，沿用导出文件中的 URL。',
      variant: 'warning',
      confirmText: '确认导入',
    });
    if (!ok) return;
    setBusy('import');
    setMessage('');
    try {
      const result = await apiClient.post(importUrl, payload) as ImportSummary;
      setMessage(`导入完成：共 ${result.total ?? 0} 条，新增 ${result.created ?? 0} 条，更新 ${result.updated ?? 0} 条`);
      onImported?.(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入失败');
    } finally {
      setBusy(null);
    }
  };

  return <div className="flex flex-wrap items-center justify-end gap-2">
    <button type="button" disabled={busy !== null} onClick={() => void download()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
      {busy === 'export' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}导出 JSON
    </button>
    <button type="button" disabled={!canImport || busy !== null} onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50">
      {busy === 'import' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}导入 JSON
    </button>
    <input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} />
    {message && <span className={`basis-full text-right text-xs ${message.includes('失败') || message.includes('无效') || message.includes('缺少') ? 'text-red-600' : 'text-emerald-700'}`}>{message}</span>}
  </div>;
}
