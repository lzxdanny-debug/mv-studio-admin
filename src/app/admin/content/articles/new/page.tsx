'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import apiClient from '@/lib/api';
import {
  ArticleForm,
  EMPTY_ARTICLE_FORM,
  parseTags,
  type ArticleFormValues,
} from '../_components/article-form';

function errMessage(err: unknown): string {
  const anyErr = err as { response?: { data?: { message?: string | string[] } }; message?: string };
  const msg = anyErr?.response?.data?.message ?? anyErr?.message;
  if (Array.isArray(msg)) return msg.join('；');
  return msg || '创建失败';
}

export default function NewArticlePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (values: ArticleFormValues) =>
      apiClient.post('/admin/blog/articles', {
        locale: values.locale,
        slug: values.slug,
        title: values.title,
        excerpt: values.excerpt,
        bodyMarkdown: values.bodyMarkdown,
        coverUrl: values.coverUrl || undefined,
        seoTitle: values.seoTitle || undefined,
        seoDescription: values.seoDescription || undefined,
        tags: parseTags(values.tagsText),
      }) as Promise<{ id: string }>,
    onSuccess: (article) => {
      router.replace(`/admin/content/articles/${article.id}`);
    },
    onError: (err) => setError(errMessage(err)),
  });

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
          <h1 className="mt-2 text-xl font-bold text-slate-900">新建文章</h1>
          <p className="mt-1 text-sm text-slate-500">默认保存为草稿，发布后才会出现在 C 端。</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <ArticleForm
            initial={EMPTY_ARTICLE_FORM}
            submitLabel="创建草稿"
            busy={create.isPending}
            error={error}
            onSubmit={(values) => {
              setError(null);
              create.mutate(values);
            }}
          />
        </div>
      </div>
    </div>
  );
}
