'use client';

import { Sparkles } from 'lucide-react';
import { PlansSection } from '../../_components/plans-section';

export default function BillingMembershipEntitlementsPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-600" />
            会员权益
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            配置各会员档位的功能权益、C 端定价展示项（月度赠送、充值折扣、并发等）。
          </p>
        </div>
        <PlansSection variant="entitlements" showHeader={false} />
      </div>
    </div>
  );
}
