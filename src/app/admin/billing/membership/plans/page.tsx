'use client';

import { Crown } from 'lucide-react';
import { PlansSection } from '../../_components/plans-section';
import { PlanTransferActions } from '../../_components/plan-transfer-actions';

export default function BillingMembershipPlansPage() {
  return (
    <div className="admin-page">
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Crown className="h-5 w-5 text-blue-600" />
              会员计划
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              统一配置周付、月付、年付套餐的原价、赠送积分、Stripe Price 与关闭弹窗后的首期优惠。
            </p>
          </div>
          <PlanTransferActions />
        </div>
        <PlansSection variant="full" showHeader={false} />
      </div>
    </div>
  );
}
