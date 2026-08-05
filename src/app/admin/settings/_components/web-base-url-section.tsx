'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Save, XCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { FromEnvBadge } from './from-env-badge';
import { CONTROL_WIDE } from './settings-form-styles';

interface GeneralConfigView {
  webBaseUrl: string;
  webBaseUrlFromEnv: boolean;
  configured: boolean;
}

export function WebBaseUrlSection() {
  const qc = useQueryClient();
  const [webBaseUrl, setWebBaseUrl] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<GeneralConfigView>({
    queryKey: ['admin', 'settings', 'general'],
    queryFn: () => apiClient.get('/admin/settings/general') as Promise<GeneralConfigView>,
  });

  useEffect(() => {
    if (data?.webBaseUrl != null) setWebBaseUrl(data.webBaseUrl);
  }, [data?.webBaseUrl]);

  const save = useMutation({
    mutationFn: (payload: { webBaseUrl: string }) =>
      apiClient.patch('/admin/settings/general', payload) as Promise<GeneralConfigView>,
    onSuccess: (cfg) => {
      setMsg({ ok: true, text: '前端站点地址已保存，密码重置与邀请链接将立即使用新地址。' });
      setWebBaseUrl(cfg.webBaseUrl);
      qc.setQueryData(['admin', 'settings', 'general'], (prev: any) => ({ ...prev, ...cfg }));
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请检查 URL 格式后重试。' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    save.mutate({ webBaseUrl: webBaseUrl.trim() });
  };

  const configured = !!data?.configured;

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
                <p className="text-base font-semibold text-slate-900">前端站点地址</p>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    configured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                  )}
                >
                  {configured ? '已配置' : '未配置'}
                </span>
                {data && <FromEnvBadge fromEnv={data.webBaseUrlFromEnv} />}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {configured
                  ? `${data?.webBaseUrl} · 用于密码重置、邀请注册等链接`
                  : '未配置时将使用默认 localhost'}
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
                WEB_BASE_URL
              </h2>
            </div>
            <div className="divide-y divide-slate-100 px-5 py-2">
              <FormField
                label="前端根地址"
                description="C 端前端根地址，不含尾斜杠。"
                controlClassName={CONTROL_WIDE}
              >
                <Input
                  size="sm"
                  type="url"
                  value={webBaseUrl}
                  onChange={(e) => setWebBaseUrl(e.target.value)}
                  placeholder="https://mv.offoff.ai"
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
              disabled={save.isPending || !webBaseUrl.trim()}
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
