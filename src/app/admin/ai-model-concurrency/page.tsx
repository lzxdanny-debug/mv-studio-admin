'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gauge, RefreshCw } from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';

type RoutingProvider =
  | 'mountsea'
  | 'apisale'
  | 'smartfashion'
  | 'aitokens'
  | 'google';

interface ModelConcurrencyRow {
  id?: string;
  provider: RoutingProvider;
  model: string;
  modality: 'video' | 'image';
  projectConcurrency: number;
  globalConcurrency: number;
  queueTimeoutSec: number;
  isActive: boolean;
  notes: string | null;
  configured: boolean;
  capabilities: string[];
  runtime: { running: number; queued: number };
}

interface ModelConcurrencyResp {
  rows: ModelConcurrencyRow[];
}

const PROVIDER_LABEL: Record<RoutingProvider, string> = {
  mountsea: 'Mountsea',
  apisale: 'apisale',
  smartfashion: 'smartfashion',
  aitokens: 'aitokens',
  google: 'Google Gemini',
};

export default function AiModelConcurrencyPage() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, ModelConcurrencyRow>>({});
  const [message, setMessage] = useState('');
  const queryKey = ['admin', 'ai-model-concurrency'] as const;

  const concurrencyQ = useQuery<ModelConcurrencyResp>({
    queryKey,
    queryFn: () =>
      apiClient.get(
        '/admin/ai-routing/model-concurrency',
      ) as Promise<ModelConcurrencyResp>,
    refetchInterval: 10_000,
  });

  const save = useMutation({
    mutationFn: (row: ModelConcurrencyRow) =>
      apiClient.put('/admin/ai-routing/model-concurrency', {
        provider: row.provider,
        model: row.model,
        modality: row.modality,
        projectConcurrency: Number(row.projectConcurrency),
        globalConcurrency: Number(row.globalConcurrency),
        queueTimeoutSec: Number(row.queueTimeoutSec),
        isActive: row.isActive,
        notes: row.notes,
      }) as Promise<ModelConcurrencyResp>,
    onSuccess: () => {
      setMessage('并发配置已保存，新请求立即生效。');
      setDrafts({});
      qc.invalidateQueries({ queryKey });
      setTimeout(() => setMessage(''), 1800);
    },
    onError: (error: Error) => setMessage(error.message || '保存失败'),
  });

  const keyFor = (row: ModelConcurrencyRow) =>
    `${row.provider}::${row.model}`;
  const draftFor = (row: ModelConcurrencyRow) => drafts[keyFor(row)] ?? row;
  const update = (
    row: ModelConcurrencyRow,
    patch: Partial<ModelConcurrencyRow>,
  ) => {
    const key = keyFor(row);
    setDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? row), ...patch },
    }));
  };

  return (
    <div className="admin-page">
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Gauge className="h-5 w-5 text-blue-600" />
              模型并发中心
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              仅管理视频和图片模型；LLM 与音频不限制。普通 MV、Dance 与 Karaoke 共用同一套限制，模型回退时会自动切换并发池。
            </p>
          </div>
          <button
            type="button"
            onClick={() => qc.invalidateQueries({ queryKey })}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="模型数" value={concurrencyQ.data?.rows.length ?? 0} />
          <SummaryCard
            label="运行中"
            value={sumRuntime(concurrencyQ.data?.rows, 'running')}
          />
          <SummaryCard
            label="排队中"
            value={sumRuntime(concurrencyQ.data?.rows, 'queued')}
          />
        </div>

        {message && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
            {message}
          </div>
        )}

        <QueryState
          isLoading={concurrencyQ.isLoading}
          isError={concurrencyQ.isError}
          error={concurrencyQ.error}
          isEmpty={concurrencyQ.data?.rows.length === 0}
          height="h-64"
        >
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-xs">
                <thead className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <tr>
                    <th className="px-2 py-2">供应商 / 模型</th>
                    <th className="px-2 py-2">能力</th>
                    <th className="px-2 py-2">单项目</th>
                    <th className="px-2 py-2">全局</th>
                    <th className="px-2 py-2">排队超时</th>
                    <th className="px-2 py-2">运行 / 排队</th>
                    <th className="px-2 py-2">启用</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {concurrencyQ.data?.rows.map((row) => {
                    const draft = draftFor(row);
                    return (
                      <tr
                        key={keyFor(row)}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-2 py-3">
                          <p className="font-semibold text-slate-800">
                            {PROVIDER_LABEL[row.provider] ?? row.provider}
                          </p>
                          <p className="mt-0.5 max-w-64 truncate font-mono text-[10px] text-slate-500">
                            {row.model}
                          </p>
                          {!row.configured && (
                            <span className="mt-1 inline-block text-[10px] text-amber-600">
                              类型默认值
                            </span>
                          )}
                        </td>
                        <td className="max-w-52 px-2 py-3 text-[10px] leading-4 text-slate-500">
                          {row.capabilities.join('、') || row.modality}
                        </td>
                        <td className="px-2 py-3">
                          <NumberInput
                            value={draft.projectConcurrency}
                            min={1}
                            max={50}
                            onChange={(value) =>
                              update(row, { projectConcurrency: value })
                            }
                          />
                        </td>
                        <td className="px-2 py-3">
                          <NumberInput
                            value={draft.globalConcurrency}
                            min={1}
                            max={200}
                            onChange={(value) =>
                              update(row, { globalConcurrency: value })
                            }
                          />
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-1">
                            <NumberInput
                              value={draft.queueTimeoutSec}
                              min={5}
                              max={3600}
                              wide
                              onChange={(value) =>
                                update(row, { queueTimeoutSec: value })
                              }
                            />
                            <span className="text-slate-400">秒</span>
                          </div>
                        </td>
                        <td className="px-2 py-3 font-medium text-slate-600">
                          {row.runtime.running} / {row.runtime.queued}
                        </td>
                        <td className="px-2 py-3">
                          <input
                            type="checkbox"
                            checked={draft.isActive}
                            onChange={(event) =>
                              update(row, { isActive: event.target.checked })
                            }
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </td>
                        <td className="px-2 py-3 text-right">
                          <button
                            type="button"
                            disabled={save.isPending}
                            onClick={() => save.mutate(draft)}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                          >
                            保存
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </QueryState>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  wide = false,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  wide?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className={`${wide ? 'w-24' : 'w-20'} rounded-lg border border-slate-200 px-2 py-1.5`}
    />
  );
}

function sumRuntime(
  rows: ModelConcurrencyRow[] | undefined,
  field: 'running' | 'queued',
) {
  return rows?.reduce((sum, row) => sum + row.runtime[field], 0) ?? 0;
}
