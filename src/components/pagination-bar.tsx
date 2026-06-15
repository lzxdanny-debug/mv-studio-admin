'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface PaginationBarProps {
  page: number;
  pageSize: number;
  total?: number;
  hasMore?: boolean;
  onPageChange: (page: number) => void;
  /** 传入后显示「每页条数」下拉，并触发服务端重新拉取 */
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  /** 当前页左右各展示几个页码按钮，默认 5 */
  windowRadius?: number;
}

function buildPageItems(
  page: number,
  totalPages: number,
  radius: number,
): Array<number | 'ellipsis'> {
  const start = Math.max(1, page - radius);
  const end = Math.min(totalPages, page + radius);
  const items: Array<number | 'ellipsis'> = [];

  if (start > 1) {
    items.push(1);
    if (start > 2) items.push('ellipsis');
  }

  for (let i = start; i <= end; i++) items.push(i);

  if (end < totalPages) {
    if (end < totalPages - 1) items.push('ellipsis');
    items.push(totalPages);
  }

  return items;
}

/** 服务端分页底栏：每页条数、页码窗口、快捷跳转、输入页码 Go / 回车 */
export function PaginationBar({
  page,
  pageSize,
  total,
  hasMore,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  className,
  windowRadius = 5,
}: PaginationBarProps) {
  const [jumpInput, setJumpInput] = useState('');

  const totalPages = total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : undefined;
  const canPrev = page > 1;
  const canNext =
    totalPages !== undefined ? page < totalPages : hasMore === true;

  useEffect(() => {
    setJumpInput('');
  }, [page]);

  const pageItems = useMemo(() => {
    if (totalPages === undefined || totalPages <= 1) return [];
    return buildPageItems(page, totalPages, windowRadius);
  }, [page, totalPages, windowRadius]);

  const commitJump = () => {
    if (totalPages === undefined) return;
    const parsed = parseInt(jumpInput.trim(), 10);
    if (Number.isNaN(parsed)) return;
    const target = Math.min(totalPages, Math.max(1, parsed));
    onPageChange(target);
    setJumpInput('');
  };

  const showNav = totalPages === undefined ? canPrev || canNext : (totalPages ?? 0) > 1;
  const hasData = (total ?? 0) > 0 || canPrev || canNext;

  if (!hasData) return null;
  if (!showNav && !onPageSizeChange) return null;

  const btnBase =
    'min-w-[1.75rem] h-7 px-1.5 rounded-lg text-xs font-medium transition-colors';
  const btnIdle = 'text-slate-600 hover:bg-white border border-transparent';
  const btnActive = 'bg-teal-600 text-white border border-teal-600 shadow-sm';
  const btnDisabled = 'opacity-30 cursor-not-allowed';

  const selectCls =
    'h-7 pl-2 pr-6 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400';

  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 px-4 py-3 border-t border-slate-200 bg-slate-50 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <p className="text-xs text-slate-500">
          {total !== undefined ? (
            <>
              共 <span className="font-medium text-slate-700">{total}</span> 条，第{' '}
              <span className="font-medium text-slate-700">{page}</span>
              {totalPages !== undefined && <> / {totalPages} 页</>}
            </>
          ) : (
            <>
              第 <span className="font-medium text-slate-700">{page}</span> 页
              {hasMore === false && '（已到末页）'}
            </>
          )}
        </p>
        {onPageSizeChange && (
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <span className="whitespace-nowrap">每页</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className={selectCls}
              aria-label="每页条数"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n} 条
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {(showNav || (totalPages !== undefined && totalPages > 1)) && (
        <div className="flex flex-wrap items-center gap-1 justify-end">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={!canPrev}
            title="上一页"
            className={cn(
              'p-1.5 rounded-lg text-slate-500 hover:bg-white',
              !canPrev && btnDisabled,
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {pageItems.map((item, idx) =>
            item === 'ellipsis' ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1 text-xs text-slate-400 select-none"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                className={cn(btnBase, item === page ? btnActive : btnIdle)}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() =>
              onPageChange(
                totalPages !== undefined ? Math.min(totalPages, page + 1) : page + 1,
              )
            }
            disabled={!canNext}
            title="下一页"
            className={cn(
              'p-1.5 rounded-lg text-slate-500 hover:bg-white',
              !canNext && btnDisabled,
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {totalPages !== undefined && totalPages > 1 && (
            <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-slate-200">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitJump();
                  }
                }}
                placeholder="页码"
                className="w-14 h-7 px-2 text-xs text-center border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                aria-label="跳转页码"
              />
              <button
                type="button"
                onClick={commitJump}
                disabled={!jumpInput.trim()}
                className={cn(
                  'h-7 px-2.5 rounded-lg text-xs font-medium border transition-colors',
                  jumpInput.trim()
                    ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    : 'bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed',
                )}
              >
                Go
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
