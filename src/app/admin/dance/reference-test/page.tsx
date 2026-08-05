'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, FlaskConical, Loader2, Play, Search } from 'lucide-react';
import apiClient from '@/lib/api';

type Variant = 'storyboard_start_frame' | 'identity_storyboard_multi_ref';

interface TestCase {
  projectId: string;
  clipIndex: number;
  clipId: string;
  duration: string;
  aspectRatio: string;
  resolution: string;
  originalCharacterImageUrl: string;
  storyboardImageUrl: string;
  productionVideoUrl: string | null;
  productionProvider: string | null;
  productionModel: string | null;
  productionProviderRequestId: string | null;
  prompt: string;
  variants: Array<{
    value: Variant;
    title: string;
    capability: string;
    referenceImageUrls: string[];
    description: string;
    prompt: string;
    promptLength: number;
    promptLimit: number;
    parameterMode?: string;
  }>;
}

interface TestResult {
  variant: Variant;
  videoUrl: string;
  usedProvider: string;
  usedModel: string;
  providerRequestId: string | null;
  fellBack: boolean;
  totalElapsedMs: number;
  referenceImageUrls: string[];
}

const DEFAULT_PROJECT_ID = '3be8687f-8299-4115-aa59-ad0e9fdd294a';

export default function DanceReferenceTestPage() {
  const [projectInput, setProjectInput] = useState(DEFAULT_PROJECT_ID);
  const [clipInput, setClipInput] = useState('0');
  const [query, setQuery] = useState({ projectId: DEFAULT_PROJECT_ID, clipIndex: 0 });
  const [results, setResults] = useState<Partial<Record<Variant, TestResult>>>({});

  const testCase = useQuery<TestCase>({
    queryKey: ['dance-reference-test', query],
    queryFn: () =>
      apiClient.get(
        `/admin/dance/projects/${query.projectId}/reference-test?clipIndex=${query.clipIndex}`,
      ) as any,
    retry: false,
  });

  const run = useMutation<TestResult, unknown, Variant>({
    mutationFn: (variant) =>
      apiClient.post(`/admin/dance/projects/${query.projectId}/reference-test`, {
        clipIndex: query.clipIndex,
        variant,
      }) as any,
    onSuccess: (result) => {
      setResults((current) => ({ ...current, [result.variant]: result }));
    },
  });

  const load = () => {
    setResults({});
    setQuery({
      projectId: projectInput.trim(),
      clipIndex: Math.max(0, Number.parseInt(clipInput, 10) || 0),
    });
  };

  return (
    <div className="h-full min-h-0 space-y-6 overflow-y-auto p-6">
      <header>
        <div className="flex items-center gap-2 text-blue-600">
          <FlaskConical className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em]">Isolated experiment</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-800">Dance 单镜头参考图对照</h1>
        <p className="mt-1 text-sm text-slate-500">
          不改项目、不替换成片、不扣用户积分；每次点击仍会产生一次上游模型成本。
        </p>
      </header>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_140px_auto]">
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-500">项目 ID</span>
          <input
            value={projectInput}
            onChange={(event) => setProjectInput(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm outline-none focus:border-blue-400"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-500">Clip 序号（从 0 开始）</span>
          <input
            value={clipInput}
            onChange={(event) => setClipInput(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
          />
        </label>
        <button
          type="button"
          onClick={load}
          className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white"
        >
          <Search className="h-4 w-4" />
          读取镜头
        </button>
      </section>

      {testCase.isLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在读取项目数据…
        </div>
      )}
      {testCase.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          无法读取项目，请确认项目 ID、Clip 序号和管理员权限。
        </div>
      )}

      {testCase.data && (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            <ReferenceCard title="人物原图" imageUrl={testCase.data.originalCharacterImageUrl} />
            <ReferenceCard title="Storyboard" imageUrl={testCase.data.storyboardImageUrl} />
            <VideoCard
              title="当前正式片段"
              videoUrl={testCase.data.productionVideoUrl}
              meta={`${testCase.data.productionProvider ?? '-'} · ${testCase.data.productionModel ?? '-'}`}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            {testCase.data.variants.map((variant) => {
              const result = results[variant.value];
              const isRunning = run.isPending && run.variables === variant.value;
              const error =
                run.isError && run.variables === variant.value
                  ? getExperimentError(run.error)
                  : null;
              return (
                <article key={variant.value} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 p-5">
                    <h2 className="font-semibold text-slate-800">{variant.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{variant.description}</p>
                    <p className="mt-2 font-mono text-xs text-slate-400">
                      {variant.capability} · {testCase.data.duration} · {testCase.data.aspectRatio} · Prompt {variant.promptLength}/
                      {variant.promptLimit ?? (variant.value === 'identity_storyboard_multi_ref' ? 1990 : 4000)}
                    </p>
                    {variant.parameterMode && (
                      <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        {variant.parameterMode}
                      </p>
                    )}
                  </div>
                  <div className="p-5">
                    {result ? (
                      <video src={result.videoUrl} controls className="aspect-video w-full rounded-xl bg-black object-contain" />
                    ) : (
                      <div className="flex aspect-video items-center justify-center rounded-xl bg-slate-950 text-sm text-white/45">
                        尚未运行
                      </div>
                    )}
                    {result && (
                      <div className="mt-3 space-y-1 text-xs text-slate-500">
                        <p>{result.usedProvider} · {result.usedModel}</p>
                        <p className="font-mono">{result.providerRequestId ?? '无 task id'}</p>
                        <p>{(result.totalElapsedMs / 1000).toFixed(1)} 秒{result.fellBack ? ' · 使用了 fallback' : ''}</p>
                      </div>
                    )}
                    {error && (
                      <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-semibold">{error.title}</p>
                          <p className="text-amber-700">{error.description}</p>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={run.isPending}
                      onClick={() => run.mutate(variant.value)}
                      className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      {isRunning ? '生成中…' : '生成这个对照片段'}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>

          <details className="rounded-2xl border border-slate-200 bg-white p-5">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">查看两组共用的原始镜头参数</summary>
            <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-200">
              {testCase.data.prompt}
            </pre>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              两组动作、镜头和场景参数相同；参考图角色说明会按单图或双图方案分别生成，并控制在模型的 4000 字符限制内。
            </p>
          </details>
        </>
      )}
    </div>
  );
}

function getExperimentError(error: unknown) {
  const payload = error as {
    message?: string;
    error?: string;
    data?: { message?: string };
  };
  const message = String(
    payload?.message ?? payload?.data?.message ?? payload?.error ?? '对照片段生成失败',
  );
  const normalized = message.toLowerCase();

  if (
    normalized.includes('451') ||
    normalized.includes('reference images appear to be unsafe') ||
    normalized.includes('content_safety')
  ) {
    return {
      title: '当前模型拒绝了这张参考图',
      description:
        '图片已成功传入视频模型，但触发了上游内容安全审核。系统会按 AI Router 的顺序尝试备用模型；若仍显示此提示，说明所有已配置候选都未通过。',
    };
  }

  return {
    title: '对照片段生成失败',
    description: message,
  };
}

function ReferenceCard({ title, imageUrl }: { title: string; imageUrl: string }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={title} className="aspect-video w-full bg-slate-100 object-contain" />
      <p className="p-3 text-sm font-medium text-slate-700">{title}</p>
    </article>
  );
}

function VideoCard({ title, videoUrl, meta }: { title: string; videoUrl: string | null; meta: string }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {videoUrl ? (
        <video src={videoUrl} controls className="aspect-video w-full bg-black object-contain" />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-slate-950 text-sm text-white/45">没有视频</div>
      )}
      <div className="p-3">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <p className="mt-1 truncate font-mono text-[10px] text-slate-400">{meta}</p>
      </div>
    </article>
  );
}
