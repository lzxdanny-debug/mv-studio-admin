import { redirect } from 'next/navigation';

/** 旧地址保留跳转，会员套餐与权益已收口到同一个编辑入口。 */
export default function LegacyMembershipEntitlementsPage() {
  redirect('/admin/billing/membership/plans');
}
