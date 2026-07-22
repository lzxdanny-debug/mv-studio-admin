'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { cn, formatDate } from '@/lib/utils';
import { hasPermission } from '@/lib/admin-permissions';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import {
  ArticleForm,
  parseTags,
  type ArticleFormValues,
} from '../_components/article-form';

type ArticleStatus = 'draft' | 'published' | 'archived';

interface BlogArticle {
  id: string;
  locale: string;
  slug: string;
  status: ArticleStatus;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  coverUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  tags: string[];
  externalSource: string | null;
  externalId: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

function errMessage(err: unknown): string {
  const anyErr = err as { response?: { data?: { message?: string | string[] } }; message?: string };
  const msg = anyErr?.response?.data?.message ?? anyErr?.message;
  if (Array.isArray(msg)) return msg.join('；');
  return msg || '操作失败';
}

const STATUS_LABEL: Record<ArticleStatus, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
};

export default function EditArticlePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const permissions = useAdminAuthStore((s) => s.permissions);
  const canManage = hasPermission(permissions, 'blog.manage');
  const [error, setError] = useState<string | null>(null);

  const detail = useQuery<BlogArticle>({
    queryKey: ['admin', 'blog', 'article', id],
    queryFn: () => apiClient.get(`/admin/blog/articles/${id}`) as any,
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'blog', 'article', id] });
    qc.invalidateQueries({ queryKey: ['admin', 'blog', 'articles'] });
  };

  const save = useMutation({
    mutationFn: (values: ArticleFormValues) =>
      apiClient.patch(`/admin/blog/articles/${id}`, {
        locale: values.locale,
        slug: values.slug,
        title: values.title,
        excerpt: values.excerpt,
        bodyMarkdown: values.bodyMarkdown,
        coverUrl: values.coverUrl || null,
        seoTitle: values.seoTitle || null,
        seoDescription: values.seoDescription || null,
        tags: parseTags(values.tagsText),
      }) as any,
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(errMessage(err)),
  });

  const publish = useMutation({
    mutationFn: () => apiClient.post(`/admin/blog/articles/${id}/publish`) as any,
    onSuccess: invalidate,
    onError: (err) => setError(errMessage(err)),
  });

  const unpublish = useMutation({
    mutationFn: () => apiClient.post(`/admin/blog/articles/${id}/unpublish`) as any,
    onSuccess: invalidate,
    onError: (err) => setError(errMessage(err)),
  });

  const archive = useMutation({
    mutationFn: () => apiClient.post(`/admin/blog/articles/${id}/archive`) as any,
    onSuccess: invalidate,
    onError: (err) => setError(errMessage(err)),
  });

  const initial = useMemo<ArticleFormValues | null>(() => {
    const a = detail.data;
    if (!a) return null;
    return {
      locale: a.locale,
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt ?? '',
      bodyMarkdown: a.bodyMarkdown ?? '',
      coverUrl: a.coverUrl ?? '',
      seoTitle: a.seoTitle ?? '',
      seoDescription: a.seoDescription ?? '',
      tagsText: (a.tags ?? []).join(', '),
    };
  }, [detail.data]);

  const busy =
    save.isPending || publish.isPending || unpublish.isPending || archive.isPending;

  return (
    <div className="admin-page">
      <div className="p-6 max-w-4xl space-y-5">
        <div>
          <Link
            href="/admin/content/articles"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">编辑文章</h1>
            {detail.data && (
              <span
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                  detail.data.status === 'published'
                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                    : detail.data.status === 'archived'
                      ? 'border-slate-200 bg-slate-100 text-slate-600'
                      : 'border-amber-100 bg-amber-50 text-amber-700',
                )}
              >
                {STATUS_LABEL[detail.data.status]}
              </span>
            )}
          </div>
          {detail.data && (
            <p className="mt-1 text-sm text-slate-500">
              更新于 {formatDate(detail.data.updatedAt)}
              {detail.data.externalSource
                ? ` · 来源 ${detail.data.externalSource}/${detail.data.externalId}`
                : ''}
            </p>
          )}
        </div>

        <QueryState
          isLoading={detail.isLoading}
          isError={detail.isError}
          error={detail.error}
          isEmpty={!detail.data}
          emptyMessage="文章不存在"
          height="h-64"
        >
          {initial && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <ArticleForm
                key={`${detail.data?.id}-${detail.data?.updatedAt}`}
                initial={initial}
                submitLabel="保存"
                busy={busy}
                error={error}
                onSubmit={(values) => {
                  if (!canManage) return;
                  setError(null);
                  save.mutate(values);
                }}
                extraActions={
                  canManage ? (
                    <>
                      {detail.data?.status !== 'published' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setError(null);
                            publish.mutate();
                          }}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          发布
                        </button>
                      )}
                      {detail.data?.status === 'published' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setError(null);
                            unpublish.mutate();
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          撤回发布
                        </button>
                      )}
                      {detail.data?.status !== 'archived' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setError(null);
                            archive.mutate();
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        >
                          归档
                        </button>
                      )}
                    </>
                  ) : undefined
                }
              />
            </div>
          )}
        </QueryState>
      </div>
    </div>
  );
}
