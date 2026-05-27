'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Zap, Search, ExternalLink } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';

type Provider = 'veo' | 'fal';

interface LookupResult {
  status?: string;
  resultUrls?: string[];
  errorMessage?: string;
  [k: string]: any;
}

export default function AdminQuickVideoToolPage() {
  const [provider, setProvider] = useState<Provider>('veo');
  const [taskId, setTaskId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);

  const lookup = useMutation({
    mutationFn: () =>
      apiClient.post('/admin/tools/quick-video/lookup', {
        provider,
        taskId: taskId.trim() || undefined,
        sessionId: sessionId.trim() || undefined,
      }) as any,
    onSuccess: (data) => setResult(data),
    onError: (err: any) =>
      setResult({ errorMessage: err?.message || '查询失败' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    if (provider === 'veo' && !taskId.trim()) return;
    if (provider === 'fal' && !sessionId.trim()) return;
    lookup.mutate();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4 max-w-3xl">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            快速视频任务查询
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            凭 Veo taskId 或 fal.ai sessionId 查询任务状态（无持久化历史，仅运维 lookup）
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
        >
          <div className="flex items-center gap-2">
            {(['veo', 'fal'] as Provider[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors',
                  provider === p
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
                )}
              >
                {p === 'veo' ? 'Veo (山海)' : 'fal.ai'}
              </button>
            ))}
          </div>

          {provider === 'veo' ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Veo taskId</label>
              <input
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                placeholder="例如：76a88729-3b37-410f-8902-d664525de62a"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">fal.ai sessionId</label>
              <input
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="fal 提交返回的 sessionId"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={lookup.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              <Search className={cn('h-3.5 w-3.5', lookup.isPending && 'animate-spin')} />
              {lookup.isPending ? '查询中…' : '查询状态'}
            </button>
          </div>
        </form>

        {result && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">查询结果</h3>
              {result.status && <StatusBadge status={result.status} kind="generic" />}
            </div>
            {result.errorMessage && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {result.errorMessage}
              </p>
            )}
            {result.resultUrls && result.resultUrls.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">产出文件</p>
                {result.resultUrls.map((url, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  >
                    <span className="text-xs text-slate-600 truncate min-w-0">{url}</span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 flex-shrink-0"
                    >
                      打开
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>
            )}
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-500 hover:text-slate-800">
                原始 JSON
              </summary>
              <pre className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-x-auto text-[11px] text-slate-700">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
