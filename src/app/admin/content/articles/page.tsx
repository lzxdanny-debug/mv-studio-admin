'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileText, Plus, Plug } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn, formatDate } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { PaginationBar } from '@/components/pagination-bar';
import { hasPermission } from '@/lib/admin-permissions';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { useAlert, useConfirm } from '@/components/ui/dialog-provider';

const WEB_BASE =
  process.env.NEXT_PUBLIC_MAIN_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';

/** C 端文章链接：中文无 locale 前缀，其它语言带 /{locale} */
function publicArticleUrl(locale: string, slug: string): string {
  const path =
    locale === 'zh' || locale === 'zh-CN'
      ? `/articles/${encodeURIComponent(slug)}`
      : `/${locale}/articles/${encodeURIComponent(slug)}`;
  return `${WEB_BASE}${path}`;
}

type ArticleStatus = 'draft' | 'published' | 'archived';

interface BlogArticleRow {
  id: string;
  locale: string;
  slug: string;
  status: ArticleStatus;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  tags: string[];
  externalSource: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

interface ListResponse {
  items: BlogArticleRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface SeobotInfo {
  webhookUrl: string;
  secretConfigured: boolean;
  secretMasked: string;
  secretFromEnv: boolean;
  notes: string[];
}

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已归档', value: 'archived' },
];

const LOCALE_OPTIONS = [
  { label: '全部语言', value: '' },
  { label: '中文', value: 'zh' },
  { label: '英文', value: 'en' },
];

const STATUS_BADGE: Record<ArticleStatus, string> = {
  draft: 'bg-amber-50 text-amber-700 border-amber-100',
  published: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  archived: 'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_LABEL: Record<ArticleStatus, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
};

export default function AdminArticlesPage() {
  const qc = useQueryClient();
  const alert = useAlert();
  const confirm = useConfirm();
  const permissions = useAdminAuthStore((s) => s.permissions);
  const canManage = hasPermission(permissions, 'blog.manage');
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [status, setStatus] = useState('');
  const [locale, setLocale] = useState('');
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [seobotOpen, setSeobotOpen] = useState(false);
  const [secretDraft, setSecretDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const listQuery = useQuery<ListResponse>({
    queryKey: ['admin', 'blog', 'articles', { page, pageSize, status, locale, q }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (status) params.set('status', status);
      if (locale) params.set('locale', locale);
      if (q) params.set('q', q);
      return apiClient.get(`/admin/blog/articles?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
  });

  const seobotQuery = useQuery<SeobotInfo>({
    queryKey: ['admin', 'blog', 'seobot'],
    queryFn: () => apiClient.get('/admin/blog/seobot') as any,
    enabled: seobotOpen,
  });

  const saveSecret = useMutation({
    mutationFn: (webhookSecret: string) =>
      apiClient.patch('/admin/blog/seobot', { webhookSecret }) as any,
    onSuccess: () => {
      setSecretDraft('');
      qc.invalidateQueries({ queryKey: ['admin', 'blog', 'seobot'] });
    },
  });

  const invalidateList = () =>
    qc.invalidateQueries({ queryKey: ['admin', 'blog', 'articles'] });

  async function runAction(
    id: string,
    action: 'publish' | 'unpublish' | 'delete',
  ) {
    if (action === 'delete') {
      const ok = await confirm({
        title: '删除文章',
        description: '确定删除该文章？此操作不可恢复。',
        confirmText: '删除',
        variant: 'danger',
      });
      if (!ok) return;
    }

    setBusyId(id);
    try {
      if (action === 'delete') {
        await apiClient.delete(`/admin/blog/articles/${id}`);
        alert({ title: '已删除', variant: 'success' });
      } else if (action === 'publish') {
        await apiClient.post(`/admin/blog/articles/${id}/publish`);
        alert({ title: '已发布', variant: 'success' });
      } else {
        await apiClient.post(`/admin/blog/articles/${id}/unpublish`);
        alert({ title: '已撤回发布', variant: 'success' });
      }
      await invalidateList();
    } catch (err: any) {
      alert({
        title: '操作失败',
        description: err?.message || '请稍后重试',
        variant: 'danger',
      });
    } finally {
      setBusyId(null);
    }
  }

  const statusButtons = useMemo(() => STATUS_OPTIONS, []);

  return (
    <div className="admin-page">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              文章
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              共 {listQuery.data?.total ?? 0} 篇 · Markdown 正文 · SEObot 同步默认进入草稿
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSeobotOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plug className="h-4 w-4" />
              SEObot 对接
            </button>
            {canManage && (
              <Link
                href="/admin/content/articles/new"
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                新建文章
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {statusButtons.map((opt) => (
              <button
                key={opt.value || 'all'}
                type="button"
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
          <select
            value={locale}
            onChange={(e) => {
              setPage(1);
              setLocale(e.target.value);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
          >
            {LOCALE_OPTIONS.map((opt) => (
              <option key={opt.value || 'all-locale'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setQ(searchInput.trim());
            }}
          >
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜索标题 / slug"
              className="w-56 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs"
            />
            <button
              type="submit"
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              搜索
            </button>
          </form>
        </div>

        <QueryState
          isLoading={listQuery.isLoading}
          isError={listQuery.isError}
          error={listQuery.error}
          isEmpty={!listQuery.data?.items.length}
          emptyMessage="暂无文章"
          height="h-64"
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">标题</th>
                  <th className="px-4 py-3 font-medium">语言</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">来源</th>
                  <th className="px-4 py-3 font-medium">更新时间</th>
                  <th className="px-4 py-3 font-medium">链接</th>
                  <th className="px-4 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listQuery.data?.items.map((row) => {
                  const publicUrl = publicArticleUrl(row.locale, row.slug);
                  const busy = busyId === row.id;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/content/articles/${row.id}`}
                          className="font-medium text-slate-900 hover:text-blue-600"
                        >
                          {row.title}
                        </Link>
                        <div className="mt-0.5 text-xs text-slate-400">/{row.slug}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.locale}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium',
                            STATUS_BADGE[row.status],
                          )}
                        >
                          {STATUS_LABEL[row.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {row.externalSource || '本地'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDate(row.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        {row.status === 'published' ? (
                          <a
                            href={publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-[220px] items-center gap-1 truncate text-xs text-blue-600 hover:underline"
                            title={publicUrl}
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {row.locale === 'zh' ? `/articles/${row.slug}` : `/${row.locale}/articles/${row.slug}`}
                            </span>
                          </a>
                        ) : (
                          <span
                            className="text-xs text-slate-400"
                            title="发布后可在 C 端访问"
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Link
                            href={`/admin/content/articles/${row.id}`}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            编辑
                          </Link>
                          {canManage && (
                            <>
                              {row.status !== 'published' ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => runAction(row.id, 'publish')}
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  发布
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => runAction(row.id, 'unpublish')}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  撤回
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => runAction(row.id, 'delete')}
                                className="rounded-lg border border-red-100 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                删除
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </QueryState>

        {!!listQuery.data?.total && (
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={listQuery.data.total}
            onPageChange={setPage}
            onPageSizeChange={onPageSizeChange}
          />
        )}
      </div>

      {seobotOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="关闭"
            onClick={() => setSeobotOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">SEObot 对接</h2>
              <button
                type="button"
                onClick={() => setSeobotOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
              >
                关闭
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
              {seobotQuery.isLoading && (
                <p className="text-slate-400">加载对接信息…</p>
              )}
              {seobotQuery.data && (
                <>
                  <div>
                    <div className="text-xs font-medium text-slate-500">Webhook URL</div>
                    <code className="mt-1 block break-all rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-800">
                      {seobotQuery.data.webhookUrl}
                    </code>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500">密钥状态</div>
                    <p className="mt-1 text-slate-700">
                      {seobotQuery.data.secretConfigured
                        ? `已配置（${seobotQuery.data.secretMasked}${
                            seobotQuery.data.secretFromEnv ? ' · 来自环境变量' : ''
                          }）`
                        : '未配置 — 请先设置密钥'}
                    </p>
                  </div>
                  <ul className="list-disc space-y-1 pl-5 text-slate-600">
                    {seobotQuery.data.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-2">
                    <p>请求头：`X-Seobot-Secret`（SEObot 自定义 Header）</p>
                    <p>
                      <span className="font-medium text-slate-700">兼容 SEObot 官方：</span>
                      id → externalId，headline → title，markdown →
                      bodyMarkdown，image → coverUrl，metaDescription →
                      seo/excerpt，tags[].title → tags
                    </p>
                    <p>
                      亦可自定义字段：externalId, locale, slug, title,
                      bodyMarkdown；可选 excerpt, coverUrl, tags, seoTitle,
                      seoDescription
                    </p>
                    <p>无 locale 时用 Query：`?locale=en`（默认 en）</p>
                  </div>
                  {canManage && (
                    <div className="space-y-2 pt-2">
                      <label className="block text-xs font-medium text-slate-500">
                        更新 Webhook 密钥
                      </label>
                      <input
                        type="password"
                        value={secretDraft}
                        onChange={(e) => setSecretDraft(e.target.value)}
                        placeholder="输入新密钥"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={!secretDraft.trim() || saveSecret.isPending}
                        onClick={() => saveSecret.mutate(secretDraft.trim())}
                        className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saveSecret.isPending ? '保存中…' : '保存密钥'}
                      </button>
                      {saveSecret.isError && (
                        <p className="text-xs text-red-600">保存失败，请重试</p>
                      )}
                      {saveSecret.isSuccess && (
                        <p className="text-xs text-emerald-600">密钥已更新</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
