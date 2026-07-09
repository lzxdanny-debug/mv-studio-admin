'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pause,
  Play,
  Trash2,
  ArrowDownToLine,
  Wifi,
  WifiOff,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { startSse } from '../_lib/sse-client';
import { LogFileMeta, LogLevel, LogLine, SseEnvelope } from '../_lib/types';
import { LogLineRow } from './log-line';

const LEVEL_FILTER: Array<{ key: LogLevel | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'log', label: 'LOG' },
  { key: 'warn', label: 'WARN' },
  { key: 'error', label: 'ERROR' },
  { key: 'fatal', label: 'FATAL' },
  { key: 'debug', label: 'DEBUG' },
];

const MAX_BUFFER = 2000;
const INITIAL_LINES = 200;

interface Props {
  files: LogFileMeta[];
}

export function LiveTail({ files }: Props) {
  // 默认只勾 active 的 api-out / api-err
  const defaultSelected = useMemo(
    () =>
      files
        .filter((f) => f.active && f.app === 'api')
        .map((f) => f.name)
        .slice(0, 4),
    [files],
  );

  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [paused, setPaused] = useState(false);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [keyword, setKeyword] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [conn, setConn] = useState<'idle' | 'connecting' | 'open' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingRef = useRef<LogLine[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 文件变更或 selected 变更 → 重新连
  useEffect(() => {
    if (!selected.length) return;
    setConn('connecting');
    setErrMsg(null);
    setLines([]);
    pendingRef.current = [];

    const ac = new AbortController();
    const url =
      `/admin/logs/tail?files=${encodeURIComponent(selected.join(','))}` +
      `&initialLines=${INITIAL_LINES}`;

    let opened = false;
    startSse<SseEnvelope>({
      path: url,
      signal: ac.signal,
      onEvent: (evt) => {
        if (!opened) {
          opened = true;
          setConn('open');
        }
        if (evt.type === 'line') {
          pendingRef.current.push(evt.payload);
          scheduleFlush();
        } else if (evt.type === 'error') {
          setErrMsg(evt.payload?.message ?? 'unknown');
          if (evt.payload?.fatal) {
            setConn('error');
            ac.abort();
          }
        }
        // heartbeat: 忽略
      },
      onError: (err) => {
        if (ac.signal.aborted) return;
        setConn('error');
        setErrMsg(err.message);
      },
    }).catch((err) => {
      if (ac.signal.aborted) return;
      setConn('error');
      setErrMsg(err.message);
    });

    return () => {
      ac.abort();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.join(',')]);

  // 节流 flush：每 80ms 把 buffer 一次性塞进 React state，避免高频 re-render
  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      if (paused) return; // 暂停时只攒不渲染
      const incoming = pendingRef.current;
      pendingRef.current = [];
      if (!incoming.length) return;
      setLines((prev) => {
        const next = prev.concat(incoming);
        if (next.length > MAX_BUFFER) next.splice(0, next.length - MAX_BUFFER);
        return next;
      });
    }, 80);
  }, [paused]);

  // 暂停 → 恢复时把暂停期攒下的也 flush 进去
  useEffect(() => {
    if (!paused) {
      const incoming = pendingRef.current;
      pendingRef.current = [];
      if (incoming.length) {
        setLines((prev) => {
          const next = prev.concat(incoming);
          if (next.length > MAX_BUFFER) next.splice(0, next.length - MAX_BUFFER);
          return next;
        });
      }
    }
  }, [paused]);

  // autoScroll：每次 lines 变更滚到底
  useEffect(() => {
    if (!autoScroll) return;
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, autoScroll]);

  // 用户手动滚动远离底部 → 关闭 autoScroll
  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom > 80 && autoScroll) setAutoScroll(false);
    else if (distFromBottom <= 8 && !autoScroll) setAutoScroll(true);
  };

  const toggleFile = (name: string) => {
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= 4) return prev; // 上限 4
      return [...prev, name];
    });
  };

  const visible = useMemo(() => {
    return lines.filter((l) => {
      if (filter !== 'all' && l.level !== filter) return false;
      if (keyword && !l.message.toLowerCase().includes(keyword.toLowerCase())) {
        return false;
      }
      if (userFilter && !(l.userTag ?? '').toLowerCase().includes(userFilter.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [lines, filter, keyword, userFilter]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 工具条 */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl">
        <ConnectionPill state={conn} />

        <div className="flex items-center gap-1 ml-2">
          {files
            .filter((f) => f.active)
            .map((f) => {
              const on = selected.includes(f.name);
              return (
                <button
                  key={f.name}
                  onClick={() => toggleFile(f.name)}
                  className={cn(
                    'px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors',
                    on
                      ? f.stream === 'err'
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50',
                  )}
                >
                  {f.app}-{f.stream}
                </button>
              );
            })}
        </div>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as LogLevel | 'all')}
          className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
        >
          {LEVEL_FILTER.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>

        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="客户端过滤关键词"
          className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white w-40"
        />
        <input
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          placeholder="用户 tag (alice / a3f2c1d8)"
          className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white w-44"
        />

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setPaused((p) => !p)}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium',
              paused
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
            )}
            title={paused ? '恢复（已缓冲的会一次性 flush）' : '暂停（继续 buffer 但不渲染）'}
          >
            {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {paused ? '恢复' : '暂停'}
          </button>
          <button
            onClick={() => {
              setLines([]);
              pendingRef.current = [];
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700"
            title="清空当前缓冲（不影响后续推送）"
          >
            <Trash2 className="h-3 w-3" />
            清空
          </button>
          <button
            onClick={() => {
              setAutoScroll(true);
              const el = containerRef.current;
              if (el) el.scrollTop = el.scrollHeight;
            }}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium',
              autoScroll
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
            )}
            title="自动滚动到底"
          >
            <ArrowDownToLine className="h-3 w-3" />
            跟随
          </button>
        </div>
      </div>

      {errMsg && conn === 'error' && (
        <div className="mt-2 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">连接已断开</p>
            <p className="text-[11px] text-red-600 mt-0.5">{errMsg}</p>
          </div>
          <button
            onClick={() => setSelected((s) => [...s])} // 触发重连
            className="px-2 py-0.5 rounded bg-red-600 text-white text-[11px] font-medium hover:bg-red-700"
          >
            重连
          </button>
        </div>
      )}

      {/* 日志面板 */}
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="flex-1 mt-2 overflow-y-auto bg-slate-900/95 rounded-2xl border border-slate-200 min-h-0"
        style={{ scrollBehavior: autoScroll ? 'auto' : 'smooth' }}
      >
        <div className="bg-white">
          {visible.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-xs text-slate-400">
              {selected.length === 0
                ? '请选择至少 1 个文件订阅'
                : conn === 'connecting'
                  ? '连接中…'
                  : conn === 'error'
                    ? '连接异常'
                    : '等待新日志…'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visible.map((l) => (
                <LogLineRow
                  key={l.seq}
                  file={l.file}
                  parsed={l}
                  highlight={keyword || undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-400">
        <span>
          缓冲 {lines.length} / {MAX_BUFFER} · 显示 {visible.length}
          {paused && pendingRef.current.length > 0 && (
            <span className="ml-2 text-amber-600">（暂停中，{pendingRef.current.length} 条待 flush）</span>
          )}
        </span>
        <span>初始回灌 {INITIAL_LINES} 行 · 缓冲满后自动丢弃最早行</span>
      </div>
    </div>
  );
}

function ConnectionPill({ state }: { state: 'idle' | 'connecting' | 'open' | 'error' }) {
  const map = {
    idle: { label: '空闲', cls: 'bg-slate-100 text-slate-500 border-slate-200', Icon: WifiOff },
    connecting: {
      label: '连接中',
      cls: 'bg-amber-50 text-amber-700 border-amber-200',
      Icon: Wifi,
    },
    open: { label: '已连接', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: Wifi },
    error: { label: '已断开', cls: 'bg-red-50 text-red-700 border-red-200', Icon: WifiOff },
  } as const;
  const { label, cls, Icon } = map[state];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium',
        cls,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
