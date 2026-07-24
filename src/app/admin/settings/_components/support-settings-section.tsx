'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Headphones, Save, CheckCircle2, XCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';

interface SupportLimitField {
  id: string;
  settingKey: string;
  labelZh: string;
  helpZh: string;
  value: number;
  default: number;
  min: number;
  max: number;
}

interface SupportConfigView {
  supportNotifyEmail: string;
  supportNotifyEmailConfigured: boolean;
  supportLlmTimeoutMs: number;
  supportLlmTimeoutMsDefault: number;
  supportLlmTimeoutMsMin: number;
  supportLlmTimeoutMsMax: number;
  limits: SupportLimitField[];
}

export function SupportSettingsSection() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [timeoutMs, setTimeoutMs] = useState('25000');
  const [limitValues, setLimitValues] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<SupportConfigView>({
    queryKey: ['admin', 'settings', 'support'],
    queryFn: () => apiClient.get('/admin/settings/support') as Promise<SupportConfigView>,
  });

  useEffect(() => {
    if (data?.supportNotifyEmail != null) setEmail(data.supportNotifyEmail);
    if (data?.supportLlmTimeoutMs != null) setTimeoutMs(String(data.supportLlmTimeoutMs));
    if (data?.limits?.length) {
      setLimitValues(
        Object.fromEntries(data.limits.map((f) => [f.id, String(f.value)])),
      );
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (payload: {
      supportNotifyEmail: string;
      supportLlmTimeoutMs: number;
      limits: Record<string, number>;
    }) => apiClient.patch('/admin/settings/support', payload) as Promise<SupportConfigView>,
    onSuccess: (cfg) => {
      setMsg({ ok: true, text: '智能客服配置已保存。' });
      setEmail(cfg.supportNotifyEmail ?? '');
      setTimeoutMs(String(cfg.supportLlmTimeoutMs ?? 25000));
      if (cfg.limits?.length) {
        setLimitValues(
          Object.fromEntries(cfg.limits.map((f) => [f.id, String(f.value)])),
        );
      }
      qc.setQueryData(['admin', 'settings', 'support'], cfg);
    },
    onError: (err: any) =>
      setMsg({
        ok: false,
        text: err?.message || '保存失败，请检查表单后重试。',
      }),
  });

  const limitMetaById = useMemo(() => {
    const map = new Map<string, SupportLimitField>();
    for (const f of data?.limits ?? []) map.set(f.id, f);
    return map;
  }, [data?.limits]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const n = Number.parseInt(timeoutMs.trim(), 10);
    if (!Number.isFinite(n)) {
      setMsg({ ok: false, text: 'LLM 超时须为整数毫秒。' });
      return;
    }
    const min = data?.supportLlmTimeoutMsMin ?? 5000;
    const max = data?.supportLlmTimeoutMsMax ?? 120000;
    if (n < min || n > max) {
      setMsg({ ok: false, text: `LLM 超时须在 ${min}–${max} ms 之间。` });
      return;
    }

    const limits: Record<string, number> = {};
    for (const f of data?.limits ?? []) {
      const raw = (limitValues[f.id] ?? '').trim();
      const v = Number.parseInt(raw, 10);
      if (!Number.isFinite(v)) {
        setMsg({ ok: false, text: `${f.labelZh}须为整数。` });
        return;
      }
      if (v < f.min || v > f.max) {
        setMsg({ ok: false, text: `${f.labelZh}须在 ${f.min}–${f.max} 之间。` });
        return;
      }
      limits[f.id] = v;
    }

    save.mutate({
      supportNotifyEmail: email.trim(),
      supportLlmTimeoutMs: n,
      limits,
    });
  };

  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        智能客服
      </h2>
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-40">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <Headphones className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">Support</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                通知邮箱、LLM 超时，以及防刷 / 超长上下文 / 图片限额（写入 system_settings，即时生效）。
              </p>
              {data && (
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center gap-1.5">
                    {data.supportNotifyEmailConfigured ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-xs text-emerald-600 font-medium">
                          通知邮箱 · {data.supportNotifyEmail}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-xs text-amber-600 font-medium">通知邮箱未配置</span>
                      </>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    LLM 超时 · {data.supportLlmTimeoutMs} ms（默认{' '}
                    {data.supportLlmTimeoutMsDefault}）
                  </span>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  通知收件邮箱（support_notify_email）
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="support@example.com"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  LLM 超时 ms（support_llm_timeout_ms）
                </label>
                <input
                  type="number"
                  min={data?.supportLlmTimeoutMsMin ?? 5000}
                  max={data?.supportLlmTimeoutMsMax ?? 120000}
                  step={1000}
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(e.target.value)}
                  placeholder="25000"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  建议 25000–60000；范围 {data?.supportLlmTimeoutMsMin ?? 5000}–
                  {data?.supportLlmTimeoutMsMax ?? 120000}。
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">防刷与图片限额</p>
              <p className="text-[11px] text-slate-400 mb-3">
                未单独配置时使用默认值；保存后立即影响 C 端客服。
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(data?.limits ?? []).map((f) => (
                  <div key={f.id}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      {f.labelZh}
                      <span className="ml-1 font-normal text-slate-400">（{f.settingKey}）</span>
                    </label>
                    <input
                      type="number"
                      min={f.min}
                      max={f.max}
                      step={1}
                      value={limitValues[f.id] ?? String(f.value)}
                      onChange={(e) =>
                        setLimitValues((prev) => ({ ...prev, [f.id]: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      {f.helpZh} 默认 {limitMetaById.get(f.id)?.default ?? f.default}，范围{' '}
                      {f.min}–{f.max}
                      {f.id === 'maxImageMb' ? ' MB' : ''}。
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {msg && (
              <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
                {msg.text}
              </p>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={save.isPending}
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
