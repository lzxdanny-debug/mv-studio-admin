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
  Layers,
  Film,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { PaginationBar } from '@/components/pagination-bar';
import { useConfirm } from '@/components/ui/dialog-provider';
import { SecretInput } from '@/components/secret-input';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

const SECRET_INPUT_CLS = cn(
  'rounded-[10px] border-slate-200/90 bg-white',
  'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
  'focus:ring-[3px] focus:ring-blue-500/15 focus:border-blue-400',
);
const CONTROL_WIDE = 'sm:w-[360px] w-[220px]';

// ──────────────────────────────────────────────────────────────────────
// 类型 —— 与后端 CredentialView / 字段定义一一对应
// ──────────────────────────────────────────────────────────────────────

type AiProvider = 'mountsea' | 'apisale' | 'smartfashion' | 'aitokens' | 'minimax';

const ALL_AI_PROVIDERS: AiProvider[] = [
  'mountsea',
  'apisale',
  'smartfashion',
  'aitokens',
  'minimax',
];

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
  mountsea: {
    provider: 'mountsea',
    title: 'Mountsea',
    icon: ServerCog,
    iconWrap: 'bg-blue-50',
    iconColor: 'text-blue-600',
    desc: 'Legacy 渠道：/chat/completions（首页推荐、Agent 对话、LRC/音乐分析等）。保存后立即生效，无需重启。',
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
  apisale: {
    provider: 'apisale',
    title: 'apisale',
    icon: Layers,
    iconWrap: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    desc:
      '媒体主渠道：/v1/run/{slug}（图像 / 视频 / 口型）。USD 钱包计费；Router provider=apisale。Mountsea MS 已停维下线。',
    consoleUrl: 'https://apisale.ai/console',
    secretFields: [
      {
        key: 'apiKey',
        label: 'API Key',
        placeholder: 'sk-xxxxxxxxxxxxxxxxxxxx',
        secret: true,
        hint: '环境变量 APISALE_API_KEY；Authorization: Key …',
      },
    ],
    hasBaseUrl: true,
    baseUrlPlaceholder: 'https://api.apisale.ai (默认)',
  },
  smartfashion: {
    provider: 'smartfashion',
    title: 'smartfashion',
    icon: Cloud,
    iconWrap: 'bg-cyan-50',
    iconColor: 'text-cyan-700',
    desc:
      'New-API Seedance 视频：Bearer + /v1/video/generations。视频用 API Key；对账另需系统访问令牌 + 用户 ID（拉 /api/log/self）。',
    consoleUrl: 'https://seedance.smartfashionai.cn',
    secretFields: [
      {
        key: 'apiKey',
        label: 'API Key（视频）',
        placeholder: 'sk-xxxxxxxxxxxxxxxxxxxx',
        secret: true,
        hint: '令牌管理里的 sk-…；仅用于生成视频',
      },
      {
        key: 'usageToken',
        label: '系统访问令牌（对账）',
        placeholder: '登录后 GET /api/user/token',
        secret: true,
        hint: '≠ API Key；Authorization 原样放入，Header 另带 New-Api-User',
      },
      {
        key: 'userId',
        label: '用户 ID（New-Api-User）',
        placeholder: '例如 126638',
        secret: false,
        hint: '控制台个人资料里的数字用户 ID',
      },
    ],
    hasBaseUrl: true,
    baseUrlPlaceholder: 'https://seedance.smartfashionai.cn (默认)',
  },
  aitokens: {
    provider: 'aitokens',
    title: 'aitokens',
    icon: Cloud,
    iconWrap: 'bg-teal-50',
    iconColor: 'text-teal-700',
    desc:
      'New-API Seedance 视频（seedance.ai-tokens.app）：与 smartfashion 协议同构、独立账本。Bearer + /v1/video/generations。',
    consoleUrl: 'https://seedance.ai-tokens.app',
    secretFields: [
      {
        key: 'apiKey',
        label: 'API Key（视频）',
        placeholder: 'sk-xxxxxxxxxxxxxxxxxxxx',
        secret: true,
        hint: '令牌管理里的 sk-…；仅用于生成视频',
      },
      {
        key: 'usageToken',
        label: '系统访问令牌（对账）',
        placeholder: '登录后 GET /api/user/token',
        secret: true,
        hint: '≠ API Key；Authorization 原样放入，Header 另带 New-Api-User',
      },
      {
        key: 'userId',
        label: '用户 ID（New-Api-User）',
        placeholder: '例如 126638',
        secret: false,
        hint: '控制台个人资料里的数字用户 ID',
      },
    ],
    hasBaseUrl: true,
    baseUrlPlaceholder: 'https://seedance.ai-tokens.app (默认)',
  },
  minimax: {
    provider: 'minimax',
    title: 'MiniMax',
    icon: Film,
    iconWrap: 'bg-violet-50',
    iconColor: 'text-violet-700',
    desc:
      '官方 Video V2：Bearer + POST /v2/video_generation（MiniMax-H3）。支持单图 i2va / 多图 r2va / 对口型 reference_audio。',
    consoleUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
    secretFields: [
      {
        key: 'apiKey',
        label: 'API Key',
        placeholder: 'xxxxxxxxxxxxxxxxxxxx',
        secret: true,
        hint: '环境变量 MINIMAX_API_KEY；Authorization: Bearer …（国内开放平台按量 Key）',
      },
    ],
    hasBaseUrl: true,
    baseUrlPlaceholder: 'https://api.minimaxi.com (默认；国际可用 https://api.minimax.io)',
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

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'ai-providers'] });
  };

  return (
    <div className="admin-page">
      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Cloud className="h-5 w-5 text-blue-600" />
              AI Provider 凭证
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              管理 Mountsea / apisale / smartfashion / aitokens 的 API 凭证。AES-256-GCM 加密存储，DB 缺失时回落 env。
            </p>
          </div>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
          <div className="space-y-6">
            {ALL_AI_PROVIDERS.map((p) => {
              const view = data?.find((c) => c.provider === p);
              return view ? (
                <ProviderCard key={p} view={view} />
              ) : (
                <div
                  key={p}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-400"
                >
                  {p} 加载失败
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            <AuditLogsSection />
          </div>
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
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div
        className={cn(
          'flex items-center justify-between gap-4 border-b px-5 py-4',
          view.configured && view.isActive
            ? 'border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50'
            : view.configured
              ? 'border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50'
              : 'border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/40',
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]',
              meta.iconWrap,
            )}
          >
            <Icon className={cn('h-5 w-5', meta.iconColor)} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-slate-900">{meta.title}</p>
              <SourceBadge source={view.source} />
              <HealthBadge
                palette={health}
                status={view.lastHealthStatus}
                configured={view.configured}
              />
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{meta.desc}</p>
          </div>
        </div>
        <Switch
          checked={view.isActive}
          disabled={!view.configured || toggleActive.isPending}
          onChange={(checked) => toggleActive.mutate(checked)}
          label={`启用 ${meta.title}`}
          size="lg"
        />
      </div>

      <div className="border-b border-slate-100 px-5 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">凭证</h2>
      </div>
      <div className="divide-y divide-slate-100 px-5 py-2">
          {meta.secretFields.map((f) => {
            const masked = view.secretsMasked[f.key];
            const revealed = revealedSecrets?.[f.key];
            const display = showSecret[f.key] && revealed ? revealed : masked || '—';

            if (editing) {
              return (
                <FormField
                  key={f.key}
                  label={f.label}
                  description={
                    f.hint
                      ? `${f.hint}。留空保存表示不修改。`
                      : '留空保存表示不修改已有密钥。'
                  }
                  controlClassName={CONTROL_WIDE}
                >
                  {f.secret ? (
                    <SecretInput
                      configured={!!masked}
                      maskedPreview={masked}
                      value={form[f.key] ?? ''}
                      onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
                      placeholder={f.placeholder}
                      showToggle
                      className={SECRET_INPUT_CLS}
                    />
                  ) : (
                    <Input
                      size="sm"
                      mono
                      autoComplete="off"
                      placeholder={f.placeholder}
                      value={form[f.key] ?? ''}
                      onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                    />
                  )}
                </FormField>
              );
            }

            return (
              <FormField
                key={f.key}
                label={f.label}
                description={f.hint}
                controlClassName={CONTROL_WIDE}
              >
                <div className="flex w-full items-center justify-end gap-1.5">
                  <span className="min-w-0 truncate font-mono text-xs text-slate-700" title={display}>
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
                      className="shrink-0 rounded-[8px] p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                      title={showSecret[f.key] ? '隐藏明文' : '显示明文（记审计）'}
                    >
                      {showSecret[f.key] ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </FormField>
            );
          })}

          {meta.hasBaseUrl &&
            (editing ? (
              <FormField
                label="Base URL"
                description="可选；留空使用渠道默认地址。"
                controlClassName={CONTROL_WIDE}
              >
                <Input
                  size="sm"
                  mono
                  placeholder={meta.baseUrlPlaceholder}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </FormField>
            ) : view.baseUrl ? (
              <FormField label="Base URL" description="当前生效的 API 根地址。" controlClassName={CONTROL_WIDE}>
                <span
                  className="w-full truncate text-right font-mono text-xs text-slate-700"
                  title={view.baseUrl}
                >
                  {view.baseUrl}
                </span>
              </FormField>
            ) : null)}
      </div>

      {!editing && (view.updatedAt || meta.consoleUrl) && (
        <div className="space-y-1.5 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          {view.updatedAt && (
            <p>
              上次更新{' '}
              <span className="font-medium text-slate-700">{view.updatedBy ?? '—'}</span>
              {' · '}
              {new Date(view.updatedAt).toLocaleString('zh-CN')}
            </p>
          )}
          {view.lastHealthCheck && (
            <p>
              上次健康检查 {new Date(view.lastHealthCheck).toLocaleString('zh-CN')}
              {view.lastErrorMessage && (
                <span className="ml-1 text-red-600">{view.lastErrorMessage.slice(0, 80)}</span>
              )}
            </p>
          )}
          {meta.consoleUrl && (
            <a
              href={meta.consoleUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-block font-medium text-blue-600 hover:underline"
            >
              获取/查看凭证 ↗
            </a>
          )}
        </div>
      )}

      {testResult && (
        <div
          className={cn(
            'mx-5 mb-1 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm',
            testResult.success
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700',
          )}
        >
          {testResult.success ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">{testResult.summary}</p>
            {testResult.errorMessage && (
              <p className="mt-0.5 break-all text-xs">{testResult.errorMessage}</p>
            )}
          </div>
        </div>
      )}

      {msg && (
        <p
          className={cn(
            'px-5 text-xs font-medium',
            msg.ok ? 'text-emerald-600' : 'text-red-500',
          )}
        >
          {msg.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-4">
        {editing ? (
          <>
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              <KeyRound className={cn('h-3.5 w-3.5', save.isPending && 'animate-spin')} />
              {save.isPending ? '保存中…' : '保存凭证'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              取消
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={enterEdit}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <KeyRound className="h-3.5 w-3.5" />
              {view.configured ? '编辑凭证' : '配置凭证'}
            </button>
            <button
              type="button"
              onClick={() => testMu.mutate()}
              disabled={!view.configured || testMu.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
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
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
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
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
        <XCircle className="h-3 w-3" />
        未配置
      </span>
    );
  }
  if (source === 'env') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
        env
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
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
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        palette.wrap,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', palette.dot)} />
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
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();

  const { data, isLoading } = useQuery<{
    items: AuditLog[];
    total: number;
    page: number;
    pageSize: number;
  }>({
    queryKey: ['admin', 'ai-provider-audit-logs', providerFilter, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (providerFilter) qs.set('provider', providerFilter);
      return apiClient.get(`/admin/ai-providers/audit-logs?${qs}`) as Promise<{
        items: AuditLog[];
        total: number;
        page: number;
        pageSize: number;
      }>;
    },
    enabled: open,
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
      >
        <span className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-slate-400" />
          审计日志
          {data && <span className="text-xs font-normal text-slate-400">（{data.total} 条）</span>}
        </span>
        <span className="text-xs font-medium text-slate-400">{open ? '收起' : '展开'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3">
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => { setProviderFilter(''); setPage(1); }}
              className={cn(
                'px-2 py-1 rounded-lg border',
                providerFilter === ''
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-600',
              )}
            >
              全部
            </button>
            {ALL_AI_PROVIDERS.map((p) => (
              <button
                key={p}
                onClick={() => { setProviderFilter(p); setPage(1); }}
                className={cn(
                  'px-2 py-1 rounded-lg border',
                  providerFilter === p
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600',
                )}
              >
                {PROVIDER_META[p].title}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              加载中…
            </div>
          ) : !data || data.items.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">暂无审计记录</p>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
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
                  {data.items.map((log) => (
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
            <PaginationBar
              page={page}
              pageSize={pageSize}
              total={data.total}
              onPageChange={setPage}
              onPageSizeChange={onPageSizeChange}
            />
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
    tested: 'bg-blue-50 text-blue-700',
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
