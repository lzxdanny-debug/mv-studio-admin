'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Save, XCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

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
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
        <div />
      </QueryState>
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
        className="space-y-4"
      >
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/40 px-5 py-4">
          <p className="text-base font-semibold text-slate-900">MV 音乐限制</p>
          <p className="mt-1 text-sm text-slate-600">
            控制制作区间、源音频时长与上传体积。前端波形裁剪器与创建项目接口均会校验。
          </p>
          <p className="mt-2 text-xs text-slate-600">
            当前生效：制作 {eff.minDurationSec}–{eff.maxTrimSec}s · 源音频 ≤{eff.maxSourceSec}s ·
            上传 ≤{eff.maxUploadMb}MB
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              音乐长度
            </h2>
          </div>
          <div className="divide-y divide-slate-100 px-5 py-2">
            <FormField
              label="最大制作时长（秒）"
              description={`建议 60–180，当前生效 ${eff.maxTrimSec}s。留空走 env 或默认 120。`}
            >
              <Input
                size="sm"
                type="number"
                min={10}
                max={3600}
                mono
                value={draft.maxTrimSec}
                onChange={(e) => setField('maxTrimSec', e.target.value)}
                placeholder={String(eff.maxTrimSec)}
              />
            </FormField>
            <FormField
              label="最小制作时长（秒）"
              description={`低于该值拒绝创建。建议 5–15，当前生效 ${eff.minDurationSec}s。`}
            >
              <Input
                size="sm"
                type="number"
                min={5}
                max={120}
                mono
                value={draft.minDurationSec}
                onChange={(e) => setField('minDurationSec', e.target.value)}
                placeholder={String(eff.minDurationSec)}
              />
            </FormField>
            <FormField
              label="源音频最大时长（秒）"
              description={`上传或外链导入完整时长上限。建议 300–900，当前生效 ${eff.maxSourceSec}s。`}
            >
              <Input
                size="sm"
                type="number"
                min={30}
                max={7200}
                mono
                value={draft.maxSourceSec}
                onChange={(e) => setField('maxSourceSec', e.target.value)}
                placeholder={String(eff.maxSourceSec)}
              />
            </FormField>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              音乐容量
            </h2>
          </div>
          <div className="divide-y divide-slate-100 px-5 py-2">
            <FormField
              label="上传体积上限（MB）"
              description={`建议 20–100，当前生效 ${eff.maxUploadMb}MB。留空走 env 或默认 50。`}
            >
              <Input
                size="sm"
                type="number"
                min={1}
                max={500}
                mono
                value={draft.maxUploadMb}
                onChange={(e) => setField('maxUploadMb', e.target.value)}
                placeholder={String(eff.maxUploadMb)}
              />
            </FormField>
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          前端可通过 <code className="rounded bg-slate-100 px-1">GET /mv/limits</code> 读取生效值。
        </p>

        {msg && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-2 text-sm',
              msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
            )}
          >
            {msg.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0" />
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
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            撤销修改
          </button>
          <button
            type="submit"
            disabled={!dirty || save.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            {save.isPending ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </QueryState>
  );
}
