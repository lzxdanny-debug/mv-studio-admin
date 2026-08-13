'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Film, Home, Loader2, RefreshCw, Upload } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { DataTable, DataTableColumn } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { SearchBar } from '@/components/search-bar';
import { formatDate } from '@/lib/utils';
import { exportMvProject, importMvProject } from '@/lib/mv-import-export';
import { useAlert } from '@/components/ui/dialog-provider';
import { AdminTagsEditor } from '@/components/admin-tags-editor';
import {
  OperationsFilterBar,
  operationsFilterToQueryParams,
  type OperationsFilterKey,
} from '@/components/operations-filter-bar';

/**
 * 当一条 MV 是通过 admin 导入接口从其它环境带过来时，importSource 为非 null 对象。
 * 字段语义与后端 MvProject.importSource 严格对应——这里全部声明 string 是因为
 * 后端 jsonb 序列化时会把 Date 等都转成 ISO 字符串。
 */
interface ImportSource {
  sourceProjectId: string;
  sourceUserEmail: string | null;
  sourceUserDisplayName: string | null;
  originalCreatedAt: string;
  importedAt: string;
}

interface MvProjectRow {
  id: string;
  title: string;
  userId: string;
  status: string;
  currentStep: number;
  styleTag: string;
  mvType: string;
  aspectRatio: string;
  videoProvider: string;
  resultUrl: string | null;
  errorMessage: string | null;
  importSource: ImportSource | null;
  adminTags: string[] | null;
  isPublic: boolean;
  homepageFeaturedAt: string | null;
  createdAt: string;
  updatedAt: string;
  userDisplayName: string | null;
  userEmail: string | null;
}

interface ListResponse {
  items: MvProjectRow[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '待开始', value: 'pending' },
  { label: '规划中', value: 'planning' },
  { label: '等待确认', value: 'reviewing' },
  { label: '生成中', value: 'generating' },
  { label: '合成中', value: 'composing' },
  { label: '已完成', value: 'done' },
  { label: '失败', value: 'failed' },
];

interface MvCapabilities {
  importEnabled: boolean;
}

export default function AdminMvProjectsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const alert = useAlert();
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [operationsFilter, setOperationsFilter] = useState<OperationsFilterKey>('');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [homepageFeaturedPendingId, setHomepageFeaturedPendingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'mv', 'projects', { page, pageSize, status, search, operationsFilter }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      for (const [key, value] of Object.entries(operationsFilterToQueryParams(operationsFilter))) {
        params.set(key, value);
      }
      return apiClient.get(`/admin/mv/projects?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
  });

  // 环境能力：本地 dev 后端会返回 importEnabled=true，线上保持 false。
  // 当 query 处于 loading（首次）时按钮先按"禁用"展示，避免线上闪一下可点。
  const { data: capabilities } = useQuery<MvCapabilities>({
    queryKey: ['admin', 'mv', 'capabilities'],
    queryFn: () => apiClient.get('/admin/mv/capabilities') as any,
    // 能力字段几乎不变，缓存久一点；导入按钮可见性不需要频繁拉取
    staleTime: 5 * 60_000,
  });
  const importEnabled = capabilities?.importEnabled === true;

  const homepageFeaturedMutation = useMutation<
    { id: string; homepageFeaturedAt: string | null },
    Error,
    { id: string; featured: boolean }
  >({
    mutationFn: ({ id, featured }) =>
      apiClient.patch(`/admin/mv/projects/${id}/homepage-featured`, { featured }) as Promise<{
        id: string;
        homepageFeaturedAt: string | null;
      }>,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'mv', 'projects'] });
    },
    onError: async (err: Error) => {
      await alert({
        title: '操作失败',
        description: err.message || String(err),
        variant: 'danger',
      });
    },
    onSettled: () => {
      setHomepageFeaturedPendingId(null);
    },
  });

  /** 单行导出：调 API 拉全量 JSON 后由浏览器触发下载 */
  const handleExport = async (row: MvProjectRow) => {
    setExportingId(row.id);
    try {
      await exportMvProject(row.id, row.title);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await alert({ title: '导出失败', description: msg, variant: 'danger' });
    } finally {
      setExportingId(null);
    }
  };

  /** 右上角导入：触发隐藏 file input，由 onChange 完成读取与上传 */
  const handleImportClick = () => {
    if (importing) return;
    fileInputRef.current?.click();
  };

  /**
   * 全局对账：调一次后端「跑过去 6h 时间窗 reconcileWindow」逻辑（等价于手动跑 cron）。
   * 用于不想等整点 cron 时立刻把估算金额刷成真实账单值。
   * 后端会跳过 reconciled_at 已落库的记录，可反复触发。
   */
  const reconcileNowMutation = useMutation<{
    mountsea: number;
    apisale?: number;
    smartfashion?: number;
    aitokens?: number;
    total: number;
    reconciled: number;
    unmatched: number;
    window: { hours: number; startIso: string; endIso: string };
  }>({
    mutationFn: () =>
      apiClient.post('/admin/mv/cost/reconcile-now?hours=6', {}) as any,
    onSuccess: async (s) => {
      // 刷新所有项目的成本明细（不知道用户当前在哪一个项目详情页）
      await qc.invalidateQueries({ queryKey: ['admin', 'mv'] });
      await alert({
        title: '对账完成',
        description:
          `时间窗：${s.window.startIso.slice(11, 19)} → ${s.window.endIso.slice(11, 19)}（最近 ${s.window.hours}h）\n\n` +
          `本次窗口待对账记录：${s.total} 条\n` +
          `成功匹配：${s.reconciled} 条（mountsea ${s.mountsea}` +
          ` / apisale ${s.apisale ?? 0} / smartfashion ${s.smartfashion ?? 0} / aitokens ${s.aitokens ?? 0}）\n` +
          `未匹配：${s.unmatched} 条（下次 cron 会再尝试，或扩大时间窗后重试）`,
      });
    },
    onError: async (err: any) => {
      await alert({
        title: '对账失败',
        description: err?.message ?? String(err),
        variant: 'danger',
      });
    },
  });

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 立刻 reset value，否则同一个文件第二次选不会触发 onChange
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const { newProjectId } = await importMvProject(file);
      qc.invalidateQueries({ queryKey: ['admin', 'mv', 'projects'] });
      // 直接跳到新项目详情，便于立刻查看
      router.push(`/admin/mv/projects/${newProjectId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await alert({ title: '导入失败', description: msg, variant: 'danger' });
    } finally {
      setImporting(false);
    }
  };

  const columns: DataTableColumn<MvProjectRow>[] = [
    {
      key: 'title',
      header: '项目',
      render: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/admin/mv/projects/${row.id}`}
              className="font-medium text-slate-900 hover:text-blue-600 truncate"
            >
              {row.title || '(未命名)'}
            </Link>
            {row.importSource && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 flex-shrink-0"
                title={
                  `从其它环境导入\n` +
                  `源用户：${row.importSource.sourceUserDisplayName ?? '—'}` +
                  (row.importSource.sourceUserEmail ? ` (${row.importSource.sourceUserEmail})` : '') +
                  `\n源项目 ID：${row.importSource.sourceProjectId}` +
                  `\n原创建：${row.importSource.originalCreatedAt}` +
                  `\n导入于：${row.importSource.importedAt}`
                }
              >
                <Download className="h-2.5 w-2.5" />
                已导入
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 truncate">{row.id}</p>
        </div>
      ),
    },
    {
      key: 'user',
      header: '用户',
      render: (row) => (
        <div className="min-w-0">
          <p className="text-sm text-slate-700 truncate">{row.userDisplayName || '—'}</p>
          {row.userEmail && (
            <p className="text-xs text-slate-400 truncate">{row.userEmail}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      width: 'w-32',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={row.status} kind="mvProject" />
          <span className="text-[10px] text-slate-400">Step {row.currentStep}/10</span>
        </div>
      ),
    },
    {
      key: 'config',
      header: '配置',
      width: 'w-40',
      render: (row) => (
        <div className="text-xs text-slate-500 space-y-0.5">
          <p>
            <span className="text-slate-700">{row.styleTag || '—'}</span> · {row.mvType}
          </p>
          <p className="text-slate-400">
            {row.aspectRatio} · {row.videoProvider}
          </p>
        </div>
      ),
    },
    {
      key: 'adminTags',
      header: '运营标签',
      width: 'w-36',
      render: (row) => (
        <AdminTagsEditor
          id={row.id}
          tags={row.adminTags}
          kind="mv"
          invalidateQueryKey={['admin', 'mv', 'projects']}
        />
      ),
    },
    {
      key: 'createdAt',
      header: '创建时间',
      width: 'w-40',
      render: (row) => (
        <span className="text-xs text-slate-500">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '操作',
      width: 'w-40',
      render: (row) => {
        const isExporting = exportingId === row.id;
        const isFeatured = Boolean(row.homepageFeaturedAt);
        const isHomepagePending = homepageFeaturedPendingId === row.id;
        const canAddToHomepage =
          row.status === 'done' && Boolean(row.resultUrl?.trim()) && row.isPublic;
        const homepageDisabledReason = !row.resultUrl?.trim()
          ? '项目尚无成片'
          : row.status !== 'done'
            ? '项目尚未完成'
            : !row.isPublic
              ? '请先在运营设置中开启公开'
              : undefined;

        return (
          <div className="flex flex-col gap-1">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void handleExport(row);
              }}
              disabled={isExporting}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
              title="导出项目 JSON（含全部 shots/planning/assets）"
            >
              {isExporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              导出
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setHomepageFeaturedPendingId(row.id);
                homepageFeaturedMutation.mutate({ id: row.id, featured: !isFeatured });
              }}
              disabled={isHomepagePending || (!isFeatured && !canAddToHomepage)}
              className={
                isFeatured
                  ? 'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-amber-700 hover:text-amber-800 hover:bg-amber-50 disabled:opacity-50 transition-colors'
                  : 'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 transition-colors'
              }
              title={
                isFeatured
                  ? '从首页 MV 墙移出'
                  : homepageDisabledReason ?? '加入首页 MV 墙展示'
              }
            >
              {isHomepagePending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Home className="h-3.5 w-3.5" />
              )}
              {isFeatured ? '移出首页' : '加入首页'}
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="admin-page">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Film className="h-5 w-5 text-blue-600" />
              MV 项目
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              共 {data?.total ?? 0} 个项目
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 全局立即对账：手动触发对账 cron，覆盖最近 6 小时窗口内所有项目。
                cron 默认整点跑一次，这里给运营一个不用等的入口。 */}
            <button
              onClick={() => reconcileNowMutation.mutate()}
              disabled={reconcileNowMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              title="立刻调用上游账单 API，把最近 6 小时窗口内所有未对账的 MV 估算金额换成真实金额。幂等，可反复触发。"
            >
              {reconcileNowMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {reconcileNowMutation.isPending ? '对账中...' : '立即对账（最近 6h）'}
            </button>
            {/* 隐藏 input：通过按钮 click 触发，避免裸露 input 影响布局；
                同一文件二选时需要在 onChange 后清空 value */}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportFileChange}
            />
            <button
              onClick={handleImportClick}
              disabled={importing || !importEnabled}
              className={
                importEnabled
                  ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50'
                  : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-200 text-slate-500 cursor-not-allowed'
              }
              title={
                importEnabled
                  ? '导入由「导出」按钮生成的 .json 文件，将自动归属到当前 admin 名下'
                  : '当前环境已禁止导入（生产环境保护）。仅在本地 dev 设置 MV_IMPORT_ENABLED=true 后可用，用于把线上数据拉到本地调试'
              }
            >
              {importing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {importing ? '导入中...' : importEnabled ? '导入 MV' : '导入 MV（本环境已禁用）'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SearchBar
            value={search}
            onChange={(v) => {
              setPage(1);
              setSearch(v);
            }}
            placeholder="搜索标题 / 用户名 / 邮箱"
            width="w-72"
          />
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setPage(1);
                  setStatus(opt.value);
                }}
                className={
                  status === opt.value
                    ? 'px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-600 text-white'
                    : 'px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100'
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <OperationsFilterBar
          value={operationsFilter}
          onChange={(next) => {
            setPage(1);
            setOperationsFilter(next);
          }}
        />

        <DataTable<MvProjectRow>
          columns={columns}
          rows={data?.items}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          isError={isError}
          error={error}
          emptyMessage="暂无 MV 项目"
          page={data?.page ?? page}
          pageSize={data?.pageSize ?? pageSize}
          total={data?.total}
          onPageChange={setPage}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  );
}
