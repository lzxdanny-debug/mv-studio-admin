'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  FileSpreadsheet,
  ListFilter,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  HelpCircle,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { DataTable } from '@/components/data-table';
import { SearchBar } from '@/components/search-bar';
import { useServerPagination } from '@/lib/use-server-pagination';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { hasPermission } from '@/lib/admin-permissions';
import { useConfirm } from '@/components/ui/dialog-provider';
import type { ConfirmVariant } from '@/components/ui/confirm-modal';

export type RiskListKind = 'block' | 'allow';

interface BlocklistEntry {
  id: string;
  listType: RiskListKind;
  targetType: string;
  targetValue: string;
  scopes: string[];
  reason: string;
  expiresAt: string | null;
  isActive: boolean;
  source: string;
  attemptCount: number;
  hitCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  items: BlocklistEntry[];
  total: number;
  page: number;
  pageSize: number;
}

interface BlocklistMeta {
  listTypes: string[];
  targetTypes: string[];
  scopes: string[];
  sources: string[];
}

const TARGET_TYPE_LABEL: Record<string, string> = {
  user_id: '用户 ID',
  email: '邮箱',
  email_domain: '邮箱域名',
  ip: 'IP（可填 localhost 合并 ::1 与 127.0.0.1）',
  ip_cidr: 'IP 网段',
  device_id: '设备 ID',
};

/** 对象类型说明（匹配规则） */
const TARGET_TYPE_DESC: Record<string, string> = {
  user_id: '精确匹配 C 端用户 UUID',
  email: '精确匹配完整邮箱，如 user@example.com',
  email_domain: '匹配该域名下所有邮箱，如 tempmail.com（不含 @）',
  ip: '单个 IP；填 localhost 可同时匹配本机 ::1 与 127.0.0.1',
  ip_cidr: '匹配网段内所有 IP，如 10.0.0.0/24',
  device_id: '匹配 Web 端 X-Device-Id（localStorage 设备指纹）',
};

const TARGET_VALUE_PLACEHOLDER: Record<string, string> = {
  user_id: 'f9e068b8-fae9-4dc3-9b48-7456aec246cb',
  email: 'user@example.com',
  email_domain: 'tempmail.com',
  ip: 'localhost 或 203.0.113.10',
  ip_cidr: '10.0.0.0/24',
  device_id: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
};

const SCOPE_LABEL: Record<string, string> = {
  register: '注册',
  login: '登录',
  free_credit_claim: '注册赠送',
  generation: '生成',
  payment: '支付',
  all: '全部',
};

/** 作用范围说明（在哪些 C 端环节生效） */
const SCOPE_DESC: Record<string, string> = {
  register: 'POST /auth/register — 注册前拦截或白名单跳过 IP/设备上限',
  login: 'POST /auth/login — 黑名单拦截登录（V1 白名单仅审计）',
  free_credit_claim: '注册赠送积分 — 防刷 IP/设备/临时邮箱',
  generation: 'MV 创建与视频生成 — 生成前风控',
  payment: '预留，V1 仅落库未接入 Stripe',
  all: '展开为以上全部范围（不含 payment 以外的自定义组合请多选）',
};

const SOURCE_LABEL: Record<string, string> = {
  manual: '手动',
  import: 'Excel 导入',
  system: '系统',
};

const PAGE_CONFIG: Record<
  RiskListKind,
  {
    title: string;
    subtitle: string;
    hint?: string;
    hintCls?: string;
    emptyMessage: string;
    createLabel: string;
    editTitle: string;
    createTitle: string;
    deactivateConfirm: string;
    exportFilename: string;
    templateFilename: string;
    accentBtn: string;
    icon: LucideIcon;
    iconCls: string;
    confirmOnCreate?: {
      title: string;
      description: string;
      variant?: ConfirmVariant;
    };
  }
> = {
  block: {
    title: '封控黑名单',
    subtitle: '精确封禁 IP、设备、邮箱、用户等对象。命中后立即拦截，优先级高于白名单与数值规则。',
    emptyMessage: '暂无黑名单条目',
    createLabel: '新建黑名单',
    editTitle: '编辑黑名单',
    createTitle: '新建黑名单',
    deactivateConfirm: '确定停用该黑名单条目？',
    exportFilename: 'risk-blocklist.xlsx',
    templateFilename: 'risk-blocklist-template.xlsx',
    accentBtn: 'bg-rose-600 hover:bg-rose-700',
    icon: ShieldAlert,
    iconCls: 'text-rose-600',
  },
  allow: {
    title: '信任白名单',
    subtitle:
      '对可信对象跳过部分自动封控规则（如同 IP 注册上限、临时邮箱拦截、注册赠送 IP/设备限制等）。',
    hint: '白名单不绕过账号 banned 等硬封禁；黑名单仍优先于白名单。配置前请确认对象可信。',
    hintCls: 'border-amber-100 bg-amber-50/80 text-amber-800',
    emptyMessage: '暂无白名单条目',
    createLabel: '新建白名单',
    editTitle: '编辑白名单',
    createTitle: '新建白名单',
    deactivateConfirm: '确定停用该白名单条目？',
    exportFilename: 'risk-allowlist.xlsx',
    templateFilename: 'risk-allowlist-template.xlsx',
    accentBtn: 'bg-emerald-600 hover:bg-emerald-700',
    icon: ShieldCheck,
    iconCls: 'text-emerald-600',
    confirmOnCreate: {
      title: '确认添加白名单？',
      description: '白名单将跳过部分数值限流规则。请确认该对象可信后再保存。',
      variant: 'warning',
    },
  },
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api';

function downloadWithAuth(path: string, filename: string) {
  const token = localStorage.getItem('admin_access_token');
  fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then(async (res) => {
      if (!res.ok) throw new Error('下载失败');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(() => alert('下载失败，请检查登录状态'));
}

function emptyForm(listType: RiskListKind) {
  return {
    listType,
    targetType: 'ip',
    targetValue: '',
    scopes: ['register'] as string[],
    reason: '',
    expiresAt: '',
    isActive: true,
  };
}

export function RiskListPage({ fixedListType }: { fixedListType: RiskListKind }) {
  const cfg = PAGE_CONFIG[fixedListType];
  const Icon = cfg.icon;
  const confirmDialog = useConfirm();
  const qc = useQueryClient();
  const permissions = useAdminAuthStore((s) => s.permissions);
  const canManage = hasPermission(permissions, 'risk.manage');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [targetType, setTargetType] = useState('');
  const [scope, setScope] = useState('');
  const [q, setQ] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<BlocklistEntry | null>(null);
  const [form, setForm] = useState(emptyForm(fixedListType));
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const exportQuery = `listType=${fixedListType}`;
  const templateQuery = `listType=${fixedListType}`;

  const { data: meta } = useQuery<BlocklistMeta>({
    queryKey: ['admin', 'risk', 'blocklist', 'meta'],
    queryFn: () => apiClient.get('/admin/risk/blocklist/meta') as Promise<BlocklistMeta>,
  });

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: [
      'admin',
      'risk',
      'blocklist',
      fixedListType,
      { page, pageSize, targetType, scope, q, activeOnly },
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('listType', fixedListType);
      if (targetType) params.set('targetType', targetType);
      if (scope) params.set('scope', scope);
      if (q) params.set('q', q);
      if (activeOnly) params.set('activeOnly', 'true');
      return apiClient.get(`/admin/risk/blocklist?${params.toString()}`) as Promise<ListResponse>;
    },
    placeholderData: (prev) => prev,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        listType: fixedListType,
        targetType: form.targetType,
        targetValue: form.targetValue.trim(),
        scopes: form.scopes,
        reason: form.reason.trim(),
        expiresAt: form.expiresAt || null,
        isActive: form.isActive,
      };
      if (editing) {
        return apiClient.patch(`/admin/risk/blocklist/${editing.id}`, payload);
      }
      return apiClient.post('/admin/risk/blocklist', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'risk', 'blocklist'] });
      setEditorOpen(false);
      setEditing(null);
      setForm(emptyForm(fixedListType));
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.message ?? err?.message ?? '保存失败');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/risk/blocklist/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'risk', 'blocklist'] }),
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const token = localStorage.getItem('admin_access_token');
      const res = await fetch(`${API_URL}/admin/risk/blocklist/import?mode=upsert`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const json = await res.json();
      const body = json?.data ?? json;
      if (!res.ok) throw new Error(body?.message ?? '导入失败');
      return body as {
        created: number;
        updated: number;
        skipped: number;
        errors: Array<{ row: number; message: string }>;
      };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['admin', 'risk', 'blocklist'] });
      const errCount = result.errors?.length ?? 0;
      setImportMsg(
        `导入完成：新建 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}${errCount ? `，失败 ${errCount} 行` : ''}`,
      );
    },
    onError: (err: any) => setImportMsg(err?.message ?? '导入失败'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(fixedListType));
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (row: BlocklistEntry) => {
    setEditing(row);
    setForm({
      listType: fixedListType,
      targetType: row.targetType,
      targetValue: row.targetValue,
      scopes: [...row.scopes],
      reason: row.reason,
      expiresAt: row.expiresAt ? row.expiresAt.slice(0, 16) : '',
      isActive: row.isActive,
    });
    setFormError(null);
    setEditorOpen(true);
  };

  const toggleScope = (s: string) => {
    setForm((prev) => {
      const has = prev.scopes.includes(s);
      return {
        ...prev,
        scopes: has ? prev.scopes.filter((x) => x !== s) : [...prev.scopes, s],
      };
    });
  };

  const handleSave = async () => {
    if (!editing && cfg.confirmOnCreate) {
      const ok = await confirmDialog({
        title: cfg.confirmOnCreate.title,
        description: cfg.confirmOnCreate.description,
        confirmText: '继续保存',
        variant: cfg.confirmOnCreate.variant ?? 'warning',
      });
      if (!ok) return;
    }
    saveMutation.mutate();
  };

  const columns = [
    {
      key: 'target',
      header: '对象',
      render: (row: BlocklistEntry) => (
        <div className="min-w-0">
          <div className="text-xs text-slate-400">
            {TARGET_TYPE_LABEL[row.targetType] ?? row.targetType}
          </div>
          <div className="truncate font-mono text-sm text-slate-800">{row.targetValue}</div>
        </div>
      ),
    },
    {
      key: 'scopes',
      header: '作用范围',
      render: (row: BlocklistEntry) => (
        <div className="flex flex-wrap gap-1">
          {row.scopes.map((s) => (
            <span
              key={s}
              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
            >
              {SCOPE_LABEL[s] ?? s}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'reason',
      header: '原因',
      render: (row: BlocklistEntry) => (
        <span className="line-clamp-2 text-sm text-slate-600">{row.reason || '—'}</span>
      ),
    },
    ...(fixedListType === 'block'
      ? [
          {
            key: 'attemptCount',
            header: '尝试次数',
            render: (row: BlocklistEntry) => (
              <span
                className={cn(
                  'font-mono text-sm tabular-nums',
                  row.attemptCount > 0 ? 'text-slate-700' : 'text-slate-300',
                )}
                title="匹配该对象的注册 API 调用次数（含成功与失败）"
              >
                {row.attemptCount ?? 0}
              </span>
            ),
          },
          {
            key: 'hitCount',
            header: '拦截次数',
            render: (row: BlocklistEntry) => (
              <span
                className={cn(
                  'font-mono text-sm tabular-nums',
                  row.hitCount > 0 ? 'font-medium text-rose-600' : 'text-slate-300',
                )}
                title="上述尝试中被风控挡住的次数（含黑名单与数值规则）"
              >
                {row.hitCount ?? 0}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'expiresAt',
      header: '过期',
      render: (row: BlocklistEntry) =>
        row.expiresAt ? (
          <span className="text-xs text-slate-500">
            {new Date(row.expiresAt).toLocaleString('zh-CN')}
          </span>
        ) : (
          <span className="text-xs text-slate-300">永久</span>
        ),
    },
    {
      key: 'status',
      header: '状态',
      render: (row: BlocklistEntry) =>
        row.isActive ? (
          <span className="text-xs text-emerald-600">启用</span>
        ) : (
          <span className="text-xs text-slate-400">已停用</span>
        ),
    },
    {
      key: 'source',
      header: '来源',
      render: (row: BlocklistEntry) => (
        <span className="text-xs text-slate-500">
          {SOURCE_LABEL[row.source] ?? row.source}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '操作',
            render: (row: BlocklistEntry) => (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(row)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-violet-600"
                  title="编辑"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {row.isActive && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirmDialog({
                        title: '确定停用？',
                        description: cfg.deactivateConfirm,
                        variant: 'danger',
                        confirmText: '停用',
                      });
                      if (ok) deactivateMutation.mutate(row.id);
                    }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="停用"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Icon className={cn('h-5 w-5', cfg.iconCls)} />
              {cfg.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{cfg.subtitle}</p>
            {cfg.hint && (
              <p className={cn('mt-2 rounded-lg border px-3 py-2 text-xs', cfg.hintCls)}>
                {cfg.hint}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                downloadWithAuth(
                  `/admin/risk/blocklist/template.xlsx?${templateQuery}`,
                  cfg.templateFilename,
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              下载模板
            </button>
            <button
              type="button"
              onClick={() =>
                downloadWithAuth(
                  `/admin/risk/blocklist/export.xlsx?${exportQuery}`,
                  cfg.exportFilename,
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              导出 Excel
            </button>
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" />
                  导入 Excel
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) importMutation.mutate(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={openCreate}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white',
                    cfg.accentBtn,
                  )}
                >
                  <Plus className="h-4 w-4" />
                  {cfg.createLabel}
                </button>
              </>
            )}
          </div>
        </div>

        {importMsg && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
            {importMsg}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setGuideOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <span className="inline-flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-violet-500" />
              字段说明（对象类型 / 作用范围 / 原因 / 来源
              {fixedListType === 'block' ? ' / 尝试·拦截次数' : ''}）
            </span>
            <ChevronDown
              className={cn('h-4 w-4 text-slate-400 transition-transform', guideOpen && 'rotate-180')}
            />
          </button>
          {guideOpen && (
            <div className="space-y-4 border-t border-slate-100 px-4 py-4 text-xs leading-relaxed text-slate-600">
              <p>
                <strong className="text-slate-700">「原因」</strong>
                是运营自行填写的备注，不是系统预设类型。黑名单命中时，此文案会作为 C 端 403
                提示的一部分；白名单仅作后台审计。例如{' '}
                <code className="rounded bg-slate-100 px-1">acceptance test block</code>{' '}
                是开发验收时写的测试说明，可按需改成「刷单 IP」「临时邮箱滥用」等。
              </p>
              {fixedListType === 'block' && (
                <p>
                  <strong className="text-slate-700">「尝试次数 / 拦截次数」</strong>
                  按对象自动统计。
                  <strong className="text-slate-700">尝试</strong>
                  = 每次注册 API 且对象匹配；
                  <strong className="text-slate-700">拦截</strong>
                  = 被风控挡住的次数。本地开发 API 常见 IP 为{' '}
                  <code className="rounded bg-slate-100 px-1">::1</code>，可建一条{' '}
                  <code className="rounded bg-slate-100 px-1">ip / localhost</code>{' '}
                  代替分别建 ::1 与 127.0.0.1；公网 IP（如 112.33.22.11）须单独一条，无法与 localhost 合并。
                </p>
              )}
              <div>
                <p className="mb-2 font-medium text-slate-700">对象类型</p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {Object.entries(TARGET_TYPE_DESC).map(([key, desc]) => (
                    <li key={key}>
                      <span className="font-medium text-slate-700">
                        {TARGET_TYPE_LABEL[key] ?? key}
                      </span>
                      ：{desc}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 font-medium text-slate-700">作用范围</p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {Object.entries(SCOPE_DESC).map(([key, desc]) => (
                    <li key={key}>
                      <span className="font-medium text-slate-700">
                        {SCOPE_LABEL[key] ?? key}
                      </span>
                      ：{desc}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 font-medium text-slate-700">来源</p>
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {Object.entries(SOURCE_LABEL).map(([key, label]) => (
                    <li key={key}>
                      <span className="font-medium text-slate-700">{label}</span>（{key}）
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchBar
            value={q}
            onChange={(v) => {
              setPage(1);
              setQ(v);
            }}
            placeholder="搜索对象值 / 原因…"
            width="w-56"
          />
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            <ListFilter className="mx-1 h-4 w-4 text-slate-400" />
            <select
              value={targetType}
              onChange={(e) => {
                setPage(1);
                setTargetType(e.target.value);
              }}
              className="h-8 rounded-lg border-0 bg-transparent px-2 text-sm text-slate-600 focus:ring-0"
            >
              <option value="">全部对象</option>
              {(meta?.targetTypes ?? []).map((t) => (
                <option key={t} value={t}>
                  {TARGET_TYPE_LABEL[t] ?? t}
                </option>
              ))}
            </select>
            <select
              value={scope}
              onChange={(e) => {
                setPage(1);
                setScope(e.target.value);
              }}
              className="h-8 rounded-lg border-0 bg-transparent px-2 text-sm text-slate-600 focus:ring-0"
            >
              <option value="">全部范围</option>
              {(meta?.scopes ?? []).map((s) => (
                <option key={s} value={s}>
                  {SCOPE_LABEL[s] ?? s}
                </option>
              ))}
            </select>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => {
                setPage(1);
                setActiveOnly(e.target.checked);
              }}
              className="accent-violet-600"
            />
            仅启用
          </label>
        </div>

        <QueryState isLoading={isLoading} isError={isError} error={error} height="h-48">
          <DataTable
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(r) => r.id}
            total={data?.total ?? 0}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={onPageSizeChange}
            emptyMessage={cfg.emptyMessage}
          />
        </QueryState>
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">
              {editing ? cfg.editTitle : cfg.createTitle}
            </h2>
            {formError && <p className="mt-2 text-sm text-rose-600">{formError}</p>}
            <div className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="text-slate-600">对象类型</span>
                <select
                  value={form.targetType}
                  onChange={(e) => setForm((p) => ({ ...p, targetType: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {(meta?.targetTypes ?? []).map((t) => (
                    <option key={t} value={t}>
                      {TARGET_TYPE_LABEL[t] ?? t}
                    </option>
                  ))}
                </select>
                {TARGET_TYPE_DESC[form.targetType] && (
                  <p className="mt-1.5 text-xs text-slate-400">
                    {TARGET_TYPE_DESC[form.targetType]}
                  </p>
                )}
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">对象值</span>
                <input
                  value={form.targetValue}
                  onChange={(e) => setForm((p) => ({ ...p, targetValue: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
                  placeholder={
                    TARGET_VALUE_PLACEHOLDER[form.targetType] ?? '填写要匹配的值'
                  }
                />
              </label>
              <div>
                <span className="text-sm text-slate-600">作用范围</span>
                <p className="mt-0.5 text-xs text-slate-400">至少选一项；仅对勾选的环节生效</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(meta?.scopes ?? []).map((s) => (
                    <button
                      key={s}
                      type="button"
                      title={SCOPE_DESC[s]}
                      onClick={() => toggleScope(s)}
                      className={cn(
                        'rounded-lg border px-2.5 py-1 text-xs',
                        form.scopes.includes(s)
                          ? 'border-violet-300 bg-violet-50 text-violet-700'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50',
                      )}
                    >
                      {SCOPE_LABEL[s] ?? s}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-sm">
                <span className="text-slate-600">原因</span>
                <p className="mt-0.5 text-xs text-slate-400">
                  运营备注；黑名单命中时 C 端会看到此文案（如「刷单 IP，请联系客服」）
                </p>
                <textarea
                  rows={2}
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder={
                    fixedListType === 'block'
                      ? '如：异常注册 IP / 用户投诉'
                      : '如：公司办公网出口 IP / 合作方测试'
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">过期时间（可选）</span>
                <input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="accent-violet-600"
                />
                启用
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditorOpen(false);
                  setEditing(null);
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={saveMutation.isPending || !form.targetValue.trim() || !form.scopes.length}
                onClick={handleSave}
                className={cn(
                  'rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60',
                  cfg.accentBtn,
                )}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
