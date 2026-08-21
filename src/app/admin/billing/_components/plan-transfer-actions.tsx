'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Upload } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAlert, useConfirm } from '@/components/ui/dialog-provider';
import type { PlanEntitlement } from './types';

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

type PlansImportPreview = {
  added: string[];
  changed: string[];
  unchanged: string[];
  removed: string[];
  activeSubscriptionsAffected: number;
  activeSubscriptionsByPlan: Record<string, number>;
  missingActivePlanCodes: string[];
};

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
    if (Array.isArray(message) && message.length > 0) return message.join('，');
  }
  return '操作失败，请检查配置文件后重试';
}

/** 会员计划是一个完整业务对象，导入导出统一放在会员计划页。 */
export function PlanTransferActions() {
  const qc = useQueryClient();
  const alert = useAlert();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  const exportPlans = useMutation({
    mutationFn: () =>
      apiClient.get('/admin/billing/plans/export') as Promise<PlansExportPayload>,
    onMutate: () => setBusy('export'),
    onSuccess: (data) => {
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(`membership-plans-${date}.json`, data);
      void alert({
        title: '已导出',
        description: `共 ${(data.plans ?? []).length} 个会员计划`,
        variant: 'success',
      });
    },
    onError: (err) =>
      void alert({ title: '导出失败', description: errorMessage(err), variant: 'danger' }),
    onSettled: () => setBusy(null),
  });

  const importPlans = useMutation({
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
      void alert({ title: '导入失败', description: errorMessage(err), variant: 'danger' }),
    onSettled: () => setBusy(null),
  });

  const handleFile = async (file: File) => {
    let parsed: PlansExportPayload | Partial<PlanEntitlement>[];
    try {
      parsed = JSON.parse(await file.text()) as PlansExportPayload | Partial<PlanEntitlement>[];
    } catch {
      await alert({ title: '导入失败', description: '无法解析 JSON 文件', variant: 'danger' });
      return;
    }

    const plans = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.plans)
        ? parsed.plans
        : null;
    if (!plans?.length) {
      await alert({
        title: '导入失败',
        description: 'JSON 中未找到非空 plans 数组',
        variant: 'danger',
      });
      return;
    }

    setBusy('import');
    try {
      const [preview, current] = await Promise.all([
        apiClient.post('/admin/billing/plans/import/preview', { plans }) as Promise<PlansImportPreview>,
        apiClient.get('/admin/billing/plans/export') as Promise<PlansExportPayload>,
      ]);
      if (preview.missingActivePlanCodes.length > 0) {
        await alert({
          title: '无法导入：会导致存量订阅失去计划',
          description: `文件缺少仍有生效订阅的计划：${preview.missingActivePlanCodes.join('、')}。请先补齐这些 planCode。`,
          variant: 'danger',
        });
        setBusy(null);
        return;
      }
      const impacted = Object.entries(preview.activeSubscriptionsByPlan)
        .filter(([code, count]) => preview.changed.includes(code) && count > 0)
        .map(([code, count]) => `${code} ${count} 人`)
        .join('、');
      const approved = await confirm({
        title: '确认按差异完全覆盖？',
        description: [
          `新增 ${preview.added.length} 个，修改 ${preview.changed.length} 个，无变化 ${preview.unchanged.length} 个，删除 ${preview.removed.length} 个。`,
          preview.changed.length ? `修改：${preview.changed.join('、')}。` : '',
          preview.removed.length ? `删除：${preview.removed.join('、')}。` : '',
          preview.activeSubscriptionsAffected > 0
            ? `其中 ${preview.activeSubscriptionsAffected} 个生效订阅会立即读取新权益${impacted ? `（${impacted}）` : ''}；已承诺的周期积分仍使用订阅快照。`
            : '没有生效订阅会受本次修改或删除影响。',
          '确认后会先自动下载当前配置备份，再执行覆盖；如需回滚，可重新导入该备份文件。',
        ].filter(Boolean).join('\n'),
        variant: 'danger',
        confirmText: '备份并完全覆盖',
      });
      if (!approved) {
        setBusy(null);
        return;
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadJson(`membership-plans-before-import-${timestamp}.json`, current);
      importPlans.mutate(plans);
    } catch (err) {
      setBusy(null);
      await alert({
        title: '差异预览失败，未执行导入',
        description: errorMessage(err),
        variant: 'danger',
      });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => exportPlans.mutate()}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
      >
        {busy === 'export' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        导出配置
      </button>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy !== null}
        title="导入将完全覆盖当前全部会员计划"
        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-50"
      >
        {busy === 'import' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        导入配置（完全覆盖）
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
