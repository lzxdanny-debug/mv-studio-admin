'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Film, ExternalLink, Info } from 'lucide-react';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';

interface EngineRoute {
  engine: string;
  capability: string;
  capabilityLabel: string;
  primary: { provider: string; model: string };
  secondary: { provider: string; model: string } | null;
}

interface ModelConfigView {
  engineRouting?: { standard: EngineRoute; ultron: EngineRoute };
}

const PROVIDER_LABEL: Record<string, string> = {
  cloudflare: 'Cloudflare',
  fal: 'Fal.ai',
  mountsea: 'Mountsea',
};

function ChannelCard({
  title,
  badge,
  badgeClass,
  desc,
  route,
}: {
  title: string;
  badge: string;
  badgeClass: string;
  desc: string;
  route?: EngineRoute;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${badgeClass}`}>
          {badge}
        </span>
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
      {route ? (
        <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 text-[11px] leading-relaxed space-y-0.5">
          <p className="text-slate-400">实际渠道（来自 AI 路由配置 · {route.capabilityLabel}）</p>
          <p className="text-slate-600 font-mono">
            主 · {PROVIDER_LABEL[route.primary.provider] ?? route.primary.provider} ·{' '}
            {route.primary.model || '默认'}
          </p>
          {route.secondary && (
            <p className="text-slate-400 font-mono">
              兜 · {PROVIDER_LABEL[route.secondary.provider] ?? route.secondary.provider} ·{' '}
              {route.secondary.model || '默认'}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-300">—</p>
      )}
    </div>
  );
}

export default function ModelConfigPage() {
  const { data, isLoading, isError, error } = useQuery<ModelConfigView>({
    queryKey: ['admin', 'billing', 'model-config'],
    queryFn: () => apiClient.get('/admin/billing/model-config') as any,
  });

  return (
    <div className="admin-page">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="h-5 w-5 text-blue-600" />
            MV 模型配置
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            视频生成引擎已全部由「AI 路由配置」决定，本页仅只读展示各品质当前生效的实际渠道。
            标准模式走「单图模式（videoSingleRef）」，Ultron 走「videoUltron」。
          </p>
        </div>

        {/* 职责说明 */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-slate-600 leading-relaxed flex gap-2">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <div>
            视频引擎（含主/备 provider、模型、容错降级）统一在
            <Link
              href="/admin/ai-routing"
              className="inline-flex items-center gap-0.5 mx-1 text-blue-600 hover:underline font-medium"
            >
              AI 路由配置
              <ExternalLink className="h-3 w-3" />
            </Link>
            管理。清晰度与品质的每秒价在
            <Link
              href="/admin/billing/step-prices"
              className="inline-flex items-center gap-0.5 mx-1 text-blue-600 hover:underline font-medium"
            >
              步骤价格
              <ExternalLink className="h-3 w-3" />
            </Link>
            按「清晰度 × 品质」逐格设置。
          </div>
        </div>

        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={false}
          height="h-48"
        >
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Film className="h-3.5 w-3.5" />
              视频引擎路由总览（只读）
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ChannelCard
                title="标准模式（单图模式）"
                badge="标准"
                badgeClass="bg-slate-100 text-slate-600"
                desc="普通会员 / 标准品质镜头：走单图参考（videoSingleRef）路由。"
                route={data?.engineRouting?.standard}
              />
              <ChannelCard
                title="Ultron 高质量"
                badge="Ultron"
                badgeClass="bg-blue-100 text-blue-700"
                desc="Ultron 品质镜头：走 videoUltron 路由（高质量模型，主/备直配）。"
                route={data?.engineRouting?.ultron}
              />
            </div>
            <p className="text-xs text-slate-400 mt-3">
              如需调整引擎或模型，请前往
              <Link
                href="/admin/ai-routing"
                className="inline-flex items-center gap-0.5 mx-1 text-blue-600 hover:underline font-medium"
              >
                AI 路由配置 · 视频生成
                <ExternalLink className="h-3 w-3" />
              </Link>
              。
            </p>
          </section>
        </QueryState>
      </div>
    </div>
  );
}
