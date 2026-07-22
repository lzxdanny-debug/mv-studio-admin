'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LineTabs } from './line-tabs';
import { GoogleOAuthSection } from './google-oauth-section';
import { MailSection } from './mail-section';
import { StorageSection } from './storage-section';
import { S3StorageSection } from './s3-storage-section';
import { MountseaSection } from './mountsea-section';

export type AccountSubTab = 'google' | 'mail' | 'cos' | 's3' | 'mountsea';

const ACCOUNT_TABS: Array<{ id: AccountSubTab; label: string }> = [
  { id: 'google', label: 'Google 登录' },
  { id: 'mail', label: '阿里云邮件' },
  { id: 'cos', label: '腾讯云 COS' },
  { id: 's3', label: 'AWS S3' },
  { id: 'mountsea', label: 'Mountsea' },
];

export function AccountTab() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeSubTab = useMemo<AccountSubTab>(() => {
    const raw = searchParams.get('account');
    if (
      raw === 'google' ||
      raw === 'mail' ||
      raw === 'cos' ||
      raw === 's3' ||
      raw === 'mountsea'
    ) {
      return raw;
    }
    return 'google';
  }, [searchParams]);

  const setSubTab = (account: AccountSubTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'account');
    params.set('account', account);
    router.replace(`/admin/settings?${params.toString()}`);
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
      <LineTabs
        items={ACCOUNT_TABS}
        active={activeSubTab}
        onChange={setSubTab}
        variant="secondary"
      />
      <div className="p-6">
        {activeSubTab === 'google' && <GoogleOAuthSection embedded />}
        {activeSubTab === 'mail' && <MailSection embedded />}
        {activeSubTab === 'cos' && <StorageSection embedded />}
        {activeSubTab === 's3' && <S3StorageSection embedded />}
        {activeSubTab === 'mountsea' && <MountseaSection embedded />}
      </div>
    </div>
  );
}
