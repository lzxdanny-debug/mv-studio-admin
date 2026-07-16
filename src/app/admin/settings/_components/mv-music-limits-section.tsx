'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Music2, Save, CheckCircle2, XCircle, HardDrive } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';

interface MvMusicLimitsSaved {
  maxTrimSec: string;
  minDurationSec: string;
  maxSourceSec: string;
  maxUploadMb: string;
}

interface MvMusicLimitsResp {
  saved: MvMusicLimitsSaved;
  effective: {
    maxTrimSec: number;
    minDurationSec: number;
    maxSourceSec: number;
    maxUploadMb: number;
    maxUploadBytes: number;
  };
}

function ConfigField({
  label,
  hint,
  value,
  placeholder,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  placeholder: string;
  min: number;
  max: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white font-mono tabular-nums"
      />
      <p className="text-[11px] text-slate-400 leading-relaxed">{hint}</p>
    </label>
  );
}

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200/90 rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-blue-600">{icon}</div>
        <div>
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function MvMusicLimitsSection() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<MvMusicLimitsSaved | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<MvMusicLimitsResp>({
    queryKey: ['admin', 'settings', 'mv-music-limits'],
    queryFn: () =>
      apiClient.get('/admin/settings/mv/music-limits') as Promise<MvMusicLimitsResp>,
  });

  useEffect(() => {
    if (data?.saved && draft === null) {
      setDraft(data.saved);
    }
  }, [data, draft]);

  const save = useMutation({
    mutationFn: (payload: Partial<MvMusicLimitsSaved>) =>
      apiClient.patch('/admin/settings/mv/music-limits', payload) as Promise<MvMusicLimitsResp>,
    onSuccess: (resp) => {
      setMsg({ ok: true, text: '音乐限制配置已保存，下一次上传/创建项目即生效。' });
      qc.setQueryData(['admin', 'settings', 'mv-music-limits'], resp);
      if (resp?.saved) setDraft(resp.saved);
    },
    onError: (e: any) =>
      setMsg({ ok: false, text: e?.response?.data?.message ?? '保存失败，请检查输入' }),
  });

  if (isLoading || !draft || !data) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6 flex items-center justify-center text-slate-400 text-sm h-48">
        加载中…
      </div>
    );
  }

  const eff = data.effective;
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.saved);

  const setField = <K extends keyof MvMusicLimitsSaved>(key: K, value: MvMusicLimitsSaved[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  return (
    <QueryState isLoading={false} isError={isError} error={error} isEmpty={false} height="h-48">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          save.mutate(draft);
        }}
        className="space-y-5"
      >
        <SectionCard
          title="音乐长度"
          description="控制用户可选取的制作区间与源音频时长上限。前端波形裁剪器与创建项目接口均会校验。"
          icon={<Music2 className="h-5 w-5" />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ConfigField
              label="最大制作时长（秒）"
              hint={`用户单次 MV 可选取的最长区间。建议 60~180，当前生效 ${eff.maxTrimSec}s。留空走 env MV_MUSIC_MAX_TRIM_SEC 或默认 120。`}
              value={draft.maxTrimSec}
              placeholder={String(eff.maxTrimSec)}
              min={10}
              max={3600}
              onChange={(maxTrimSec) => setField('maxTrimSec', maxTrimSec)}
            />
            <ConfigField
              label="最小制作时长（秒）"
              hint={`低于该值拒绝创建项目。建议 5~15，当前生效 ${eff.minDurationSec}s。`}
              value={draft.minDurationSec}
              placeholder={String(eff.minDurationSec)}
              min={5}
              max={120}
              onChange={(minDurationSec) => setField('minDurationSec', minDurationSec)}
            />
            <ConfigField
              label="源音频最大时长（秒）"
              hint={`上传或外链导入的完整音频时长上限。建议 300~900，当前生效 ${eff.maxSourceSec}s。`}
              value={draft.maxSourceSec}
              placeholder={String(eff.maxSourceSec)}
              min={30}
              max={7200}
              onChange={(maxSourceSec) => setField('maxSourceSec', maxSourceSec)}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="音乐容量"
          description="控制音频上传体积上限，影响 /upload 接口与外链导入前的 HEAD 探测。"
          icon={<HardDrive className="h-5 w-5" />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ConfigField
              label="上传体积上限（MB）"
              hint={`音频文件最大体积。建议 20~100，当前生效 ${eff.maxUploadMb}MB（${(eff.maxUploadBytes / 1024 / 1024).toFixed(0)}MB）。留空走 env 或默认 50。`}
              value={draft.maxUploadMb}
              placeholder={String(eff.maxUploadMb)}
              min={1}
              max={500}
              onChange={(maxUploadMb) => setField('maxUploadMb', maxUploadMb)}
            />
          </div>
        </SectionCard>

        <p className="text-[11px] text-slate-400 px-1">
          前端可通过公开接口 <code className="px-1 rounded bg-slate-100">GET /mv/limits</code> 读取生效值，用于波形裁剪器与上传提示。
        </p>

        {msg && (
          <div
            className={cn(
              'flex items-center gap-2 text-sm rounded-lg px-3 py-2',
              msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
            )}
          >
            {msg.ok ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 flex-shrink-0" />
            )}
            {msg.text}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(data.saved);
              setMsg(null);
            }}
            disabled={!dirty || save.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            撤销修改
          </button>
          <button
            type="submit"
            disabled={!dirty || save.isPending}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              dirty && !save.isPending
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed',
            )}
          >
            <Save className="h-4 w-4" />
            {save.isPending ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </QueryState>
  );
}
