'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { FromEnvBadge } from './from-env-badge';
import { CONTROL_WIDE } from './settings-form-styles';
import {
  SettingsPanel,
  SettingsSaveBar,
  SettingsStatusBadge,
} from './settings-panel';

interface GeneralConfigView {
  webBaseUrl: string;
  webBaseUrlFromEnv: boolean;
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
      setMsg({ ok: true, text: '已保存，密码重置与邀请链接将使用新地址。' });
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
          title="前端站点地址"
          tone="sky"
          badge={
            <SettingsStatusBadge
              ok={!!data?.configured}
              extra={
                data ? <FromEnvBadge fromEnv={data.webBaseUrlFromEnv} /> : null
              }
            />
          }
          summary={
            data?.configured
              ? data.webBaseUrl
              : '未配置时使用默认 localhost · WEB_BASE_URL'
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
            label="前端根地址"
            description="C 端根地址，不含尾斜杠"
            controlClassName={CONTROL_WIDE}
            className="py-1"
          >
            <Input
              size="sm"
              type="url"
              value={webBaseUrl}
              onChange={(e) => setWebBaseUrl(e.target.value)}
              placeholder="https://mv.offoff.ai"
            />
          </FormField>
        </SettingsPanel>
      </form>
    </QueryState>
  );
}
