import type { LucideIcon } from 'lucide-react';
import {
  Coins,
  CreditCard,
  Gift,
  CalendarCheck,
  Users,
  SlidersHorizontal,
} from 'lucide-react';

export type CreditSource =
  | 'purchase'
  | 'signup'
  | 'daily_check_in'
  | 'referral'
  | 'admin_adjust'
  | 'consume'
  | 'refund'
  | 'other';

export interface SourceStat {
  source: CreditSource;
  inCredits: number;
  outCredits: number;
  netCredits: number;
  count: number;
}

export interface CreditsSummary {
  balance: {
    totalBalance: number;
    userCount: number;
    usersWithBalance: number;
  };
  totalIn: number;
  totalOut: number;
  netFlow: number;
  bySource: SourceStat[];
}

export interface BalanceRow {
  userId: string;
  userEmail: string | null;
  userDisplayName: string | null;
  balance: number;
  updatedAt: string;
}

export interface TransactionRow {
  id: string;
  userId: string;
  userEmail: string | null;
  userDisplayName: string | null;
  amount: number;
  type: string;
  source: CreditSource;
  referenceId: string | null;
  description: string;
  createdAt: string;
}

export interface ListResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreditTypeConfig {
  source: CreditSource;
  slug: string;
  label: string;
  description: string;
  icon: LucideIcon;
  cls: string;
  /** 主指标：入账 / 净额 */
  metric: 'in' | 'net';
}

export const CREDIT_TYPE_PAGES: CreditTypeConfig[] = [
  {
    source: 'purchase',
    slug: 'purchase',
    label: '充值',
    description: '用户通过 Stripe 充值获得的积分流水',
    icon: CreditCard,
    cls: 'bg-blue-50 text-blue-700 border-blue-100',
    metric: 'in',
  },
  {
    source: 'signup',
    slug: 'signup',
    label: '注册赠送',
    description: '新用户注册时一次性赠送的积分',
    icon: Gift,
    cls: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    metric: 'in',
  },
  {
    source: 'daily_check_in',
    slug: 'daily-check-in',
    label: '每日登录',
    description: '用户每日签到领取的积分奖励',
    icon: CalendarCheck,
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    metric: 'in',
  },
  {
    source: 'referral',
    slug: 'referral',
    label: '邀请奖励',
    description: '邀请新用户注册后发放给邀请人的积分',
    icon: Users,
    cls: 'bg-violet-50 text-violet-700 border-violet-100',
    metric: 'in',
  },
  {
    source: 'admin_adjust',
    slug: 'admin-adjust',
    label: '手动调整',
    description: '管理员在后台手动增加或扣减的积分',
    icon: SlidersHorizontal,
    cls: 'bg-amber-50 text-amber-700 border-amber-100',
    metric: 'net',
  },
];

export const SOURCE_META: Record<CreditSource, { label: string; cls: string }> = {
  purchase: { label: '充值', cls: 'bg-blue-50 text-blue-700 border-blue-100' },
  signup: { label: '注册赠送', cls: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  daily_check_in: { label: '每日登录', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  referral: { label: '邀请奖励', cls: 'bg-violet-50 text-violet-700 border-violet-100' },
  admin_adjust: { label: '手动调整', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
  consume: { label: '消耗', cls: 'bg-rose-50 text-rose-700 border-rose-100' },
  refund: { label: '退款退回', cls: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
  other: { label: '其它', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const OVERVIEW_ICON = Coins;

export function formatCredits(n: number): string {
  return n.toLocaleString();
}

export function amountDisplay(amount: number): string {
  const prefix = amount > 0 ? '+' : '';
  return `${prefix}${amount.toLocaleString()}`;
}

export function getTypeConfig(slug: string): CreditTypeConfig | undefined {
  return CREDIT_TYPE_PAGES.find((t) => t.slug === slug);
}
