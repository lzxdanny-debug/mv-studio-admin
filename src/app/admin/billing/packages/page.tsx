'use client';

import { ShoppingBag } from 'lucide-react';
import { PackagesSection } from '../_components/packages-section';

export default function BillingPackagesPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-purple-600" />
            积分套餐
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            配置一次性积分充值套餐（USD 计价，Stripe Price 关联）。
          </p>
        </div>
        <PackagesSection showHeader={false} />
      </div>
    </div>
  );
}
