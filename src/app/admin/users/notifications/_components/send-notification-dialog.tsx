'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Megaphone, Send, UserPlus, Users, X } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { useAlert, useConfirm } from '@/components/ui/dialog-provider';
import { cn } from '@/lib/utils';

export type NotificationTargetType = 'single' | 'user_list' | 'filter' | 'all_active';

export interface SendNotificationPayload {
  targetType: NotificationTargetType;
  userIds?: string[];
  filter?: {
    status?: 'active' | 'suspended';
    registeredAfter?: string;
    registeredBefore?: string;
  };
  title: string;
  body?: string;
  linkUrl?: string;
  linkLabel?: string;
}

interface UserSearchRow {
  id: string;
  email: string | null;
  displayName: string;
}

interface SendNotificationDialogProps {
  open: boolean;
  onClose: () => void;
  /** 单用户快捷发信时预填 */
  presetUser?: { id: string; email?: string | null; displayName?: string };
  onSuccess?: () => void;
}

const TARGET_OPTIONS: Array<{
  value: NotificationTargetType;
  label: string;
  icon: typeof UserPlus;
  permission?: 'notification.send' | 'notification.broadcast';
}> = [
  { value: 'single', label: '单用户', icon: UserPlus, permission: 'notification.send' },
  { value: 'user_list', label: '用户列表', icon: Users, permission: 'notification.send' },
  { value: 'filter', label: '条件批量', icon: Users, permission: 'notification.send' },
  { value: 'all_active', label: '全站公告', icon: Megaphone, permission: 'notification.broadcast' },
];

export function SendNotificationDialog({
  open,
  onClose,
  presetUser,
  onSuccess,
}: SendNotificationDialogProps) {
  const hasPermission = useAdminAuthStore((s) => s.hasPermission);
  const alert = useAlert();
  const confirm = useConfirm();

  const canSend = hasPermission('notification.send');
  const canBroadcast = hasPermission('notification.broadcast');

  const [targetType, setTargetType] = useState<NotificationTargetType>('single');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<UserSearchRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<'active' | 'suspended'>('active');
  const [registeredAfter, setRegisteredAfter] = useState('');
  const [registeredBefore, setRegisteredBefore] = useState('');
  const [broadcastConfirm, setBroadcastConfirm] = useState('');
  const [estimateCount, setEstimateCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    if (presetUser) {
      setTargetType('single');
      setSelectedUsers([
        {
          id: presetUser.id,
          email: presetUser.email ?? null,
          displayName: presetUser.displayName ?? presetUser.email ?? presetUser.id,
        },
      ]);
    } else {
      setSelectedUsers([]);
    }
    setTitle('');
    setBody('');
    setLinkUrl('');
    setLinkLabel('');
    setUserSearch('');
    setFilterStatus('active');
    setRegisteredAfter('');
    setRegisteredBefore('');
    setBroadcastConfirm('');
    setEstimateCount(null);
  }, [open, presetUser]);

  const availableTargets = useMemo(
    () =>
      TARGET_OPTIONS.filter((opt) => {
        if (opt.permission === 'notification.broadcast') return canBroadcast;
        return canSend;
      }),
    [canSend, canBroadcast],
  );

  useEffect(() => {
    if (!open || availableTargets.length === 0) return;
    if (!availableTargets.some((t) => t.value === targetType)) {
      setTargetType(availableTargets[0].value);
    }
  }, [open, availableTargets, targetType]);

  const buildPayload = (): SendNotificationPayload | null => {
    const payload: SendNotificationPayload = {
      targetType,
      title: title.trim(),
      body: body.trim() || undefined,
      linkUrl: linkUrl.trim() || undefined,
      linkLabel: linkLabel.trim() || undefined,
    };

    if (targetType === 'single') {
      const uid = presetUser?.id ?? selectedUsers[0]?.id;
      if (!uid) return null;
      payload.userIds = [uid];
    } else if (targetType === 'user_list') {
      if (selectedUsers.length === 0) return null;
      payload.userIds = selectedUsers.map((u) => u.id);
    } else if (targetType === 'filter') {
      payload.filter = {
        status: filterStatus,
        registeredAfter: registeredAfter || undefined,
        registeredBefore: registeredBefore || undefined,
      };
    }

    return payload;
  };

  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ['admin', 'users', 'search', userSearch],
    queryFn: async () => {
      const res = (await apiClient.get(
        `/admin/users?search=${encodeURIComponent(userSearch)}&pageSize=10`,
      )) as unknown as { items: UserSearchRow[] };
      return res.items ?? [];
    },
    enabled: open && userSearch.trim().length >= 2 && targetType !== 'filter' && targetType !== 'all_active',
  });

  const estimateMutation = useMutation({
    mutationFn: async (payload: SendNotificationPayload) =>
      apiClient.post('/admin/notifications/estimate', payload) as Promise<{ count: number }>,
    onSuccess: (data) => setEstimateCount(data.count),
    onError: (err: unknown) => {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : '预估失败';
      void alert({ title: '无法预估', description: message, variant: 'danger' });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (payload: SendNotificationPayload) =>
      apiClient.post('/admin/notifications/send', payload),
    onSuccess: () => {
      void alert({ title: '发送成功', description: '消息已提交发送。' });
      onSuccess?.();
      onClose();
    },
    onError: (err: unknown) => {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : '发送失败';
      void alert({ title: '发送失败', description: message, variant: 'danger' });
    },
  });

  const handleEstimate = () => {
    const payload = buildPayload();
    if (!payload?.title) {
      void alert({ title: '请填写标题', variant: 'danger' });
      return;
    }
    estimateMutation.mutate(payload);
  };

  const handleSend = async () => {
    const payload = buildPayload();
    if (!payload?.title) {
      void alert({ title: '请填写标题', variant: 'danger' });
      return;
    }

    if (targetType === 'all_active' && broadcastConfirm !== 'CONFIRM') {
      void alert({
        title: '请确认全站公告',
        description: '请在确认框输入 CONFIRM 后再发送。',
        variant: 'danger',
      });
      return;
    }

    let count = estimateCount;
    if (count === null) {
      try {
        const est = (await apiClient.post(
          '/admin/notifications/estimate',
          payload,
        )) as { count: number };
        count = est.count;
        setEstimateCount(count);
      } catch {
        return;
      }
    }

    const ok = await confirm({
      title: '确认发送',
      description: `将向 ${count ?? 0} 位用户发送站内消息「${payload.title}」，是否继续？`,
      confirmText: '发送',
      variant: targetType === 'all_active' ? 'danger' : 'default',
    });
    if (!ok) return;

    sendMutation.mutate(payload);
  };

  const addUser = (user: UserSearchRow) => {
    if (targetType === 'single') {
      setSelectedUsers([user]);
      return;
    }
    if (selectedUsers.some((u) => u.id === user.id)) return;
    if (selectedUsers.length >= 500) {
      void alert({ title: '最多选择 500 个用户', variant: 'danger' });
      return;
    }
    setSelectedUsers((prev) => [...prev, user]);
    setUserSearch('');
  };

  if (!open) return null;

  if (!canSend && !canBroadcast) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <p className="text-sm text-slate-600">您没有发送站内消息的权限。</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-xl bg-slate-100 px-4 py-2 text-sm"
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">发送站内消息</h2>
            <p className="mt-1 text-xs text-slate-500">消息将出现在用户铃铛与通知列表中。</p>
          </div>
          <button
            type="button"
            onClick={() => !sendMutation.isPending && onClose()}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!presetUser && (
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600">发送目标</label>
              <div className="flex flex-wrap gap-2">
                {availableTargets.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setTargetType(opt.value);
                        setEstimateCount(null);
                        if (opt.value === 'single') setSelectedUsers([]);
                      }}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                        targetType === opt.value
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {targetType === 'all_active' && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              全站公告将发送给所有 active 状态用户，请谨慎操作。输入 CONFIRM 确认。
            </div>
          )}

          {(targetType === 'single' || targetType === 'user_list') && !presetUser && (
            <div className="space-y-2">
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="搜索邮箱或昵称（至少 2 字符）"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              {searching && (
                <p className="text-xs text-slate-400">搜索中…</p>
              )}
              {searchResults && searchResults.length > 0 && userSearch.trim().length >= 2 && (
                <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-100">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => addUser(u)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span>{u.displayName}</span>
                      <span className="text-xs text-slate-400">{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700"
                    >
                      {u.displayName || u.email}
                      {!presetUser && (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedUsers((prev) => prev.filter((x) => x.id !== u.id))
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {presetUser && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              收件人：{presetUser.displayName || presetUser.email || presetUser.id}
            </div>
          )}

          {targetType === 'filter' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">用户状态</label>
                <select
                  value={filterStatus}
                  onChange={(e) =>
                    setFilterStatus(e.target.value as 'active' | 'suspended')
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">注册起始</label>
                <input
                  type="date"
                  value={registeredAfter}
                  onChange={(e) => setRegisteredAfter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">注册截止</label>
                <input
                  type="date"
                  value={registeredBefore}
                  onChange={(e) => setRegisteredBefore(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {targetType === 'all_active' && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">输入 CONFIRM 确认</label>
              <input
                value={broadcastConfirm}
                onChange={(e) => setBroadcastConfirm(e.target.value)}
                placeholder="CONFIRM"
                className="w-full rounded-xl border border-red-200 px-3 py-2 text-sm"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">标题 *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="通知标题"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">正文</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="可选正文"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">链接 URL（可选）</label>
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="/notifications 或 https://..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">链接文案（可选）</label>
              <input
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="查看详情"
              />
            </div>
          </div>

          {estimateCount !== null && (
            <p className="text-xs text-indigo-600">预估收件人数：{estimateCount}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={handleEstimate}
            disabled={estimateMutation.isPending || sendMutation.isPending}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {estimateMutation.isPending ? '预估中…' : '预估人数'}
          </button>
          <button
            type="button"
            onClick={() => !sendMutation.isPending && onClose()}
            className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sendMutation.isPending}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
              targetType === 'all_active' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700',
            )}
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
