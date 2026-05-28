'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Film, Loader2, Upload } from 'lucide-react';
import apiClient from '@/lib/api';
import { DataTable, DataTableColumn } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { SearchBar } from '@/components/search-bar';
import { formatDate } from '@/lib/utils';
import { exportMvProject, importMvProject } from '@/lib/mv-import-export';

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

export default function AdminMvProjectsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'mv', 'projects', { page, status, search }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '20');
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      return apiClient.get(`/admin/mv/projects?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
  });

  /** 单行导出：调 API 拉全量 JSON 后由浏览器触发下载 */
  const handleExport = async (row: MvProjectRow) => {
    setExportingId(row.id);
    try {
      await exportMvProject(row.id, row.title);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`导出失败：${msg}`);
    } finally {
      setExportingId(null);
    }
  };

  /** 右上角导入：触发隐藏 file input，由 onChange 完成读取与上传 */
  const handleImportClick = () => {
    if (importing) return;
    fileInputRef.current?.click();
  };

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
      alert(`导入失败：${msg}`);
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
              className="font-medium text-slate-900 hover:text-purple-600 truncate"
            >
              {row.title || '(未命名)'}
            </Link>
            {row.importSource && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 flex-shrink-0"
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
      width: 'w-24',
      render: (row) => {
        const isExporting = exportingId === row.id;
        return (
          <button
            onClick={(e) => {
              // 阻止事件冒泡到行链接（如有），并阻止 Link 默认行为
              e.preventDefault();
              e.stopPropagation();
              void handleExport(row);
            }}
            disabled={isExporting}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-purple-600 hover:bg-purple-50 disabled:opacity-50 transition-colors"
            title="导出项目 JSON（含全部 shots/planning/assets）"
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            导出
          </button>
        );
      },
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Film className="h-5 w-5 text-purple-600" />
              MV 项目
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              共 {data?.total ?? 0} 个项目
            </p>
          </div>
          <div className="flex items-center gap-2">
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
              disabled={importing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              title="导入由「导出」按钮生成的 .json 文件，将自动归属到当前 admin 名下"
            >
              {importing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {importing ? '导入中...' : '导入 MV'}
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
                    ? 'px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-600 text-white'
                    : 'px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100'
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <DataTable<MvProjectRow>
          columns={columns}
          rows={data?.items}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          isError={isError}
          error={error}
          emptyMessage="暂无 MV 项目"
          page={data?.page ?? page}
          pageSize={data?.pageSize ?? 20}
          total={data?.total}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
