'use client';

import { useQuery } from '@tanstack/react-query';
import { Database, Server } from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';

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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs font-medium text-slate-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-slate-800 font-mono break-all">{value}</span>
    </div>
  );
}

export function DatabaseSection() {
  const { data, isLoading, isError, error } = useQuery<DatabaseConfigView>({
    queryKey: ['admin', 'settings', 'database'],
    queryFn: () => apiClient.get('/admin/settings/database') as unknown as Promise<DatabaseConfigView>,
  });

  return (
    <div className="space-y-6">
      <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-48">
        {data && (
          <>
            <section>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                PostgreSQL
              </h2>
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-start gap-3 mb-4">
                  <Database className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">主数据库连接</p>
                    <p className="text-xs text-slate-400 mt-0.5">只读展示，来自 API 环境变量（DB_*）</p>
                  </div>
                </div>
                <InfoRow label="Host" value={data.postgres.host} />
                <InfoRow label="Port" value={data.postgres.port} />
                <InfoRow label="User" value={data.postgres.user || '—'} />
                <InfoRow label="Database" value={data.postgres.database || '—'} />
                <InfoRow
                  label="Password"
                  value={data.postgres.passwordConfigured ? '已配置（不展示）' : '未配置'}
                />
              </div>
            </section>

            <section>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Redis
              </h2>
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-start gap-3 mb-4">
                  <Server className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">队列 / 会话缓存</p>
                    <p className="text-xs text-slate-400 mt-0.5">只读展示，来自 API 环境变量（REDIS_*）</p>
                  </div>
                </div>
                <InfoRow label="Host" value={data.redis.host} />
                <InfoRow label="Port" value={data.redis.port} />
                <InfoRow label="DB Index" value={data.redis.db} />
                <InfoRow
                  label="Password"
                  value={data.redis.passwordConfigured ? '已配置（不展示）' : '未配置'}
                />
              </div>
            </section>

            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              {data.note}
            </p>
          </>
        )}
      </QueryState>
    </div>
  );
}
