'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Cloud,
  Film,
  Gauge,
  Image as ImageIcon,
  MessageSquareText,
  RefreshCw,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { cn } from '@/lib/utils';
import { AdminConfigSync } from '@/components/admin-config-sync';

type RoutingProvider =
  | 'mountsea'
  | 'apisale'
  | 'smartfashion'
  | 'aitokens'
  | 'google';

interface ConcurrencyLimits {
  projectConcurrency: number;
  globalConcurrency: number;
  queueTimeoutSec: number;
  isActive: boolean;
  notes: string | null;
  configured: boolean;
  runtime: { running: number; queued: number };
}

interface FamilyRow extends ConcurrencyLimits {
  family: string;
  modality: 'video' | 'image' | 'text';
  inherited: boolean;
  source: 'family' | 'provider' | 'default';
  capabilities: string[];
  models: string[];
}

interface ProviderCard {
  provider: RoutingProvider;
  imageDefault: ConcurrencyLimits;
  videoDefault: ConcurrencyLimits;
  families: FamilyRow[];
}

interface ModelConcurrencyResp {
  providers: ProviderCard[];
}

const PROVIDER_LABEL: Record<RoutingProvider, string> = {
  mountsea: 'Mountsea',
  apisale: 'apisale',
  smartfashion: 'smartfashion',
  aitokens: 'aitokens',
  google: 'Google',
};

type DraftLimits = Pick<
  ConcurrencyLimits,
  'projectConcurrency' | 'globalConcurrency' | 'queueTimeoutSec' | 'isActive'
>;

export default function AiModelConcurrencyPage() {
  const qc = useQueryClient();
  const [activeProvider, setActiveProvider] = useState<RoutingProvider | null>(
    null,
  );
  const [channelDrafts, setChannelDrafts] = useState<
    Record<string, { image: DraftLimits; video: DraftLimits }>
  >({});
  const [familyDrafts, setFamilyDrafts] = useState<Record<string, DraftLimits>>(
    {},
  );
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
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.put(
        '/admin/ai-routing/model-concurrency',
        body,
      ) as Promise<ModelConcurrencyResp>,
    onSuccess: () => {
      setMessage('并发配置已保存，新请求立即生效。');
      setChannelDrafts({});
      setFamilyDrafts({});
      qc.invalidateQueries({ queryKey });
      setTimeout(() => setMessage(''), 1800);
    },
    onError: (error: Error) => setMessage(error.message || '保存失败'),
  });

  const clearFamily = useMutation({
    mutationFn: ({
      provider,
      family,
    }: {
      provider: RoutingProvider;
      family: string;
    }) =>
      apiClient.delete(
        `/admin/ai-routing/model-concurrency/family?provider=${provider}&family=${encodeURIComponent(family)}`,
      ) as Promise<ModelConcurrencyResp>,
    onSuccess: () => {
      setMessage('已清除族覆盖，恢复继承渠道默认。');
      setFamilyDrafts({});
      qc.invalidateQueries({ queryKey });
      setTimeout(() => setMessage(''), 1800);
    },
    onError: (error: Error) => setMessage(error.message || '清除失败'),
  });

  const providers = concurrencyQ.data?.providers ?? [];

  useEffect(() => {
    if (providers.length === 0) return;
    if (
      activeProvider &&
      providers.some((item) => item.provider === activeProvider)
    ) {
      return;
    }
    setActiveProvider(providers[0].provider);
  }, [activeProvider, providers]);

  const activeCard =
    providers.find((item) => item.provider === activeProvider) ?? null;

  const summary = useMemo(() => {
    let running = 0;
    let queued = 0;
    const seen = new Set<string>();
    for (const card of providers) {
      for (const [modality, limits] of [
        ['image', card.imageDefault],
        ['video', card.videoDefault],
      ] as const) {
        const key = `${card.provider}::@provider/${modality}`;
        if (!seen.has(key)) {
          seen.add(key);
          running += limits.runtime.running;
          queued += limits.runtime.queued;
        }
      }
      for (const family of card.families) {
        if (family.inherited) continue;
        const key = `${card.provider}::@family/${family.family}`;
        if (seen.has(key)) continue;
        seen.add(key);
        running += family.runtime.running;
        queued += family.runtime.queued;
      }
    }
    return { channels: providers.length, running, queued };
  }, [providers]);

  const channelDraft = (card: ProviderCard, modality: 'image' | 'video') => {
    const key = card.provider;
    const base = modality === 'image' ? card.imageDefault : card.videoDefault;
    const draft = channelDrafts[key]?.[modality];
    return draft ?? pickDraft(base);
  };

  const updateChannel = (
    provider: RoutingProvider,
    modality: 'image' | 'video',
    patch: Partial<DraftLimits>,
  ) => {
    setChannelDrafts((current) => {
      const card = concurrencyQ.data?.providers.find(
        (item) => item.provider === provider,
      );
      if (!card) return current;
      const prev = current[provider] ?? {
        image: pickDraft(card.imageDefault),
        video: pickDraft(card.videoDefault),
      };
      return {
        ...current,
        [provider]: {
          ...prev,
          [modality]: { ...prev[modality], ...patch },
        },
      };
    });
  };

  const familyKey = (provider: string, family: string) =>
    `${provider}::${family}`;

  const familyDraft = (provider: RoutingProvider, row: FamilyRow) =>
    familyDrafts[familyKey(provider, row.family)] ?? pickDraft(row);

  const updateFamily = (
    provider: RoutingProvider,
    row: FamilyRow,
    patch: Partial<DraftLimits>,
  ) => {
    const key = familyKey(provider, row.family);
    setFamilyDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? pickDraft(row)), ...patch },
    }));
  };

  return (
    <div className="admin-page">
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Gauge className="h-5 w-5 text-blue-600" />
              模型并发中心
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              按渠道配置图片/视频默认并发，并可按模型族覆盖；同族不同版本共享同一运行池。文本模型族（如
              Gemini）会展示路由归属，但不进入并发队列。
            </p>
          </div>
          <button
            type="button"
            onClick={() => qc.invalidateQueries({ queryKey })}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </button>
        </div>

        <AdminConfigSync
          kind="ai-model-concurrency"
          title="模型并发配置"
          endpoint="/admin/ai-routing/model-concurrency/sync"
          description="同步已保存的渠道默认并发和模型族覆盖。运行中、排队中等实时数据不会导出；目标环境原有但文件未包含的配置会保留。"
          onImported={() => qc.invalidateQueries({ queryKey })}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="渠道数" value={summary.channels} />
          <SummaryCard label="运行中" value={summary.running} />
          <SummaryCard label="排队中" value={summary.queued} />
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
          isEmpty={providers.length === 0}
          height="h-64"
        >
          <>
            <div className="mb-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5">
              <div className="flex min-w-max items-center gap-1">
                {providers.map((card) => {
                  const active = activeProvider === card.provider;
                  return (
                    <button
                      key={card.provider}
                      type="button"
                      onClick={() => setActiveProvider(card.provider)}
                      className={cn(
                        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-colors',
                        active
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                      )}
                    >
                      <Cloud
                        className={cn(
                          'h-3.5 w-3.5',
                          active ? 'text-white' : 'text-slate-400',
                        )}
                      />
                      {PROVIDER_LABEL[card.provider] ?? card.provider}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeCard && (
              <ProviderConcurrencyPanel
                card={activeCard}
                image={channelDraft(activeCard, 'image')}
                video={channelDraft(activeCard, 'video')}
                familyDraft={familyDraft}
                updateChannel={updateChannel}
                updateFamily={updateFamily}
                onSaveChannel={(modality, draft) =>
                  save.mutate({
                    provider: activeCard.provider,
                    scope: 'provider',
                    modality,
                    ...draft,
                  })
                }
                onSaveFamily={(row, draft) =>
                  save.mutate({
                    provider: activeCard.provider,
                    scope: 'family',
                    family: row.family,
                    modality: row.modality,
                    ...draft,
                  })
                }
                onClearFamily={(family) =>
                  clearFamily.mutate({
                    provider: activeCard.provider,
                    family,
                  })
                }
                saving={save.isPending}
                clearing={clearFamily.isPending}
              />
            )}
          </>
        </QueryState>
      </div>
    </div>
  );
}

function ProviderConcurrencyPanel({
  card,
  image,
  video,
  familyDraft,
  updateChannel,
  updateFamily,
  onSaveChannel,
  onSaveFamily,
  onClearFamily,
  saving,
  clearing,
}: {
  card: ProviderCard;
  image: DraftLimits;
  video: DraftLimits;
  familyDraft: (provider: RoutingProvider, row: FamilyRow) => DraftLimits;
  updateChannel: (
    provider: RoutingProvider,
    modality: 'image' | 'video',
    patch: Partial<DraftLimits>,
  ) => void;
  updateFamily: (
    provider: RoutingProvider,
    row: FamilyRow,
    patch: Partial<DraftLimits>,
  ) => void;
  onSaveChannel: (modality: 'image' | 'video', draft: DraftLimits) => void;
  onSaveFamily: (row: FamilyRow, draft: DraftLimits) => void;
  onClearFamily: (family: string) => void;
  saving: boolean;
  clearing: boolean;
}) {
  const imageFamilies = card.families.filter((row) => row.modality === 'image');
  const videoFamilies = card.families.filter((row) => row.modality === 'video');
  const textFamilies = card.families.filter((row) => row.modality === 'text');
  const showImage = imageFamilies.length > 0;
  const showVideo = videoFamilies.length > 0;
  const showText = textFamilies.length > 0;
  const runtimeBits = [
    showImage
      ? `图片运行 ${card.imageDefault.runtime.running}/${card.imageDefault.runtime.queued}`
      : null,
    showVideo
      ? `视频运行 ${card.videoDefault.runtime.running}/${card.videoDefault.runtime.queued}`
      : null,
    showText ? `文本模型族 ${textFamilies.length}` : null,
  ].filter(Boolean);
  const showUnconfiguredHint =
    (showImage && !card.imageDefault.configured) ||
    (showVideo && !card.videoDefault.configured);

  return (
    <section className="w-full">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2.5 border-b border-blue-200 bg-blue-100 px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-blue-200 bg-white/90 shadow-sm">
            <Cloud className="h-4 w-4 text-blue-700" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-wide text-blue-950">
              {PROVIDER_LABEL[card.provider] ?? card.provider}
            </h2>
            <p className="mt-0.5 text-[11px] text-blue-900/70">
              {runtimeBits.length > 0
                ? runtimeBits.join(' · ')
                : '当前路由中暂无该渠道的可展示模型族'}
              {showUnconfiguredHint && (
                <span className="ml-2 text-amber-700">
                  未保存渠道默认时使用代码默认值
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {showImage && (
            <ModalityEditor
              title="图片"
              icon={ImageIcon}
              draft={image}
              onChange={(patch) => updateChannel(card.provider, 'image', patch)}
              onSave={() => onSaveChannel('image', image)}
              saving={saving}
            >
              <FamilyOverrideTable
                modalityLabel="图片模型族"
                emptyText="当前路由中暂无该渠道的图片模型族"
                families={imageFamilies}
                provider={card.provider}
                familyDraft={familyDraft}
                updateFamily={updateFamily}
                onSaveFamily={onSaveFamily}
                onClearFamily={onClearFamily}
                saving={saving}
                clearing={clearing}
              />
            </ModalityEditor>
          )}

          {showVideo && (
            <ModalityEditor
              title="视频"
              icon={Film}
              draft={video}
              onChange={(patch) => updateChannel(card.provider, 'video', patch)}
              onSave={() => onSaveChannel('video', video)}
              saving={saving}
            >
              <FamilyOverrideTable
                modalityLabel="视频模型族"
                emptyText="当前路由中暂无该渠道的视频模型族"
                families={videoFamilies}
                provider={card.provider}
                familyDraft={familyDraft}
                updateFamily={updateFamily}
                onSaveFamily={onSaveFamily}
                onClearFamily={onClearFamily}
                saving={saving}
                clearing={clearing}
              />
            </ModalityEditor>
          )}

          {showText && <TextFamilyRoster families={textFamilies} />}

          {!showImage && !showVideo && !showText && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center text-[11px] text-slate-400">
              当前路由中暂无该渠道的图片/视频/文本模型族
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TextFamilyRoster({ families }: { families: FamilyRow[] }) {
  return (
    <div className="w-full rounded-xl border border-slate-200 bg-slate-50/40 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
              <MessageSquareText className="h-3.5 w-3.5 text-slate-600" />
            </span>
            文本
          </p>
          <p className="mt-1.5 text-[11px] leading-5 text-slate-500">
            路由中的文本 / LLM 模型族（如 Gemini）。文本调用不进入并发队列，此处仅展示归属，不可限流。
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 tabular-nums">
          {families.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className="px-3.5 py-2.5 text-[10px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                  模型族
                </th>
                <th className="px-3.5 py-2.5 text-[10px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                  能力
                </th>
                <th className="px-3.5 py-2.5 text-[10px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                  示例模型
                </th>
              </tr>
            </thead>
            <tbody>
              {families.map((row) => (
                <tr
                  key={row.family}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                >
                  <td className="px-3.5 py-3">
                    <p className="font-semibold text-slate-800">{row.family}</p>
                    <p className="mt-1">
                      <span className="inline-flex rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200/80">
                        不限流
                      </span>
                    </p>
                  </td>
                  <td className="max-w-72 px-3.5 py-3 text-[10px] leading-4 text-slate-500">
                    {row.capabilities.join('、') || '—'}
                  </td>
                  <td className="px-3.5 py-3 font-mono text-[10px] text-slate-500">
                    {row.models.slice(0, 4).join(' · ')}
                    {row.models.length > 4 ? ` +${row.models.length - 4}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FamilyOverrideTable({
  modalityLabel,
  emptyText,
  families,
  provider,
  familyDraft,
  updateFamily,
  onSaveFamily,
  onClearFamily,
  saving,
  clearing,
}: {
  modalityLabel: string;
  emptyText: string;
  families: FamilyRow[];
  provider: RoutingProvider;
  familyDraft: (provider: RoutingProvider, row: FamilyRow) => DraftLimits;
  updateFamily: (
    provider: RoutingProvider,
    row: FamilyRow,
    patch: Partial<DraftLimits>,
  ) => void;
  onSaveFamily: (row: FamilyRow, draft: DraftLimits) => void;
  onClearFamily: (family: string) => void;
  saving: boolean;
  clearing: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-3.5 py-2.5">
        <div>
          <p className="text-[11px] font-bold tracking-[0.08em] text-slate-700 uppercase">
            {modalityLabel}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">
            覆盖渠道默认；未覆盖时继承上方配置
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 tabular-nums">
          {families.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90">
              <th className="px-3.5 py-2.5 text-[10px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                模型族
              </th>
              <th className="px-3.5 py-2.5 text-[10px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                能力 / 示例
              </th>
              <th className="px-3.5 py-2.5 text-[10px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                单项目
              </th>
              <th className="px-3.5 py-2.5 text-[10px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                全局
              </th>
              <th className="px-3.5 py-2.5 text-[10px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                超时
              </th>
              <th className="px-3.5 py-2.5 text-[10px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                运行 / 排队
              </th>
              <th className="px-3.5 py-2.5 text-[10px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                启用
              </th>
              <th className="px-3.5 py-2.5 text-right text-[10px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {families.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3.5 py-8 text-center text-[11px] text-slate-400"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              families.map((row) => {
                const draft = familyDraft(provider, row);
                return (
                  <tr
                    key={row.family}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="px-3.5 py-3">
                      <p className="font-semibold text-slate-800">
                        {row.family}
                      </p>
                      <p className="mt-1">
                        {row.inherited ? (
                          <span className="inline-flex rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200/80">
                            继承渠道
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200/80">
                            已覆盖
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="max-w-56 px-3.5 py-3 text-[10px] leading-4 text-slate-500">
                      <p>{row.capabilities.join('、') || '—'}</p>
                      <p className="mt-1 font-mono text-slate-400">
                        {row.models.slice(0, 3).join(' · ')}
                        {row.models.length > 3
                          ? ` +${row.models.length - 3}`
                          : ''}
                      </p>
                    </td>
                    <td className="px-3.5 py-3">
                      <NumberInput
                        value={draft.projectConcurrency}
                        min={1}
                        max={50}
                        onChange={(value) =>
                          updateFamily(provider, row, {
                            projectConcurrency: value,
                          })
                        }
                      />
                    </td>
                    <td className="px-3.5 py-3">
                      <NumberInput
                        value={draft.globalConcurrency}
                        min={1}
                        max={200}
                        onChange={(value) =>
                          updateFamily(provider, row, {
                            globalConcurrency: value,
                          })
                        }
                      />
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-1">
                        <NumberInput
                          value={draft.queueTimeoutSec}
                          min={5}
                          max={3600}
                          wide
                          onChange={(value) =>
                            updateFamily(provider, row, {
                              queueTimeoutSec: value,
                            })
                          }
                        />
                        <span className="text-slate-400">秒</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 font-medium tabular-nums text-slate-600">
                      {row.runtime.running} / {row.runtime.queued}
                      {row.inherited && (
                        <span className="ml-1 text-[10px] font-normal text-slate-400">
                          (渠道池)
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-3">
                      <input
                        type="checkbox"
                        checked={draft.isActive}
                        onChange={(event) =>
                          updateFamily(provider, row, {
                            isActive: event.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </td>
                    <td className="px-3.5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {!row.inherited && (
                          <button
                            type="button"
                            disabled={clearing}
                            onClick={() => onClearFamily(row.family)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                          >
                            清除
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => onSaveFamily(row, draft)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                        >
                          保存覆盖
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function pickDraft(limits: ConcurrencyLimits): DraftLimits {
  return {
    projectConcurrency: limits.projectConcurrency,
    globalConcurrency: limits.globalConcurrency,
    queueTimeoutSec: limits.queueTimeoutSec,
    isActive: limits.isActive,
  };
}

function ModalityEditor({
  title,
  icon: Icon = ImageIcon,
  draft,
  onChange,
  onSave,
  saving,
  children,
}: {
  title: string;
  icon?: typeof ImageIcon;
  draft: DraftLimits;
  onChange: (patch: Partial<DraftLimits>) => void;
  onSave: () => void;
  saving: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="w-full rounded-xl border border-slate-200 bg-slate-50/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
            <Icon className="h-3.5 w-3.5 text-slate-600" />
          </span>
          {title}
        </p>
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
        >
          保存渠道
        </button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-200/80 bg-white p-3 sm:grid-cols-4">
        <Field label="单项目">
          <NumberInput
            value={draft.projectConcurrency}
            min={1}
            max={50}
            onChange={(value) => onChange({ projectConcurrency: value })}
          />
        </Field>
        <Field label="全局">
          <NumberInput
            value={draft.globalConcurrency}
            min={1}
            max={200}
            onChange={(value) => onChange({ globalConcurrency: value })}
          />
        </Field>
        <Field label="超时(秒)">
          <NumberInput
            value={draft.queueTimeoutSec}
            min={5}
            max={3600}
            wide
            onChange={(value) => onChange({ queueTimeoutSec: value })}
          />
        </Field>
        <Field label="启用">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(event) => onChange({ isActive: event.target.checked })}
            className="mt-1.5 h-4 w-4 rounded border-slate-300"
          />
        </Field>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-[11px] text-slate-500">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
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
      className={`${wide ? 'w-24' : 'w-20'} rounded-lg border border-slate-200 bg-white px-2 py-1.5`}
    />
  );
}
