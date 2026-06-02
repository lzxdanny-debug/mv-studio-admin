'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Cloud,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Loader2,
  RefreshCw,
  ScrollText,
  Database,
  ServerCog,
  Sparkles,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { useConfirm } from '@/components/ui/dialog-provider';

// ──────────────────────────────────────────────────────────────────────
// 类型 —— 与后端 CredentialView / 字段定义一一对应
// ──────────────────────────────────────────────────────────────────────

type AiProvider = 'cloudflare' | 'fal' | 'mountsea';

interface CredentialView {
  provider: AiProvider;
  configured: boolean;
  source: 'db' | 'env' | 'none';
  isActive: boolean;
  baseUrl: string | null;
  metadata: Record<string, unknown>;
  secretsMasked: Record<string, string>;
  secretsRevealed?: Record<string, string>;
  lastHealthCheck: string | null;
  lastHealthStatus: string | null;
  lastErrorMessage: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

interface TestResult {
  success: boolean;
  summary: string;
  errorMessage?: string;
  elapsedMs: number;
}

interface AuditLog {
  id: string;
  credentialId: string | null;
  provider: string;
  action: string;
  changedFields: string[] | null;
  testResult: string | null;
  testErrorMessage: string | null;
  operatorId: string;
  operatorName: string | null;
  operatorIp: string | null;
  createdAt: string;
}

// ──────────────────────────────────────────────────────────────────────
// Provider 元信息 —— 哪些字段必填、提示文案、官方链接
// ──────────────────────────────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  /** 是 secret 还是普通字段（决定是否 mask） */
  secret: boolean;
  hint?: string;
}

interface ProviderMeta {
  provider: AiProvider;
  title: string;
  icon: typeof Cloud;
  /** 静态 tailwind class（避免 JIT 漏扫） */
  iconWrap: string;
  iconColor: string;
  desc: string;
  consoleUrl?: string;
  secretFields: FieldDef[];
  hasBaseUrl: boolean;
  baseUrlPlaceholder?: string;
}

const PROVIDER_META: Record<AiProvider, ProviderMeta> = {
  cloudflare: {
    provider: 'cloudflare',
    title: 'Cloudflare Workers AI',
    icon: Cloud,
    iconWrap: 'bg-orange-50',
    iconColor: 'text-orange-600',
    desc:
      'gpt-5.5 / gemini-3.1-pro / nano-banana-pro / veo-3.1-fast / seedance —— 最新代际模型，性价比高。',
    consoleUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    secretFields: [
      {
        key: 'accountId',
        label: 'Account ID',
        placeholder: '32 位 hex 字符串',
        secret: false,
        hint: 'dash.cloudflare.com 右下角',
      },
      {
        key: 'apiToken',
        label: 'API Token',
        placeholder: 'cfut_xxxxxxxxxxxxxxxx',
        secret: true,
        hint: 'My Profile → API Tokens',
      },
    ],
    hasBaseUrl: true,
    baseUrlPlaceholder: 'https://api.cloudflare.com/client/v4 (默认)',
  },
  fal: {
    provider: 'fal',
    title: 'Fal.ai',
    icon: Sparkles,
    iconWrap: 'bg-pink-50',
    iconColor: 'text-pink-600',
    desc:
      'nano-banana / veo3 / seedance / kling / wan —— 视频生成强项，多模型聚合。文本走 any-llm 代理。',
    consoleUrl: 'https://fal.ai/dashboard/keys',
    secretFields: [
      {
        key: 'apiKey',
        label: 'API Key',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:xxxxx',
        secret: true,
        hint: 'fal.ai Dashboard → API Keys',
      },
    ],
    hasBaseUrl: false,
  },
  mountsea: {
    provider: 'mountsea',
    title: 'Mountsea',
    icon: ServerCog,
    iconWrap: 'bg-purple-50',
    iconColor: 'text-purple-600',
    desc: '现网主力。Gemini Audio（LRC 转写 / 音乐分析）锁死该 provider。',
    consoleUrl: 'https://api.mountsea.ai',
    secretFields: [
      {
        key: 'apiKey',
        label: 'API Key',
        placeholder: 'sk-xxxxxxxxxxxxxxxxxxxx',
        secret: true,
      },
    ],
    hasBaseUrl: true,
    baseUrlPlaceholder: 'https://api.mountsea.ai (默认)',
  },
};

// ──────────────────────────────────────────────────────────────────────
// 主页面
// ──────────────────────────────────────────────────────────────────────

export default function AiProvidersPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery<CredentialView[]>({
    queryKey: ['admin', 'ai-providers'],
    queryFn: () => apiClient.get('/admin/ai-providers') as Promise<CredentialView[]>,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'ai-providers'] });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4 max-w-5xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Cloud className="h-5 w-5 text-purple-600" />
              AI Provider 凭证
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              管理 Cloudflare / Fal / Mountsea 三家 AI Provider 的 API 凭证。
              凭证 AES-256-GCM 加密存储，DB 缺失时自动回落到 env 变量作为兜底。
            </p>
          </div>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </button>
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={false}
          height="h-64"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(['cloudflare', 'fal', 'mountsea'] as const).map((p) => {
              const view = data?.find((c) => c.provider === p);
              return view ? (
                <ProviderCard key={p} view={view} />
              ) : (
                <div
                  key={p}
                  className="bg-white border border-slate-200 rounded-2xl p-5 text-sm text-slate-400"
                >
                  {p} 加载失败
                </div>
              );
            })}
          </div>

          <AuditLogsSection />
        </QueryState>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 单 Provider 卡片
// ──────────────────────────────────────────────────────────────────────

function ProviderCard({ view }: { view: CredentialView }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const meta = PROVIDER_META[view.provider];
  const Icon = meta.icon;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [baseUrl, setBaseUrl] = useState('');
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string> | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // 进入编辑模式时把当前 baseUrl 带入，secrets 全部留空（表示"不改"）
  const enterEdit = () => {
    setForm(Object.fromEntries(meta.secretFields.map((f) => [f.key, ''])));
    setBaseUrl(view.baseUrl ?? '');
    setEditing(true);
    setMsg(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm({});
    setMsg(null);
  };

  const save = useMutation({
    mutationFn: async () => {
      // 编辑场景：留空的字段 = 不修改，必须把"已存在但未改"的字段从原值拿回
      // 后端约定：upsert 用整体替换语义，所以这里要把所有字段都填全
      // 实现策略：编辑时如果某 secret 字段为空但原本有值，先 reveal 拿到原值再合并
      const finalSecrets: Record<string, string> = {};
      const fieldsToReveal: string[] = [];
      for (const f of meta.secretFields) {
        if (form[f.key]?.trim()) {
          finalSecrets[f.key] = form[f.key].trim();
        } else if (view.secretsMasked[f.key]) {
          // 用户留空但原值存在 → 需要 reveal
          fieldsToReveal.push(f.key);
        }
      }
      if (fieldsToReveal.length > 0) {
        const revealed = (await apiClient.get(
          `/admin/ai-providers/${view.provider}/reveal`,
        )) as CredentialView;
        for (const k of fieldsToReveal) {
          if (revealed.secretsRevealed?.[k]) {
            finalSecrets[k] = revealed.secretsRevealed[k];
          }
        }
      }
      return apiClient.put(`/admin/ai-providers/${view.provider}`, {
        secrets: finalSecrets,
        baseUrl: meta.hasBaseUrl ? baseUrl || null : undefined,
      }) as Promise<CredentialView>;
    },
    onSuccess: () => {
      setMsg({ ok: true, text: '凭证已保存。下次 AI 调用立即生效。' });
      setEditing(false);
      setForm({});
      setRevealedSecrets(null);
      setShowSecret({});
      qc.invalidateQueries({ queryKey: ['admin', 'ai-providers'] });
      qc.invalidateQueries({ queryKey: ['admin', 'ai-provider-audit-logs'] });
    },
    onError: (e: any) => setMsg({ ok: false, text: e?.message ?? '保存失败' }),
  });

  const testMu = useMutation({
    mutationFn: () =>
      apiClient.post(`/admin/ai-providers/${view.provider}/test`) as Promise<TestResult>,
    onSuccess: (r) => {
      setTestResult(r);
      qc.invalidateQueries({ queryKey: ['admin', 'ai-providers'] });
      qc.invalidateQueries({ queryKey: ['admin', 'ai-provider-audit-logs'] });
    },
    onError: (e: any) =>
      setTestResult({
        success: false,
        summary: '请求失败',
        errorMessage: e?.message ?? '未知错误',
        elapsedMs: 0,
      }),
  });

  const toggleActive = useMutation({
    mutationFn: (isActive: boolean) =>
      apiClient.patch(`/admin/ai-providers/${view.provider}/active`, { isActive }) as Promise<CredentialView>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'ai-providers'] });
      qc.invalidateQueries({ queryKey: ['admin', 'ai-provider-audit-logs'] });
    },
  });

  const revealMu = useMutation({
    mutationFn: () =>
      apiClient.get(`/admin/ai-providers/${view.provider}/reveal`) as Promise<CredentialView>,
    onSuccess: (r) => {
      setRevealedSecrets(r.secretsRevealed ?? null);
      qc.invalidateQueries({ queryKey: ['admin', 'ai-provider-audit-logs'] });
    },
  });

  const health = useMemo(() => {
    if (!view.configured) {
      return { wrap: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' };
    }
    switch (view.lastHealthStatus) {
      case 'healthy':
        return { wrap: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' };
      case 'degraded':
        return { wrap: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' };
      case 'down':
        return { wrap: 'bg-red-50 text-red-700', dot: 'bg-red-500' };
      default:
        return { wrap: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' };
    }
  }, [view]);

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
      {/* 顶部：标题 + 健康状态 + 启用开关 */}
      <div className="flex items-start gap-3">
        <div className={cn('h-9 w-9 rounded-xl flex-shrink-0 flex items-center justify-center', meta.iconWrap)}>
          <Icon className={cn('h-4 w-4', meta.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800">{meta.title}</p>
            <SourceBadge source={view.source} />
            <HealthBadge palette={health} status={view.lastHealthStatus} configured={view.configured} />
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{meta.desc}</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={view.isActive}
            disabled={!view.configured || toggleActive.isPending}
            onChange={(e) => toggleActive.mutate(e.target.checked)}
          />
          <div className="w-9 h-5 bg-slate-300 peer-checked:bg-emerald-500 rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 peer-disabled:opacity-50" />
        </label>
      </div>

      {/* 凭证字段展示/编辑 */}
      <div className="space-y-2">
        {meta.secretFields.map((f) => {
          const masked = view.secretsMasked[f.key];
          const revealed = revealedSecrets?.[f.key];
          const display = showSecret[f.key] && revealed ? revealed : masked || '—';
          if (editing) {
            return (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {f.label}
                  {f.hint && <span className="ml-1.5 text-[10px] text-slate-400 font-normal">· {f.hint}</span>}
                </label>
                <input
                  type={f.secret ? 'password' : 'text'}
                  autoComplete="new-password"
                  placeholder={masked ? `留空则不修改（当前 ${masked}）` : f.placeholder}
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-slate-50 font-mono"
                />
              </div>
            );
          }
          return (
            <div key={f.key} className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 w-24 flex-shrink-0">{f.label}</span>
              <span className="flex-1 text-xs font-mono text-slate-700 truncate">
                {display}
              </span>
              {f.secret && masked && (
                <button
                  type="button"
                  onClick={async () => {
                    if (showSecret[f.key]) {
                      setShowSecret((s) => ({ ...s, [f.key]: false }));
                      return;
                    }
                    if (!revealedSecrets) {
                      await revealMu.mutateAsync();
                    }
                    setShowSecret((s) => ({ ...s, [f.key]: true }));
                  }}
                  disabled={revealMu.isPending}
                  className="p-1 text-slate-400 hover:text-slate-700"
                  title={showSecret[f.key] ? '隐藏明文' : '显示明文（记审计）'}
                >
                  {showSecret[f.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          );
        })}

        {meta.hasBaseUrl && (
          editing ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Base URL</label>
              <input
                type="text"
                placeholder={meta.baseUrlPlaceholder}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-slate-50 font-mono"
              />
            </div>
          ) : view.baseUrl ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 w-24 flex-shrink-0">Base URL</span>
              <span className="flex-1 text-xs font-mono text-slate-700 truncate">{view.baseUrl}</span>
            </div>
          ) : null
        )}
      </div>

      {/* 状态/操作元信息 */}
      {!editing && view.updatedAt && (
        <div className="text-[10px] text-slate-400 leading-relaxed pt-2 border-t border-slate-100">
          上次更新：{view.updatedBy ?? '?'} · {new Date(view.updatedAt).toLocaleString('zh-CN')}
          {view.lastHealthCheck && (
            <>
              <br />
              上次健康检查：{new Date(view.lastHealthCheck).toLocaleString('zh-CN')}
              {view.lastErrorMessage && (
                <> · <span className="text-red-500">{view.lastErrorMessage.slice(0, 80)}</span></>
              )}
            </>
          )}
          {meta.consoleUrl && (
            <>
              <br />
              <a
                href={meta.consoleUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-purple-600 hover:underline"
              >
                获取/查看凭证 ↗
              </a>
            </>
          )}
        </div>
      )}

      {/* 测试结果 */}
      {testResult && (
        <div
          className={cn(
            'rounded-xl px-3 py-2 text-xs border flex items-start gap-2',
            testResult.success
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700',
          )}
        >
          {testResult.success ? (
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium">{testResult.summary}</p>
            {testResult.errorMessage && (
              <p className="text-[11px] mt-0.5 break-all">{testResult.errorMessage}</p>
            )}
          </div>
        </div>
      )}

      {/* 编辑期消息 */}
      {msg && (
        <p className={cn('text-xs font-medium', msg.ok ? 'text-emerald-600' : 'text-red-500')}>
          {msg.text}
        </p>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2 flex-wrap">
        {editing ? (
          <>
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-medium"
            >
              <KeyRound className={cn('h-3.5 w-3.5', save.isPending && 'animate-spin')} />
              {save.isPending ? '保存中…' : '保存凭证'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={save.isPending}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-medium text-slate-700"
            >
              取消
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={enterEdit}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium"
            >
              <KeyRound className="h-3.5 w-3.5" />
              {view.configured ? '编辑凭证' : '配置凭证'}
            </button>
            <button
              type="button"
              onClick={() => testMu.mutate()}
              disabled={!view.configured || testMu.isPending}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-medium text-slate-700"
            >
              <Activity className={cn('h-3.5 w-3.5', testMu.isPending && 'animate-spin')} />
              {testMu.isPending ? '测试中…' : '测试连通性'}
            </button>
            {view.configured && view.source === 'db' && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirm({
                    title: `禁用 ${meta.title} 凭证？`,
                    description:
                      '禁用后，AI 路由器会回落到该 provider 在 env 中的兜底配置（如果有）或跳到下一家。可随时重新启用。',
                    variant: 'danger',
                    confirmText: '禁用',
                  });
                  if (ok) toggleActive.mutate(false);
                }}
                disabled={!view.isActive || toggleActive.isPending}
                className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 bg-white hover:bg-red-50 disabled:opacity-50 text-xs font-medium text-red-600"
              >
                禁用
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function SourceBadge({ source }: { source: 'db' | 'env' | 'none' }) {
  if (source === 'none') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
        <XCircle className="h-3 w-3" />
        未配置
      </span>
    );
  }
  if (source === 'env') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700">
        env
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700">
      <Database className="h-3 w-3" />
      DB
    </span>
  );
}

function HealthBadge({
  palette,
  status,
  configured,
}: {
  palette: { wrap: string; dot: string };
  status: string | null;
  configured: boolean;
}) {
  if (!configured) return null;
  const label =
    status === 'healthy'
      ? 'healthy'
      : status === 'degraded'
        ? 'degraded'
        : status === 'down'
          ? 'down'
          : '未检测';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
        palette.wrap,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', palette.dot)} />
      {label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 审计日志
// ──────────────────────────────────────────────────────────────────────

function AuditLogsSection() {
  const [providerFilter, setProviderFilter] = useState<'' | AiProvider>('');
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<{ rows: AuditLog[]; total: number }>({
    queryKey: ['admin', 'ai-provider-audit-logs', providerFilter],
    queryFn: () => {
      const q = providerFilter ? `?provider=${providerFilter}` : '';
      return apiClient.get(`/admin/ai-providers/audit-logs${q}`) as Promise<{
        rows: AuditLog[];
        total: number;
      }>;
    },
    enabled: open,
  });

  return (
    <section className="bg-white border border-slate-200 rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-2xl"
      >
        <span className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-slate-400" />
          审计日志
          {data && <span className="text-xs text-slate-400 font-normal">（{data.total} 条）</span>}
        </span>
        <span className="text-xs text-slate-400">{open ? '收起' : '展开'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3">
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setProviderFilter('')}
              className={cn(
                'px-2 py-1 rounded-lg border',
                providerFilter === ''
                  ? 'bg-purple-50 border-purple-300 text-purple-700'
                  : 'bg-white border-slate-200 text-slate-600',
              )}
            >
              全部
            </button>
            {(['cloudflare', 'fal', 'mountsea'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setProviderFilter(p)}
                className={cn(
                  'px-2 py-1 rounded-lg border',
                  providerFilter === p
                    ? 'bg-purple-50 border-purple-300 text-purple-700'
                    : 'bg-white border-slate-200 text-slate-600',
                )}
              >
                {p}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              加载中…
            </div>
          ) : !data || data.rows.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">暂无审计记录</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="text-left py-2 pr-3 font-medium">时间</th>
                    <th className="text-left py-2 pr-3 font-medium">Provider</th>
                    <th className="text-left py-2 pr-3 font-medium">操作</th>
                    <th className="text-left py-2 pr-3 font-medium">字段</th>
                    <th className="text-left py-2 pr-3 font-medium">结果</th>
                    <th className="text-left py-2 pr-3 font-medium">操作者</th>
                    <th className="text-left py-2 pr-3 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((log) => (
                    <tr key={log.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{log.provider}</td>
                      <td className="py-2 pr-3">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="py-2 pr-3 text-slate-500 font-mono">
                        {log.changedFields?.join(', ') ?? '—'}
                      </td>
                      <td className="py-2 pr-3">
                        {log.testResult === 'success' && (
                          <span className="text-emerald-600">✓ {log.testErrorMessage ?? ''}</span>
                        )}
                        {log.testResult === 'failure' && (
                          <span className="text-red-500" title={log.testErrorMessage ?? ''}>
                            ✗ {(log.testErrorMessage ?? '').slice(0, 40)}
                          </span>
                        )}
                        {!log.testResult && '—'}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">
                        {log.operatorName ?? log.operatorId.slice(0, 8)}
                      </td>
                      <td className="py-2 pr-3 text-slate-400 font-mono">{log.operatorIp ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ActionBadge({ action }: { action: string }) {
  const palette: Record<string, string> = {
    created: 'bg-emerald-50 text-emerald-700',
    updated: 'bg-blue-50 text-blue-700',
    rotated: 'bg-blue-50 text-blue-700',
    viewed: 'bg-slate-100 text-slate-600',
    tested: 'bg-purple-50 text-purple-700',
    enabled: 'bg-emerald-50 text-emerald-700',
    disabled: 'bg-amber-50 text-amber-700',
  };
  return (
    <span
      className={cn(
        'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium',
        palette[action] ?? 'bg-slate-100 text-slate-600',
      )}
    >
      {action}
    </span>
  );
}
