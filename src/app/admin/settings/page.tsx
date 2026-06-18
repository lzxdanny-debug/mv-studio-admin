'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Settings as SettingsIcon,
  HardDrive,
  CheckCircle2,
  XCircle,
  Download,
  Upload,
  FileJson,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { SecretInput } from '@/components/secret-input';

interface StorageConfig {
  secretIdMasked: string;
  secretIdConfigured: boolean;
  secretIdFromEnv: boolean;
  secretKeyMasked: string;
  secretKeyConfigured: boolean;
  secretKeyFromEnv: boolean;
  bucket: string;
  region: string;
}

interface StorageForm {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
}

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<StorageForm>({
    secretId: '',
    secretKey: '',
    bucket: '',
    region: '',
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<StorageConfig>({
    queryKey: ['admin', 'settings', 'storage'],
    queryFn: async () => {
      const cfg = (await apiClient.get('/admin/settings/storage')) as unknown as StorageConfig;
      // 同步 bucket/region 到表单（secretId/secretKey 留空表示"不修改"）
      setForm((f) => ({ ...f, bucket: cfg.bucket, region: cfg.region }));
      return cfg;
    },
  });

  const save = useMutation({
    mutationFn: (payload: Partial<StorageForm>) =>
      apiClient.patch('/admin/settings/storage', payload) as any,
    onSuccess: () => {
      setMsg({ ok: true, text: '存储配置已保存。' });
      setForm((f) => ({ ...f, secretId: '', secretKey: '' }));
      qc.invalidateQueries({ queryKey: ['admin', 'settings', 'storage'] });
    },
    onError: () => setMsg({ ok: false, text: '保存失败，请检查输入后重试。' }),
  });

  const configured = !!(
    data?.secretIdConfigured &&
    data?.secretKeyConfigured &&
    data?.bucket &&
    data?.region
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const payload: Partial<StorageForm> = { bucket: form.bucket, region: form.region };
    if (form.secretId) payload.secretId = form.secretId;
    if (form.secretKey) payload.secretKey = form.secretKey;
    save.mutate(payload);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-teal-600" />
            系统设置
          </h1>
          <p className="text-sm text-slate-500 mt-1">配置 MV Studio 运行时依赖</p>
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={false}
          height="h-64"
        >
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              对象存储（腾讯云 COS）
            </h2>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <HardDrive className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">腾讯云 COS</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    用于将 AI 生成的视频、图片、音乐归档到永久存储，避免 Mountsea CDN 链接过期。
                  </p>
                  {data && (
                    <div className="flex items-center gap-1.5 mt-2">
                      {configured ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-xs text-emerald-600 font-medium">
                            已配置 · {data.bucket} ({data.region})
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3.5 w-3.5 text-amber-500" />
                          <span className="text-xs text-amber-600 font-medium">
                            未配置完整，AI 生成文件将使用临时链接
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">SecretId</label>
                    <SecretInput
                      configured={data?.secretIdConfigured}
                      maskedPreview={data?.secretIdMasked}
                      value={form.secretId}
                      onChange={(secretId) => setForm((f) => ({ ...f, secretId }))}
                      placeholder="AKIDxxxxxxxxxxxxxxxx"
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">SecretKey</label>
                    <SecretInput
                      configured={data?.secretKeyConfigured}
                      maskedPreview={data?.secretKeyMasked}
                      value={form.secretKey}
                      onChange={(secretKey) => setForm((f) => ({ ...f, secretKey }))}
                      placeholder="32 位字符串"
                      showToggle
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Bucket</label>
                    <input
                      type="text"
                      placeholder="aiconsole-1387810185"
                      value={form.bucket}
                      onChange={(e) => setForm((f) => ({ ...f, bucket: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Region</label>
                    <input
                      type="text"
                      placeholder="ap-hongkong"
                      value={form.region}
                      onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50"
                    />
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

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={save.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                  >
                    <SettingsIcon className={cn('h-3.5 w-3.5', save.isPending && 'animate-spin')} />
                    {save.isPending ? '保存中…' : '保存配置'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </QueryState>

        <ConfigBackupSection />
      </div>
    </div>
  );
}

interface ImportResult {
  settingsWritten: number;
  settingsSkipped: number;
  settingsWrittenKeys: string[];
  credentialsWritten: string[];
}

function ConfigBackupSection() {
  const [content, setContent] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const exportMut = useMutation({
    mutationFn: () =>
      apiClient.get('/admin/settings/config/export') as unknown as Promise<{
        filename: string;
        content: string;
      }>,
    onSuccess: (data) => {
      setMsg(null);
      const blob = new Blob([data.content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || 'mv-studio-config.jsonc';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onError: () => setMsg({ ok: false, text: '导出失败，请重试。' }),
  });

  const importMut = useMutation({
    mutationFn: (text: string) =>
      apiClient.post('/admin/settings/config/import', {
        content: text,
      }) as unknown as Promise<ImportResult>,
    onSuccess: (data) => {
      setResult(data);
      setMsg({
        ok: true,
        text: `导入成功：写入 ${data.settingsWritten} 项设置（跳过 ${data.settingsSkipped} 项空值）${
          data.credentialsWritten.length
            ? `，更新渠道密钥 ${data.credentialsWritten.join('、')}`
            : ''
        }。`,
      });
    },
    onError: (e: any) => {
      setResult(null);
      const detail = e?.message || e?.error || '导入失败，请检查 JSON 格式后重试。';
      setMsg({ ok: false, text: detail });
    },
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContent(text);
    setMsg(null);
    setResult(null);
    e.target.value = '';
  };

  const handleImport = () => {
    setMsg(null);
    setResult(null);
    if (!content.trim()) {
      setMsg({ ok: false, text: '请先粘贴或选择配置文件内容。' });
      return;
    }
    importMut.mutate(content);
  };

  return (
    <section>
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        配置导出 / 导入（JSONC 备份）
      </h2>
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <FileJson className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">配置备份 / 跨环境迁移</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              导出会把计费参数、COS、Stripe、字幕/水印、音频压缩，以及 AI 渠道密钥（明文）打成一份带注释的
              JSONC。导入时普通 key 写入系统设置、<code className="text-slate-500">cred.*</code> 写入渠道密钥；
              <span className="font-medium text-slate-500">值为空字符串的项会被跳过，不覆盖已有配置</span>。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportMut.mutate()}
            disabled={exportMut.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            <Download className={cn('h-3.5 w-3.5', exportMut.isPending && 'animate-bounce')} />
            {exportMut.isPending ? '导出中…' : '导出配置'}
          </button>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            选择文件
            <input type="file" accept=".json,.jsonc,application/json,text/plain" className="hidden" onChange={handleFile} />
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            配置内容（可直接粘贴 / 编辑，支持 // 注释）
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            placeholder='粘贴导出的 JSONC，或点击"选择文件"载入。导入前可手动编辑。'
            className="w-full h-56 px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50 resize-y"
          />
        </div>

        {msg && (
          <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
            {msg.text}
          </p>
        )}

        {result && result.settingsWrittenKeys.length > 0 && (
          <div className="text-xs text-slate-500">
            写入的设置项：
            <span className="font-mono text-slate-600">{result.settingsWrittenKeys.join(', ')}</span>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleImport}
            disabled={importMut.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            <Upload className={cn('h-3.5 w-3.5', importMut.isPending && 'animate-pulse')} />
            {importMut.isPending ? '导入中…' : '导入配置'}
          </button>
        </div>
      </div>
    </section>
  );
}
