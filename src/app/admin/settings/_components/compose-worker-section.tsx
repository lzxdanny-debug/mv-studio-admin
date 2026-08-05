'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Copy, Save, Sparkles, XCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { SecretInput } from '@/components/secret-input';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';
import { FromEnvBadge } from './from-env-badge';
import { CONTROL_WIDE, SECRET_INPUT_CLS } from './settings-form-styles';

interface ComposeQueueSaved {
  workerApiKey: string;
  consumerMode: string;
  globalMaxRunning: string;
  globalMaxQueued: string;
  presignExpiresSec: string;
  localMaxSlots: string;
  consumerPollMs: string;
}

interface ComposeQueueResp {
  saved: ComposeQueueSaved;
  effective: {
    workerApiKeyConfigured: boolean;
    workerApiKeyMasked: string;
    workerApiKeyFromEnv: boolean;
    consumerMode: 'local' | 'worker';
    globalMaxRunning: number;
    globalMaxQueued: number;
    presignExpiresSec: number;
    localMaxSlots: number;
    consumerPollMs: number;
  };
}

const MODE_DEFAULT = '__default__';

export function ComposeWorkerSection() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<ComposeQueueSaved | null>(null);
  const [workerApiKeyInput, setWorkerApiKeyInput] = useState('');
  const [savedKeyForCopy, setSavedKeyForCopy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery<ComposeQueueResp>({
    queryKey: ['admin', 'settings', 'compose-queue'],
    queryFn: () =>
      apiClient.get('/admin/settings/mv/compose-queue') as Promise<ComposeQueueResp>,
  });

  useEffect(() => {
    if (data?.saved && draft === null) {
      setDraft(data.saved);
    }
  }, [data, draft]);

  const save = useMutation({
    mutationFn: (payload: Partial<ComposeQueueSaved>) =>
      apiClient.patch('/admin/settings/mv/compose-queue', payload) as Promise<ComposeQueueResp>,
    onSuccess: (resp, variables) => {
      const newKey = variables.workerApiKey?.trim();
      if (newKey) {
        setSavedKeyForCopy(newKey);
        setWorkerApiKeyInput('');
        setMsg({
          ok: true,
          text: 'Worker 配置已保存。请立即复制 API Key 到 worker.constants.ts（关闭本页后将无法再次查看明文）。',
        });
      } else {
        setMsg({ ok: true, text: 'Worker 配置已保存，下一次入队/claim 即生效。' });
      }
      qc.setQueryData(['admin', 'settings', 'compose-queue'], resp);
      if (resp?.saved) setDraft(resp.saved);
      setCopyHint(null);
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

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(data.saved) || !!workerApiKeyInput.trim();

  const copyableKey = workerApiKeyInput.trim() || savedKeyForCopy || '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const payload: Partial<ComposeQueueSaved> = { ...draft };
    if (workerApiKeyInput.trim()) {
      payload.workerApiKey = workerApiKeyInput.trim();
    } else {
      delete payload.workerApiKey;
    }
    save.mutate(payload);
  };

  const setField = <K extends keyof ComposeQueueSaved>(key: K, value: ComposeQueueSaved[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  const generateWorkerApiKey = () => {
    setWorkerApiKeyInput(crypto.randomUUID());
    setSavedKeyForCopy(null);
    setCopyHint(null);
    setMsg(null);
  };

  const copyWorkerApiKey = async () => {
    const text = copyableKey;
    if (!text) {
      setCopyHint('请先生成并保存密钥，或保存后在本页立即复制（已存库的密钥不会明文展示）');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint('已复制到剪贴板');
    } catch {
      setCopyHint('复制失败，请手动选择复制');
    }
  };

  const keyConfigured = data.effective.workerApiKeyConfigured;

  return (
    <QueryState isLoading={false} isError={isError} error={error} isEmpty={false} height="h-48">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          className={cn(
            'flex items-center justify-between gap-4 rounded-2xl border px-5 py-4',
            keyConfigured
              ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50'
              : 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50',
          )}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-slate-900">合成 MV（FFmpeg Worker）</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                模式 {data.effective.consumerMode}
              </span>
              {data.effective.workerApiKeyFromEnv && <FromEnvBadge fromEnv />}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              管理 compose / 字幕重渲 / 编辑器渲染的 FFmpeg 队列与容量。留空回退 env 或代码默认值。
            </p>
          </div>
          {keyConfigured ? (
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
          ) : (
            <XCircle className="h-6 w-6 shrink-0 text-amber-500" />
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              消费模式与鉴权
            </h2>
          </div>
          <div className="divide-y divide-slate-100 px-5 py-2">
            <FormField
              label="消费模式"
              description={`local：API 内 FFmpeg；worker：外部 claim。当前生效 ${data.effective.consumerMode}。`}
              controlClassName={CONTROL_WIDE}
            >
              <SimpleSelect
                size="sm"
                value={draft.consumerMode || MODE_DEFAULT}
                onValueChange={(v) => setField('consumerMode', v === MODE_DEFAULT ? '' : v)}
                options={[
                  { value: MODE_DEFAULT, label: '默认（local）' },
                  { value: 'local', label: 'local — API 内 FFmpeg' },
                  { value: 'worker', label: 'worker — 外部 Worker claim' },
                ]}
              />
            </FormField>
            <FormField
              label="Worker API Key"
              description="Worker 访问 /internal/worker/* 的 Bearer。保存新密钥后请立即复制。"
              className="items-start"
              controlClassName="sm:w-[420px] w-full"
            >
              <div className="w-full space-y-2">
                <SecretInput
                  configured={data.effective.workerApiKeyConfigured}
                  maskedPreview={data.effective.workerApiKeyMasked}
                  value={workerApiKeyInput}
                  onChange={(v) => {
                    setWorkerApiKeyInput(v);
                    setCopyHint(null);
                  }}
                  placeholder="点击下方自动生成"
                  className={SECRET_INPUT_CLS}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={generateWorkerApiKey}
                    className="inline-flex items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    自动生成
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyWorkerApiKey()}
                    className="inline-flex items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    复制
                  </button>
                </div>
                {copyHint && (
                  <p
                    className={cn(
                      'text-[11px]',
                      copyHint.includes('已复制') ? 'text-emerald-600' : 'text-amber-600',
                    )}
                  >
                    {copyHint}
                  </p>
                )}
                {savedKeyForCopy && !workerApiKeyInput && (
                  <div className="rounded-[10px] border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-[11px] leading-relaxed text-emerald-800">
                    新密钥已写入。点「复制」获取刚保存的明文，并同步到{' '}
                    <code className="rounded bg-white/80 px-1">worker.constants.ts</code>。
                  </div>
                )}
              </div>
            </FormField>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              队列与容量
            </h2>
          </div>
          <div className="divide-y divide-slate-100 px-5 py-2">
            <FormField
              label="全局 running 上限"
              description={`全站 running 上限；达限后新任务 503。建议 2–8，当前 ${data.effective.globalMaxRunning}。`}
            >
              <Input
                size="sm"
                type="number"
                min={1}
                max={64}
                mono
                value={draft.globalMaxRunning}
                onChange={(e) => setField('globalMaxRunning', e.target.value)}
                placeholder={String(data.effective.globalMaxRunning)}
              />
            </FormField>
            <FormField
              label="队列 queued 上限"
              description={`排队上限。建议 20–100，当前 ${data.effective.globalMaxQueued}。`}
            >
              <Input
                size="sm"
                type="number"
                min={1}
                max={500}
                mono
                value={draft.globalMaxQueued}
                onChange={(e) => setField('globalMaxQueued', e.target.value)}
                placeholder={String(data.effective.globalMaxQueued)}
              />
            </FormField>
            <FormField
              label="预签名 URL 有效期（秒）"
              description={`COS 预签名有效期。默认 14400（4h），当前 ${data.effective.presignExpiresSec}。`}
            >
              <Input
                size="sm"
                type="number"
                min={60}
                max={86400}
                mono
                value={draft.presignExpiresSec}
                onChange={(e) => setField('presignExpiresSec', e.target.value)}
                placeholder={String(data.effective.presignExpiresSec)}
              />
            </FormField>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              本地消费（local）
            </h2>
          </div>
          <div className="divide-y divide-slate-100 px-5 py-2">
            <FormField
              label="本地并发槽位"
              description={`本机同时跑几个 FFmpeg。建议 1–2，当前 ${data.effective.localMaxSlots}。`}
            >
              <Input
                size="sm"
                type="number"
                min={1}
                max={16}
                mono
                value={draft.localMaxSlots}
                onChange={(e) => setField('localMaxSlots', e.target.value)}
                placeholder={String(data.effective.localMaxSlots)}
              />
            </FormField>
            <FormField
              label="轮询间隔（毫秒）"
              description={`claim 频率。建议 2000–5000，当前 ${data.effective.consumerPollMs} ms。`}
            >
              <Input
                size="sm"
                type="number"
                min={500}
                max={60000}
                mono
                value={draft.consumerPollMs}
                onChange={(e) => setField('consumerPollMs', e.target.value)}
                placeholder={String(data.effective.consumerPollMs)}
              />
            </FormField>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-xs leading-relaxed text-slate-500 space-y-2">
          <p className="font-medium text-slate-700">Worker 进程侧（mv-studio-worker）</p>
          <p>
            以下参数在{' '}
            <code className="rounded border border-slate-100 bg-white px-1">
              src/config/worker.constants.ts
            </code>{' '}
            配置：
          </p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <code className="rounded bg-white px-1">mainApiBaseUrl</code> — 主服务地址
            </li>
            <li>
              <code className="rounded bg-white px-1">workerApiKey</code> — 与上方 API Key 相同
            </li>
            <li>
              <code className="rounded bg-white px-1">workerId</code> — 多实例须唯一
            </li>
            <li>
              <code className="rounded bg-white px-1">workerMaxSlots</code> — 本机并发，建议从 1 开始
            </li>
          </ul>
        </div>

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
              setWorkerApiKeyInput('');
              setSavedKeyForCopy(null);
              setCopyHint(null);
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
