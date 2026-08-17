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

interface JwtConfigView {
  accessSecretMasked: string;
  accessSecretConfigured: boolean;
  refreshSecretMasked: string;
  refreshSecretConfigured: boolean;
  adminAccessSecretMasked: string;
  adminAccessSecretConfigured: boolean;
  adminRefreshSecretMasked: string;
  adminRefreshSecretConfigured: boolean;
  userJwtReady: boolean;
  adminJwtReady: boolean;
  dbConfigured: {
    accessSecret: boolean;
    refreshSecret: boolean;
    adminAccessSecret: boolean;
    adminRefreshSecret: boolean;
  };
}

export function JwtSecretSection() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    accessSecret: '',
    refreshSecret: '',
    adminAccessSecret: '',
    adminRefreshSecret: '',
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, isError, error } = useQuery<JwtConfigView>({
    queryKey: ['admin', 'settings', 'jwt'],
    queryFn: () =>
      apiClient.get('/admin/settings/jwt') as Promise<JwtConfigView>,
  });

  const save = useMutation({
    mutationFn: (payload: Partial<typeof form>) =>
      apiClient.patch('/admin/settings/jwt', payload) as Promise<JwtConfigView>,
    onSuccess: () => {
      setMsg({
        ok: true,
        text: '已保存；已登录用户需重新登录。',
      });
      setForm({
        accessSecret: '',
        refreshSecret: '',
        adminAccessSecret: '',
        adminRefreshSecret: '',
      });
      qc.invalidateQueries({ queryKey: ['admin', 'settings', 'jwt'] });
    },
    onError: (e: any) =>
      setMsg({
        ok: false,
        text: e?.response?.data?.message ?? '保存失败，请检查输入后重试。',
      }),
  });

  const ready = !!data?.userJwtReady && !!data?.adminJwtReady;
  const dirty =
    !!form.accessSecret ||
    !!form.refreshSecret ||
    !!form.adminAccessSecret ||
    !!form.adminRefreshSecret;

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
          const payload: Partial<typeof form> = {};
          if (form.accessSecret) payload.accessSecret = form.accessSecret;
          if (form.refreshSecret) payload.refreshSecret = form.refreshSecret;
          if (form.adminAccessSecret)
            payload.adminAccessSecret = form.adminAccessSecret;
          if (form.adminRefreshSecret)
            payload.adminRefreshSecret = form.adminRefreshSecret;
          if (Object.keys(payload).length === 0) {
            setMsg({ ok: false, text: '请至少填写一项要更新的密钥。' });
            return;
          }
          save.mutate(payload);
        }}
        className="space-y-3"
      >
        <SettingsPanel
          title="JWT 密钥"
          tone="amber"
          badge={<SettingsStatusBadge ok={ready} okText="已就绪" badText="未就绪" />}
          summary="仅读数据库，无 env 兜底；冷库首次启动会自动生成用户端密钥"
          footer={
            <SettingsSaveBar
              msg={msg}
              saving={save.isPending}
              disabled={!dirty}
              label="保存密钥"
            />
          }
        >
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                用户端（必填）
              </p>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 px-3">
                <FormField
                  label="jwt_secret"
                  description={
                    data?.accessSecretConfigured
                      ? '用户 access'
                      : '未配置 — 无法签发'
                  }
                  controlClassName={CONTROL_WIDE}
                  className="py-2.5"
                >
                  <SecretInput
                    className={SECRET_INPUT_CLS}
                    configured={data?.accessSecretConfigured}
                    maskedPreview={data?.accessSecretMasked}
                    value={form.accessSecret}
                    onChange={(accessSecret) =>
                      setForm((f) => ({ ...f, accessSecret }))
                    }
                    placeholder="≥16 字符，留空不改"
                  />
                </FormField>
                <FormField
                  label="jwt_refresh_secret"
                  description={
                    data?.refreshSecretConfigured
                      ? '用户 refresh'
                      : '未配置 — 无法刷新'
                  }
                  controlClassName={CONTROL_WIDE}
                  className="py-2.5"
                >
                  <SecretInput
                    className={SECRET_INPUT_CLS}
                    configured={data?.refreshSecretConfigured}
                    maskedPreview={data?.refreshSecretMasked}
                    value={form.refreshSecret}
                    onChange={(refreshSecret) =>
                      setForm((f) => ({ ...f, refreshSecret }))
                    }
                    placeholder="≥16 字符，留空不改"
                  />
                </FormField>
              </div>
            </div>

            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                管理端（可选）
              </p>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 px-3">
                <FormField
                  label="admin_jwt_secret"
                  description={
                    data?.dbConfigured.adminAccessSecret
                      ? '已单独配置'
                      : '回退 jwt_secret'
                  }
                  controlClassName={CONTROL_WIDE}
                  className="py-2.5"
                >
                  <SecretInput
                    className={SECRET_INPUT_CLS}
                    configured={data?.dbConfigured.adminAccessSecret}
                    maskedPreview={
                      data?.dbConfigured.adminAccessSecret
                        ? data.adminAccessSecretMasked
                        : ''
                    }
                    value={form.adminAccessSecret}
                    onChange={(adminAccessSecret) =>
                      setForm((f) => ({ ...f, adminAccessSecret }))
                    }
                    placeholder="可选，留空不改"
                  />
                </FormField>
                <FormField
                  label="admin_jwt_refresh_secret"
                  description={
                    data?.dbConfigured.adminRefreshSecret
                      ? '已单独配置'
                      : '回退 jwt_refresh_secret'
                  }
                  controlClassName={CONTROL_WIDE}
                  className="py-2.5"
                >
                  <SecretInput
                    className={SECRET_INPUT_CLS}
                    configured={data?.dbConfigured.adminRefreshSecret}
                    maskedPreview={
                      data?.dbConfigured.adminRefreshSecret
                        ? data.adminRefreshSecretMasked
                        : ''
                    }
                    value={form.adminRefreshSecret}
                    onChange={(adminRefreshSecret) =>
                      setForm((f) => ({ ...f, adminRefreshSecret }))
                    }
                    placeholder="可选，留空不改"
                  />
                </FormField>
              </div>
            </div>
          </div>
        </SettingsPanel>
      </form>
    </QueryState>
  );
}
