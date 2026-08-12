'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  SlidersHorizontal,
  Subtitles,
  Sparkles,
  Upload,
  Activity,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/dialog-provider';

/**
 * /admin/mv/defaults
 *
 * MV 字幕默认配置（preset / position / 字号 / 推送 / 环境自检）。
 * 成片水印、音频压缩已迁至「系统设置 → 成片资源」；
 * 生成并发统一由「模型并发中心」控制。
 */
export default function AdminMvDefaultsPage() {
  return (
    <div className="admin-page">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-blue-600" />
            MV 默认配置
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            MV 字幕样式系统默认值。新建项目自动套用，已有项目可手动推送。
            成片水印与音频压缩见「系统设置 → 成片资源」；生成并发见「模型并发中心」。
          </p>
        </div>

        <MvSubtitleDefaultSection />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MV 字幕默认配置（系统级）
// ─────────────────────────────────────────────────────────────────────────────

/** 字幕配置类型，与 mv-studio-api SubtitleService.SubtitleConfig 一一对应 */
interface MvSubtitleConfig {
  enabled: boolean;
  preset:
    | 'cinema' | 'pop' | 'karaoke' | 'minimal'
    | 'neon' | 'retro' | 'elegant' | 'handwrite' | 'bold' | 'rounded' | 'ink'
    | 'glitch' | 'highlighter' | 'vapor' | 'comic'
    | 'custom';
  position: 'bottom' | 'top' | 'lower-third' | 'center';
  karaokeMode?: 'off' | 'fill' | 'glow';
  /**
   * 行入场动画（libass 标签实现）。
   * 同步自 mv-studio-api/src/mv/services/subtitle.service.ts 的 EntryAnimation。
   */
  entryAnimation?:
    | 'none' | 'fade' | 'pop' | 'zoom' | 'bounce'
    | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right'
    | 'drop-bounce' | 'swoosh' | 'flip-y'
    | 'glitch' | 'rotate-x' | 'typewriter'
    | 'scatter' | 'gather-top' | 'swarm-side';
  loopEffect?: 'none' | 'pulse' | 'wave' | 'rainbow';
  fontSizePct?: number;
  marginBottomPct?: number;
  voiceColors?: { male?: string; female?: string; duet?: string };
}

interface MvSubtitleDefaultResp {
  config: MvSubtitleConfig;
  fromDb: boolean;
}

interface SubtitleDiagnoseResp {
  ok: boolean;
  ffmpeg: { ok: boolean; version?: string; error?: string };
  libass: { ok: boolean; error?: string };
  fonts: { ok: boolean; cjkFound: number; sample?: string[]; error?: string };
  smokeTest: { ok: boolean; durationMs?: number; error?: string };
  hints: string[];
}

function MvSubtitleDefaultSection() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<MvSubtitleConfig | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [diagnose, setDiagnose] = useState<SubtitleDiagnoseResp | null>(null);
  const [diagnoseLoading, setDiagnoseLoading] = useState(false);

  const { data, isLoading } = useQuery<MvSubtitleDefaultResp>({
    queryKey: ['admin', 'settings', 'mv-subtitle-default'],
    queryFn: () =>
      apiClient.get('/admin/settings/mv/subtitle-default') as Promise<MvSubtitleDefaultResp>,
  });
  useEffect(() => {
    if (data?.config && draft === null) {
      setDraft(data.config);
    }
  }, [data, draft]);

  const save = useMutation({
    mutationFn: (cfg: MvSubtitleConfig) =>
      apiClient.patch('/admin/settings/mv/subtitle-default', { config: cfg }) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: '系统默认字幕配置已保存。新建项目会自动使用，已有项目需手动「推送」。' });
      qc.invalidateQueries({ queryKey: ['admin', 'settings', 'mv-subtitle-default'] });
    },
    onError: (e: any) => setMsg({ ok: false, text: e?.response?.data?.message ?? '保存失败' }),
  });

  const push = useMutation({
    mutationFn: (overrideExisting: boolean) =>
      apiClient.post('/admin/settings/mv/subtitle-default/push', { overrideExisting }) as any,
    onSuccess: (resp: any) => {
      const cnt = resp?.updatedCount ?? 0;
      const mode = resp?.overrideMode ? '强制覆盖' : '仅未设置';
      setMsg({ ok: true, text: `推送完成：${mode}模式，共更新 ${cnt} 个项目。` });
    },
    onError: (e: any) => setMsg({ ok: false, text: e?.response?.data?.message ?? '推送失败' }),
  });

  const runDiagnose = async () => {
    setDiagnoseLoading(true);
    setMsg(null);
    try {
      const resp = (await apiClient.get('/admin/settings/mv/subtitle-default/diagnose')) as unknown as SubtitleDiagnoseResp;
      setDiagnose(resp);
    } catch (e: any) {
      setMsg({ ok: false, text: e?.response?.data?.message ?? '自检接口调用失败' });
    } finally {
      setDiagnoseLoading(false);
    }
  };

  if (isLoading || !draft) {
    return (
      <section>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          MV 字幕默认配置
        </h2>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-center text-slate-400 text-sm h-32">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          加载中…
        </div>
      </section>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(data?.config);

  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        MV 字幕默认配置
      </h2>
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Subtitles className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">系统默认字幕配置</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              新建 MV 项目时若 LRC 非空，会自动套用这套字幕配置。修改后点「推送」可应用到所有未设过字幕的老项目。
              当前 {data?.fromDb ? '已自定义' : '使用代码默认（cinema · lower-third）'}。
            </p>
          </div>
        </div>

        {/* 启用开关 */}
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
          <div>
            <p className="text-xs font-medium text-slate-700">默认启用字幕</p>
            <p className="text-[11px] text-slate-400 mt-0.5">关闭后新项目默认不烧录字幕</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            />
            <div className="w-9 h-5 bg-slate-300 peer-checked:bg-blue-600 rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
          </label>
        </div>

        {/* 预设选择 */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">样式预设</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {(
              [
                { v: 'cinema', label: '影视', desc: '纯白带描边' },
                { v: 'pop', label: '流行', desc: '加粗 + 蓝高亮' },
                { v: 'karaoke', label: 'KTV', desc: '黄色逐字' },
                { v: 'minimal', label: '极简', desc: '半透轻盈' },
                { v: 'neon', label: '霓虹', desc: '青绿+紫红' },
                { v: 'retro', label: '复古', desc: '米黄+衬线' },
                { v: 'elegant', label: '优雅', desc: '金边+衬线' },
                { v: 'handwrite', label: '中国风', desc: '楷体+朱红' },
                { v: 'bold', label: '重金', desc: '金字+超粗' },
                { v: 'rounded', label: '圆萌', desc: '圆体+粉色' },
                { v: 'ink', label: '水墨', desc: '行书+印章红' },
                { v: 'glitch', label: '故障', desc: '橙黄+红错位' },
                { v: 'highlighter', label: '荧光笔', desc: '粉粗描边' },
                { v: 'vapor', label: '蒸汽波', desc: '紫描边+紫拖影' },
                { v: 'comic', label: '漫画', desc: '黑粗边+白外光' },
              ] as const
            ).map((p) => {
              const active = draft.preset === p.v;
              return (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => setDraft({ ...draft, preset: p.v })}
                  className={cn(
                    'rounded-xl border p-2 text-left transition',
                    active
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-300'
                      : 'border-slate-200 hover:border-slate-300 bg-white',
                  )}
                >
                  <div className="text-xs font-semibold text-slate-800">{p.label}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{p.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 位置选择 */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">位置</label>
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                { v: 'lower-third', label: '下三分之一' },
                { v: 'bottom', label: '底部' },
                { v: 'top', label: '顶部' },
                { v: 'center', label: '居中' },
              ] as const
            ).map((p) => {
              const active = draft.position === p.v;
              return (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => setDraft({ ...draft, position: p.v })}
                  className={cn(
                    'rounded-lg border px-2 py-1.5 text-xs transition',
                    active
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 字号 slider */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-medium text-slate-600">默认字号</label>
            <span className="text-[11px] text-slate-500 font-mono tabular-nums">
              {(draft.fontSizePct ?? 5.2).toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min={2.5}
            max={10}
            step={0.1}
            value={draft.fontSizePct ?? 5.2}
            onChange={(e) =>
              setDraft({ ...draft, fontSizePct: parseFloat(parseFloat(e.target.value).toFixed(1)) })
            }
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-[10px] text-slate-300 mt-0.5">
            <span>2.5</span>
            <span>5</span>
            <span>8</span>
            <span>10</span>
          </div>
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

        {/* 操作按钮组 */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => save.mutate(draft)}
            disabled={!dirty || save.isPending}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium transition-colors"
          >
            <Sparkles className={cn('h-3.5 w-3.5', save.isPending && 'animate-spin')} />
            {save.isPending ? '保存中…' : dirty ? '保存默认配置' : '已保存'}
          </button>
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: '推送默认配置到未设置项目？',
                description: '仅推送给 subtitle_config=null 的项目，不影响用户已主动调过字幕的项目。',
                variant: 'default',
                confirmText: '推送',
              });
              if (ok) push.mutate(false);
            }}
            disabled={push.isPending || dirty}
            title={dirty ? '请先保存当前修改' : '推送给 subtitle_config=null 的项目'}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-slate-700 transition-colors"
          >
            <Upload className={cn('h-3.5 w-3.5', push.isPending && 'animate-spin')} />
            {push.isPending ? '推送中…' : '推送到未设置项目'}
          </button>
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: '强制覆盖所有项目的字幕配置？',
                description: '此操作会清空所有项目的用户自定义字幕配置，无法撤销。',
                variant: 'danger',
                confirmText: '我已确认，强制覆盖',
              });
              if (ok) push.mutate(true);
            }}
            disabled={push.isPending || dirty}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 bg-white hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-red-600 transition-colors"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            强制覆盖全部
          </button>
          <button
            type="button"
            onClick={runDiagnose}
            disabled={diagnoseLoading}
            className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-medium text-slate-700 transition-colors"
          >
            <Activity className={cn('h-3.5 w-3.5', diagnoseLoading && 'animate-spin')} />
            环境自检
          </button>
        </div>

        {/* 自检结果 */}
        {diagnose && (
          <div
            className={cn(
              'rounded-xl border p-3 space-y-2 text-xs',
              diagnose.ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50',
            )}
          >
            <div className={cn('font-medium flex items-center gap-2', diagnose.ok ? 'text-emerald-700' : 'text-amber-700')}>
              {diagnose.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {diagnose.ok ? '字幕烧录环境完全可用' : '字幕烧录环境存在问题'}
            </div>
            <ul className="space-y-1 text-slate-700 ml-1">
              <li>
                ffmpeg：{diagnose.ffmpeg.ok ? `✓ ${diagnose.ffmpeg.version ?? 'OK'}` : `✗ ${diagnose.ffmpeg.error ?? 'fail'}`}
              </li>
              <li>libass：{diagnose.libass.ok ? '✓ subtitles filter 可用' : `✗ ${diagnose.libass.error ?? 'fail'}`}</li>
              <li>
                中文字体：{diagnose.fonts.ok ? `✓ ${diagnose.fonts.cjkFound} 个 CJK 字体` : `⚠ ${diagnose.fonts.error ?? 'fc-list 未检测'}`}
                {diagnose.fonts.sample && diagnose.fonts.sample.length > 0 && (
                  <span className="text-slate-400 ml-1">（含 {diagnose.fonts.sample.slice(0, 3).join('、')}…）</span>
                )}
              </li>
              <li>
                端到端冒烟：
                {diagnose.smokeTest.ok
                  ? `✓ 通过（${diagnose.smokeTest.durationMs ?? '?'} ms）`
                  : `✗ ${diagnose.smokeTest.error?.slice(0, 200) ?? 'fail'}`}
              </li>
            </ul>
            {diagnose.hints.length > 0 && (
              <div className="text-[11px] text-slate-600 border-t border-current/10 pt-2">
                <p className="font-medium mb-1">修复建议：</p>
                <ul className="list-disc list-inside space-y-0.5 leading-relaxed">
                  {diagnose.hints.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
