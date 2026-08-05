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
type FieldType = 'boolean' | 'number' | 'text' | 'select' | 'multi' | 'percent';

interface SettingFieldDef {
  key: string;
  label: string;
  description: string;
  type: FieldType;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  /** select / multi 的静态选项；watermarkRemovePlans 在页面内动态注入 */
  options?: Array<{ value: string; label: string }>;
  mono?: boolean;
  /** multi 至少保留一项 */
  requireAtLeastOne?: boolean;
}

/** 与后端 dance.constants 对齐 */
const DANCE_ASPECT_RATIOS = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
];
const DANCE_RESOLUTIONS = [
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
];
const DANCE_QUALITIES = [
  { value: 'standard', label: 'standard' },
  { value: 'ultron', label: 'ultron' },
];

/** 总开关单独渲染，不进下方列表 */
const MASTER_SWITCH: SettingFieldDef = {
  key: 'enabled',
  label: '舞蹈视频总开关',
  description: '关闭后前台入口整体隐藏，进行中的项目不受影响。',
  type: 'boolean',
};

/** 对应后端 DANCE_SETTING_KEYS 的 camelCase key，写入 system_settings 的 dance_* 项 */
const FIELD_GROUPS: Array<{ title: string; fields: SettingFieldDef[] }> = [
  {
    title: '功能开关',
    fields: [
      { key: 'allowlistOnly', label: '仅白名单可用', description: '灰度阶段只允许白名单用户创建舞蹈项目。', type: 'boolean' },
      { key: 'dualCharacterEnabled', label: '双人舞', description: '允许上传第二角色图生成双人舞蹈。开启前请确认视频模型支持多图人物锁定。', type: 'boolean' },
      {
        key: 'multiReferenceVideoEnabled',
        label: '视频多图参考',
        description:
          '关闭（推荐）时，每个视频片段只使用已验收的 Storyboard 作为起始帧；开启时同时传入人物原图与 Storyboard。保存后，尚未提交的视频片段立即按新设置执行。',
        type: 'boolean',
      },
      { key: 'defaultAutoAdvance', label: '默认自动推进', description: '新项目默认是否自动跨阶段推进；关闭时每个关键阶段等待用户确认。', type: 'boolean' },
      { key: 'publicDefault', label: '默认公开新项目', description: '新建项目默认是否公开展示。', type: 'boolean' },
      { key: 'refundOnFailure', label: '失败自动退积分', description: '生成失败时按未产出的步骤自动退还积分。', type: 'boolean' },
    ],
  },
  {
    title: '时长与画幅',
    fields: [
      { key: 'minDurationSec', label: '最短时长', description: '允许生成的最短成片时长。', type: 'number', unit: '秒', min: 1 },
      { key: 'maxDurationSec', label: '最长时长', description: '允许生成的最长成片时长。时长越长，段落与片段数越多，成本上升。', type: 'number', unit: '秒', min: 1 },
      { key: 'defaultDurationSec', label: '默认时长', description: '创建页默认截取的时长。', type: 'number', unit: '秒', min: 1 },
      {
        key: 'allowedAspectRatios',
        label: '允许的画幅比例',
        description: '创建页可选的画幅。至少保留一项。',
        type: 'multi',
        options: DANCE_ASPECT_RATIOS,
        requireAtLeastOne: true,
      },
      {
        key: 'allowedResolutions',
        label: '允许的分辨率',
        description: '创建页可选的分辨率档位。至少保留一项。',
        type: 'multi',
        options: DANCE_RESOLUTIONS,
        requireAtLeastOne: true,
      },
      {
        key: 'defaultResolution',
        label: '默认分辨率',
        description: '创建页默认选中的分辨率档位，须在允许列表内。',
        type: 'select',
        options: DANCE_RESOLUTIONS,
      },
      {
        key: 'allowedQualities',
        label: '允许的画质档',
        description: '创建页可选的画质档。至少保留一项。',
        type: 'multi',
        options: DANCE_QUALITIES,
        requireAtLeastOne: true,
      },
      {
        key: 'defaultQuality',
        label: '默认画质档',
        description: '创建页默认选中的画质档，须在允许列表内。',
        type: 'select',
        options: DANCE_QUALITIES,
      },
    ],
  },
  {
    title: '段落与片段规划',
    fields: [
      { key: 'maxSections', label: '最大段落数', description: '单个项目允许拆分的音乐段落上限。', type: 'number', unit: '段', min: 1 },
      { key: 'maxClips', label: '最大片段数', description: '单个项目允许生成的视频片段总数上限，直接影响成本天花板。', type: 'number', unit: '个', min: 1 },
      { key: 'targetClipSec', label: '片段目标时长', description: '编排时优先采用的单片段时长。', type: 'number', unit: '秒', min: 1, step: 0.1 },
      { key: 'minClipSec', label: '片段最短时长', description: '低于此时长的片段会被合并，避免碎片化动作。', type: 'number', unit: '秒', min: 0, step: 0.1 },
      { key: 'maxClipSec', label: '片段最长时长', description: '受视频模型单次生成上限约束。', type: 'number', unit: '秒', min: 1, step: 0.1 },
      { key: 'sectionTimeToleranceSec', label: '段落时间容差', description: '段落边界与音乐分析结果允许的偏差，超出会触发重新编排。', type: 'number', unit: '秒', min: 0, step: 0.05 },
    ],
  },
  {
    title: '镜头与画面约束',
    fields: [
      { key: 'maxHeroSpaces', label: '最大主场景数', description: '同一支舞允许出现的主要空间数量，过多会破坏空间连贯性。', type: 'number', unit: '个', min: 1 },
      {
        key: 'fullBodyMinRatio',
        label: '全身镜头最低占比',
        description: '全身/中远景镜头占比下限，舞蹈需要看清动作。',
        type: 'percent',
        min: 0,
        max: 100,
        step: 5,
      },
      {
        key: 'closeUpMaxRatio',
        label: '特写镜头最高占比',
        description: '特写占比上限，过多特写会看不到编舞。',
        type: 'percent',
        min: 0,
        max: 100,
        step: 5,
      },
    ],
  },
  {
    title: '质量与重试',
    fields: [
      { key: 'qualityAutoRetryEnabled', label: '质检失败自动重试', description: '质检未通过时自动重新生成该片段。', type: 'boolean' },
      { key: 'qualityMinScore', label: '质检最低分', description: '低于此分判定为不通过。过高会导致大量重试与成本上升。', type: 'number', unit: '分', min: 0, max: 100 },
      { key: 'autoRetryCount', label: '自动重试次数', description: '单个片段生成失败后系统自动重试的次数。', type: 'number', unit: '次', min: 0 },
    ],
  },
  {
    title: '并发与超时',
    fields: [
      { key: 'planningConcurrency', label: '规划并发', description: '规划类 LLM 调用的并发上限。', type: 'number', unit: '路', min: 1 },
      { key: 'videoConcurrency', label: '视频并发', description: '片段视频生成的并发上限，受 Provider 配额约束。', type: 'number', unit: '路', min: 1 },
      { key: 'visionTimeoutSec', label: '人物识别超时', description: 'Dance 人物参考图识别单次请求的超时时间，直接同步到 AI Router 的 danceVision 配置。', type: 'number', unit: '秒', min: 1, max: 1800 },
      { key: 'providerTimeoutSec', label: '图片/视频 Provider 超时', description: '参考图与视频片段生成调用的超时判定时间。', type: 'number', unit: '秒', min: 1 },
    ],
  },
  {
    title: '其它',
    fields: [
      {
        key: 'watermarkRemovePlans',
        label: '免水印会员档位',
        description: '命中的会员 plan 成片不加水印。',
        type: 'multi',
        // options 由页面内 plans 查询注入
      },
      {
        key: 'promptVersion',
        label: 'Prompt 版本',
        description: '当前生效的 Dance Prompt 版本号，用于回溯生成结果。',
        type: 'text',
        mono: true,
      },
    ],
  },
];

const ALL_FIELDS = [MASTER_SWITCH, ...FIELD_GROUPS.flatMap((g) => g.fields)];

interface DanceSettingsView {
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

export default function AdminDanceSettingsPage() {
  const qc = useQueryClient();
  const canEdit = useAdminAuthStore((s) => s.hasPermission('dance.settings.edit'));
  const [form, setForm] = useState<Record<string, FieldValue>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<DanceSettingsView>({
    queryKey: ['admin', 'dance', 'settings'],
    queryFn: async () =>
      (await apiClient.get('/admin/dance/settings')) as unknown as DanceSettingsView,
  });

  const {
    data: plansData,
    isError: plansError,
  } = useQuery<{ items: Array<{ planCode: string; name?: string }> }>({
    queryKey: ['admin', 'billing', 'plans', 'dance-settings'],
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
        label: p.name ? `${p.planCode}` : p.planCode,
      }));
  }, [plansData]);

  const usePlanChips = !plansError && planOptions.length > 0;

  const settings = useMemo(() => data?.settings ?? {}, [data]);

  useEffect(() => {
    if (!data) return;
    setForm({ ...settings });
  }, [data, settings]);

  const allowedResolutions = parseCsv(form.allowedResolutions ?? settings.allowedResolutions);
  const allowedQualities = parseCsv(form.allowedQualities ?? settings.allowedQualities);

  const dirty = useMemo(
    () => ALL_FIELDS.some((f) => String(form[f.key] ?? '') !== String(settings[f.key] ?? '')),
    [form, settings],
  );

  const save = useMutation({
    mutationFn: (payload: Record<string, FieldValue>) =>
      apiClient.put('/admin/dance/settings', { settings: payload }) as Promise<DanceSettingsView>,
    onSuccess: (res) => {
      setMsg({ ok: true, text: '舞蹈视频设置已保存，立即生效。' });
      qc.setQueryData(['admin', 'dance', 'settings'], res);
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

    // 默认值须落在允许列表内（与后端 intersect 行为一致）
    const resList = parseCsv(payload.allowedResolutions);
    const qualList = parseCsv(payload.allowedQualities);
    payload.defaultResolution = clampDefault(
      String(payload.defaultResolution ?? ''),
      resList,
      DANCE_RESOLUTIONS.map((o) => o.value),
    );
    payload.defaultQuality = clampDefault(
      String(payload.defaultQuality ?? ''),
      qualList,
      DANCE_QUALITIES.map((o) => o.value),
    );

    save.mutate(payload);
  };

  const setField = (key: string, value: FieldValue) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // 允许列表变化时，立即把默认值钳到合法项
      if (key === 'allowedResolutions') {
        next.defaultResolution = clampDefault(
          String(next.defaultResolution ?? prev.defaultResolution ?? ''),
          parseCsv(value),
          DANCE_RESOLUTIONS.map((o) => o.value),
        );
      }
      if (key === 'allowedQualities') {
        next.defaultQuality = clampDefault(
          String(next.defaultQuality ?? prev.defaultQuality ?? ''),
          parseCsv(value),
          DANCE_QUALITIES.map((o) => o.value),
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

    if (f.type === 'percent') {
      const ratio = Number(value ?? 0);
      const pct = Math.round(ratio * 1000) / 10; // 保留一位避免浮点噪点
      return (
        <NumberInput
          value={pct}
          onChange={(next) => {
            const clamped = Math.min(f.max ?? 100, Math.max(f.min ?? 0, next));
            setField(f.key, clamped / 100);
          }}
          unit="%"
          min={f.min}
          max={f.max}
          step={f.step ?? 5}
          disabled={disabled}
          size="sm"
        />
      );
    }

    if (f.type === 'select') {
      let options = f.options ?? [];
      if (f.key === 'defaultResolution') {
        options = DANCE_RESOLUTIONS.filter((o) => allowedResolutions.includes(o.value));
        if (options.length === 0) options = DANCE_RESOLUTIONS;
      }
      if (f.key === 'defaultQuality') {
        options = DANCE_QUALITIES.filter((o) => allowedQualities.includes(o.value));
        if (options.length === 0) options = DANCE_QUALITIES;
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
      // 免水印档位：plans 拉取失败或为空时回退文本输入
      if (f.key === 'watermarkRemovePlans' && !usePlanChips) {
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
        f.key === 'watermarkRemovePlans' ? planOptions : (f.options ?? []);
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

    // text
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
            舞蹈视频设置
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            控制舞蹈视频的开关、时长画幅、段落与片段规划、镜头约束、质检与并发。写入 system_settings，保存后立即生效。
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
                  当前账号仅有 dance.settings.view，无法保存（需 dance.settings.edit）。
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
