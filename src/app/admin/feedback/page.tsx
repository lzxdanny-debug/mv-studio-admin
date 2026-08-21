'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, Image as ImageIcon, MessageCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn, formatDate } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { PaginationBar } from '@/components/pagination-bar';

interface FeedbackRow {
  id: string;
  category: 'bug' | 'suggestion' | 'other';
  content: string;
  contactEmail: string | null;
  contactName: string | null;
  subject: string | null;
  screenshotUrl: string | null;
  userId: string | null;
  isRead: boolean;
  pagePath: string | null;
  createdAt: string;
  user: { id: string; displayName: string; email: string | null } | null;
}

interface ListResponse {
  items: FeedbackRow[];
  total: number;
  page: number;
  pageSize: number;
}

const CATEGORY_OPTIONS = [
  { label: '全部', value: '' },
  { label: 'Bug', value: 'bug' },
  { label: '建议', value: 'suggestion' },
  { label: '其它', value: 'other' },
];

const CATEGORY_BADGE: Record<string, string> = {
  bug: 'bg-red-50 text-red-700 border-red-100',
  suggestion: 'bg-blue-50 text-blue-700 border-blue-100',
  other: 'bg-slate-100 text-slate-700 border-slate-200',
};

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug',
  suggestion: '建议',
  other: '其它',
};

const READ_OPTIONS = [
  { label: '全部', value: '' },
  { label: '未读', value: 'false' },
  { label: '已读', value: 'true' },
];

export default function AdminFeedbackPage() {
  const qc = useQueryClient();
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [category, setCategory] = useState('');
  const [readFilter, setReadFilter] = useState('');

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'feedback', { page, pageSize, category, readFilter }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (category) params.set('category', category);
      if (readFilter) params.set('isRead', readFilter);
      return apiClient.get(`/admin/feedback?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: ({ id, isRead }: { id: string; isRead: boolean }) =>
      apiClient.patch(`/admin/feedback/${id}/read`, { isRead }) as any,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'feedback'] });
      qc.invalidateQueries({ queryKey: ['admin', 'feedback', 'unread'] });
    },
  });


  return (
    <div className="admin-page">
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-blue-600" />
            联系反馈
          </h1>
          <p className="text-sm text-slate-500 mt-1">查看联系表单与站内用户反馈，共 {data?.total ?? 0} 条</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setPage(1);
                  setCategory(opt.value);
                }}
                className={
                  category === opt.value
                    ? 'px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-600 text-white'
                    : 'px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100'
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {READ_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setPage(1);
                  setReadFilter(opt.value);
                }}
                className={
                  readFilter === opt.value
                    ? 'px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-600 text-white'
                    : 'px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100'
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={!data?.items.length}
          emptyMessage="暂无反馈"
          height="h-64"
        >
          <div className="space-y-3">
            {data?.items.map((fb) => (
              <div
                key={fb.id}
                className={cn(
                  'bg-white border rounded-2xl p-4 transition-all',
                  fb.isRead ? 'border-slate-200' : 'border-blue-200 ring-1 ring-blue-100',
                )}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
                        CATEGORY_BADGE[fb.category] ?? CATEGORY_BADGE.other,
                      )}
                    >
                      {fb.contactName ? '联系表单' : (CATEGORY_LABELS[fb.category] ?? fb.category)}
                    </span>
                    {!fb.isRead && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-500 text-white">
                        未读
                      </span>
                    )}
                    {fb.user ? (
                      <span className="text-xs text-slate-500">
                        {fb.user.displayName}
                        {fb.user.email && (
                          <span className="text-slate-400"> · {fb.user.email}</span>
                        )}
                      </span>
                    ) : fb.contactName ? (
                      <span className="text-xs text-slate-500">访客 · {fb.contactName}</span>
                    ) : (
                      <span className="text-xs text-slate-400">匿名</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] text-slate-400">{formatDate(fb.createdAt)}</span>
                    <button
                      onClick={() =>
                        markRead.mutate({ id: fb.id, isRead: !fb.isRead })
                      }
                      disabled={markRead.isPending}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors disabled:opacity-50',
                        fb.isRead
                          ? 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200',
                      )}
                    >
                      <Check className="h-3 w-3" />
                      {fb.isRead ? '标记未读' : '标记已读'}
                    </button>
                  </div>
                </div>
                {fb.subject && (
                  <h2 className="mb-1.5 text-sm font-semibold text-slate-900 break-words">
                    {fb.subject}
                  </h2>
                )}
                <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                  {fb.content}
                </p>
                {(fb.contactEmail || fb.pagePath || fb.screenshotUrl) && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
                    {fb.contactEmail && (
                      <span className="text-slate-500">
                        联系：<span className="text-slate-700">{fb.contactEmail}</span>
                      </span>
                    )}
                    {fb.pagePath && /^https?:\/\//i.test(fb.pagePath) && (
                      <a
                        href={fb.pagePath}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-xl items-center gap-1 truncate text-blue-600 hover:text-blue-700"
                      >
                        来源页面：{fb.pagePath}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    )}
                    {fb.pagePath && !/^https?:\/\//i.test(fb.pagePath) && (
                      <span className="max-w-xl truncate font-mono text-slate-500">
                        来源页面：{fb.pagePath}
                      </span>
                    )}
                    {fb.screenshotUrl && (
                      <a
                        href={fb.screenshotUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                      >
                        <ImageIcon className="h-3 w-3" />
                        查看截图
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </QueryState>

        {data && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <PaginationBar
              page={page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={setPage}
              onPageSizeChange={onPageSizeChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
