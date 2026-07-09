'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Save, CheckCircle2, XCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { FromEnvBadge } from './from-env-badge';

interface GeneralConfigView {
  allowedOrigins: string;
  allowedOriginsFromEnv: boolean;
  allowedOriginsConfigured: boolean;
}

export function AllowedOriginsSection() {
  const qc = useQueryClient();
  const [allowedOrigins, setAllowedOrigins] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<GeneralConfigView>({
    queryKey: ['admin', 'settings', 'general'],
    queryFn: async () => {
      const cfg = (await apiClient.get('/admin/settings/general')) as unknown as GeneralConfigView;
      setAllowedOrigins(cfg.allowedOrigins);
      return cfg;
    },
  });

  const save = useMutation({
    mutationFn: (payload: { allowedOrigins: string }) =>
      apiClient.patch('/admin/settings/general', payload) as any,
    onSuccess: (cfg: GeneralConfigView) => {
      setMsg({ ok: true, text: 'CORS 白名单已保存，下一次跨域请求即生效（无需重启）。' });
      setAllowedOrigins(cfg.allowedOrigins);
      qc.invalidateQueries({ queryKey: ['admin', 'settings', 'general'] });
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

  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        跨域白名单
      </h2>
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-40">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <Shield className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">ALLOWED_ORIGINS</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                允许哪些前端域名跨域访问 API。逗号分隔，填写完整 URL（不含尾斜杠）。
                本地开发至少包含管理后台地址，例如 <code className="text-slate-500">http://localhost:4002</code>。
              </p>
              {data && (
                <div className="flex items-center gap-1.5 mt-2">
                  {data.allowedOriginsConfigured ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-xs text-emerald-600 font-medium">
                        已配置 · {data.allowedOrigins.split(',').length} 个来源
                        <FromEnvBadge fromEnv={data.allowedOriginsFromEnv} />
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs text-amber-600 font-medium">
                        未配置，使用默认 localhost:3000
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                允许的来源（逗号分隔）
              </label>
              <textarea
                value={allowedOrigins}
                onChange={(e) => setAllowedOrigins(e.target.value)}
                placeholder="http://localhost:4002, https://mv.offoff.ai, https://admin.offoff.ai"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 resize-y min-h-[4.5rem]"
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
                disabled={save.isPending || !allowedOrigins.trim()}
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
