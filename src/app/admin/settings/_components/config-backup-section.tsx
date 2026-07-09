'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download, Upload, FileJson } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';

interface ImportResult {
  settingsWritten: number;
  settingsSkipped: number;
  settingsWrittenKeys: string[];
  credentialsWritten: string[];
}

export function ConfigBackupSection() {
  const [content, setContent] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const exportMut = useMutation({
    mutationFn: () =>
      apiClient.get('/admin/settings/config/export') as unknown as Promise<{
        filename: string;
        content: string;
      }>,
    onSuccess: (data) => {
      setMsg(null);
      const blob = new Blob([data.content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || 'mv-studio-config.jsonc';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onError: () => setMsg({ ok: false, text: '导出失败，请重试。' }),
  });

  const importMut = useMutation({
    mutationFn: (text: string) =>
      apiClient.post('/admin/settings/config/import', { content: text }) as unknown as Promise<ImportResult>,
    onSuccess: (data) => {
      setResult(data);
      setMsg({
        ok: true,
        text: `导入成功：写入 ${data.settingsWritten} 项设置（跳过 ${data.settingsSkipped} 项空值）${
          data.credentialsWritten.length
            ? `，更新渠道密钥 ${data.credentialsWritten.join('、')}`
            : ''
        }。`,
      });
    },
    onError: (e: any) => {
      setResult(null);
      setMsg({ ok: false, text: e?.message || e?.error || '导入失败，请检查 JSON 格式后重试。' });
    },
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContent(text);
    setMsg(null);
    setResult(null);
    e.target.value = '';
  };

  const handleImport = () => {
    setMsg(null);
    setResult(null);
    if (!content.trim()) {
      setMsg({ ok: false, text: '请先粘贴或选择配置文件内容。' });
      return;
    }
    importMut.mutate(content);
  };

  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        配置导出 / 导入（JSONC 备份）
      </h2>
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <FileJson className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">配置备份 / 跨环境迁移</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              导出计费参数、COS、OAuth、邮件、站点地址等系统设置，以及 AI 渠道密钥（明文 JSONC）。
              值为空字符串的项导入时会被跳过。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportMut.mutate()}
            disabled={exportMut.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            <Download className={cn('h-3.5 w-3.5', exportMut.isPending && 'animate-bounce')} />
            {exportMut.isPending ? '导出中…' : '导出配置'}
          </button>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            选择文件
            <input
              type="file"
              accept=".json,.jsonc,application/json,text/plain"
              className="hidden"
              onChange={handleFile}
            />
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            配置内容（可直接粘贴 / 编辑，支持 // 注释）
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            placeholder='粘贴导出的 JSONC，或点击"选择文件"载入。'
            className="w-full h-56 px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 resize-y"
          />
        </div>

        {msg && (
          <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
            {msg.text}
          </p>
        )}

        {result && result.settingsWrittenKeys.length > 0 && (
          <div className="text-xs text-slate-500">
            写入的设置项：
            <span className="font-mono text-slate-600">{result.settingsWrittenKeys.join(', ')}</span>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleImport}
            disabled={importMut.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            <Upload className={cn('h-3.5 w-3.5', importMut.isPending && 'animate-pulse')} />
            {importMut.isPending ? '导入中…' : '导入配置'}
          </button>
        </div>
      </div>
    </section>
  );
}
