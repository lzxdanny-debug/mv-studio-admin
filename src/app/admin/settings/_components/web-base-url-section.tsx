'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, Save, CheckCircle2, XCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { FromEnvBadge } from './from-env-badge';

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
    queryFn: async () => {
      const cfg = (await apiClient.get('/admin/settings/general')) as unknown as GeneralConfigView;
      setWebBaseUrl(cfg.webBaseUrl);
      return cfg;
    },
  });

  const save = useMutation({
    mutationFn: (payload: { webBaseUrl: string }) =>
      apiClient.patch('/admin/settings/general', payload) as any,
    onSuccess: (cfg: GeneralConfigView) => {
      setMsg({ ok: true, text: '前端站点地址已保存，密码重置与邀请链接将立即使用新地址。' });
      setWebBaseUrl(cfg.webBaseUrl);
      qc.invalidateQueries({ queryKey: ['admin', 'settings', 'general'] });
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请检查 URL 格式后重试。' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    save.mutate({ webBaseUrl: webBaseUrl.trim() });
  };

  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        前端站点地址
      </h2>
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-40">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <Globe className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">WEB_BASE_URL</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                C 端前端根地址（不含尾斜杠）。用于密码重置邮件、邀请注册链接等。
              </p>
              {data && (
                <div className="flex items-center gap-1.5 mt-2">
                  {data.configured ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-xs text-emerald-600 font-medium">
                        已配置 · {data.webBaseUrl}
                        <FromEnvBadge fromEnv={data.webBaseUrlFromEnv} />
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs text-amber-600 font-medium">未配置，将使用默认 localhost</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">前端根地址</label>
              <input
                type="url"
                value={webBaseUrl}
                onChange={(e) => setWebBaseUrl(e.target.value)}
                placeholder="https://mv.offoff.ai"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
              />
            </div>

            {msg && (
              <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
                {msg.text}
              </p>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={save.isPending || !webBaseUrl.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                {save.isPending ? '保存中…' : '保存配置'}
              </button>
            </div>
          </form>
        </div>
      </QueryState>
    </section>
  );
}
