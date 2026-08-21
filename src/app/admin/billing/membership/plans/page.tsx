'use client';

import { Crown } from 'lucide-react';
import { PlansSection } from '../../_components/plans-section';
import { PlanTransferActions } from '../../_components/plan-transfer-actions';
import { MembershipBenefitsSection } from '../../_components/membership-benefits-section';

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
              在一个入口统一配置订阅价格、赠送积分、MV 创作权益、合成产能与 Stripe 价格。周 / 月 / 年三档权益相同，在下方共用开关里统一取消。
            </p>
          </div>
          <PlanTransferActions />
        </div>
        <MembershipBenefitsSection />
        <PlansSection variant="full" showHeader={false} />
      </div>
    </div>
  );
}
