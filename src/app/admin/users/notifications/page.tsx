'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bell, Plus, Send } from 'lucide-react';
import apiClient from '@/lib/api';
import { useServerPagination } from '@/lib/use-server-pagination';
import { formatDate } from '@/lib/utils';
import { SearchBar } from '@/components/search-bar';
import { DataTable, DataTableColumn } from '@/components/data-table';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { SendNotificationDialog } from './_components/send-notification-dialog';

type TabKey = 'campaigns' | 'compose' | 'records';

interface CampaignRow {
  id: string;
  title: string;
  targetType: string;
  totalTargets: number;
  sentCount: number;
  failedCount: number;
  readCount: number;
  readRate: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
  createdBy: { email: string | null; displayName: string | null };
}

interface NotificationRow {
  id: string;
  userId: string;
  category: string;
  type: string;
  title: string;
  body: string | null;
  source: string;
  campaignId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  userEmail: string | null;
  userDisplayName: string | null;
}

interface CampaignDetail extends CampaignRow {
  body: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  targetFilter: Record<string, unknown> | null;
  targetUserIds: string[] | null;
  startedAt: string | null;
  metadata: Record<string, unknown> | null;
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  single: '单用户',
  user_list: '用户列表',
  filter: '条件批量',
  all_active: '全站公告',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '待发送',
  sending: '发送中',
  completed: '已完成',
  failed: '失败',
};

const STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '待发送', value: 'pending' },
  { label: '发送中', value: 'sending' },
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' },
];

const TARGET_OPTIONS = [
  { label: '全部类型', value: '' },
  { label: '单用户', value: 'single' },
  { label: '用户列表', value: 'user_list' },
  { label: '条件批量', value: 'filter' },
  { label: '全站公告', value: 'all_active' },
];

const SOURCE_OPTIONS = [
  { label: '全部来源', value: '' },
  { label: 'Admin 发送', value: 'admin' },
  { label: '系统自动', value: 'system' },
];

function FilterPills({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value || '__all'}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function AdminNotificationsPage() {
  const hasPermission = useAdminAuthStore((s) => s.hasPermission);
  const canSend = hasPermission('notification.send') || hasPermission('notification.broadcast');

  const [tab, setTab] = useState<TabKey>('campaigns');
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const campaignPg = useServerPagination();
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignStatus, setCampaignStatus] = useState('');
  const [campaignTargetType, setCampaignTargetType] = useState('');

  const recordPg = useServerPagination();
  const [recordSearch, setRecordSearch] = useState('');
  const [recordSource, setRecordSource] = useState('');
  const [recordIsRead, setRecordIsRead] = useState('');

  const campaignsQuery = useQuery({
    queryKey: [
      'admin',
      'notifications',
      'campaigns',
      {
        page: campaignPg.page,
        pageSize: campaignPg.pageSize,
        search: campaignSearch,
        status: campaignStatus,
        targetType: campaignTargetType,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(campaignPg.page),
        pageSize: String(campaignPg.pageSize),
      });
      if (campaignSearch) params.set('search', campaignSearch);
      if (campaignStatus) params.set('status', campaignStatus);
      if (campaignTargetType) params.set('targetType', campaignTargetType);
      return (await apiClient.get(
        `/admin/notifications/campaigns?${params}`,
      )) as { items: CampaignRow[]; total: number };
    },
    enabled: tab === 'campaigns' || tab === 'compose',
    refetchInterval: tab === 'campaigns' ? 10000 : false,
  });

  const recordsQuery = useQuery({
    queryKey: [
      'admin',
      'notifications',
      'records',
      {
        page: recordPg.page,
        pageSize: recordPg.pageSize,
        search: recordSearch,
        source: recordSource,
        isRead: recordIsRead,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(recordPg.page),
        pageSize: String(recordPg.pageSize),
      });
      if (recordSearch) params.set('search', recordSearch);
      if (recordSource) params.set('source', recordSource);
      if (recordIsRead) params.set('isRead', recordIsRead);
      return (await apiClient.get(
        `/admin/notifications?${params}`,
      )) as { items: NotificationRow[]; total: number };
    },
    enabled: tab === 'records',
  });

  const campaignDetailQuery = useQuery({
    queryKey: ['admin', 'notifications', 'campaign', selectedCampaignId],
    queryFn: async () =>
      (await apiClient.get(
        `/admin/notifications/campaigns/${selectedCampaignId}`,
      )) as CampaignDetail,
    enabled: !!selectedCampaignId,
    refetchInterval: selectedCampaignId ? 5000 : false,
  });

  const campaignColumns: DataTableColumn<CampaignRow>[] = [
    {
      key: 'title',
      header: '标题',
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelectedCampaignId(row.id)}
          className="max-w-xs truncate text-left font-medium text-indigo-600 hover:underline"
        >
          {row.title}
        </button>
      ),
    },
    {
      key: 'targetType',
      header: '目标',
      render: (row) => TARGET_TYPE_LABELS[row.targetType] ?? row.targetType,
    },
    {
      key: 'progress',
      header: '进度',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {row.sentCount}/{row.totalTargets}
          {row.failedCount > 0 && (
            <span className="ml-1 text-red-600">失败 {row.failedCount}</span>
          )}
        </span>
      ),
    },
    {
      key: 'readRate',
      header: '已读率',
      render: (row) => `${row.readRate}%`,
    },
    {
      key: 'status',
      header: '状态',
      render: (row) => STATUS_LABELS[row.status] ?? row.status,
    },
    {
      key: 'createdBy',
      header: '发送人',
      render: (row) => row.createdBy?.displayName || row.createdBy?.email || '—',
    },
    {
      key: 'createdAt',
      header: '时间',
      render: (row) => formatDate(row.createdAt),
    },
  ];

  const recordColumns: DataTableColumn<NotificationRow>[] = [
    {
      key: 'user',
      header: '用户',
      render: (row) => (
        <Link
          href={`/admin/users/${row.userId}`}
          className="text-indigo-600 hover:underline"
        >
          {row.userDisplayName || row.userEmail || row.userId.slice(0, 8)}
        </Link>
      ),
    },
    { key: 'title', header: '标题', render: (row) => row.title },
    {
      key: 'source',
      header: '来源',
      render: (row) => (row.source === 'admin' ? 'Admin' : '系统'),
    },
    {
      key: 'isRead',
      header: '已读',
      render: (row) => (row.isRead ? '是' : '否'),
    },
    {
      key: 'createdAt',
      header: '时间',
      render: (row) => formatDate(row.createdAt),
    },
  ];

  const detail = campaignDetailQuery.data;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100">
      <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-xl font-bold text-slate-900">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
              <Bell className="h-4 w-4" strokeWidth={2.25} />
            </span>
            消息管理
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            向 C 端用户发送站内通知，查看发送记录与阅读情况。
          </p>
        </div>
        {canSend && (
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            发送消息
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {(
          [
            { key: 'campaigns' as const, label: '发送记录' },
            ...(canSend ? [{ key: 'compose' as const, label: '发送消息' }] : []),
            { key: 'records' as const, label: '通知明细' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              if (t.key === 'compose') setComposeOpen(true);
            }}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <SearchBar
              value={campaignSearch}
              onChange={setCampaignSearch}
              placeholder="搜索标题…"
              width="w-64"
            />
            <FilterPills
              options={STATUS_OPTIONS}
              value={campaignStatus}
              onChange={(v) => {
                setCampaignStatus(v);
                campaignPg.setPage(1);
              }}
            />
            <FilterPills
              options={TARGET_OPTIONS}
              value={campaignTargetType}
              onChange={(v) => {
                setCampaignTargetType(v);
                campaignPg.setPage(1);
              }}
            />
          </div>

          <DataTable<CampaignRow>
            columns={campaignColumns}
            rows={campaignsQuery.data?.items}
            rowKey={(row) => row.id}
            isLoading={campaignsQuery.isLoading}
            isError={campaignsQuery.isError}
            error={campaignsQuery.error}
            emptyMessage="暂无发送记录"
            page={campaignPg.page}
            pageSize={campaignPg.pageSize}
            total={campaignsQuery.data?.total ?? 0}
            onPageChange={campaignPg.setPage}
            onPageSizeChange={campaignPg.onPageSizeChange}
          />
        </div>
      )}

      {tab === 'records' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <SearchBar
              value={recordSearch}
              onChange={setRecordSearch}
              placeholder="搜索用户邮箱/昵称/标题…"
              width="w-72"
            />
            <FilterPills
              options={SOURCE_OPTIONS}
              value={recordSource}
              onChange={(v) => {
                setRecordSource(v);
                recordPg.setPage(1);
              }}
            />
            <FilterPills
              options={[
                { label: '全部', value: '' },
                { label: '未读', value: 'false' },
                { label: '已读', value: 'true' },
              ]}
              value={recordIsRead}
              onChange={(v) => {
                setRecordIsRead(v);
                recordPg.setPage(1);
              }}
            />
          </div>

          <DataTable<NotificationRow>
            columns={recordColumns}
            rows={recordsQuery.data?.items}
            rowKey={(row) => row.id}
            isLoading={recordsQuery.isLoading}
            isError={recordsQuery.isError}
            error={recordsQuery.error}
            emptyMessage="暂无通知记录"
            page={recordPg.page}
            pageSize={recordPg.pageSize}
            total={recordsQuery.data?.total ?? 0}
            onPageChange={recordPg.setPage}
            onPageSizeChange={recordPg.onPageSizeChange}
          />
        </div>
      )}

      {tab === 'compose' && canSend && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <Send className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 text-sm text-slate-600">点击上方按钮打开发送表单</p>
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
          >
            发送消息
          </button>
        </div>
      )}

      {selectedCampaignId && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-slate-900">活动详情</h3>
              <button
                type="button"
                onClick={() => setSelectedCampaignId(null)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                关闭
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 text-sm space-y-3">
              {campaignDetailQuery.isLoading && <p className="text-slate-400">加载中…</p>}
              {detail && (
                <>
                  <div>
                    <p className="text-xs text-slate-500">标题</p>
                    <p className="font-medium">{detail.title}</p>
                  </div>
                  {detail.body && (
                    <div>
                      <p className="text-xs text-slate-500">正文</p>
                      <p className="whitespace-pre-wrap text-slate-700">{detail.body}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500">类型</p>
                      <p>{TARGET_TYPE_LABELS[detail.targetType] ?? detail.targetType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">状态</p>
                      <p>{STATUS_LABELS[detail.status] ?? detail.status}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">进度</p>
                      <p>
                        {detail.sentCount}/{detail.totalTargets}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">已读率</p>
                      <p>{detail.readRate}%</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">发送时间</p>
                    <p>{formatDate(detail.createdAt)}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <SendNotificationDialog
        open={composeOpen}
        onClose={() => {
          setComposeOpen(false);
          if (tab === 'compose') setTab('campaigns');
        }}
        onSuccess={() => {
          void campaignsQuery.refetch();
          setTab('campaigns');
        }}
      />
      </div>
    </div>
  );
}
