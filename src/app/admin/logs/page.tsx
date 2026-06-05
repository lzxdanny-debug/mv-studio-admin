'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, History as HistoryIcon, Loader2, RefreshCw, Terminal, AlertTriangle } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { LiveTail } from './_components/live-tail';
import { HistorySearch } from './_components/history-search';
import type { FilesResp } from './_lib/types';

/**
 * Admin 后台「系统日志」页。
 *
 * 路由：/admin/logs
 *
 * 后端接口：
 *   GET /admin/logs/files   列文件
 *   GET /admin/logs/search  ripgrep 历史检索
 *   GET /admin/logs/tail    SSE 实时流（_lib/sse-client.ts 用 fetch+ReadableStream
 *                           处理，绕开原生 EventSource 不支持 Authorization header
 *                           的限制）
 *
 * 拆分原则：
 *   - 这个 page 只负责拉文件列表 + Tab 切换
 *   - 实时 / 历史的具体交互在 _components 内，互相隔离便于独立调试
 *
 * 注意：本目录路径 src/app/admin/logs/ 跟仓库根 .gitignore 的 logs/ 冲突，
 * 已在 .gitignore 单独加 `!src/app/admin/logs/` 例外，否则整目录会被静默忽略。
 */
export default function AdminLogsPage() {
  const [tab, setTab] = useState<'tail' | 'history'>('tail');

  const filesQuery = useQuery<FilesResp>({
    queryKey: ['admin', 'logs', 'files'],
    queryFn: () => apiClient.get('/admin/logs/files') as any,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  return (
    <div className="flex-1 overflow-hidden bg-slate-100 flex flex-col">
      <div className="px-6 pt-6 pb-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Terminal className="h-5 w-5 text-purple-600" />
            系统日志
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            实时尾随 PM2 输出 + ripgrep 历史检索（最多同时尾随 4 个文件）
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {(
              [
                ['tail', '实时', Activity],
                ['history', '历史检索', HistoryIcon],
              ] as Array<['tail' | 'history', string, any]>
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition',
                  tab === key ? 'bg-purple-600 text-white' : 'text-slate-500 hover:bg-slate-100',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => filesQuery.refetch()}
            disabled={filesQuery.isFetching}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            title="刷新文件列表"
          >
            {filesQuery.isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            刷新
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6 overflow-hidden">
        {filesQuery.isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : filesQuery.isError ? (
          <div className="h-full flex items-center justify-center">
            <div className="max-w-md px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">加载日志文件列表失败</p>
                <p className="text-xs mt-1">
                  {(filesQuery.error as any)?.message ?? '未知错误'}（请检查后端 /admin/logs/files 是否可用）
                </p>
              </div>
            </div>
          </div>
        ) : !filesQuery.data || filesQuery.data.files.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-500">
            服务器尚无可读日志文件（PM2 未启动 / LOG_DIR 未配 / 没有 *-out.log）
          </div>
        ) : (
          <div className="h-full">
            {tab === 'tail' ? (
              <LiveTail files={filesQuery.data.files} />
            ) : (
              <HistorySearch files={filesQuery.data.files} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
