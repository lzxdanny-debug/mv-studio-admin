'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, XCircle, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { PaginationBar } from '@/components/pagination-bar';
import type { CreditPackage } from './types';

const EMPTY_PACKAGE: Partial<CreditPackage> = {
  code: '',
  name: '',
  credits: 0,
  priceCents: 0,
  currency: 'usd',
  sortOrder: 0,
  isActive: true,
};

function packageBodyForSave(local: Partial<CreditPackage>): Partial<CreditPackage> {
  return {
    code: local.code,
    name: local.name,
    credits: local.credits,
    priceCents: local.priceCents,
    currency: local.currency,
    stripePriceId: local.stripePriceId,
    sortOrder: local.sortOrder,
    isActive: local.isActive,
  };
}

function saveErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (Array.isArray(msg) && msg.length > 0) return msg.join('，');
  }
  return '保存失败，请稍后再试';
}

export function PackagesSection({ showHeader = true }: { showHeader?: boolean }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Partial<CreditPackage> | null>(null);
  const [savingId, setSavingId] = useState<string | 'new' | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const { page, setPage, pageSize, onPageSizeChange } = useServerPagination();

  const { data, isLoading, isError, error } = useQuery<{
    items: CreditPackage[];
    total: number;
    page: number;
    pageSize: number;
  }>({
    queryKey: ['admin', 'billing', 'packages', page],
    queryFn: () =>
      apiClient.get(`/admin/billing/packages?page=${page}&pageSize=${pageSize}`) as any,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['admin', 'billing', 'packages'] });

  const create = useMutation({
    mutationFn: (body: Partial<CreditPackage>) =>
      apiClient.post('/admin/billing/packages', packageBodyForSave(body)) as any,
    onMutate: () => setSavingId('new'),
    onSuccess: () => {
      setDraft(null);
      setToast({ ok: true, text: '充值套餐已创建' });
      invalidate();
    },
    onError: (e) => setToast({ ok: false, text: saveErrorMessage(e) }),
    onSettled: () => setSavingId(null),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CreditPackage> }) =>
      apiClient.patch(`/admin/billing/packages/${id}`, packageBodyForSave(body)) as any,
    onMutate: ({ id }) => setSavingId(id),
    onSuccess: () => {
      setToast({ ok: true, text: '已保存' });
      invalidate();
    },
    onError: (e) => setToast({ ok: false, text: saveErrorMessage(e) }),
    onSettled: () => setSavingId(null),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admin/billing/packages/${id}`) as any,
    onSuccess: () => {
      setToast({ ok: true, text: '已删除' });
      invalidate();
    },
    onError: (e) => setToast({ ok: false, text: saveErrorMessage(e) }),
  });

  return (
    <section>
      <div className={cn('mb-3', showHeader ? 'flex items-center justify-between' : 'flex justify-end')}>
        {showHeader && (
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            充值套餐
          </h2>
        )}
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY_PACKAGE })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium"
        >
          <Plus className="h-3.5 w-3.5" /> 新建套餐
        </button>
      </div>
      {toast && (
        <p
          className={cn(
            'text-xs font-medium mb-3',
            toast.ok ? 'text-emerald-600' : 'text-red-500',
          )}
        >
          {toast.text}
        </p>
      )}
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-32">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wider">
                <th className="text-left px-3 py-2 font-medium">Code</th>
                <th className="text-left px-3 py-2 font-medium">名称</th>
                <th className="text-right px-3 py-2 font-medium">积分</th>
                <th className="text-right px-3 py-2 font-medium">价格(USD)</th>
                <th className="text-center px-3 py-2 font-medium">排序</th>
                <th className="text-center px-3 py-2 font-medium">启用</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {draft && (
                <PackageRow
                  pkg={draft}
                  isNew
                  saving={savingId === 'new'}
                  onChange={setDraft}
                  onSave={() => create.mutate(draft)}
                  onCancel={() => setDraft(null)}
                />
              )}
              {(data?.items ?? []).map((pkg) => (
                <PackageRow
                  key={pkg.id}
                  pkg={pkg}
                  saving={savingId === pkg.id}
                  onSave={(body) => update.mutate({ id: pkg.id, body })}
                  onDelete={() => remove.mutate(pkg.id)}
                />
              ))}
              {(data?.items ?? []).length === 0 && !draft && (
                <tr>
                  <td colSpan={7} className="text-center text-xs text-slate-400 py-6">
                    暂无套餐
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {data && (
            <PaginationBar
              page={page}
              pageSize={pageSize}
              total={data.total}
              onPageChange={setPage}
              onPageSizeChange={onPageSizeChange}
            />
          )}
        </div>
      </QueryState>
    </section>
  );
}

function PackageRow({
  pkg,
  isNew,
  saving,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  pkg: Partial<CreditPackage>;
  isNew?: boolean;
  saving?: boolean;
  onChange?: (p: Partial<CreditPackage>) => void;
  onSave: (body: Partial<CreditPackage>) => void;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  const [local, setLocal] = useState<Partial<CreditPackage>>(pkg);
  useEffect(() => setLocal(pkg), [pkg]);

  const dirty =
    JSON.stringify(packageBodyForSave(local)) !== JSON.stringify(packageBodyForSave(pkg));

  const patch = (p: Partial<CreditPackage>) => {
    const next = { ...local, ...p };
    setLocal(next);
    onChange?.(next);
  };

  const cellInput =
    'w-full px-2 py-1 text-sm border border-transparent hover:border-slate-200 focus:border-teal-400 rounded focus:outline-none bg-transparent';

  return (
    <tr className={cn(isNew && 'bg-teal-50/40')}>
      <td className="px-3 py-1.5">
        <input
          className={cellInput}
          value={local.code ?? ''}
          placeholder="pkg_xxx"
          disabled={!isNew}
          onChange={(e) => patch({ code: e.target.value })}
        />
      </td>
      <td className="px-3 py-1.5">
        <input className={cellInput} value={local.name ?? ''} onChange={(e) => patch({ name: e.target.value })} />
      </td>
      <td className="px-3 py-1.5 text-right">
        <input
          type="number"
          min={0}
          className={cn(cellInput, 'text-right')}
          value={local.credits ?? 0}
          onChange={(e) => patch({ credits: Number(e.target.value) })}
        />
      </td>
      <td className="px-3 py-1.5 text-right">
        <input
          type="number"
          step="0.01"
          min={0}
          className={cn(cellInput, 'text-right')}
          value={((local.priceCents ?? 0) / 100).toString()}
          onChange={(e) => patch({ priceCents: Math.round(Number(e.target.value) * 100) })}
        />
      </td>
      <td className="px-3 py-1.5 text-center">
        <input
          type="number"
          className={cn(cellInput, 'text-center w-14')}
          value={local.sortOrder ?? 0}
          onChange={(e) => patch({ sortOrder: Number(e.target.value) })}
        />
      </td>
      <td className="px-3 py-1.5 text-center">
        <input
          type="checkbox"
          checked={local.isActive ?? true}
          onChange={(e) => patch({ isActive: e.target.checked })}
          className="accent-teal-600"
        />
      </td>
      <td className="px-3 py-1.5">
        <div className="flex items-center justify-end gap-1">
          {isNew ? (
            <>
              <button
                type="button"
                onClick={() => onSave(local)}
                disabled={saving}
                className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                title="保存"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={onCancel} className="p-1.5 rounded text-slate-400 hover:bg-slate-100" title="取消">
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onSave(local)}
                disabled={saving || !dirty}
                className="p-1.5 rounded text-teal-600 hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title={dirty ? '保存' : '已保存'}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 rounded text-red-500 hover:bg-red-50"
                title="删除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
