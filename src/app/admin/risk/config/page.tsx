'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HelpCircle, Save, Shield } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { hasPermission } from '@/lib/admin-permissions';

type FieldType = 'number' | 'boolean' | 'textarea';
type FieldSource = 'db' | 'default';

interface RiskConfigField {
  key: string;
  settingKey: string;
  label: string;
  description: string;
  type: FieldType;
  min?: number;
  max?: number;
  unit?: string;
  value: string | number | boolean;
  default: string | number | boolean;
  source: FieldSource;
}

interface RiskConfigView {
  config: Record<string, string | number | boolean>;
  fields: RiskConfigField[];
}

const SOURCE_LABEL: Record<FieldSource, string> = {
  db: '已配置',
  default: '默认值',
};

const SOURCE_CLS: Record<FieldSource, string> = {
  db: 'bg-emerald-50 text-emerald-600',
  default: 'bg-slate-100 text-slate-400',
};

export default function RiskConfigPage() {
  const qc = useQueryClient();
  const permissions = useAdminAuthStore((s) => s.permissions);
  const canManage = hasPermission(permissions, 'risk.manage');

  const [form, setForm] = useState<Record<string, string | number | boolean>>({});
  const [openHelp, setOpenHelp] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<RiskConfigView>({
    queryKey: ['admin', 'risk', 'config'],
    queryFn: async () =>
      (await apiClient.get('/admin/risk/config')) as unknown as RiskConfigView,
  });

  const fields = data?.fields ?? [];

  useEffect(() => {
    if (!fields.length) return;
    setForm(Object.fromEntries(fields.map((f) => [f.key, f.value])));
  }, [fields]);

  const dirty = useMemo(
    () =>
      fields.some((f) => {
        const cur = form[f.key];
        const saved = f.value;
        if (f.type === 'textarea') {
          return String(cur ?? '') !== String(saved ?? '');
        }
        return cur !== saved;
      }),
    [fields, form],
  );

  const save = useMutation({
    mutationFn: (payload: Record<string, string | number | boolean>) =>
      apiClient.patch('/admin/risk/config', payload) as Promise<RiskConfigView>,
    onSuccess: (res) => {
      setMsg({ ok: true, text: '风控封控参数已保存，立即生效。' });
      setForm(Object.fromEntries((res.fields ?? []).map((f) => [f.key, f.value])));
      qc.setQueryData(['admin', 'risk', 'config'], res);
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请重试。' }),
  });

  const numberFields = fields.filter((f) => f.type === 'number');
  const booleanFields = fields.filter((f) => f.type === 'boolean');
  const textareaFields = fields.filter((f) => f.type === 'textarea');

  const handleSave = () => {
    if (!canManage) return;
    setMsg(null);
    const payload: Record<string, string | number | boolean> = {};
    for (const f of fields) {
      payload[f.key] = form[f.key] ?? f.value;
    }
    save.mutate(payload);
  };

  const renderFieldCard = (f: RiskConfigField) => {
    const displayValue = form[f.key] ?? f.value;
    return (
      <div key={f.key} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium text-slate-700">{f.label}</span>
            <button
              type="button"
              onClick={() => setOpenHelp(openHelp === f.key ? null : f.key)}
              className="flex-shrink-0 text-slate-400 hover:text-violet-600"
              title="查看说明"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </div>
          <span
            className={cn(
              'flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
              SOURCE_CLS[f.source],
            )}
          >
            {SOURCE_LABEL[f.source]}
          </span>
        </div>

        {f.type === 'number' && (
          <div className="mt-2.5 flex items-center gap-1.5">
            <input
              type="number"
              min={f.min}
              max={f.max}
              step={1}
              value={Number(displayValue)}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))
              }
              disabled={!canManage}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-60"
            />
            {f.unit && <span className="w-16 flex-shrink-0 text-xs text-slate-400">{f.unit}</span>}
          </div>
        )}

        {f.type === 'boolean' && (
          <label className="mt-2.5 inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={displayValue === true}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.checked }))}
              disabled={!canManage}
              className="accent-violet-600 disabled:opacity-60"
            />
            {displayValue === true ? '已开启' : '已关闭'}
          </label>
        )}

        {f.type === 'textarea' && (
          <textarea
            rows={8}
            value={String(displayValue ?? '')}
            onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
            disabled={!canManage}
            className="mt-2.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-60"
            placeholder="一行一个域名"
          />
        )}

        {openHelp === f.key && (
          <p className="mt-2.5 rounded-lg border border-slate-100 bg-white p-2.5 text-xs leading-relaxed text-slate-500">
            {f.description}
            <span className="mt-1 block text-slate-400">
              默认值：{String(f.default)}
              {f.unit ? ` ${f.unit}` : ''}
            </span>
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="space-y-6 p-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Shield className="h-5 w-5 text-violet-600" />
            风控封控参数
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            注册限流、注册赠送防刷、临时邮箱黑名单、生成拦截等规则。写入 system_settings，保存后立即生效。
          </p>
          <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-800">
            临时邮箱域名建议迁移到「信任白名单 / 封控黑名单 → email_domain」统一管理；此处文本框保留兼容，两者同时生效（V1）。
          </p>
          <p className="mt-2 text-xs text-slate-400">
            会员权益（Seedance / 双角色 / Ultron / 清晰度）请在「计费中心 → 会员计划」中按档位配置。
          </p>
        </div>

        <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                注册限流
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {numberFields.map(renderFieldCard)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                临时邮箱
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {textareaFields.map(renderFieldCard)}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {booleanFields
                    .filter((f) => f.key.includes('Disposable'))
                    .map(renderFieldCard)}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                注册赠送 & 生成拦截
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {booleanFields
                  .filter((f) => !f.key.includes('Disposable'))
                  .map(renderFieldCard)}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {msg && (
                <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
                  {msg.text}
                </p>
              )}
              {!canManage && (
                <p className="text-xs text-amber-600">当前账号仅有 risk.view，无法保存（需 risk.manage）。</p>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={save.isPending || !dirty || !canManage}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" />
                {save.isPending ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </QueryState>
      </div>
    </div>
  );
}
