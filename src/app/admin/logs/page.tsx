'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, Terminal, AlertTriangle } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { canAccessTab } from '@/lib/admin-permissions';
import { PermissionTabs } from '@/components/permission-tabs';
import { LiveTail } from './_components/live-tail';
import { HistorySearch } from './_components/history-search';
import type { FilesResp } from './_lib/types';

export default function AdminLogsPage() {
  const permissions = useAdminAuthStore((s) => s.permissions);

  const filesQuery = useQuery<FilesResp>({
    queryKey: ['admin', 'logs', 'files'],
    queryFn: () => apiClient.get('/admin/logs/files') as any,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    enabled: canAccessTab(permissions, 'logs.page', 'tail'),
  });

  const tabs = useMemo(
    () => [
      {
        key: 'tail' as const,
        label: '实时',
        panel: filesQuery.isLoading ? (
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
                  {(filesQuery.error as any)?.message ?? '未知错误'}
                </p>
              </div>
            </div>
          </div>
        ) : !filesQuery.data || filesQuery.data.files.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-500">
            服务器尚无可读日志文件
          </div>
        ) : (
          <LiveTail files={filesQuery.data.files} />
        ),
      },
      {
        key: 'history' as const,
        label: '历史检索',
        panel:
          filesQuery.data && filesQuery.data.files.length > 0 ? (
            <HistorySearch files={filesQuery.data.files} />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-500">
              请先加载日志文件列表
            </div>
          ),
      },
    ],
    [filesQuery],
  );

  return (
    <div className="flex-1 overflow-hidden bg-slate-100 flex flex-col">
      <div className="px-6 pt-6 pb-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Terminal className="h-5 w-5 text-blue-600" />
            系统日志
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            实时尾随 PM2 输出 + ripgrep 历史检索（最多同时尾随 4 个文件）
          </p>
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

      <div className="flex-1 px-6 pb-6 overflow-hidden">
        <PermissionTabs
          pageKey="logs.page"
          tabs={tabs}
          defaultTab="tail"
          className="h-full flex flex-col"
        />
      </div>
    </div>
  );
}
