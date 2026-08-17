'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import { QueryState } from '@/components/query-state';
import { SecretInput } from '@/components/secret-input';
import { FormField } from '@/components/ui/form-field';
import { CONTROL_WIDE, SECRET_INPUT_CLS } from './settings-form-styles';
import {
  SettingsPanel,
  SettingsSaveBar,
  SettingsStatusBadge,
} from './settings-panel';

interface CredentialEncryptionView {
  secretMasked: string;
  configured: boolean;
  dbConfigured: boolean;
  envConfigured: boolean;
  source: 'env' | 'db' | 'none';
  lengthOk: boolean;
  ready: boolean;
}

export function CredentialEncryptionSection() {
  const qc = useQueryClient();
  const [secret, setSecret] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<CredentialEncryptionView>({
    queryKey: ['admin', 'settings', 'credential-encryption'],
    queryFn: () =>
      apiClient.get(
        '/admin/settings/credential-encryption',
      ) as Promise<CredentialEncryptionView>,
  });

  const save = useMutation({
    mutationFn: (payload: { secret: string }) =>
      apiClient.patch(
        '/admin/settings/credential-encryption',
        payload,
      ) as Promise<CredentialEncryptionView>,
    onSuccess: () => {
      setMsg({
        ok: true,
        text: '已保存并热加载。更换密钥后请在「AI 凭证」中重新填写渠道 API Key。',
      });
      setSecret('');
      qc.invalidateQueries({
        queryKey: ['admin', 'settings', 'credential-encryption'],
      });
    },
    onError: (e: any) =>
      setMsg({
        ok: false,
        text: e?.response?.data?.message ?? '保存失败，请检查输入后重试。',
      }),
  });

  const sourceLabel =
    data?.source === 'env'
      ? '当前生效：环境变量（重启后仍优先 env）'
      : data?.source === 'db'
        ? '当前生效：数据库'
        : '未配置';

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
          if (!secret.trim()) {
            setMsg({ ok: false, text: '请填写新的密钥。' });
            return;
          }
          save.mutate({ secret: secret.trim() });
        }}
        className="space-y-3"
      >
        <SettingsPanel
          title="凭证加密密钥"
          tone="violet"
          badge={
            <SettingsStatusBadge
              ok={!!data?.ready}
              okText="已就绪"
              badText="未就绪"
            />
          }
          summary="加密 AI 渠道 API Key（ai_provider_credentials）；冷启动可自动生成"
          footer={
            <SettingsSaveBar
              msg={msg}
              saving={save.isPending}
              disabled={!secret.trim()}
              label="保存密钥"
            />
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              {sourceLabel}
              {data?.envConfigured
                ? '。若需长期以后台为准，请去掉 Pod 上的 CREDENTIAL_ENCRYPTION_KEY。'
                : ''}
            </p>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 px-3">
              <FormField
                label="credential_encryption_key"
                description={
                  data?.configured
                    ? data.lengthOk
                      ? 'AES-256-GCM 主密钥（32 字节）'
                      : '已配置但长度不正确'
                    : '未配置 — 生产冷启动会自动生成'
                }
                controlClassName={CONTROL_WIDE}
                className="py-2.5"
              >
                <SecretInput
                  className={SECRET_INPUT_CLS}
                  configured={data?.configured}
                  maskedPreview={data?.secretMasked}
                  value={secret}
                  onChange={setSecret}
                  placeholder="openssl rand -base64 32"
                />
              </FormField>
            </div>
          </div>
        </SettingsPanel>
      </form>
    </QueryState>
  );
}
