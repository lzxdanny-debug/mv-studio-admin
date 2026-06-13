'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn, formatDate } from '@/lib/utils';
import { SearchBar } from '@/components/search-bar';
import { DataTable, DataTableColumn } from '@/components/data-table';
import { QueryState } from '@/components/query-state';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { useAlert, useConfirm } from '@/components/ui/dialog-provider';

interface AdminStaffRow {
  id: string;
  email: string;
  displayName: string;
  status: 'active' | 'disabled';
  roles: Array<{ id: string; code: string; name: string }>;
  roleCodes: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

interface RoleOption {
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
}

interface ListResponse {
  items: AdminStaffRow[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_META = {
  active: { label: '正常', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  disabled: { label: '已禁用', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

export default function AdminStaffPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const alert = useAlert();
  const currentId = useAdminAuthStore((s) => s.adminUser?.id);
  const isSuperAdmin = useAdminAuthStore((s) => s.roles.includes('super_admin'));

  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdminStaffRow | null>(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    roleIds: [] as string[],
  });

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: ['admin', 'admin-users', { page, pageSize, search, status }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      return apiClient.get(`/admin/admin-users?${params.toString()}`) as any;
    },
    placeholderData: (prev) => prev,
  });

  const { data: rolesData } = useQuery<{ items: RoleOption[] }>({
    queryKey: ['admin', 'roles'],
    queryFn: () => apiClient.get('/admin/roles') as any,
  });

  const roleOptions = (rolesData?.items ?? []).filter(
    (r) => isSuperAdmin || r.code !== 'super_admin',
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const body: Record<string, unknown> = {
          displayName: form.displayName || undefined,
          roleIds: form.roleIds,
        };
        if (form.password) body.password = form.password;
        return apiClient.patch(`/admin/admin-users/${editing.id}`, body);
      }
      return apiClient.post('/admin/admin-users', {
        email: form.email,
        password: form.password,
        displayName: form.displayName || undefined,
        roleIds: form.roleIds,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'admin-users'] });
      setEditorOpen(false);
      setEditing(null);
    },
    onError: async (err: any) => {
      await alert({
        title: '保存失败',
        description: err?.message ?? String(err),
        variant: 'danger',
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status: s }: { id: string; status: 'active' | 'disabled' }) =>
      apiClient.patch(`/admin/admin-users/${id}/status`, { status: s }) as any,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'admin-users'] }),
    onError: async (err: any) => {
      await alert({ title: '操作失败', description: err?.message, variant: 'danger' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/admin-users/${id}`) as any,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'admin-users'] }),
    onError: async (err: any) => {
      await alert({ title: '删除失败', description: err?.message, variant: 'danger' });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ email: '', password: '', displayName: '', roleIds: [] });
    setEditorOpen(true);
  };

  const openEdit = (row: AdminStaffRow) => {
    setEditing(row);
    setForm({
      email: row.email,
      password: '',
      displayName: row.displayName,
      roleIds: row.roles.map((r) => r.id),
    });
    setEditorOpen(true);
  };

  const toggleRole = (roleId: string) => {
    setForm((f) => ({
      ...f,
      roleIds: f.roleIds.includes(roleId)
        ? f.roleIds.filter((id) => id !== roleId)
        : [...f.roleIds, roleId],
    }));
  };

  const columns: DataTableColumn<AdminStaffRow>[] = [
    {
      key: 'email',
      header: '后台管理员',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.displayName}</p>
          <p className="text-xs text-slate-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'roles',
      header: '角色',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.roles.map((r) => (
            <span
              key={r.id}
              className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100"
            >
              {r.name}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      render: (row) => {
        const m = STATUS_META[row.status];
        return (
          <span className={cn('text-xs px-2 py-0.5 rounded-full border', m.cls)}>
            {m.label}
          </span>
        );
      },
    },
    {
      key: 'lastLogin',
      header: '最近登录',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.lastLoginAt ? formatDate(row.lastLoginAt) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center gap-1">
          <button
            onClick={() => openEdit(row)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            title="编辑"
          >
            <Pencil className="h-4 w-4" />
          </button>
          {row.id !== currentId && (
            <>
              <button
                onClick={() =>
                  statusMutation.mutate({
                    id: row.id,
                    status: row.status === 'active' ? 'disabled' : 'active',
                  })
                }
                className="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                {row.status === 'active' ? '禁用' : '启用'}
              </button>
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: `删除管理员 ${row.email}？`,
                    variant: 'danger',
                    confirmText: '删除',
                  });
                  if (ok) deleteMutation.mutate(row.id);
                }}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-purple-600" />
              后台管理员
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              与 C 端用户独立管理 · 通过角色分配后台功能权限
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-purple-600 text-white hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" />
            添加管理员
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchBar value={search} onChange={setSearch} placeholder="搜索邮箱或名称…" />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-xl border border-slate-200 text-sm bg-white"
          >
            <option value="">全部状态</option>
            <option value="active">正常</option>
            <option value="disabled">已禁用</option>
          </select>
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
          />
        </QueryState>
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditorOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">
                {editing ? '编辑管理员' : '添加管理员'}
              </h2>
              <button
                onClick={() => setEditorOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!editing && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">邮箱</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">显示名称</label>
                <input
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {editing ? '新密码（留空不修改）' : '登录密码'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">绑定角色</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-3">
                  {roleOptions.map((r) => (
                    <label
                      key={r.id}
                      className="flex items-center gap-2 text-sm p-1 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.roleIds.includes(r.id)}
                        onChange={() => toggleRole(r.id)}
                      />
                      <span className="text-slate-700">{r.name}</span>
                      <span className="text-xs text-slate-400 font-mono">{r.code}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setEditorOpen(false)}
                className="px-4 py-2 rounded-xl text-sm border border-slate-200"
              >
                取消
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={
                  saveMutation.isPending ||
                  form.roleIds.length === 0 ||
                  (!editing && (!form.email || !form.password))
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-purple-600 text-white disabled:opacity-50"
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
