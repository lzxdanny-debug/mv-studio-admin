'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { useAlert } from '@/components/ui/dialog-provider';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import {
  usd,
  TYPE_LABEL,
  PAYMENT_STATUS_META,
  REFUND_STATUS_META,
  METHOD_LABEL,
  RISK_META,
} from '../../_lib/format';

interface RefundRow {
  id: string;
  providerRefundId: string | null;
  amountCents: number;
  currency: string;
  creditsReversed: number;
  reason: string | null;
  status: string;
  createdAt: string;
}

interface PaymentDetail {
  id: string;
  user: {
    id: string | null;
    email: string | null;
    displayName: string | null;
    stripeCustomerId: string | null;
  };
  type: string;
  status: string;
  rawStatus: string;
  manualStatus: string | null;
  manualStatusNote: string | null;
  manualStatusUpdatedAt: string | null;
  isValid: boolean;
  amountCents: number;
  listAmountCents: number | null;
  discountAmountCents: number;
  discountCode: string | null;
  presentmentAmountCents: number | null;
  presentmentCurrency: string | null;
  refundedCents: number;
  netCents: number;
  currency: string;
  creditAmount: number | null;
  committedCredits: number;
  grantedCredits: number;
  pendingCredits: number;
  usedCredits: number;
  availableCredits: number;
  balanceBefore: number | null;
  balanceAfter: number | null;
  packageCode: string | null;
  planCode: string | null;
  country: string | null;
  paymentMethod: string | null;
  riskLevel: string | null;
  disputeStatus: 'none' | 'open' | 'won' | 'lost';
  providerDisputeId: string | null;
  disputedAt: string | null;
  disputeResolvedAt: string | null;
  attributionSnapshot: Record<string, unknown> | null;
  provider: string;
  providerPaymentId: string | null;
  providerSessionId: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  refunds: RefundRow[];
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-800 text-right break-all">{children}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="admin-card p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-2">{title}</h3>
      {children}
    </div>
  );
}

const mono = 'font-mono text-xs text-slate-600';

function ManualStatusCard({ data }: { data: PaymentDetail }) {
  const qc = useQueryClient();
  const alert = useAlert();
  const canManage = useAdminAuthStore((s) => s.hasPermission('billing.manage'));
  const [status, setStatus] = useState(data.manualStatus ?? '');
  const [note, setNote] = useState(data.manualStatusNote ?? '');
  const save = useMutation({
    mutationFn: () => apiClient.patch(`/admin/billing/payments/${data.id}/status`, {
      status: status || null,
      note: note || undefined,
    }) as any,
    onSuccess: async (result: any) => {
      setStatus(result.manualStatus ?? '');
      await qc.invalidateQueries({ queryKey: ['admin', 'billing', 'payment', data.id] });
      await qc.invalidateQueries({ queryKey: ['admin', 'billing', 'payments'] });
      await alert({ title: '订单状态已更新', description: '本次操作仅更新运营标记，不会触发 Stripe 退款。' });
    },
    onError: async (error: any) => {
      await alert({ title: '更新失败', description: error?.message ?? String(error), variant: 'danger' });
    },
  });

  return (
    <Card title="运营状态设置">
      <p className="mb-3 text-xs text-slate-500">
        全额退款、部分退款和 CB 由运营人工设置；过期由系统根据订单有效期自动判断。
      </p>
      <div className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
        <select
          value={status}
          disabled={!canManage || save.isPending}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:bg-slate-50"
        >
          <option value="">系统自动判断</option>
          <option value="refunded">全额退款</option>
          <option value="partially_refunded">部分退款</option>
          <option value="chargeback">CB</option>
        </select>
        <input
          value={note}
          disabled={!canManage || save.isPending}
          onChange={(event) => setNote(event.target.value)}
          placeholder="运营备注（可选）"
          maxLength={1000}
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 disabled:bg-slate-50"
        />
        <button
          type="button"
          disabled={!canManage || save.isPending}
          onClick={() => save.mutate()}
          className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {save.isPending ? '保存中…' : '保存状态'}
        </button>
      </div>
      {!canManage && <p className="mt-2 text-xs text-amber-600">当前账号没有订单状态管理权限。</p>}
    </Card>
  );
}

export default function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data, isLoading, isError, error } = useQuery<PaymentDetail>({
    queryKey: ['admin', 'billing', 'payment', id],
    queryFn: () => apiClient.get(`/admin/billing/payments/${id}`) as any,
  });

  return (
    <div className="admin-page">
      <div className="admin-page-inner">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/billing/payments"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            返回充值记录
          </Link>
          <h1 className="text-lg font-bold text-slate-900">支付详情</h1>
        </div>

        <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={false} height="h-96">
          {data && (
            <div className="space-y-4">
              <div className="admin-card p-5 flex flex-wrap items-center gap-x-8 gap-y-3">
                <div>
                  <p className="text-xs text-slate-500">实付金额</p>
                  <p className="text-2xl font-bold text-slate-900">{usd(data.amountCents)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">原价 / 优惠</p>
                  <p className="mt-1 text-sm text-slate-700"><span className="text-slate-400 line-through">{usd(data.listAmountCents ?? data.amountCents)}</span><span className="ml-2 text-emerald-700">-{usd(data.discountAmountCents)}</span></p>
                  {data.discountCode && <p className="mt-1 text-xs text-slate-400">{data.discountCode}</p>}
                </div>
                <div>
                  <p className="text-xs text-slate-500">实得（净）</p>
                  <p className="text-2xl font-bold text-emerald-700">{usd(data.netCents)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">类型</p>
                  <p className="text-sm font-medium text-slate-800 mt-1">
                    {TYPE_LABEL[data.type] ?? data.type}
                    {(data.packageCode || data.planCode) && (
                      <span className="text-slate-400 ml-1">{data.packageCode ?? data.planCode}</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">状态</p>
                  <span
                    className={cn(
                      'inline-flex mt-1 px-2 py-0.5 rounded-md text-xs border',
                      PAYMENT_STATUS_META[data.status]?.cls ?? 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {PAYMENT_STATUS_META[data.status]?.label ?? data.status}
                  </span>
                  <p className={cn('mt-1 text-xs font-medium', data.isValid ? 'text-emerald-600' : 'text-red-600')}>
                    {data.isValid ? '订单有效' : '订单无效'}
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-slate-500">支付时间</p>
                  <p className="text-sm text-slate-700 mt-1">
                    {data.paidAt ? formatDate(data.paidAt) : '—'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="用户与积分">
                  <Row label="用户">
                    {data.user.id ? (
                      <Link href={`/admin/users/${data.user.id}`} className="text-blue-700 hover:underline">
                        {data.user.displayName || data.user.email || data.user.id.slice(0, 8)}
                      </Link>
                    ) : (
                      data.user.email || '游客订单'
                    )}
                  </Row>
                  <Row label="邮箱">{data.user.email ?? '—'}</Row>
                  <Row label="发放积分">
                    {data.creditAmount != null ? (
                      <span className="text-amber-600 font-medium">+{data.creditAmount}</span>
                    ) : (
                      '—'
                    )}
                  </Row>
                  <Row label="承诺总积分">{data.committedCredits.toLocaleString()}</Row>
                  <Row label="已发放积分">{data.grantedCredits.toLocaleString()}</Row>
                  <Row label="待发放积分">{data.pendingCredits.toLocaleString()}</Row>
                  <Row label="已使用积分">{data.usedCredits.toLocaleString()}</Row>
                  <Row label="可用剩余积分">{data.availableCredits.toLocaleString()}</Row>
                  <Row label="充值前余额">{data.balanceBefore ?? '—'}</Row>
                  <Row label="充值后余额">{data.balanceAfter ?? '—'}</Row>
                </Card>

                <Card title="渠道与风控">
                  <Row label="支付方式">
                    {data.paymentMethod
                      ? METHOD_LABEL[data.paymentMethod] ?? data.paymentMethod
                      : '—'}
                  </Row>
                  <Row label="国家">{data.country ? data.country.toUpperCase() : '—'}</Row>
                  <Row label="风险等级">
                    {data.riskLevel ? (
                      <span className={RISK_META[data.riskLevel]?.cls ?? 'text-slate-600'}>
                        {RISK_META[data.riskLevel]?.label ?? data.riskLevel}
                      </span>
                    ) : (
                      '—'
                    )}
                  </Row>
                  <Row label="已退金额">
                    {data.refundedCents > 0 ? (
                      <span className="text-red-600">-{usd(data.refundedCents)}</span>
                    ) : (
                      '—'
                    )}
                  </Row>
                  <Row label="订单有效期">
                    {data.expiresAt ? formatDate(data.expiresAt) : '长期有效'}
                  </Row>
                  <Row label="展示币种">
                    {data.presentmentAmountCents != null && data.presentmentCurrency
                      ? `${(data.presentmentAmountCents / 100).toFixed(2)} ${data.presentmentCurrency.toUpperCase()}`
                      : data.currency.toUpperCase()}
                  </Row>
                  <Row label="争议状态">
                    {data.disputeStatus === 'open' ? '争议中' : data.disputeStatus === 'won' ? '胜诉' : data.disputeStatus === 'lost' ? '败诉' : '无争议'}
                  </Row>
                  {data.providerDisputeId && <Row label="Stripe 争议 ID"><span className={mono}>{data.providerDisputeId}</span></Row>}
                </Card>
              </div>

              <ManualStatusCard data={data} />

              <details className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                  订单归因快照 <span className="ml-2 text-xs font-normal text-blue-600 group-open:hidden">点击查看详情</span><span className="ml-2 hidden text-xs font-normal text-blue-600 group-open:inline">点击收起</span>
                </summary>
                <div className="border-t border-slate-100 p-5">
                  {data.attributionSnapshot ? <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(data.attributionSnapshot, null, 2)}</pre> : <p className="text-xs text-slate-400">该订单暂无归因快照。</p>}
                </div>
              </details>

              <Card title="Stripe 标识">
                <Row label="Provider">{data.provider}</Row>
                <Row label="Customer ID">
                  <span className={mono}>{data.user.stripeCustomerId ?? '—'}</span>
                </Row>
                <Row label="Payment / Invoice ID">
                  <span className={mono}>{data.providerPaymentId ?? '—'}</span>
                </Row>
                <Row label="Checkout Session ID">
                  <span className={mono}>{data.providerSessionId ?? '—'}</span>
                </Row>
                {data.providerPaymentId && (
                  <a
                    href={`https://dashboard.stripe.com/payments/${data.providerPaymentId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"
                  >
                    在 Stripe 后台查看 <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </Card>

              <Card title={`退款明细（${data.refunds.length}）`}>
                {data.refunds.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">无退款记录</p>
                ) : (
                  <div className="space-y-2">
                    {data.refunds.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-md bg-slate-50 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-slate-500 truncate">
                            {r.providerRefundId ?? r.id}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatDate(r.createdAt)}
                            {r.reason && ` · ${r.reason}`}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-red-600 font-medium">-{usd(r.amountCents)}</p>
                          <p className="text-[11px] text-slate-400">回收 {r.creditsReversed} 积分</p>
                        </div>
                        <span
                          className={cn(
                            'inline-flex px-2 py-0.5 rounded-md text-xs border flex-shrink-0',
                            REFUND_STATUS_META[r.status]?.cls ?? 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {REFUND_STATUS_META[r.status]?.label ?? r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </QueryState>
      </div>
    </div>
  );
}
