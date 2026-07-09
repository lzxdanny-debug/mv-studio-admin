'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { useAlert, useConfirm } from '@/components/ui/dialog-provider';

interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount?: number;
  permissionCodes: string[];
  createdAt: string;
}

interface PermissionItem {
  code: string;
  name: string;
  module: string;
  description: string | null;
}

const MODULE_LABELS: Record<string, string> = {
  admin: '管理员',
  user: '用户',
  project: 'MV 项目',
  asset: '素材',
  generation: '生成任务',
  credit: '积分',
  payment: '支付',
  billing: '计费',
  provider: 'AI Provider',
  system: '系统',
  risk: '风控',
  dashboard: '仪表盘',
  music: '音乐',
  tools: '工具',
  feedback: '反馈',
  ai: 'AI 路由',
  logs: '日志',
};

export default function AdminRolesPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const alert = useAlert();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    permissionCodes: [] as string[],
  });

  const { data, isLoading, isError, error } = useQuery<{ items: RoleRow[] }>({
    queryKey: ['admin', 'roles'],
    queryFn: () => apiClient.get('/admin/roles') as any,
  });

  const { data: permData } = useQuery<{
    items: PermissionItem[];
    byModule: Record<string, PermissionItem[]>;
  }>({
    queryKey: ['admin', 'permissions'],
    queryFn: () => apiClient.get('/admin/permissions') as any,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return apiClient.patch(`/admin/roles/${editing.id}`, {
          name: form.name,
          description: form.description || undefined,
          permissionCodes: form.permissionCodes,
        });
      }
      return apiClient.post('/admin/roles', {
        code: form.code,
        name: form.name,
        description: form.description || undefined,
        permissionCodes: form.permissionCodes,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'roles'] });
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/roles/${id}`) as any,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'roles'] }),
    onError: async (err: any) => {
      await alert({
        title: '删除失败',
        description: err?.message ?? String(err),
        variant: 'danger',
      });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', description: '', permissionCodes: [] });
    setEditorOpen(true);
  };

  const openEdit = (role: RoleRow) => {
    if (role.code === 'super_admin') return;
    setEditing(role);
    setForm({
      code: role.code,
      name: role.name,
      description: role.description ?? '',
      permissionCodes: role.permissionCodes.includes('*') ? [] : [...role.permissionCodes],
    });
    setEditorOpen(true);
  };

  const togglePerm = (code: string) => {
    setForm((f) => ({
      ...f,
      permissionCodes: f.permissionCodes.includes(code)
        ? f.permissionCodes.filter((c) => c !== code)
        : [...f.permissionCodes, code],
    }));
  };

  const modules = useMemo(
    () => Object.entries(permData?.byModule ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    [permData],
  );

  return (
    <div className="admin-page">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              角色权限
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              创建角色并勾选权限点，再将角色分配给管理员账号
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            新建角色
          </button>
        </div>

        <QueryState isLoading={isLoading} isError={isError} error={error} height="h-48">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">角色</th>
                  <th className="px-4 py-3 font-medium">权限数</th>
                  <th className="px-4 py-3 font-medium">管理员</th>
                  <th className="px-4 py-3 font-medium">类型</th>
                  <th className="px-4 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((role) => (
                  <tr key={role.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{role.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{role.code}</p>
                      {role.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{role.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {role.permissionCodes.includes('*') ? '全部' : role.permissionCodes.length}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{role.userCount ?? 0}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full border',
                          role.isSystem
                            ? 'bg-blue-50 text-blue-700 border-blue-100'
                            : 'bg-slate-50 text-slate-600 border-slate-200',
                        )}
                      >
                        {role.isSystem ? '系统' : '自定义'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {role.code !== 'super_admin' && (
                          <button
                            onClick={() => openEdit(role)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                            title="编辑"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {!role.isSystem && (role.userCount ?? 0) === 0 && (
                          <button
                            onClick={async () => {
                              const ok = await confirm({
                                title: `删除角色「${role.name}」？`,
                                variant: 'danger',
                                confirmText: '删除',
                              });
                              if (ok) deleteMutation.mutate(role.id);
                            }}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueryState>
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditorOpen(false)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">
                {editing ? `编辑角色：${editing.name}` : '新建角色'}
              </h2>
              <button
                onClick={() => setEditorOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!editing && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">角色 code</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="例如 custom_finance"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">小写字母、数字、下划线，创建后不可改</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">显示名称</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">说明</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">
                  权限点（已选 {form.permissionCodes.length} 项）
                </p>
                <div className="space-y-4 max-h-64 overflow-y-auto border border-slate-200 rounded-xl p-3">
                  {modules.map(([mod, perms]) => (
                    <div key={mod}>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase mb-1.5">
                        {MODULE_LABELS[mod] ?? mod}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {perms.map((p) => (
                          <label
                            key={p.code}
                            className="flex items-start gap-2 text-xs p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={form.permissionCodes.includes(p.code)}
                              onChange={() => togglePerm(p.code)}
                              className="mt-0.5"
                            />
                            <span>
                              <span className="font-medium text-slate-700">{p.name}</span>
                              <span className="block text-slate-400 font-mono text-[10px]">
                                {p.code}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setEditorOpen(false)}
                className="px-4 py-2 rounded-xl text-sm border border-slate-200 text-slate-600"
              >
                取消
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.name.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 text-white disabled:opacity-50"
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
