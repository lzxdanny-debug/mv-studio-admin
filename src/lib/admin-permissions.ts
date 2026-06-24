/** 路由 → permission 映射（最长前缀优先） */
export const ROUTE_PERMISSION_RULES: Array<{ prefix: string; permission: string; exact?: boolean }> = [
  { prefix: '/admin', permission: 'dashboard.view', exact: true },
  { prefix: '/admin/mv/projects', permission: 'project.view' },
  { prefix: '/admin/mv/anomalies', permission: 'mv.anomaly.view' },
  { prefix: '/admin/mv/styles', permission: 'asset.view' },
  { prefix: '/admin/mv/character-presets', permission: 'asset.view' },
  { prefix: '/admin/mv/defaults', permission: 'system.manage' },
  { prefix: '/admin/mv/cost-stats', permission: 'billing.cost.view' },
  { prefix: '/admin/music/tasks', permission: 'music.view' },
  { prefix: '/admin/tools/lrc', permission: 'tools.lrc.view' },
  { prefix: '/admin/users', permission: 'user.view' },
  { prefix: '/admin/feedback', permission: 'feedback.view' },
  { prefix: '/admin/billing/settings', permission: 'billing.manage' },
  { prefix: '/admin/billing/bonus-config', permission: 'billing.manage' },
  { prefix: '/admin/billing/packages', permission: 'billing.manage' },
  { prefix: '/admin/billing/membership/plans', permission: 'billing.manage' },
  { prefix: '/admin/billing/membership/entitlements', permission: 'billing.manage' },
  { prefix: '/admin/billing/profit', permission: 'billing.cost.view' },
  { prefix: '/admin/billing/models', permission: 'billing.manage' },
  { prefix: '/admin/billing/music-pricing', permission: 'billing.manage' },
  { prefix: '/admin/billing/step-prices', permission: 'billing.manage' },
  { prefix: '/admin/billing/pricing', permission: 'billing.manage' },
  { prefix: '/admin/billing/payments', permission: 'billing.payments.view' },
  { prefix: '/admin/billing/refunds', permission: 'billing.refunds.view' },
  { prefix: '/admin/billing/cost', permission: 'billing.cost.view' },
  { prefix: '/admin/billing/bonus', permission: 'billing.cost.view' },
  { prefix: '/admin/billing/events', permission: 'billing.events.view' },
  { prefix: '/admin/billing', permission: 'billing.overview.view', exact: true },
  { prefix: '/admin/ai-providers', permission: 'provider.manage' },
  { prefix: '/admin/ai-routing', permission: 'ai.routing.view' },
  { prefix: '/admin/logs', permission: 'logs.view' },
  { prefix: '/admin/settings', permission: 'system.manage' },
  { prefix: '/admin/admin-users', permission: 'admin.manage' },
  { prefix: '/admin/roles', permission: 'admin.manage' },
];

/** 详情页 Tab → permission */
export const TAB_PERMISSION_REGISTRY: Record<
  string,
  Array<{ key: string; label: string; permission: string }>
> = {
  'mv.project.detail': [
    { key: 'costs', label: '成本明细', permission: 'billing.cost.view' },
    { key: 'assets', label: '素材', permission: 'project.view' },
    { key: 'shots', label: '镜头', permission: 'project.view' },
    { key: 'planning', label: '规划', permission: 'project.view' },
    { key: 'history', label: '成片历史', permission: 'project.view' },
    { key: 'operations', label: '操作', permission: 'project.manage' },
  ],
  'music.task.detail': [
    { key: 'costs', label: '成本明细', permission: 'billing.cost.view' },
    { key: 'overview', label: '概览', permission: 'music.view' },
    { key: 'operations', label: '运营', permission: 'project.manage' },
  ],
  'tools.lrc.detail': [
    { key: 'costs', label: '成本明细', permission: 'billing.cost.view' },
    { key: 'overview', label: '概览', permission: 'tools.lrc.view' },
  ],
  'logs.page': [
    { key: 'tail', label: '实时', permission: 'logs.view' },
    { key: 'history', label: '历史检索', permission: 'logs.search' },
  ],
};

export function hasPermission(
  permissions: string[] | undefined,
  code: string,
): boolean {
  if (!permissions?.length) return false;
  if (permissions.includes('*')) return true;
  return permissions.includes(code);
}

export function resolveRoutePermission(pathname: string): string | null {
  const sorted = [...ROUTE_PERMISSION_RULES].sort(
    (a, b) => b.prefix.length - a.prefix.length,
  );
  for (const rule of sorted) {
    if (rule.exact) {
      if (pathname === rule.prefix) return rule.permission;
      continue;
    }
    if (pathname === rule.prefix || pathname.startsWith(rule.prefix + '/')) {
      return rule.permission;
    }
  }
  return null;
}

export function canAccessRoute(
  permissions: string[] | undefined,
  pathname: string,
): boolean {
  const required = resolveRoutePermission(pathname);
  if (!required) return true;
  return hasPermission(permissions, required);
}

export function canAccessTab(
  permissions: string[] | undefined,
  pageKey: string,
  tabKey: string,
): boolean {
  const tabs = TAB_PERMISSION_REGISTRY[pageKey];
  const tab = tabs?.find((t) => t.key === tabKey);
  if (!tab) return true;
  return hasPermission(permissions, tab.permission);
}

export function firstAllowedTab(
  permissions: string[] | undefined,
  pageKey: string,
): string | null {
  const tabs = TAB_PERMISSION_REGISTRY[pageKey];
  if (!tabs?.length) return null;
  const allowed = tabs.find((t) => hasPermission(permissions, t.permission));
  return allowed?.key ?? null;
}
