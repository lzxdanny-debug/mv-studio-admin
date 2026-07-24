'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Headphones, Send } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn, formatDate } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { PaginationBar } from '@/components/pagination-bar';

interface ConversationRow {
  id: string;
  userId: string;
  status: string;
  category: string | null;
  lastMessageAt: string | null;
  unreadForAdmin: number;
  assigneeAdminId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MessageRow {
  id: string;
  role: 'user' | 'assistant' | 'agent' | 'system';
  content: string;
  attachments?: Array<{ url: string; name?: string }> | null;
  createdAt: string;
}

interface ListResponse {
  items: ConversationRow[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '待人工', value: 'waiting_human' },
  { label: '人工中', value: 'human' },
  { label: 'Bot', value: 'bot' },
  { label: '已解决', value: 'resolved' },
  { label: '已关闭', value: 'closed' },
];

const STATUS_LABEL: Record<string, string> = {
  bot: 'Bot',
  waiting_human: '待人工',
  human: '人工中',
  resolved: '已解决',
  closed: '已关闭',
};

const CATEGORY_LABEL: Record<string, string> = {
  cancel_subscription: '取消订阅',
  invoice: '发票',
  billing_refund: '退款/积分',
  video_stuck: '生成卡住',
  account: '账号',
  other: '其他',
};

export default function AdminSupportInboxPage() {
  const qc = useQueryClient();
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [status, setStatus] = useState('waiting_human');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const listQ = useQuery<ListResponse>({
    queryKey: ['admin', 'support', { page, pageSize, status }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (status) params.set('status', status);
      return apiClient.get(`/admin/support/conversations?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
    refetchInterval: 20_000,
  });

  const detailQ = useQuery<{ conversation: ConversationRow; messages: MessageRow[] }>({
    queryKey: ['admin', 'support', 'detail', selectedId],
    queryFn: () => apiClient.get(`/admin/support/conversations/${selectedId}`) as any,
    enabled: !!selectedId,
    refetchInterval: selectedId ? 10_000 : false,
  });

  const reply = useMutation({
    mutationFn: (content: string) =>
      apiClient.post(`/admin/support/conversations/${selectedId}/messages`, { content }) as any,
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['admin', 'support'] });
      qc.invalidateQueries({ queryKey: ['admin', 'support', 'unread'] });
    },
  });

  const patch = useMutation({
    mutationFn: (body: { status?: string; claim?: boolean }) =>
      apiClient.patch(`/admin/support/conversations/${selectedId}`, body) as any,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'support'] });
      qc.invalidateQueries({ queryKey: ['admin', 'support', 'unread'] });
    },
  });

  const selected = detailQ.data?.conversation;
  const messages = detailQ.data?.messages ?? [];

  const emptyHint = useMemo(() => {
    if (status === 'waiting_human') return '暂无待接入会话';
    return '暂无会话';
  }, [status]);

  return (
    <div className="admin-page">
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Headphones className="h-5 w-5 text-blue-600" />
            客服 Inbox
          </h1>
          <p className="text-sm text-slate-500 mt-1">共 {listQ.data?.total ?? 0} 条会话</p>
        </div>

        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit flex-wrap">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value || 'all'}
              onClick={() => {
                setPage(1);
                setStatus(opt.value);
              }}
              className={
                status === opt.value
                  ? 'px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-600 text-white'
                  : 'px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100'
              }
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[560px]">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
            <QueryState
              isLoading={listQ.isLoading}
              isError={listQ.isError}
              error={listQ.error}
              isEmpty={!listQ.data?.items?.length}
              emptyMessage={emptyHint}
              height="h-72"
            >
              <ul className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[560px]">
                {listQ.data?.items.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        'w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors',
                        selectedId === c.id && 'bg-blue-50',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-slate-500 truncate">
                          {c.id.slice(0, 8)}
                        </span>
                        {c.unreadForAdmin > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500 text-white">
                            {c.unreadForAdmin}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <span className="font-medium text-slate-800">
                          {STATUS_LABEL[c.status] ?? c.status}
                        </span>
                        {c.category && (
                          <span className="text-slate-400">
                            {CATEGORY_LABEL[c.category] ?? c.category}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatDate(c.lastMessageAt || c.updatedAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </QueryState>
            {listQ.data && (
              <div className="border-t border-slate-100 p-2">
                <PaginationBar
                  page={page}
                  pageSize={pageSize}
                  total={listQ.data.total}
                  onPageChange={setPage}
                  onPageSizeChange={onPageSizeChange}
                />
              </div>
            )}
          </div>

          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl flex flex-col min-h-[560px]">
            {!selectedId ? (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                选择左侧会话开始接待
              </div>
            ) : (
              <QueryState
                isLoading={detailQ.isLoading}
                isError={detailQ.isError}
                error={detailQ.error}
                isEmpty={false}
                height="h-full"
              >
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {STATUS_LABEL[selected?.status ?? ''] ?? selected?.status} ·{' '}
                      {selected?.category
                        ? CATEGORY_LABEL[selected.category] ?? selected.category
                        : '未分类'}
                    </p>
                    <p className="text-xs text-slate-400 font-mono truncate">
                      user {selected?.userId?.slice(0, 8)} · conv {selected?.id?.slice(0, 8)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      disabled={patch.isPending}
                      onClick={() => patch.mutate({ claim: true })}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 hover:bg-slate-50"
                    >
                      接手
                    </button>
                    <button
                      type="button"
                      disabled={patch.isPending}
                      onClick={() => patch.mutate({ status: 'resolved' })}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      解决
                    </button>
                    <button
                      type="button"
                      disabled={patch.isPending}
                      onClick={() => patch.mutate({ status: 'closed' })}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      关闭
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-[420px]">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        'max-w-[90%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap',
                        m.role === 'user'
                          ? 'ml-auto bg-blue-600 text-white'
                          : m.role === 'agent'
                            ? 'mr-auto bg-emerald-50 text-emerald-900 border border-emerald-100'
                            : m.role === 'system'
                              ? 'mx-auto bg-amber-50 text-amber-900 text-xs'
                              : 'mr-auto bg-slate-100 text-slate-800',
                      )}
                    >
                      <p className="text-[10px] opacity-70 mb-0.5 uppercase">{m.role}</p>
                      {m.content}
                      {m.attachments?.map((a) => (
                        <a
                          key={a.url}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block mt-2 underline text-xs"
                        >
                          {a.name || '附件'}
                        </a>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 p-3 flex gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const text = draft.trim();
                        if (!text || reply.isPending) return;
                        reply.mutate(text);
                      }
                    }}
                    rows={2}
                    placeholder="输入人工回复…（Enter 发送，Shift+Enter 换行）"
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  />
                  <button
                    type="button"
                    disabled={reply.isPending || !draft.trim()}
                    onClick={() => reply.mutate(draft.trim())}
                    className="self-end inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium"
                  >
                    <Send className="h-3.5 w-3.5" />
                    发送
                  </button>
                </div>
              </QueryState>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
