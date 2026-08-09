/** 路由 → permission 映射（最长前缀优先） */
export const ROUTE_PERMISSION_RULES: Array<{ prefix: string; permission: string; exact?: boolean }> = [
  { prefix: '/admin', permission: 'dashboard.view', exact: true },
  { prefix: '/admin/mv/projects', permission: 'project.view' },
  { prefix: '/admin/api-calls', permission: 'billing.cost.view' },
  { prefix: '/admin/mv/anomalies', permission: 'mv.anomaly.view' },
  { prefix: '/admin/mv/styles', permission: 'asset.view' },
  { prefix: '/admin/mv/dance-styles', permission: 'asset.view' },
  { prefix: '/admin/mv/beat-effects', permission: 'asset.view' },
  { prefix: '/admin/mv/character-presets', permission: 'asset.view' },
  { prefix: '/admin/mv/defaults', permission: 'system.manage' },
  { prefix: '/admin/content/discovery', permission: 'system.manage' },
  { prefix: '/admin/content/showcase', permission: 'marketing.view' },
  { prefix: '/admin/content/articles', permission: 'blog.view' },
  { prefix: '/admin/mv/cost-stats', permission: 'billing.cost.view' },
  { prefix: '/admin/music/tasks', permission: 'music.view' },
  { prefix: '/admin/tools/lrc', permission: 'tools.lrc.view' },
  { prefix: '/admin/users/notifications', permission: 'notification.view' },
  { prefix: '/admin/users/email-logs', permission: 'user.email_log.view' },
  { prefix: '/admin/users', permission: 'user.view' },
  { prefix: '/admin/feedback', permission: 'feedback.view' },
  { prefix: '/admin/support', permission: 'support.inbox.view' },
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
  { prefix: '/admin/billing/credits/purchase', permission: 'credit.view' },
  { prefix: '/admin/billing/credits/signup', permission: 'credit.view' },
  { prefix: '/admin/billing/credits/daily-check-in', permission: 'credit.view' },
  { prefix: '/admin/billing/credits/referral', permission: 'credit.view' },
  { prefix: '/admin/billing/credits/admin-adjust', permission: 'credit.view' },
  { prefix: '/admin/billing/credits', permission: 'credit.view', exact: true },
  { prefix: '/admin/billing/payments', permission: 'billing.payments.view' },
  { prefix: '/admin/billing/refunds', permission: 'billing.refunds.view' },
  { prefix: '/admin/billing/cost', permission: 'billing.cost.view' },
  { prefix: '/admin/billing/bonus', permission: 'billing.cost.view' },
  { prefix: '/admin/billing/referrals', permission: 'billing.cost.view' },
  { prefix: '/admin/billing/events', permission: 'billing.events.view' },
  { prefix: '/admin/risk/allowlist', permission: 'risk.view' },
  { prefix: '/admin/risk/blocklist', permission: 'risk.view' },
  { prefix: '/admin/risk/config', permission: 'risk.view' },
  { prefix: '/admin/billing', permission: 'billing.overview.view', exact: true },
  { prefix: '/admin/ai-providers', permission: 'provider.manage' },
  { prefix: '/admin/ai-routing', permission: 'ai.routing.view' },
  { prefix: '/admin/logs', permission: 'logs.view' },
  { prefix: '/admin/settings', permission: 'system.manage' },
  { prefix: '/admin/admin-users', permission: 'admin.manage' },
  { prefix: '/admin/roles', permission: 'admin.manage' },
  { prefix: '/admin/karaoke/projects', permission: 'karaoke.projects.view' },
  { prefix: '/admin/karaoke/scenes', permission: 'karaoke.scenes.view' },
  { prefix: '/admin/karaoke/settings', permission: 'karaoke.settings.view' },
  { prefix: '/admin/karaoke/cost', permission: 'karaoke.cost.view' },
  { prefix: '/admin/dance/projects', permission: 'dance.projects.view' },
  { prefix: '/admin/dance/reference-test', permission: 'dance.projects.view' },
  { prefix: '/admin/dance/visual-styles', permission: 'dance.styles.view' },
  { prefix: '/admin/dance/styles', permission: 'dance.styles.view' },
  { prefix: '/admin/dance/choreography', permission: 'dance.choreography.view' },
  { prefix: '/admin/dance/scenes', permission: 'dance.scenes.view' },
  { prefix: '/admin/dance/settings', permission: 'dance.settings.view' },
  { prefix: '/admin/dance/cost', permission: 'dance.cost.view' },
  { prefix: '/admin/video-effects/templates', permission: 'effects.template.view' },
  { prefix: '/admin/video-effects/categories', permission: 'effects.view' },
  { prefix: '/admin/video-effects/scenarios', permission: 'effects.view' },
  { prefix: '/admin/video-effects/workflows', permission: 'effects.workflow.view' },
  { prefix: '/admin/video-effects/prompts', permission: 'effects.prompt.view' },
  { prefix: '/admin/video-effects/pricing', permission: 'effects.pricing.view' },
  { prefix: '/admin/video-effects/tasks', permission: 'effects.task.view' },
  { prefix: '/admin/video-effects/settings', permission: 'effects.settings.view' },
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
  'karaoke.project.detail': [
    { key: 'overview', label: '概览', permission: 'karaoke.projects.view' },
    { key: 'segments', label: '片段', permission: 'karaoke.projects.view' },
    { key: 'costs', label: '成本明细', permission: 'karaoke.cost.view' },
    { key: 'operations', label: '操作', permission: 'karaoke.projects.retry' },
  ],
  'dance.project.detail': [
    { key: 'overview', label: '概览', permission: 'dance.projects.view' },
    { key: 'sections', label: '段落与片段', permission: 'dance.projects.view' },
    { key: 'attempts', label: '生成尝试', permission: 'dance.projects.view' },
    { key: 'costs', label: '成本明细', permission: 'dance.cost.view' },
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
  if (hasPermission(permissions, required)) return true;
  // 初期兼容：持有 system.manage 也可进入营销素材页
  if (
    required === 'marketing.view' &&
    (pathname === '/admin/content/showcase' ||
      pathname.startsWith('/admin/content/showcase/')) &&
    hasPermission(permissions, 'system.manage')
  ) {
    return true;
  }
  return false;
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
