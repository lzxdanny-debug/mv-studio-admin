'use client';

import { cn } from '@/lib/utils';
import { QueryState } from './query-state';
import { PaginationBar } from './pagination-bar';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  /** Tailwind width like "w-32" or "w-[160px]" */
  width?: string;
  /** Additional classes for this column's header cell. */
  headerClassName?: string;
  /** Additional classes for this column's body cells. */
  cellClassName?: string;
  /** Right-align (numeric) */
  align?: 'left' | 'center' | 'right';
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  /** Optional page-specific table sizing, e.g. a minimum width for horizontal scrolling. */
  tableClassName?: string;
  isLoading?: boolean;
  isError?: boolean;
  error?: any;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  /** Pagination — omit `total`/`onPageChange` to disable. */
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  tableClassName,
  isLoading,
  isError,
  error,
  emptyMessage,
  onRowClick,
  page = 1,
  pageSize = 20,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
}: DataTableProps<T>) {
  const isEmpty = !isLoading && !isError && (!rows || rows.length === 0);
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={isEmpty}
        emptyMessage={emptyMessage}
        height="h-64"
      >
        <div className="overflow-x-auto">
          <table className={cn('w-full text-sm', tableClassName)}>
            <thead className="bg-slate-100/80 border-b border-slate-200">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap',
                      col.width,
                      col.headerClassName,
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      (!col.align || col.align === 'left') && 'text-left',
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows?.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={cn(
                    'hover:bg-blue-50/40 transition-colors',
                    onRowClick && 'cursor-pointer',
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-slate-700',
                        col.cellClassName,
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>

      {total !== undefined && onPageChange && (
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </div>
  );
}
