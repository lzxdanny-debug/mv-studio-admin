'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Search,
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Archive,
  FileText,
  AlertOctagon,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { LogFileMeta, LogLevel, SearchResult } from '../_lib/types';
import { LogLineRow } from './log-line';

const LEVEL_OPTIONS: Array<{ key: LogLevel | 'all'; label: string }> = [
  { key: 'all', label: '全部级别' },
  { key: 'log', label: 'LOG' },
  { key: 'warn', label: 'WARN' },
  { key: 'error', label: 'ERROR' },
  { key: 'fatal', label: 'FATAL' },
  { key: 'debug', label: 'DEBUG' },
];

interface Props {
  files: LogFileMeta[];
}

export function HistorySearch({ files }: Props) {
  // 默认搜全部 active 文件
  const [selected, setSelected] = useState<string[]>(
    files.filter((f) => f.active).map((f) => f.name),
  );
  const [includeArchived, setIncludeArchived] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [user, setUser] = useState('');
  const [level, setLevel] = useState<LogLevel | 'all'>('all');
  const [regex, setRegex] = useState(false);
  const [limit, setLimit] = useState(200);

  const targetFiles = useMemo(() => {
    if (includeArchived) return selected;
    // 排除归档（前端兜底，实际后端按用户选了什么搜什么）
    return selected.filter((n) => files.find((f) => f.name === n)?.active);
  }, [selected, includeArchived, files]);

  const search = useMutation<SearchResult, Error>({
    mutationFn: () => {
      const qs = new URLSearchParams();
      if (targetFiles.length) qs.set('files', targetFiles.join(','));
      if (keyword.trim()) qs.set('keyword', keyword.trim());
      if (user.trim()) qs.set('user', user.trim());
      if (level !== 'all') qs.set('level', level);
      if (regex) qs.set('regex', '1');
      qs.set('limit', String(limit));
      return apiClient.get(`/admin/logs/search?${qs.toString()}`) as Promise<SearchResult>;
    },
  });

  const onSearch = () => {
    if (!keyword.trim() && !user.trim() && level === 'all') {
      search.reset();
      return;
    }
    search.mutate();
  };

  const onKeyEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSearch();
  };

  const totalSize = useMemo(
    () => files.filter((f) => targetFiles.includes(f.name)).reduce((s, f) => s + f.size, 0),
    [files, targetFiles],
  );

  const selectedOversize = useMemo(
    () => files.filter((f) => targetFiles.includes(f.name) && f.oversize),
    [files, targetFiles],
  );

  // 与后端默认阈值保持一致，超过则前端先警告
  const SEARCH_TOTAL_SOFT_LIMIT = 1024 * 1024 * 1024; // 1GB 软警告
  const SEARCH_TOTAL_HARD_LIMIT = 2 * 1024 * 1024 * 1024; // 2GB 硬限（与后端 LOG_SEARCH_TOTAL_LIMIT_MB 默认值一致）

  // 当用户切换 includeArchived 时，自动联动 selected
  const toggleArchived = (val: boolean) => {
    setIncludeArchived(val);
    if (val) {
      setSelected(files.map((f) => f.name));
    } else {
      setSelected(files.filter((f) => f.active).map((f) => f.name));
    }
  };

  const toggleFile = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 工具条 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={onKeyEnter}
              placeholder={regex ? '正则表达式（PCRE2 语法）' : '关键词（区分大小写默认按字面）'}
              className="w-full pl-8 pr-2 py-2 text-sm border border-slate-200 rounded-xl bg-white"
            />
          </div>

          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            onKeyDown={onKeyEnter}
            placeholder="用户 tag (alice / a3f2c1d8)"
            className="px-2 py-2 text-sm border border-slate-200 rounded-xl bg-white w-52"
          />

          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as LogLevel | 'all')}
            className="px-2 py-2 text-sm border border-slate-200 rounded-xl bg-white"
          >
            {LEVEL_OPTIONS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-1.5 px-2 py-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={regex}
              onChange={(e) => setRegex(e.target.checked)}
              className="accent-purple-600"
            />
            正则
          </label>

          <button
            onClick={onSearch}
            disabled={search.isPending || totalSize > SEARCH_TOTAL_HARD_LIMIT}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium"
            title={
              totalSize > SEARCH_TOTAL_HARD_LIMIT
                ? '选中文件总大小超 2GB 硬上限，请缩小范围'
                : undefined
            }
          >
            {search.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            搜索
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          <span className="text-[11px] font-medium text-slate-500 mr-1">文件范围:</span>
          {files.map((f) => {
            const on = selected.includes(f.name);
            const archived = !f.active;
            if (archived && !includeArchived) return null;
            return (
              <button
                key={f.name}
                onClick={() => toggleFile(f.name)}
                title={
                  `${f.name}\n${formatBytes(f.size)} · ${formatTime(f.mtime)}` +
                  (f.oversize ? '\n⚠ 单文件过大，搜索可能超时；建议配 pm2-logrotate' : '')
                }
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border transition-colors',
                  on
                    ? f.oversize
                      ? 'bg-orange-50 border-orange-300 text-orange-800'
                      : archived
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : f.stream === 'err'
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : f.oversize
                      ? 'bg-white border-orange-200 text-orange-600 hover:bg-orange-50'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50',
                )}
              >
                {f.oversize && <AlertOctagon className="h-2.5 w-2.5" />}
                {!f.oversize && archived && <Archive className="h-2.5 w-2.5" />}
                {f.name}
                <span className="text-[9px] opacity-70">{formatBytes(f.size)}</span>
              </button>
            );
          })}

          <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => toggleArchived(e.target.checked)}
              className="accent-purple-600"
            />
            包含 logrotate 历史归档（共 {files.filter((f) => !f.active).length} 个）
          </label>

          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10))}
            className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
          >
            <option value={50}>最多 50 行</option>
            <option value={200}>最多 200 行</option>
            <option value={500}>最多 500 行</option>
            <option value={1000}>最多 1000 行</option>
          </select>
        </div>
      </div>

      {/* oversize 警告条 */}
      {(selectedOversize.length > 0 || totalSize > SEARCH_TOTAL_SOFT_LIMIT) && (
        <div
          className={cn(
            'mt-2 px-3 py-2 rounded-xl border text-xs flex items-start gap-2',
            totalSize > SEARCH_TOTAL_HARD_LIMIT
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-orange-50 border-orange-200 text-orange-800',
          )}
        >
          <AlertOctagon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            {totalSize > SEARCH_TOTAL_HARD_LIMIT ? (
              <>
                <strong>选中文件总大小 {formatBytes(totalSize)} 超过后端 2GB 硬上限</strong>，
                点击「搜索」会被服务器拒绝。请取消归档勾选 / 减少文件 / 配 pm2-logrotate 切小文件。
              </>
            ) : selectedOversize.length > 0 ? (
              <>
                选中范围内有 <strong>{selectedOversize.length}</strong> 个文件超过 500MB（共
                {formatBytes(totalSize)}），单文件 ripgrep 扫描约 {Math.ceil(totalSize / (500 * 1024 * 1024))}s，
                可能命中 5s 硬超时被截断。建议先配 pm2-logrotate（参见 deploy/AGENT-UPDATE-2026-06-03.md）。
              </>
            ) : (
              <>
                选中文件总量 <strong>{formatBytes(totalSize)}</strong>{' '}
                超过 1GB 软警告线，搜索预计耗时 {Math.ceil(totalSize / (500 * 1024 * 1024))}s 左右。
              </>
            )}
          </div>
        </div>
      )}

      {/* 摘要条 */}
      {search.data && (
        <div
          className={cn(
            'mt-2 px-3 py-2 rounded-xl border text-xs flex items-center gap-3 flex-wrap',
            search.data.truncated
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800',
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>
            命中 <span className="font-semibold">{search.data.hits.length}</span> 条
            {search.data.truncated && <span className="ml-1">（已截断，达到 limit 上限）</span>}
          </span>
          <span className="text-slate-500">·</span>
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            扫描 {search.data.scanned.files} 文件 / {formatBytes(search.data.scanned.bytes)}
          </span>
          <span className="text-slate-500">·</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            耗时 {formatMs(search.data.elapsedMs)}
          </span>
        </div>
      )}

      {search.isError && (
        <div className="mt-2 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <p className="flex-1">{(search.error as any)?.message ?? '搜索失败'}</p>
        </div>
      )}

      {/* 结果列表 */}
      <div className="flex-1 mt-2 overflow-hidden bg-white border border-slate-200 rounded-2xl flex flex-col min-h-0">
        {search.isPending ? (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            搜索中（最多 5s 自动超时）…
          </div>
        ) : search.data ? (
          search.data.hits.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
              在所选文件范围内未匹配到任何行。试试扩大文件范围、放宽级别或勾选「包含归档」
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {search.data.hits.map((h, i) => (
                <LogLineRow
                  key={`${h.file}:${h.lineNumber}:${i}`}
                  file={h.file}
                  lineNumber={h.lineNumber}
                  parsed={h.parsed}
                  highlight={keyword.trim() || undefined}
                />
              ))}
            </div>
          )
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-400 px-4 text-center">
            <div className="space-y-2">
              <p>填入关键词 / 用户 tag / 级别后点「搜索」</p>
              <p className="text-slate-400">
                当前选中 {targetFiles.length} 文件，总大小约 {formatBytes(totalSize)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
