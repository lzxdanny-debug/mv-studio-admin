'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Sparkles, Upload } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAlert, useConfirm } from '@/components/ui/dialog-provider';
import { PlansSection } from '../../_components/plans-section';
import type { PlanEntitlement } from '../../_components/types';

type PlansExportPayload = {
  version?: number;
  kind?: string;
  exportedAt?: string;
  plans?: Partial<PlanEntitlement>[];
};

type PlansImportResult = {
  ok: boolean;
  deleted: number;
  written: number;
  planCodes: string[];
};

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (Array.isArray(msg) && msg.length > 0) return msg.join('，');
  }
  return '导入失败，请检查 JSON 格式后重试';
}

export default function BillingMembershipEntitlementsPage() {
  const qc = useQueryClient();
  const alert = useAlert();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  const exportMut = useMutation({
    mutationFn: () =>
      apiClient.get('/admin/billing/plans/export') as Promise<PlansExportPayload>,
    onMutate: () => setBusy('export'),
    onSuccess: (data) => {
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(`plan-entitlements-${date}.json`, data);
      void alert({
        title: '已导出',
        description: `共 ${(data.plans ?? []).length} 个会员计划`,
        variant: 'success',
      });
    },
    onError: (err) =>
      void alert({
        title: '导出失败',
        description: importErrorMessage(err),
        variant: 'danger',
      }),
    onSettled: () => setBusy(null),
  });

  const importMut = useMutation({
    mutationFn: (plans: Partial<PlanEntitlement>[]) =>
      apiClient.put('/admin/billing/plans/import', { plans }) as Promise<PlansImportResult>,
    onMutate: () => setBusy('import'),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ['admin', 'billing', 'plans'] });
      await qc.invalidateQueries({ queryKey: ['billing', 'public-plans'] });
      await alert({
        title: '导入完成（完全覆盖）',
        description: `已删除 ${result.deleted} 条，写入 ${result.written} 条：${result.planCodes.join('、')}`,
        variant: 'success',
      });
    },
    onError: (err) =>
      void alert({
        title: '导入失败',
        description: importErrorMessage(err),
        variant: 'danger',
      }),
    onSettled: () => setBusy(null),
  });

  const handleImportFile = async (file: File) => {
    let parsed: PlansExportPayload | Partial<PlanEntitlement>[];
    try {
      parsed = JSON.parse(await file.text()) as PlansExportPayload | Partial<PlanEntitlement>[];
    } catch {
      await alert({
        title: '导入失败',
        description: '无法解析 JSON 文件',
        variant: 'danger',
      });
      return;
    }

    const plans = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.plans)
        ? parsed.plans
        : null;
    if (!plans || plans.length === 0) {
      await alert({
        title: '导入失败',
        description: 'JSON 中未找到非空 plans 数组',
        variant: 'danger',
      });
      return;
    }

    const ok = await confirm({
      title: '完全覆盖导入？',
      description: `将清空当前全部会员计划，再写入导入文件中的 ${plans.length} 条配置。此操作不可撤销，请确认已备份。`,
      variant: 'danger',
      confirmText: '完全覆盖',
    });
    if (!ok) return;
    importMut.mutate(plans);
  };

  return (
    <div className="admin-page">
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              会员权益
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              配置各会员档位的功能权益、C 端定价展示项（月度赠送、积分充值折扣、会员购买折扣、并发等）。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportMut.mutate()}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {busy === 'export' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              导出配置
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy !== null}
              title="导入将完全覆盖当前全部会员计划"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-50"
            >
              {busy === 'import' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              导入配置（完全覆盖）
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void handleImportFile(file);
              }}
            />
          </div>
        </div>
        <PlansSection variant="entitlements" showHeader={false} />
      </div>
    </div>
  );
}
