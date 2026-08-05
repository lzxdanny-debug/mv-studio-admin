'use client';

import { StripeConfigSection } from '@/app/admin/billing/_components/stripe-config-section';
import { useAdminAuthStore } from '@/stores/admin-auth.store';

/** 系统设置 → 充值设置：Stripe 密钥与 Checkout 回调 */
export function BillingRechargeTab() {
  const canManageBilling = useAdminAuthStore((s) => s.hasPermission('billing.manage'));

  if (!canManageBilling) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-800">
        当前账号没有 <span className="font-mono">billing.manage</span> 权限，无法查看或修改充值设置。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">充值设置</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          配置 Stripe 密钥与 Checkout 回调地址。写入后立即生效，无需发版。
        </p>
      </div>
      <StripeConfigSection />
    </div>
  );
}
