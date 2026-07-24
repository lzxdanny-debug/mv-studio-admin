'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HelpCircle, Save, SlidersHorizontal } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { useAdminAuthStore } from '@/stores/admin-auth.store';

type FieldValue = string | number | boolean;
type FieldType = 'boolean' | 'number' | 'select' | 'text';

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

/** Photo Karaoke 系统设置字段 —— 对应后端 karaoke_* system_settings key，与 KARAOKE_SETTING_KEYS 保持一致 */
const FIELD_GROUPS: Array<{ title: string; fields: SettingFieldDef[] }> = [
  {
    title: '功能开关',
    fields: [
      { key: 'enabled', label: 'Photo Karaoke 总开关', description: '关闭后前台入口整体隐藏，进行中的项目不受影响。', type: 'boolean' },
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
      { key: 'defaultResolution', label: '默认分辨率', description: '创建页默认选中的分辨率档位。', type: 'select', options: [{ value: '720p', label: '720p' }] },
      { key: 'allowedAspectRatios', label: '允许的画幅比例', description: '逗号分隔，如 9:16,16:9,3:4。', type: 'text' },
      { key: 'allowedResolutions', label: '允许的分辨率', description: '逗号分隔，如 720p。', type: 'text' },
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
      { key: 'removeWatermarkPlans', label: '免水印会员档位', description: '逗号分隔的会员 plan code，命中的用户成片不加水印，如 pro,ultimate。', type: 'text' },
    ],
  },
];

const ALL_FIELDS = FIELD_GROUPS.flatMap((g) => g.fields);

interface KaraokeSettingsView {
  settings: Record<string, FieldValue>;
}

export default function AdminKaraokeSettingsPage() {
  const qc = useQueryClient();
  const canEdit = useAdminAuthStore((s) => s.hasPermission('karaoke.settings.edit'));
  const [form, setForm] = useState<Record<string, FieldValue>>({});
  const [openHelp, setOpenHelp] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<KaraokeSettingsView>({
    queryKey: ['admin', 'karaoke', 'settings'],
    queryFn: async () =>
      (await apiClient.get('/admin/karaoke/settings')) as unknown as KaraokeSettingsView,
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
    save.mutate(payload);
  };

  const renderField = (f: SettingFieldDef) => {
    const value = form[f.key] ?? settings[f.key];
    return (
      <div key={f.key} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium text-slate-700">{f.label}</span>
            <button
              type="button"
              onClick={() => setOpenHelp(openHelp === f.key ? null : f.key)}
              className="flex-shrink-0 text-slate-400 hover:text-blue-600"
              title="查看说明"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {f.type === 'boolean' && (
          <label className="mt-2.5 inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={value === true || value === 'true'}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.checked }))}
              disabled={!canEdit}
              className="accent-blue-600 disabled:opacity-60"
            />
            {value === true || value === 'true' ? '已开启' : '已关闭'}
          </label>
        )}

        {f.type === 'number' && (
          <div className="mt-2.5 flex items-center gap-1.5">
            <input
              type="number"
              min={f.min}
              max={f.max}
              step={1}
              value={Number(value ?? 0)}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
              disabled={!canEdit}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
            />
            {f.unit && <span className="w-14 flex-shrink-0 text-xs text-slate-400">{f.unit}</span>}
          </div>
        )}

        {f.type === 'select' && (
          <select
            value={String(value ?? '')}
            onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
            disabled={!canEdit}
            className="mt-2.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
          >
            {f.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {f.type === 'text' && (
          <input
            type="text"
            value={String(value ?? '')}
            onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
            disabled={!canEdit}
            className="mt-2.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
          />
        )}

        {openHelp === f.key && (
          <p className="mt-2.5 rounded-lg border border-slate-100 bg-white p-2.5 text-xs leading-relaxed text-slate-500">
            {f.description}
          </p>
        )}
      </div>
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
            {FIELD_GROUPS.map((group) => (
              <div key={group.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {group.title}
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {group.fields.map(renderField)}
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
