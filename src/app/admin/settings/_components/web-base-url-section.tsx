'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { CONTROL_WIDE } from './settings-form-styles';
import {
  SettingsPanel,
  SettingsSaveBar,
  SettingsStatusBadge,
} from './settings-panel';

interface GeneralConfigView {
  webBaseUrl: string;
  configured: boolean;
}

export function WebBaseUrlSection() {
  const qc = useQueryClient();
  const [webBaseUrl, setWebBaseUrl] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<GeneralConfigView>({
    queryKey: ['admin', 'settings', 'general'],
    queryFn: () =>
      apiClient.get('/admin/settings/general') as Promise<GeneralConfigView>,
  });

  useEffect(() => {
    if (data?.webBaseUrl != null) setWebBaseUrl(data.webBaseUrl);
  }, [data?.webBaseUrl]);

  const save = useMutation({
    mutationFn: (payload: { webBaseUrl: string }) =>
      apiClient.patch('/admin/settings/general', payload) as Promise<GeneralConfigView>,
    onSuccess: (cfg) => {
      setMsg({ ok: true, text: '已保存，购买邮件、密码设置、密码重置与邀请链接将使用该域名。' });
      setWebBaseUrl(cfg.webBaseUrl);
      qc.setQueryData(['admin', 'settings', 'general'], (prev: any) => ({
        ...prev,
        ...cfg,
      }));
    },
    onError: () =>
      setMsg({ ok: false, text: '保存失败，请检查 URL 格式后重试。' }),
  });

  const dirty = webBaseUrl.trim() !== (data?.webBaseUrl ?? '').trim();

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      error={error}
      isEmpty={false}
      height="h-24"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          save.mutate({ webBaseUrl: webBaseUrl.trim() });
        }}
      >
        <SettingsPanel
          title="站点域名"
          tone="sky"
          badge={
            <SettingsStatusBadge ok={!!data?.configured} />
          }
          summary={
            data?.configured
              ? data.webBaseUrl
              : '尚未配置；仅本地开发会临时回退到 localhost'
          }
          footer={
            <SettingsSaveBar
              msg={msg}
              saving={save.isPending}
              disabled={!webBaseUrl.trim() || !dirty}
            />
          }
        >
          <FormField
            label="C 端站点根地址"
            description="写入数据库；用于购买邮件、设置/重置密码和邀请链接，不含路径及尾斜杠"
            controlClassName={CONTROL_WIDE}
            className="py-1"
          >
            <Input
              size="sm"
              type="url"
              value={webBaseUrl}
              onChange={(e) => setWebBaseUrl(e.target.value)}
              placeholder="https://test.aimv.video"
            />
          </FormField>
        </SettingsPanel>
      </form>
    </QueryState>
  );
}
