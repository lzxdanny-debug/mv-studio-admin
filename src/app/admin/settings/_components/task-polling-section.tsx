'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        save.mutate(draft);
      }}
      className="space-y-4"
    >
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/40 px-5 py-4">
        <p className="text-base font-semibold text-slate-900">任务轮询</p>
        <p className="mt-1 text-sm text-slate-600">
          控制异步任务 submit 后查询状态的间隔与上限。日志{' '}
          <code className="rounded bg-white/80 px-1 text-[11px]">attempt=48/240</code> 表示第 48
          次、最多 240 次；总超时 ≈ 间隔 × 次数。
        </p>
        <p className="mt-2 text-xs text-slate-600">
          当前生效：间隔 {eff.pollIntervalMs}ms · 图片 {eff.imageMaxAttempts} 次（≈{' '}
          {formatTimeout(eff.imageTimeoutSec)}）· 视频 {eff.videoMaxAttempts} 次（≈{' '}
          {formatTimeout(eff.videoTimeoutSec)}）· 音乐 {eff.musicMaxAttempts} 次（≈{' '}
          {formatTimeout(eff.musicTimeoutSec)}）
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            间隔与次数
          </h2>
        </div>
        <div className="divide-y divide-slate-100 px-5 py-2">
          <FormField
            label="轮询间隔（毫秒）"
            description="默认 5000。留空走 env TASK_POLL_INTERVAL_MS。"
          >
            <Input
              size="sm"
              type="number"
              min={1}
              mono
              value={draft.pollIntervalMs}
              onChange={(e) => setDraft((d) => d && { ...d, pollIntervalMs: e.target.value })}
              placeholder="5000"
            />
          </FormField>
          <FormField
            label="图片 / 故事板最大次数"
            description="默认 360（5s×360≈30min）。"
          >
            <Input
              size="sm"
              type="number"
              min={1}
              mono
              value={draft.imageMaxAttempts}
              onChange={(e) => setDraft((d) => d && { ...d, imageMaxAttempts: e.target.value })}
              placeholder="360"
            />
          </FormField>
          <FormField label="视频最大次数" description="默认 240（5s×240=20min）。">
            <Input
              size="sm"
              type="number"
              min={1}
              mono
              value={draft.videoMaxAttempts}
              onChange={(e) => setDraft((d) => d && { ...d, videoMaxAttempts: e.target.value })}
              placeholder="240"
            />
          </FormField>
          <FormField
            label="音乐队列兜底最大次数"
            description="默认 180；各音乐模型另有独立上限。"
          >
            <Input
              size="sm"
              type="number"
              min={1}
              mono
              value={draft.musicMaxAttempts}
              onChange={(e) => setDraft((d) => d && { ...d, musicMaxAttempts: e.target.value })}
              placeholder="180"
            />
          </FormField>
        </div>
      </div>

      <p className="text-[11px] text-slate-400">
        Compose Worker 本地 consumer 的轮询间隔在「MV设置」标签页单独配置（compose_consumer_poll_ms）。
      </p>

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
  );
}
