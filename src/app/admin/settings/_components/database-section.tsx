'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { FormField } from '@/components/ui/form-field';

interface DatabaseConfigView {
  postgres: {
    host: string;
    port: string;
    user: string;
    database: string;
    passwordConfigured: boolean;
  };
  redis: {
    host: string;
    port: string;
    db: string;
    passwordConfigured: boolean;
  };
  source: 'env';
  note: string;
}

function ReadonlyValue({ value }: { value: string }) {
  return (
    <span className="w-full truncate text-right font-mono text-xs text-slate-800" title={value}>
      {value}
    </span>
  );
}

export function DatabaseSection() {
  const { data, isLoading, isError, error } = useQuery<DatabaseConfigView>({
    queryKey: ['admin', 'settings', 'database'],
    queryFn: () => apiClient.get('/admin/settings/database') as unknown as Promise<DatabaseConfigView>,
  });

  return (
    <div className="space-y-4">
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
        {data && (
          <>
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4">
              <p className="text-base font-semibold text-slate-900">数据库连接（只读）</p>
              <p className="mt-1 text-sm text-slate-600">{data.note}</p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  PostgreSQL · DB_*
                </h2>
              </div>
              <div className="divide-y divide-slate-100 px-5 py-2">
                <FormField label="Host" description="主数据库主机。">
                  <ReadonlyValue value={data.postgres.host} />
                </FormField>
                <FormField label="Port" description="连接端口。">
                  <ReadonlyValue value={data.postgres.port} />
                </FormField>
                <FormField label="User" description="数据库用户。">
                  <ReadonlyValue value={data.postgres.user || '—'} />
                </FormField>
                <FormField label="Database" description="库名。">
                  <ReadonlyValue value={data.postgres.database || '—'} />
                </FormField>
                <FormField label="Password" description="密钥不展示明文。">
                  <ReadonlyValue
                    value={data.postgres.passwordConfigured ? '已配置（不展示）' : '未配置'}
                  />
                </FormField>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Redis · REDIS_*
                </h2>
              </div>
              <div className="divide-y divide-slate-100 px-5 py-2">
                <FormField label="Host" description="队列 / 会话缓存主机。">
                  <ReadonlyValue value={data.redis.host} />
                </FormField>
                <FormField label="Port" description="连接端口。">
                  <ReadonlyValue value={data.redis.port} />
                </FormField>
                <FormField label="DB Index" description="Redis 逻辑库编号。">
                  <ReadonlyValue value={data.redis.db} />
                </FormField>
                <FormField label="Password" description="密钥不展示明文。">
                  <ReadonlyValue
                    value={data.redis.passwordConfigured ? '已配置（不展示）' : '未配置'}
                  />
                </FormField>
              </div>
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}
