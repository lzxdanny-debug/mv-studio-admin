'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, SlidersHorizontal } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { FormField } from '@/components/ui/form-field';
import { NumberInput } from '@/components/ui/number-input';
import { SimpleSelect } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAdminAuthStore } from '@/stores/admin-auth.store';

type FieldValue = string | number | boolean;
type FieldType = 'boolean' | 'number' | 'select';

interface SettingFieldDef {
  key: string;
  label: string;
  description: string;
  type: FieldType;
  unit?: string;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
}

const MASTER_SWITCH: SettingFieldDef = {
  key: 'enabled',
  label: '视频特效总开关',
  description: '关闭后前台入口整体隐藏，进行中的任务不受影响。',
  type: 'boolean',
};

const FIELD_GROUPS: Array<{ title: string; fields: SettingFieldDef[] }> = [
  {
    title: '并发与超时',
    fields: [
      {
        key: 'maxConcurrentPerUser',
        label: '每用户并发上限',
        description: '单个用户同时进行中的特效任务数上限（1–20）。',
        type: 'number',
        unit: '个',
        min: 1,
        max: 20,
      },
      {
        key: 'taskTimeoutMs',
        label: '任务超时',
        description: '单任务最大执行时间，超时将标记失败。',
        type: 'number',
        unit: '毫秒',
        min: 1000,
      },
      {
        key: 'quoteTtlSec',
        label: '报价有效期',
        description: '用户报价锁定时长（30–3600 秒）。',
        type: 'number',
        unit: '秒',
        min: 30,
        max: 3600,
      },
    ],
  },
  {
    title: '默认输出',
    fields: [
      {
        key: 'defaultDurationSec',
        label: '默认时长',
        description: '创建页默认视频时长。',
        type: 'number',
        unit: '秒',
        min: 1,
      },
      {
        key: 'defaultAspectRatio',
        label: '默认画幅',
        description: '创建页默认画幅比例。',
        type: 'select',
        options: [
          { value: '16:9', label: '16:9' },
          { value: '9:16', label: '9:16' },
          { value: '1:1', label: '1:1' },
        ],
      },
      {
        key: 'defaultResolution',
        label: '默认分辨率',
        description: '创建页默认分辨率档位。',
        type: 'select',
        options: [
          { value: '720p', label: '720p' },
          { value: '1080p', label: '1080p' },
        ],
      },
      {
        key: 'watermarkDefault',
        label: '默认加水印',
        description: '新任务默认是否叠加水印。',
        type: 'boolean',
      },
    ],
  },
];

const ALL_FIELDS = [MASTER_SWITCH, ...FIELD_GROUPS.flatMap((g) => g.fields)];

interface SettingsView {
  settings: Record<string, FieldValue>;
}

function asBool(value: FieldValue | undefined): boolean {
  return value === true || value === 'true';
}

export default function AdminVideoEffectSettingsPage() {
  const qc = useQueryClient();
  const canEdit = useAdminAuthStore((s) => s.hasPermission('effects.settings.edit'));
  const [form, setForm] = useState<Record<string, FieldValue>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<SettingsView>({
    queryKey: ['admin', 'video-effects', 'settings'],
    queryFn: async () =>
      (await apiClient.get('/admin/video-effects/settings')) as unknown as SettingsView,
  });

  const settings = useMemo(() => data?.settings ?? {}, [data]);

  useEffect(() => {
    if (!data) return;
    setForm({ ...settings });
  }, [data, settings]);

  const dirty = useMemo(
    () => ALL_FIELDS.some((f) => String(form[f.key] ?? '') !== String(settings[f.key] ?? '')),
    [form, settings],
  );

  const save = useMutation({
    mutationFn: (payload: Record<string, FieldValue>) =>
      apiClient.put('/admin/video-effects/settings', { settings: payload }) as Promise<SettingsView>,
    onSuccess: (res) => {
      setMsg({ ok: true, text: '视频特效设置已保存，立即生效。' });
      qc.setQueryData(['admin', 'video-effects', 'settings'], res);
    },
    onError: (err: any) => setMsg({ ok: false, text: err?.message || '保存失败，请重试。' }),
  });

  const handleSave = () => {
    if (!canEdit) return;
    setMsg(null);
    const payload: Record<string, FieldValue> = {};
    for (const f of ALL_FIELDS) {
      payload[f.key] = form[f.key] ?? settings[f.key];
    }
    save.mutate(payload);
  };

  const setField = (key: string, value: FieldValue) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const masterEnabled = asBool(form.enabled ?? settings.enabled);

  const renderControl = (f: SettingFieldDef) => {
    const value = form[f.key] ?? settings[f.key];
    const disabled = !canEdit;

    if (f.type === 'boolean') {
      return (
        <Switch
          checked={asBool(value)}
          onChange={(next) => setField(f.key, next)}
          disabled={disabled}
          label={f.label}
        />
      );
    }

    if (f.type === 'number') {
      return (
        <NumberInput
          value={Number(value ?? 0)}
          onChange={(next) => setField(f.key, next)}
          unit={f.unit}
          min={f.min}
          max={f.max}
          disabled={disabled}
          size="sm"
        />
      );
    }

    return (
      <SimpleSelect
        value={String(value ?? '')}
        onValueChange={(next) => setField(f.key, next)}
        options={f.options ?? []}
        disabled={disabled}
        size="sm"
      />
    );
  };

  return (
    <div className="admin-page">
      <div className="space-y-6 p-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <SlidersHorizontal className="h-5 w-5 text-blue-600" />
            视频特效设置
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            控制视频特效总开关、并发超时与默认输出参数。写入 system_settings，保存后立即生效。
          </p>
        </div>

        <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
          <div className="space-y-5">
            <div
              className={cn(
                'flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 shadow-sm',
                masterEnabled
                  ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50'
                  : 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50',
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold text-slate-900">{MASTER_SWITCH.label}</p>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      masterEnabled
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700',
                    )}
                  >
                    {masterEnabled ? '已开启' : '已关闭'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{MASTER_SWITCH.description}</p>
              </div>
              <Switch
                checked={masterEnabled}
                onChange={(next) => setField('enabled', next)}
                disabled={!canEdit}
                label={MASTER_SWITCH.label}
                size="lg"
              />
            </div>

            {FIELD_GROUPS.map((group) => (
              <div key={group.title} className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {group.title}
                </h2>
                <div className="divide-y divide-slate-100">
                  {group.fields.map((f) => (
                    <FormField key={f.key} label={f.label} description={f.description}>
                      {renderControl(f)}
                    </FormField>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex flex-col items-end gap-2">
              {msg && (
                <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
                  {msg.text}
                </p>
              )}
              {!canEdit && (
                <p className="text-xs text-amber-600">
                  当前账号仅有 effects.settings.view，无法保存（需 effects.settings.edit）。
                </p>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={save.isPending || !dirty || !canEdit}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
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
