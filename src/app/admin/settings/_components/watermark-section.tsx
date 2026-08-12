'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Droplets, ImageIcon, Loader2, Sparkles, Upload } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { ScenarioField } from './scenario-field';

// ─────────────────────────────────────────────────────────────────────────────
// MV 成片水印（免费档导出叠加）
// ─────────────────────────────────────────────────────────────────────────────

interface MvWatermarkConfig {
  enabled: boolean;
  imageUrl: string;
  opacity: number;
  scale: number;
  marginX: number;
  marginY: number;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

interface MvWatermarkResp {
  config: MvWatermarkConfig;
  fromDb: boolean;
}

export function WatermarkSection() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<MvWatermarkConfig | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery<MvWatermarkResp>({
    queryKey: ['admin', 'settings', 'mv-watermark'],
    queryFn: () =>
      apiClient.get('/admin/settings/mv/watermark-config') as Promise<MvWatermarkResp>,
  });
  useEffect(() => {
    if (data?.config && draft === null) {
      setDraft(data.config);
    }
  }, [data, draft]);

  const save = useMutation({
    mutationFn: (cfg: MvWatermarkConfig) =>
      apiClient.patch('/admin/settings/mv/watermark-config', cfg) as any,
    onSuccess: (resp: any) => {
      setMsg({ ok: true, text: '水印配置已保存。需水印档位下次合成成片时将自动叠加。' });
      qc.invalidateQueries({ queryKey: ['admin', 'settings', 'mv-watermark'] });
      if (resp?.config) setDraft(resp.config);
    },
    onError: (e: any) => setMsg({ ok: false, text: e?.response?.data?.message ?? '保存失败' }),
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const resp = (await apiClient.post('/admin/settings/mv/watermark-config/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })) as unknown as { config: MvWatermarkConfig; url: string };
      setDraft(resp.config);
      setMsg({ ok: true, text: '水印图片已上传并启用。' });
      qc.invalidateQueries({ queryKey: ['admin', 'settings', 'mv-watermark'] });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.response?.data?.message ?? '上传失败' });
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || !draft) {
    return (
      <section>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          成片水印
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
        成片水印
      </h2>
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Droplets className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">FFmpeg 图片水印</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              MV / 舞蹈 / Karaoke 成片共用此水印图。会员权益中标记「需水印」的档位（默认免费版）合成时会叠加。
              推荐上传 PNG 透明底 Logo。各产品「免水印」档位不受影响。
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
          <div>
            <p className="text-xs font-medium text-slate-700">启用水印</p>
            <p className="text-[11px] text-slate-400 mt-0.5">关闭后即使免费用户也不叠加</p>
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

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="w-36 h-36 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
            {draft.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.imageUrl} alt="水印预览" className="max-w-full max-h-full object-contain" />
            ) : (
              <div className="text-center text-slate-400 p-3">
                <ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-50" />
                <p className="text-[11px]">尚未上传</p>
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700 transition-colors">
              <Upload className={cn('h-3.5 w-3.5', uploading && 'animate-spin')} />
              {uploading ? '上传中…' : '上传水印图片'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                  e.target.value = '';
                }}
              />
            </label>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              PNG / WebP 透明底最佳，最大 5MB。上传后自动写入 imageUrl 并开启 enabled。
            </p>
            {draft.imageUrl && (
              <p className="text-[10px] text-slate-400 font-mono break-all">{draft.imageUrl}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">位置</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { v: 'bottom-right', label: '右下' },
                { v: 'bottom-left', label: '左下' },
                { v: 'top-right', label: '右上' },
                { v: 'top-left', label: '左上' },
              ] as const
            ).map((p) => (
              <button
                key={p.v}
                type="button"
                onClick={() => setDraft({ ...draft, position: p.v })}
                className={cn(
                  'rounded-lg border px-2 py-1.5 text-xs transition',
                  draft.position === p.v
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-medium text-slate-600">不透明度</label>
              <span className="text-[11px] text-slate-500 font-mono">{Math.round(draft.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={draft.opacity}
              onChange={(e) => setDraft({ ...draft, opacity: parseFloat(e.target.value) })}
              className="w-full accent-blue-600"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-medium text-slate-600">相对宽度</label>
              <span className="text-[11px] text-slate-500 font-mono">{Math.round(draft.scale * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.05}
              max={0.5}
              step={0.01}
              value={draft.scale}
              onChange={(e) => setDraft({ ...draft, scale: parseFloat(e.target.value) })}
              className="w-full accent-blue-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ScenarioField
            label="水平边距 (px)"
            placeholder="24"
            value={String(draft.marginX)}
            onChange={(v) => setDraft({ ...draft, marginX: Math.max(0, parseInt(v, 10) || 0) })}
          />
          <ScenarioField
            label="垂直边距 (px)"
            placeholder="24"
            value={String(draft.marginY)}
            onChange={(v) => setDraft({ ...draft, marginY: Math.max(0, parseInt(v, 10) || 0) })}
          />
        </div>

        {msg && (
          <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
            {msg.text}
          </p>
        )}

        <div className="flex justify-end pt-1 gap-2">
          <button
            type="button"
            onClick={() => {
              if (data?.config) setDraft(data.config);
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
