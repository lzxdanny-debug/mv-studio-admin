'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Music2, Sparkles } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { ScenarioField } from './scenario-field';

// ─────────────────────────────────────────────────────────────────────────────
// 音频压缩配置（LRC 转写 / 音乐分析两套独立参数）
// ─────────────────────────────────────────────────────────────────────────────

interface AudioCompressionScenario {
  thresholdMb: string;
  bitrate: string;
  sampleRate: string;
  channels: string;
}

interface AudioCompressionEffective {
  thresholdMb: number;
  bitrate: string;
  sampleRate: string;
  channels: string;
}

interface AudioCompressionResp {
  saved: { lrc: AudioCompressionScenario; musicAnalysis: AudioCompressionScenario };
  effective: { lrc: AudioCompressionEffective; musicAnalysis: AudioCompressionEffective };
}

type ScenarioKey = 'lrc' | 'musicAnalysis';

const SCENARIO_META: Record<
  ScenarioKey,
  { title: string; desc: string; defaultHint: string }
> = {
  lrc: {
    title: 'LRC 歌词转写',
    desc:
      '把整曲音频喂给 Gemini 做语音识别。可以激进压缩 —— 64k mono 16kHz 对识别精度影响 < 2%，但能让 10MB+ 的歌大幅瘦身、避开 Mountsea overload。',
    defaultHint: '默认：5MB / 64k / 16000Hz / mono',
  },
  musicAnalysis: {
    title: '音乐深度分析',
    desc:
      'analyzeMusicFile 调用，模型要听 BPM、副歌段落、能量曲线，得保留立体声细节。压缩参数偏保守 —— 仅在 10MB+ 才触发，且保留立体声。',
    defaultHint: '默认：8MB / 128k / 44100Hz / stereo',
  },
};

export function AudioCompressionSection() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<AudioCompressionResp['saved'] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading } = useQuery<AudioCompressionResp>({
    queryKey: ['admin', 'settings', 'audio-compression'],
    queryFn: () =>
      apiClient.get('/admin/settings/audio-compression') as Promise<AudioCompressionResp>,
  });
  useEffect(() => {
    if (data?.saved && draft === null) {
      setDraft(data.saved);
    }
  }, [data, draft]);

  const save = useMutation({
    mutationFn: (payload: AudioCompressionResp['saved']) =>
      apiClient.patch('/admin/settings/audio-compression', payload) as any,
    onSuccess: (resp: any) => {
      setMsg({ ok: true, text: '音频压缩配置已保存，下一次任务即生效。' });
      // 后端返回最新 saved + effective，直接覆盖缓存避免再发一次 GET
      qc.setQueryData(['admin', 'settings', 'audio-compression'], resp);
      if (resp?.saved) setDraft(resp.saved);
    },
    onError: (e: any) =>
      setMsg({ ok: false, text: e?.response?.data?.message ?? '保存失败，请检查输入' }),
  });

  if (isLoading || !draft || !data) {
    return (
      <section>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          音频压缩配置
        </h2>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-center text-slate-400 text-sm h-32">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          加载中…
        </div>
      </section>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.saved);

  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        音频压缩配置
      </h2>
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Music2 className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">FFmpeg 重压缩参数</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              平台共用：喂 Gemini 之前对原始音频按需重压（LRC 转写 / 音乐深度分析）。
              每个字段留空表示走 <code className="px-1 rounded bg-slate-100">.env</code> 或硬编码默认。
              参数仅在原文件超过阈值时才触发，常规小文件直接透传。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {(['lrc', 'musicAnalysis'] as const).map((key) => {
            const meta = SCENARIO_META[key];
            const draftValue = draft[key];
            const effective = data.effective[key];
            return (
              <div key={key} className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/40">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">{meta.title}</p>
                    <span className="text-[11px] text-slate-400">{meta.defaultHint}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{meta.desc}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <ScenarioField
                    label="阈值 (MB)"
                    placeholder={`${effective.thresholdMb.toFixed(0)}`}
                    value={draftValue.thresholdMb}
                    onChange={(v) =>
                      setDraft({ ...draft, [key]: { ...draftValue, thresholdMb: v } })
                    }
                    hint="≤ 此大小不压缩"
                  />
                  <ScenarioField
                    label="比特率"
                    placeholder={effective.bitrate}
                    value={draftValue.bitrate}
                    onChange={(v) =>
                      setDraft({ ...draft, [key]: { ...draftValue, bitrate: v } })
                    }
                    hint='形如 "64k"'
                  />
                  <ScenarioField
                    label="采样率 (Hz)"
                    placeholder={effective.sampleRate}
                    value={draftValue.sampleRate}
                    onChange={(v) =>
                      setDraft({ ...draft, [key]: { ...draftValue, sampleRate: v } })
                    }
                    hint="16000 / 44100"
                  />
                  <ScenarioField
                    label="声道"
                    placeholder={effective.channels}
                    value={draftValue.channels}
                    onChange={(v) =>
                      setDraft({ ...draft, [key]: { ...draftValue, channels: v } })
                    }
                    hint='1=mono / 2=stereo'
                  />
                </div>

                <p className="text-[11px] text-slate-500">
                  当前生效：<span className="font-mono tabular-nums">
                    阈值 {effective.thresholdMb.toFixed(1)}MB · {effective.bitrate} · {effective.sampleRate}Hz · {effective.channels === '1' ? 'mono' : effective.channels === '2' ? 'stereo' : `${effective.channels}ch`}
                  </span>
                </p>
              </div>
            );
          })}
        </div>

        {msg && (
          <p
            className={cn(
              'text-xs font-medium',
              msg.ok ? 'text-emerald-600' : 'text-red-500',
            )}
          >
            {msg.text}
          </p>
        )}

        <div className="flex justify-end pt-1 gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(data.saved);
              setMsg(null);
            }}
            disabled={!dirty || save.isPending}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-medium text-slate-600 transition-colors"
          >
            撤销修改
          </button>
          <button
            type="button"
            onClick={() => save.mutate(draft)}
            disabled={!dirty || save.isPending}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium transition-colors"
          >
            <Sparkles className={cn('h-3.5 w-3.5', save.isPending && 'animate-spin')} />
            {save.isPending ? '保存中…' : dirty ? '保存配置' : '已保存'}
          </button>
        </div>
      </div>
    </section>
  );
}
