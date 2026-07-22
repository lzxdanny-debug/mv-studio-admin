'use client';

import { useState } from 'react';

export interface ArticleFormValues {
  locale: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  coverUrl: string;
  seoTitle: string;
  seoDescription: string;
  tagsText: string;
}

export const EMPTY_ARTICLE_FORM: ArticleFormValues = {
  locale: 'zh',
  slug: '',
  title: '',
  excerpt: '',
  bodyMarkdown: '',
  coverUrl: '',
  seoTitle: '',
  seoDescription: '',
  tagsText: '',
};

export function parseTags(tagsText: string): string[] {
  return tagsText
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

interface ArticleFormProps {
  initial: ArticleFormValues;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (values: ArticleFormValues) => void;
  extraActions?: React.ReactNode;
}

export function ArticleForm({
  initial,
  submitLabel,
  busy,
  error,
  onSubmit,
  extraActions,
}: ArticleFormProps) {
  const [values, setValues] = useState<ArticleFormValues>(initial);
  const [slugTouched, setSlugTouched] = useState(!!initial.slug);

  const set =
    (key: keyof ArticleFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const next = e.target.value;
      setValues((prev) => {
        const updated = { ...prev, [key]: next };
        if (key === 'title' && !slugTouched) {
          updated.slug = slugify(next);
        }
        return updated;
      });
    };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">标题 *</span>
          <input
            required
            value={values.title}
            onChange={set('title')}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">Slug *</span>
          <input
            required
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setValues((prev) => ({ ...prev, slug: e.target.value }));
            }}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">语言 *</span>
          <select
            value={values.locale}
            onChange={set('locale')}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="zh">中文 (zh)</option>
            <option value="en">英文 (en)</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">封面 URL</span>
          <input
            value={values.coverUrl}
            onChange={set('coverUrl')}
            placeholder="https://..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-600">摘要</span>
        <textarea
          value={values.excerpt}
          onChange={set('excerpt')}
          rows={3}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-600">正文 Markdown *</span>
        <textarea
          required
          value={values.bodyMarkdown}
          onChange={set('bodyMarkdown')}
          rows={18}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm leading-relaxed"
          placeholder="# 标题&#10;&#10;正文…"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">SEO 标题</span>
          <input
            value={values.seoTitle}
            onChange={set('seoTitle')}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">标签（逗号分隔）</span>
          <input
            value={values.tagsText}
            onChange={set('tagsText')}
            placeholder="ai, mv, seo"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-slate-600">SEO 描述</span>
        <textarea
          value={values.seoDescription}
          onChange={set('seoDescription')}
          rows={2}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? '保存中…' : submitLabel}
        </button>
        {extraActions}
      </div>
    </form>
  );
}
