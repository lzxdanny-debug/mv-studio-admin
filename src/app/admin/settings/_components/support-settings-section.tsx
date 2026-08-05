'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Save, XCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { CONTROL_MD } from './settings-form-styles';

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

  const emailOk = !!data?.supportNotifyEmailConfigured;

  return (
    <section>
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-40">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className={cn(
              'flex items-center justify-between gap-4 rounded-2xl border px-5 py-4',
              emailOk
                ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50'
                : 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50',
            )}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-slate-900">智能客服</p>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    emailOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                  )}
                >
                  {emailOk ? '通知邮箱已配置' : '通知邮箱未配置'}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {emailOk
                  ? `${data?.supportNotifyEmail} · LLM 超时 ${data?.supportLlmTimeoutMs} ms`
                  : '通知邮箱、LLM 超时与防刷限额写入 system_settings，即时生效'}
              </p>
            </div>
            {emailOk ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
            ) : (
              <XCircle className="h-6 w-6 shrink-0 text-amber-500" />
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                基础配置
              </h2>
            </div>
            <div className="divide-y divide-slate-100 px-5 py-2">
              <FormField
                label="通知收件邮箱"
                description="support_notify_email · 人工工单等通知。"
                controlClassName={CONTROL_MD}
              >
                <Input
                  size="sm"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="support@example.com"
                />
              </FormField>
              <FormField
                label="LLM 超时（毫秒）"
                description={`建议 25000–60000；范围 ${data?.supportLlmTimeoutMsMin ?? 5000}–${data?.supportLlmTimeoutMsMax ?? 120000}（默认 ${data?.supportLlmTimeoutMsDefault ?? 25000}）。`}
              >
                <Input
                  size="sm"
                  type="number"
                  min={data?.supportLlmTimeoutMsMin ?? 5000}
                  max={data?.supportLlmTimeoutMsMax ?? 120000}
                  step={1000}
                  mono
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(e.target.value)}
                  placeholder="25000"
                />
              </FormField>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                防刷与图片限额
              </h2>
            </div>
            <div className="divide-y divide-slate-100 px-5 py-2">
              {(data?.limits ?? []).map((f) => (
                <FormField
                  key={f.id}
                  label={f.labelZh}
                  description={`${f.helpZh} 默认 ${limitMetaById.get(f.id)?.default ?? f.default}，范围 ${f.min}–${f.max}${f.id === 'maxImageMb' ? ' MB' : ''}（${f.settingKey}）。`}
                >
                  <Input
                    size="sm"
                    type="number"
                    min={f.min}
                    max={f.max}
                    step={1}
                    mono
                    value={limitValues[f.id] ?? String(f.value)}
                    onChange={(e) =>
                      setLimitValues((prev) => ({ ...prev, [f.id]: e.target.value }))
                    }
                  />
                </FormField>
              ))}
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
              disabled={save.isPending}
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
