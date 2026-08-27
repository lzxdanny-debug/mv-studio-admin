'use client';

import { Route } from 'lucide-react';
import { AimvModelConfig } from '@/components/aimv-model-config';

export default function AimvModelsPage() {
  return <div className="flex h-full min-h-0 flex-col">
    <header className="border-b border-slate-200 bg-white px-6 py-5">
      <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Route className="h-5 w-5 text-violet-600" />AI MV 模型配置</h1>
      <p className="mt-1 text-sm text-slate-500">配置用户可见的一级模型，以及该模型实际调用渠道的优先级和失败降级顺序。</p>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-6"><AimvModelConfig /></main>
  </div>;
}
