'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAdminAuthStore } from '@/stores/admin-auth.store';

type SettingsRecord = Record<string, unknown>;
type SettingsResponse = { settings: SettingsRecord; version: number; updatedAt: string | null };

const FIELDS = [
  { key: 'musicExtensions', label: '音乐扩展名', hint: 'mp3, wav, m4a' },
  { key: 'musicMimeTypes', label: '音乐 MIME', hint: 'audio/mpeg, audio/wav' },
  { key: 'imageExtensions', label: '图片扩展名', hint: 'jpg, png, webp' },
  { key: 'imageMimeTypes', label: '图片 MIME', hint: 'image/jpeg, image/png' },
  { key: 'allowedResolutions', label: '允许分辨率', hint: '720p, 1080p' },
  { key: 'allowedVideoFormats', label: '允许视频格式', hint: 'mp4, mov, avi, webm' },
] as const;

function splitList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function AimvFormatWhitelist() {
  const queryClient = useQueryClient();
  const canEdit = useAdminAuthStore((state) => state.hasPermission('aimv.settings.edit'));
  const [form, setForm] = useState<SettingsRecord | null>(null);
  const [message, setMessage] = useState('');
  const query = useQuery<SettingsResponse>({ queryKey: ['aimv-settings'], queryFn: () => apiClient.get('/admin/aimv-generator/settings') as Promise<SettingsResponse> });
  useEffect(() => { if (query.data) setForm(query.data.settings); }, [query.data]);
  const save = useMutation({
    mutationFn: (payload: SettingsRecord) => apiClient.put('/admin/aimv-generator/settings', payload),
    onSuccess: () => { setMessage('格式白名单已保存，只对新创建项目生效。'); void queryClient.invalidateQueries({ queryKey: ['aimv-settings'] }); },
    onError: (error: Error) => setMessage(error.message || '保存失败'),
  });

  if (query.isLoading || !form) return <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-violet-600"/></div>;
  if (query.isError) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{(query.error as Error).message}</div>;

  return <div className="space-y-5">
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div><h2 className="font-semibold text-slate-900">格式白名单</h2><p className="mt-1 text-sm text-slate-500">控制产品中心允许上传和生成的音乐、图片及视频格式。</p></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {FIELDS.map((field) => <label key={field.key} className="text-sm text-slate-600"><span>{field.label}</span><input disabled={!canEdit || save.isPending} value={(Array.isArray(form[field.key]) ? form[field.key] as string[] : []).join(', ')} placeholder={field.hint} onChange={(event) => setForm({ ...form, [field.key]: splitList(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-violet-400 disabled:bg-slate-50"/></label>)}
      </div>
    </section>
    <div className="flex items-center justify-end gap-3">{message ? <span className="text-sm text-slate-600">{message}</span> : null}<button disabled={!canEdit || save.isPending} onClick={() => save.mutate(form)} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{save.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}保存白名单</button></div>
  </div>;
}
