'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';
import { QueryState } from '@/components/query-state';
import { FormField } from '@/components/ui/form-field';
import { FromEnvBadge } from './from-env-badge';
import {
  SettingsPanel,
  SettingsSaveBar,
  SettingsStatusBadge,
} from './settings-panel';

interface GeneralConfigView {
  allowedOrigins: string;
  allowedOriginsFromEnv: boolean;
  allowedOriginsConfigured: boolean;
}

const TEXTAREA_CLS = cn(
  'w-full resize-y min-h-[3.25rem] border bg-white text-slate-800',
  'rounded-[10px] border-slate-200/90 px-2.5 py-1.5 text-xs',
  'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
  'focus:outline-none focus-visible:border-blue-400 focus-visible:ring-[3px] focus-visible:ring-blue-500/15',
  'placeholder:text-slate-400',
);

export function AllowedOriginsSection() {
  const qc = useQueryClient();
  const [allowedOrigins, setAllowedOrigins] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<GeneralConfigView>({
    queryKey: ['admin', 'settings', 'general'],
    queryFn: () =>
      apiClient.get('/admin/settings/general') as Promise<GeneralConfigView>,
  });

  useEffect(() => {
    if (data?.allowedOrigins != null) setAllowedOrigins(data.allowedOrigins);
  }, [data?.allowedOrigins]);

  const save = useMutation({
    mutationFn: (payload: { allowedOrigins: string }) =>
      apiClient.patch('/admin/settings/general', payload) as Promise<GeneralConfigView>,
    onSuccess: (cfg) => {
      setMsg({ ok: true, text: 'CORS 白名单已保存，下一次跨域请求即生效。' });
      setAllowedOrigins(cfg.allowedOrigins);
      qc.setQueryData(['admin', 'settings', 'general'], (prev: any) => ({
        ...prev,
        ...cfg,
      }));
    },
    onError: (e: any) => {
      setMsg({
        ok: false,
        text: e?.message || e?.error || '保存失败，请检查 URL 格式后重试。',
      });
    },
  });

  const originCount = allowedOrigins
    ? allowedOrigins
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean).length
    : 0;
  const dirty =
    allowedOrigins.trim() !== (data?.allowedOrigins ?? '').trim();

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
          save.mutate({ allowedOrigins: allowedOrigins.trim() });
        }}
      >
        <SettingsPanel
          title="跨域白名单"
          tone="violet"
          badge={
            <SettingsStatusBadge
              ok={!!data?.allowedOriginsConfigured}
              okText={`${originCount} 个来源`}
              extra={
                data ? (
                  <FromEnvBadge fromEnv={data.allowedOriginsFromEnv} />
                ) : null
              }
            />
          }
          summary={
            data?.allowedOriginsConfigured
              ? data.allowedOrigins
              : '未配置时使用默认 localhost · ALLOWED_ORIGINS'
          }
          footer={
            <SettingsSaveBar
              msg={msg}
              saving={save.isPending}
              disabled={!allowedOrigins.trim() || !dirty}
            />
          }
        >
          <FormField
            label="允许的来源"
            description="逗号分隔完整 URL，无尾斜杠；本地需含管理后台"
            className="items-start py-1"
            controlClassName="sm:w-[420px] w-full"
          >
            <textarea
              value={allowedOrigins}
              onChange={(e) => setAllowedOrigins(e.target.value)}
              placeholder="http://localhost:4002, https://mv.offoff.ai"
              rows={2}
              className={TEXTAREA_CLS}
            />
          </FormField>
        </SettingsPanel>
      </form>
    </QueryState>
  );
}
