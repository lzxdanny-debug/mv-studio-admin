'use client';

import { Crown } from 'lucide-react';
import { PlansSection } from '../../_components/plans-section';

export default function BillingMembershipPlansPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Crown className="h-5 w-5 text-teal-600" />
            会员套餐
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            配置会员订阅价格、月度赠送积分、积分充值折扣与会员购买折扣。
          </p>
        </div>
        <PlansSection variant="pricing" showHeader={false} />
      </div>
    </div>
  );
}
