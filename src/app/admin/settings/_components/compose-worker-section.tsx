'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cpu, Save, CheckCircle2, XCircle, Copy, Sparkles } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { SecretInput } from '@/components/secret-input';
import { FromEnvBadge } from './from-env-badge';

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

function ConfigField({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-xs font-medium text-slate-700">{label}</span>
      {children}
      <p className="text-[11px] text-slate-400 leading-relaxed">{hint}</p>
    </label>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200/90 rounded-2xl shadow-sm p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>
      </div>
      {children}
    </section>
  );
}

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
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6 flex items-center justify-center text-slate-400 text-sm h-48">
        加载中…
      </div>
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

  const inputClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white';

  return (
    <QueryState isLoading={false} isError={isError} error={error} isEmpty={false} height="h-48">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-start gap-3 px-1">
          <Cpu className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-800">合成 Worker 配置</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              管理 MV 合成队列（compose / 字幕重渲 / 编辑器渲染 / 抽帧）的消费方式与容量。
              配置写入数据库，留空则回退到 <code className="px-1 rounded bg-slate-100">.env</code> 或代码默认值。
            </p>
          </div>
        </div>

        <SectionCard
          title="消费模式与鉴权"
          description="决定合成任务由 API 本机 FFmpeg 处理，还是由外部 Worker 进程轮询领取。"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ConfigField
              label="消费模式"
              hint={`local：API 进程内直接跑 FFmpeg，无需部署 Worker。worker：API 只入队，须有 Worker 在线 claim，否则任务会卡住。当前生效：${data.effective.consumerMode}。`}
            >
              <select
                value={draft.consumerMode}
                onChange={(e) => setField('consumerMode', e.target.value)}
                className={inputClass}
              >
                <option value="">（默认 local）</option>
                <option value="local">local — API 内 FFmpeg</option>
                <option value="worker">worker — 外部 Worker claim</option>
              </select>
            </ConfigField>

            <ConfigField
              label="Worker API Key"
              hint="仅用于 Worker 访问 /internal/worker/* 的 Bearer 鉴权，与 workerId、用户登录无关。须与 mv-studio-worker 的 workerApiKey 一致。保存新密钥后请立即复制；离开本页后只能重新生成轮换。"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <SecretInput
                      configured={data.effective.workerApiKeyConfigured}
                      maskedPreview={data.effective.workerApiKeyMasked}
                      value={workerApiKeyInput}
                      onChange={(v) => {
                        setWorkerApiKeyInput(v);
                        setCopyHint(null);
                      }}
                      placeholder="点击右侧自动生成"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={generateWorkerApiKey}
                    className="inline-flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                    title="生成 UUID 作为 API Key"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    自动生成
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyWorkerApiKey()}
                    className="inline-flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                    title="复制当前输入框中的密钥"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    复制
                  </button>
                  {data.effective.workerApiKeyFromEnv && <FromEnvBadge />}
                </div>
                {copyHint && (
                  <p className={cn('text-[11px]', copyHint.includes('已复制') ? 'text-emerald-600' : 'text-amber-600')}>
                    {copyHint}
                  </p>
                )}
                {savedKeyForCopy && !workerApiKeyInput && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-[11px] text-emerald-800 leading-relaxed">
                    新密钥已写入数据库。输入框仅显示掩码；点「复制」可获取刚保存的明文，请同步到{' '}
                    <code className="px-1 rounded bg-white/80">worker.constants.ts</code>。
                  </div>
                )}
              </div>
            </ConfigField>
          </div>
        </SectionCard>

        <SectionCard
          title="队列与容量"
          description="控制全站合成任务的并发与排队上限，在用户会员档位限制之外额外生效。"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ConfigField
              label="全局 running 上限"
              hint={`全站 status=running 的合成任务数上限；达到后新任务无法入队（503）。建议 2~8，当前生效 ${data.effective.globalMaxRunning}。`}
            >
              <input
                type="number"
                min={1}
                max={64}
                value={draft.globalMaxRunning}
                onChange={(e) => setField('globalMaxRunning', e.target.value)}
                placeholder={String(data.effective.globalMaxRunning)}
                className={cn(inputClass, 'font-mono tabular-nums')}
              />
            </ConfigField>

            <ConfigField
              label="队列 queued 上限"
              hint={`全站排队中（queued）任务数上限；队列满后拒绝新入队。建议 20~100，当前生效 ${data.effective.globalMaxQueued}。`}
            >
              <input
                type="number"
                min={1}
                max={500}
                value={draft.globalMaxQueued}
                onChange={(e) => setField('globalMaxQueued', e.target.value)}
                placeholder={String(data.effective.globalMaxQueued)}
                className={cn(inputClass, 'font-mono tabular-nums')}
              />
            </ConfigField>

            <ConfigField
              label="预签名 URL 有效期（秒）"
              hint={`Worker 下载素材、上传成品用的 COS 预签名链接有效期。合成耗时长时适当加大（默认 14400 = 4 小时），当前生效 ${data.effective.presignExpiresSec} 秒。`}
              className="sm:col-span-2"
            >
              <input
                type="number"
                min={60}
                max={86400}
                value={draft.presignExpiresSec}
                onChange={(e) => setField('presignExpiresSec', e.target.value)}
                placeholder={String(data.effective.presignExpiresSec)}
                className={cn(inputClass, 'font-mono tabular-nums')}
              />
            </ConfigField>
          </div>
        </SectionCard>

        <SectionCard
          title="本地消费（local 模式）"
          description="仅当消费模式为 local 时生效；API 进程内的 in-process consumer 使用以下参数。"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ConfigField
              label="本地并发槽位"
              hint={`API 本机同时跑几个 FFmpeg 合成。受 CPU/内存限制，建议 1~2，当前生效 ${data.effective.localMaxSlots}。`}
            >
              <input
                type="number"
                min={1}
                max={16}
                value={draft.localMaxSlots}
                onChange={(e) => setField('localMaxSlots', e.target.value)}
                placeholder={String(data.effective.localMaxSlots)}
                className={cn(inputClass, 'font-mono tabular-nums')}
              />
            </ConfigField>

            <ConfigField
              label="轮询间隔（毫秒）"
              hint={`local consumer 从队列 claim 任务的频率。越小响应越快、DB 压力略增，建议 2000~5000，当前生效 ${data.effective.consumerPollMs} ms。`}
            >
              <input
                type="number"
                min={500}
                max={60000}
                value={draft.consumerPollMs}
                onChange={(e) => setField('consumerPollMs', e.target.value)}
                placeholder={String(data.effective.consumerPollMs)}
                className={cn(inputClass, 'font-mono tabular-nums')}
              />
            </ConfigField>
          </div>
        </SectionCard>

        <section className="rounded-2xl bg-slate-50 border border-slate-100 px-5 py-4 text-xs text-slate-500 leading-relaxed space-y-2">
          <p className="font-medium text-slate-700">Worker 进程侧配置（mv-studio-worker）</p>
          <p>
            以下参数不在本页管理，需在 Worker 代码{' '}
            <code className="px-1 rounded bg-white border border-slate-100">src/config/worker.constants.ts</code>{' '}
            中按机器填写：
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <code className="px-1 rounded bg-white">mainApiBaseUrl</code> — 主服务地址（不含 /api）
            </li>
            <li>
              <code className="px-1 rounded bg-white">workerApiKey</code> — 与上方 API Key 相同
            </li>
            <li>
              <code className="px-1 rounded bg-white">workerId</code> — 实例标识，多 Worker 时须唯一
            </li>
            <li>
              <code className="px-1 rounded bg-white">workerMaxSlots</code> — 本机同时处理任务数，建议从 1 开始
            </li>
          </ul>
        </section>

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
              setWorkerApiKeyInput('');
              setSavedKeyForCopy(null);
              setCopyHint(null);
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
