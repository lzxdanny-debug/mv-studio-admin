'use client';

import { CreditCard } from 'lucide-react';
import { StripeConfigSection } from '../_components/stripe-config-section';

export default function AdminBillingSettingsPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-teal-600" />
            充值设置
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Stripe 密钥与 Checkout 回调地址（USD 计价，Stripe Checkout 托管页）。积分套餐、会员计划请到对应子页配置；注册/签到赠送请到「赠送积分」；计费系数与模型定价请到「定价策略」页。
          </p>
        </div>
        <StripeConfigSection />
      </div>
    </div>
  );
}
