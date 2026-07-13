'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Save } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';

interface TaskPollSaved {
  pollIntervalMs: string;
  imageMaxAttempts: string;
  videoMaxAttempts: string;
  musicMaxAttempts: string;
}

interface TaskPollResp {
  saved: TaskPollSaved;
  effective: {
    pollIntervalMs: number;
    imageMaxAttempts: number;
    videoMaxAttempts: number;
    musicMaxAttempts: number;
    imageTimeoutSec: number;
    videoTimeoutSec: number;
    musicTimeoutSec: number;
  };
}

function formatTimeout(sec: number): string {
  if (sec < 60) return `${sec} 秒`;
  const min = Math.round(sec / 60);
  return `${min} 分钟（${sec}s）`;
}

function ConfigField({
  label,
  hint,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
      />
      <span className="text-[11px] text-slate-400">{hint}</span>
    </label>
  );
}

export function TaskPollingSection() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<TaskPollSaved | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<TaskPollResp>({
    queryKey: ['admin', 'settings', 'task-polling'],
    queryFn: () =>
      apiClient.get('/admin/settings/task-polling') as Promise<TaskPollResp>,
  });

  useEffect(() => {
    if (data?.saved && draft === null) {
      setDraft(data.saved);
    }
  }, [data, draft]);

  const save = useMutation({
    mutationFn: (payload: Partial<TaskPollSaved>) =>
      apiClient.patch('/admin/settings/task-polling', payload) as Promise<TaskPollResp>,
    onSuccess: (resp) => {
      setMsg({ ok: true, text: '任务轮询配置已保存，下一次异步任务即生效。' });
      qc.setQueryData(['admin', 'settings', 'task-polling'], resp);
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

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6 space-y-5">
      <div className="flex items-start gap-3">
        <Clock className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold text-slate-900">任务轮询</h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-3xl">
            控制 Mountsea Legacy / Mountsea Ms、MV 故事板与视频生成、音乐任务队列等异步任务在 submit
            后查询状态的间隔与上限。日志里 <code className="text-[10px] bg-slate-100 px-1 rounded">attempt=48/240</code>{' '}
            表示第 48 次、最多 240 次；总超时 ≈ 间隔 × 次数。
          </p>
          <p className="text-xs text-slate-600 mt-2">
            当前生效：间隔 {eff.pollIntervalMs}ms · 图片 {eff.imageMaxAttempts} 次（≈{' '}
            {formatTimeout(eff.imageTimeoutSec)}）· 视频 {eff.videoMaxAttempts} 次（≈{' '}
            {formatTimeout(eff.videoTimeoutSec)}）· 音乐 {eff.musicMaxAttempts} 次（≈{' '}
            {formatTimeout(eff.musicTimeoutSec)}）
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          save.mutate(draft);
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ConfigField
            label="轮询间隔（毫秒）"
            hint="默认 5000。留空走 env TASK_POLL_INTERVAL_MS。"
            value={draft.pollIntervalMs}
            placeholder="5000"
            onChange={(pollIntervalMs) => setDraft((d) => d && { ...d, pollIntervalMs })}
          />
          <ConfigField
            label="图片 / 故事板最大次数"
            hint="默认 360（5s×360≈30min）。"
            value={draft.imageMaxAttempts}
            placeholder="360"
            onChange={(imageMaxAttempts) => setDraft((d) => d && { ...d, imageMaxAttempts })}
          />
          <ConfigField
            label="视频最大次数"
            hint="默认 240（5s×240=20min）。"
            value={draft.videoMaxAttempts}
            placeholder="240"
            onChange={(videoMaxAttempts) => setDraft((d) => d && { ...d, videoMaxAttempts })}
          />
          <ConfigField
            label="音乐队列兜底最大次数"
            hint="默认 180；各音乐模型另有独立上限。"
            value={draft.musicMaxAttempts}
            placeholder="180"
            onChange={(musicMaxAttempts) => setDraft((d) => d && { ...d, musicMaxAttempts })}
          />
        </div>

        <p className="text-[11px] text-slate-400">
          Compose Worker 本地 consumer 的轮询间隔在「Worker」标签页单独配置（compose_consumer_poll_ms）。
        </p>

        {msg && (
          <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
            {msg.text}
          </p>
        )}

        <div className="flex justify-end">
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
  );
}
