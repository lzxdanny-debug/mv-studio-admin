'use client';

import { cn } from '@/lib/utils';
import { ParsedLogLine, LogLevel } from '../_lib/types';

const LEVEL_STYLE: Record<LogLevel, { row: string; tag: string; label: string }> = {
  error: {
    row: 'bg-red-50/40 hover:bg-red-50',
    tag: 'bg-red-100 text-red-700 border-red-200',
    label: 'ERROR',
  },
  fatal: {
    row: 'bg-red-100/50 hover:bg-red-100',
    tag: 'bg-red-200 text-red-900 border-red-300',
    label: 'FATAL',
  },
  warn: {
    row: 'bg-amber-50/40 hover:bg-amber-50',
    tag: 'bg-amber-100 text-amber-700 border-amber-200',
    label: 'WARN',
  },
  log: {
    row: 'hover:bg-slate-50',
    tag: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    label: 'LOG',
  },
  debug: {
    row: 'hover:bg-slate-50',
    tag: 'bg-slate-100 text-slate-600 border-slate-200',
    label: 'DEBUG',
  },
  verbose: {
    row: 'hover:bg-slate-50',
    tag: 'bg-slate-100 text-slate-500 border-slate-200',
    label: 'VERBOSE',
  },
  unknown: {
    row: 'hover:bg-slate-50',
    tag: 'bg-slate-100 text-slate-500 border-slate-200',
    label: '·',
  },
};

interface Props {
  /** 来自哪个文件（实时 / 历史展示用） */
  file: string;
  /** 历史搜索时的源文件行号；实时 tail 不显示 */
  lineNumber?: number;
  parsed: ParsedLogLine;
  /** 关键词高亮（不区分大小写） */
  highlight?: string;
}

export function LogLineRow({ file, lineNumber, parsed, highlight }: Props) {
  const style = LEVEL_STYLE[parsed.level] ?? LEVEL_STYLE.unknown;
  return (
    <div
      className={cn(
        'group flex items-start gap-2 px-3 py-1 font-mono text-[12px] leading-[1.45] transition-colors',
        style.row,
      )}
    >
      <span className="flex-shrink-0 w-[140px] text-slate-400 truncate">
        {parsed.timestamp ? formatTime(parsed.timestamp) : ''}
      </span>
      <span
        className={cn(
          'flex-shrink-0 inline-flex items-center px-1 h-[18px] rounded text-[10px] font-semibold border',
          style.tag,
        )}
      >
        {style.label}
      </span>
      {parsed.context && (
        <span className="flex-shrink-0 text-teal-600 truncate max-w-[160px]" title={parsed.context}>
          [{parsed.context}]
        </span>
      )}
      {parsed.userTag && (
        <span
          className="flex-shrink-0 inline-flex items-center px-1 h-[18px] rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200"
          title={parsed.userTag}
        >
          u={parsed.userTag.length > 16 ? parsed.userTag.slice(0, 16) + '…' : parsed.userTag}
        </span>
      )}
      <span className="flex-1 text-slate-800 whitespace-pre-wrap break-all min-w-0">
        {highlight ? <Highlighted text={parsed.message} kw={highlight} /> : parsed.message}
      </span>
      <span
        className="flex-shrink-0 text-[10px] text-slate-300 opacity-0 group-hover:opacity-100"
        title={file}
      >
        {file}{typeof lineNumber === 'number' ? `:${lineNumber}` : ''}
      </span>
    </div>
  );
}

function Highlighted({ text, kw }: { text: string; kw: string }) {
  if (!kw) return <>{text}</>;
  const re = new RegExp(`(${escapeRe(kw)})`, 'gi');
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 19);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
