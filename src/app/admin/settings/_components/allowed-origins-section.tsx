'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Save, XCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { FormField } from '@/components/ui/form-field';
import { FromEnvBadge } from './from-env-badge';

interface GeneralConfigView {
  allowedOrigins: string;
  allowedOriginsFromEnv: boolean;
  allowedOriginsConfigured: boolean;
}

const TEXTAREA_CLS = cn(
  'w-full resize-y min-h-[4.5rem] border bg-white text-slate-800',
  'rounded-[10px] border-slate-200/90 px-2.5 py-2 text-xs',
  'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
  'transition-[border-color,box-shadow,background-color] duration-150',
  'hover:border-slate-300 hover:bg-slate-50/70',
  'focus:outline-none focus-visible:border-blue-400 focus-visible:ring-[3px] focus-visible:ring-blue-500/15',
  'placeholder:text-slate-400',
);

export function AllowedOriginsSection() {
  const qc = useQueryClient();
  const [allowedOrigins, setAllowedOrigins] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<GeneralConfigView>({
    queryKey: ['admin', 'settings', 'general'],
    queryFn: () => apiClient.get('/admin/settings/general') as Promise<GeneralConfigView>,
  });

  useEffect(() => {
    if (data?.allowedOrigins != null) setAllowedOrigins(data.allowedOrigins);
  }, [data?.allowedOrigins]);

  const save = useMutation({
    mutationFn: (payload: { allowedOrigins: string }) =>
      apiClient.patch('/admin/settings/general', payload) as Promise<GeneralConfigView>,
    onSuccess: (cfg) => {
      setMsg({ ok: true, text: 'CORS 白名单已保存，下一次跨域请求即生效（无需重启）。' });
      setAllowedOrigins(cfg.allowedOrigins);
      qc.setQueryData(['admin', 'settings', 'general'], (prev: any) => ({ ...prev, ...cfg }));
    },
    onError: (e: any) => {
      setMsg({
        ok: false,
        text: e?.message || e?.error || '保存失败，请检查 URL 格式后重试。',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    save.mutate({ allowedOrigins: allowedOrigins.trim() });
  };

  const configured = !!data?.allowedOriginsConfigured;
  const originCount = data?.allowedOrigins
    ? data.allowedOrigins.split(',').filter(Boolean).length
    : 0;

  return (
    <section>
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-40">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className={cn(
              'flex items-center justify-between gap-4 rounded-2xl border px-5 py-4',
              configured
                ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50'
                : 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50',
            )}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-slate-900">跨域白名单</p>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    configured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                  )}
                >
                  {configured ? `${originCount} 个来源` : '未配置'}
                </span>
                {data && <FromEnvBadge fromEnv={data.allowedOriginsFromEnv} />}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {configured
                  ? '允许的前端域名可跨域访问 API'
                  : '未配置时使用默认 localhost:3000'}
              </p>
            </div>
            {configured ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
            ) : (
              <XCircle className="h-6 w-6 shrink-0 text-amber-500" />
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                ALLOWED_ORIGINS
              </h2>
            </div>
            <div className="divide-y divide-slate-100 px-5 py-2">
              <FormField
                label="允许的来源"
                description="逗号分隔的完整 URL（不含尾斜杠）。本地开发至少包含管理后台，如 http://localhost:4002。"
                className="items-start"
                controlClassName="sm:w-[420px] w-full"
              >
                <textarea
                  value={allowedOrigins}
                  onChange={(e) => setAllowedOrigins(e.target.value)}
                  placeholder="http://localhost:4002, https://mv.offoff.ai, https://admin.offoff.ai"
                  rows={3}
                  className={TEXTAREA_CLS}
                />
              </FormField>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {msg && (
              <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
                {msg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={save.isPending || !allowedOrigins.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" />
              {save.isPending ? '保存中…' : '保存配置'}
            </button>
          </div>
        </form>
      </QueryState>
    </section>
  );
}
