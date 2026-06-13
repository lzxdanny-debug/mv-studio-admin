'use client';

import { ShieldOff } from 'lucide-react';

export function ForbiddenPanel({
  title = '无权访问',
  description = '当前账号没有访问此页面的权限。如需开通，请联系超级管理员。',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <ShieldOff className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-2">{description}</p>
      </div>
    </div>
  );
}
