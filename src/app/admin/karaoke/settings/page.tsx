'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, SlidersHorizontal } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import { NumberInput } from '@/components/ui/number-input';
import { SimpleSelect } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAdminAuthStore } from '@/stores/admin-auth.store';

type FieldValue = string | number | boolean;
type FieldType = 'boolean' | 'number' | 'text' | 'select' | 'multi';

interface SettingFieldDef {
  key: string;
  label: string;
  description: string;
  type: FieldType;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
  mono?: boolean;
  requireAtLeastOne?: boolean;
}

/** 与后端 karaoke.constants 对齐 */
const KARAOKE_ASPECT_RATIOS = [
  { value: '9:16', label: '9:16' },
  { value: '16:9', label: '16:9' },
  { value: '3:4', label: '3:4' },
];
const KARAOKE_RESOLUTIONS = [{ value: '720p', label: '720p' }];

/** 总开关单独渲染，不进下方列表 */
const MASTER_SWITCH: SettingFieldDef = {
  key: 'enabled',
  label: 'Photo Karaoke 总开关',
  description: '关闭后前台入口整体隐藏，进行中的项目不受影响。',
  type: 'boolean',
};

/** Photo Karaoke 系统设置字段 —— 对应后端 karaoke_* system_settings key */
const FIELD_GROUPS: Array<{ title: string; fields: SettingFieldDef[] }> = [
  {
    title: '功能开关',
    fields: [
      { key: 'soloEnabled', label: 'Solo 模式', description: '单人真人唱演视频模式。', type: 'boolean' },
      { key: 'petEnabled', label: 'Pet 模式', description: '宠物唱演视频模式。', type: 'boolean' },
      { key: 'duetEnabled', label: 'Duet 模式', description: '双人合唱视频模式。', type: 'boolean' },
      { key: 'allowlistOnly', label: '仅白名单可用', description: '开启后仅允许在白名单中的用户使用 Photo Karaoke（灰度发布用）。', type: 'boolean' },
      { key: 'continuityEnabled', label: '片段连续性', description: '多片段生成时使用上一片段末帧作为下一片段参考图，保持人物/场景连贯。', type: 'boolean' },
      { key: 'identityValidationEnabled', label: '人物身份校验', description: '场景图和每个视频片段生成后，比较人物是否仍是用户上传的同一人；不合格时停止成片。', type: 'boolean' },
      { key: 'lrcRequired', label: '强制要求 LRC 歌词', description: '开启后创建项目必须提供可用的 LRC 歌词时间轴，否则拦截创建。', type: 'boolean' },
      { key: 'publicDefault', label: '默认公开新项目', description: '新创建的项目默认是否在个人主页公开展示。', type: 'boolean' },
    ],
  },
  {
    title: '时长与片段',
    fields: [
      { key: 'minDurationSec', label: '最短时长', description: '允许生成的最短成片时长。', type: 'number', unit: '秒', min: 1 },
      { key: 'maxDurationSec', label: '最长时长', description: '允许生成的最长成片时长。', type: 'number', unit: '秒', min: 1 },
      { key: 'defaultDurationSec', label: '默认时长', description: '创建页默认预填的时长。', type: 'number', unit: '秒', min: 1 },
      { key: 'preferredSegmentSec', label: '单片段建议时长', description: '拆分片段时优先使用的目标时长（模型能力允许范围内）。', type: 'number', unit: '秒', min: 1 },
      { key: 'maxSegments', label: '最大片段数', description: '单个项目允许拆分的最大片段数量上限。', type: 'number', unit: '段', min: 1 },
    ],
  },
  {
    title: '画幅与分辨率',
    fields: [
      {
        key: 'allowedAspectRatios',
        label: '允许的画幅比例',
        description: '创建页可选的画幅。至少保留一项。',
        type: 'multi',
        options: KARAOKE_ASPECT_RATIOS,
        requireAtLeastOne: true,
      },
      {
        key: 'allowedResolutions',
        label: '允许的分辨率',
        description: '创建页可选的分辨率档位。至少保留一项。',
        type: 'multi',
        options: KARAOKE_RESOLUTIONS,
        requireAtLeastOne: true,
      },
      {
        key: 'defaultResolution',
        label: '默认分辨率',
        description: '创建页默认选中的分辨率档位，须在允许列表内。',
        type: 'select',
        options: KARAOKE_RESOLUTIONS,
      },
    ],
  },
  {
    title: '质量门槛',
    fields: [
      { key: 'sceneIdentityMinScore', label: '场景图身份最低分', description: '场景图与用户原图的人物一致性最低分。建议 72，过高可能误拦妆容或角度变化。', type: 'number', unit: '分', min: 0, max: 100 },
      { key: 'segmentIdentityMinScore', label: '视频身份最低分', description: '各片段末帧与用户原图的人物一致性最低分。建议 68，低于此分将自动重试或停止。', type: 'number', unit: '分', min: 0, max: 100 },
    ],
  },
  {
    title: '超时与重试',
    fields: [
      { key: 'autoRetryCount', label: '自动重试次数', description: '片段生成失败后系统自动重试的次数。', type: 'number', unit: '次', min: 0 },
      { key: 'segmentTimeoutSec', label: '片段超时时间', description: '单个片段生成的超时判定时间。', type: 'number', unit: '秒', min: 1 },
      { key: 'projectTimeoutSec', label: '项目超时时间', description: '整个项目的超时判定时间，超时将标记失败。', type: 'number', unit: '秒', min: 1 },
    ],
  },
  {
    title: '其它',
    fields: [
      {
        key: 'removeWatermarkPlans',
        label: '免水印会员档位',
        description: '命中的会员 plan 成片不加水印。',
        type: 'multi',
      },
    ],
  },
];

const ALL_FIELDS = [MASTER_SWITCH, ...FIELD_GROUPS.flatMap((g) => g.fields)];

interface KaraokeSettingsView {
  settings: Record<string, FieldValue>;
}

function asBool(value: FieldValue | undefined): boolean {
  return value === true || value === 'true';
}

function parseCsv(value: FieldValue | undefined): string[] {
  if (value == null || value === '') return [];
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toCsv(values: string[]): string {
  return values.join(',');
}

function clampDefault(current: string, allowed: string[], fallbackOptions: string[]): string {
  if (allowed.includes(current)) return current;
  return allowed[0] ?? fallbackOptions[0] ?? current;
}

export default function AdminKaraokeSettingsPage() {
  const qc = useQueryClient();
  const canEdit = useAdminAuthStore((s) => s.hasPermission('karaoke.settings.edit'));
  const [form, setForm] = useState<Record<string, FieldValue>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<KaraokeSettingsView>({
    queryKey: ['admin', 'karaoke', 'settings'],
    queryFn: async () =>
      (await apiClient.get('/admin/karaoke/settings')) as unknown as KaraokeSettingsView,
  });

  const {
    data: plansData,
    isError: plansError,
  } = useQuery<{ items: Array<{ planCode: string; name?: string }> }>({
    queryKey: ['admin', 'billing', 'plans', 'karaoke-settings'],
    queryFn: async () =>
      (await apiClient.get('/admin/billing/plans?page=1&pageSize=50')) as unknown as {
        items: Array<{ planCode: string; name?: string }>;
      },
    retry: 1,
  });

  const planOptions = useMemo(() => {
    const items = plansData?.items ?? [];
    return items
      .filter((p) => p.planCode)
      .map((p) => ({
        value: p.planCode,
        label: p.planCode,
      }));
  }, [plansData]);

  const usePlanChips = !plansError && planOptions.length > 0;

  const settings = useMemo(() => data?.settings ?? {}, [data]);

  useEffect(() => {
    if (!data) return;
    setForm({ ...settings });
  }, [data, settings]);

  const allowedResolutions = parseCsv(form.allowedResolutions ?? settings.allowedResolutions);

  const dirty = useMemo(
    () => ALL_FIELDS.some((f) => String(form[f.key] ?? '') !== String(settings[f.key] ?? '')),
    [form, settings],
  );

  const save = useMutation({
    // Karaoke PUT 收扁平 camelCase，不包 { settings }
    mutationFn: (payload: Record<string, FieldValue>) =>
      apiClient.put('/admin/karaoke/settings', payload) as Promise<KaraokeSettingsView>,
    onSuccess: (res) => {
      setMsg({ ok: true, text: 'Photo Karaoke 设置已保存，立即生效。' });
      qc.setQueryData(['admin', 'karaoke', 'settings'], res);
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
    payload.defaultResolution = clampDefault(
      String(payload.defaultResolution ?? ''),
      parseCsv(payload.allowedResolutions),
      KARAOKE_RESOLUTIONS.map((o) => o.value),
    );
    save.mutate(payload);
  };

  const setField = (key: string, value: FieldValue) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'allowedResolutions') {
        next.defaultResolution = clampDefault(
          String(next.defaultResolution ?? prev.defaultResolution ?? ''),
          parseCsv(value),
          KARAOKE_RESOLUTIONS.map((o) => o.value),
        );
      }
      return next;
    });
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
          step={f.step ?? 1}
          disabled={disabled}
          size="sm"
        />
      );
    }

    if (f.type === 'select') {
      let options = f.options ?? [];
      if (f.key === 'defaultResolution') {
        options = KARAOKE_RESOLUTIONS.filter((o) => allowedResolutions.includes(o.value));
        if (options.length === 0) options = KARAOKE_RESOLUTIONS;
      }
      const current = String(value ?? '');
      const safeValue = options.some((o) => o.value === current)
        ? current
        : (options[0]?.value ?? '');
      return (
        <SimpleSelect
          value={safeValue}
          onValueChange={(next) => setField(f.key, next)}
          options={options}
          disabled={disabled}
          size="sm"
        />
      );
    }

    if (f.type === 'multi') {
      if (f.key === 'removeWatermarkPlans' && !usePlanChips) {
        return (
          <Input
            value={String(value ?? '')}
            onChange={(e) => setField(f.key, e.target.value)}
            disabled={disabled}
            size="sm"
            mono
            placeholder="pro,ultimate"
          />
        );
      }
      const options =
        f.key === 'removeWatermarkPlans' ? planOptions : (f.options ?? []);
      return (
        <MultiSelect
          value={parseCsv(value)}
          onChange={(next) => setField(f.key, toCsv(next))}
          options={options}
          disabled={disabled}
          requireAtLeastOne={f.requireAtLeastOne}
        />
      );
    }

    return (
      <Input
        value={String(value ?? '')}
        onChange={(e) => setField(f.key, e.target.value)}
        disabled={disabled}
        size="sm"
        mono={f.mono}
      />
    );
  };

  return (
    <div className="admin-page">
      <div className="space-y-6 p-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <SlidersHorizontal className="h-5 w-5 text-blue-600" />
            Photo Karaoke 设置
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            控制 Photo Karaoke 功能开关、时长限制、画幅与超时重试策略。写入 system_settings，保存后立即生效。
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
                    <FormField
                      key={f.key}
                      label={f.label}
                      description={f.description}
                      controlClassName={
                        f.type === 'multi' ? 'sm:w-[280px] w-[200px]' : undefined
                      }
                    >
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
                  当前账号仅有 karaoke.settings.view，无法保存（需 karaoke.settings.edit）。
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
