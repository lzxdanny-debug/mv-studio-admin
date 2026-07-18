'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Film,
  Palette,
  UserSquare,
  SlidersHorizontal,
  Disc3,
  FileText,
  Users,
  MessageCircle,
  Crown,
  Shield,
  ShieldAlert,
  Receipt,
  Undo2,
  Activity,
  CreditCard,
  Coins,
  Boxes,
  BarChart3,
  LineChart,
  TrendingUp,
  Cloud,
  Cable,
  KeyRound,
  ShieldCheck,
  Terminal,
  Settings,
  HardDrive,
  LogOut,
  CalendarCheck,
  ChevronDown,
  FolderKanban,
  Layers,
  ListOrdered,
  PersonStanding,
  ShoppingBag,
  Sparkles,
  Gift,
  Route,
  AlertTriangle,
  Mail,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { resolveRoutePermission, hasPermission } from '@/lib/admin-permissions';
import apiClient from '@/lib/api';

// ─── 导航类型 ────────────────────────────────────────────────────────────

type NavLink = {
  href: string;
  label: string;
  icon?: LucideIcon;
  exact?: boolean;
  badgeKey?: 'feedbackUnread';
  permission?: string;
};

type NavSubgroup = {
  key: string;
  label: string;
  icon?: LucideIcon;
  items: NavLink[];
};

type NavSection = {
  key: string;
  title: string;
  /** 无二级分组时的直链（如仪表盘） */
  items?: NavLink[];
  subgroups?: NavSubgroup[];
};

// ─── 导航配置 ────────────────────────────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
  {
    key: 'dashboard',
    title: '仪表盘',
    items: [
      {
        href: '/admin',
        label: '仪表盘',
        icon: LayoutDashboard,
        exact: true,
        permission: 'dashboard.view',
      },
    ],
  },
  {
    key: 'mv',
    title: 'MV 业务',
    subgroups: [
      {
        key: 'mv-project',
        label: '项目管理',
        icon: FolderKanban,
        items: [
          { href: '/admin/mv/projects', label: 'MV 项目', icon: Film, permission: 'project.view' },
          { href: '/admin/mv/charts', label: '热门榜单', icon: ListOrdered, permission: 'project.view' },
        ],
      },
      {
        key: 'mv-anomaly',
        label: '异常管理',
        icon: AlertTriangle,
        items: [
          {
            href: '/admin/mv/anomalies/failed-shots',
            label: '镜头视频失败',
            icon: AlertTriangle,
            permission: 'mv.anomaly.view',
          },
          {
            href: '/admin/mv/anomalies/storyboards',
            label: '故事板异常',
            icon: AlertTriangle,
            permission: 'mv.anomaly.view',
          },
        ],
      },
      {
        key: 'mv-content',
        label: '内容配置',
        icon: Layers,
        items: [
          { href: '/admin/mv/styles', label: '风格库', icon: Palette, permission: 'asset.view' },
          {
            href: '/admin/mv/dance-styles',
            label: '舞蹈风格库',
            icon: PersonStanding,
            permission: 'asset.view',
          },
          {
            href: '/admin/mv/beat-effects',
            label: '节拍特效库',
            icon: Activity,
            permission: 'asset.view',
          },
          {
            href: '/admin/mv/character-presets',
            label: '默认角色图',
            icon: UserSquare,
            permission: 'asset.view',
          },
          {
            href: '/admin/mv/defaults',
            label: 'MV 默认配置',
            icon: SlidersHorizontal,
            permission: 'system.manage',
          },
          {
            href: '/admin/content/discovery',
            label: 'Discovery 搜索',
            icon: Sparkles,
            permission: 'system.manage',
          },
        ],
      },
    ],
  },
  {
    key: 'music',
    title: '音乐业务',
    items: [
      { href: '/admin/music/tasks', label: '音乐任务', icon: Disc3, permission: 'music.view' },
      { href: '/admin/tools/lrc', label: 'LRC 任务', icon: FileText, permission: 'tools.lrc.view' },
    ],
  },
  {
    key: 'ops',
    title: '用户运营',
    subgroups: [
      {
        key: 'ops-users',
        label: '用户管理',
        icon: Users,
        items: [
          { href: '/admin/users', label: 'C 端用户', icon: Users, permission: 'user.view' },
          {
            href: '/admin/users/notifications',
            label: '消息管理',
            icon: Bell,
            permission: 'notification.view',
          },
          {
            href: '/admin/users/email-logs',
            label: '已发送邮件',
            icon: Mail,
            permission: 'user.email_log.view',
          },
          {
            href: '/admin/feedback',
            label: '用户反馈',
            icon: MessageCircle,
            badgeKey: 'feedbackUnread',
            permission: 'feedback.view',
          },
        ],
      },
      {
        key: 'ops-membership',
        label: '会员管理',
        icon: Crown,
        items: [
          {
            href: '/admin/billing/membership/plans',
            label: '会员套餐',
            icon: Crown,
            permission: 'billing.manage',
          },
          {
            href: '/admin/billing/membership/entitlements',
            label: '会员权益',
            icon: Sparkles,
            permission: 'billing.manage',
          },
        ],
      },
    ],
  },
  {
    key: 'billing',
    title: '计费中心',
    subgroups: [
      {
        key: 'billing-orders',
        label: '订单管理',
        icon: Receipt,
        items: [
          {
            href: '/admin/billing/payments',
            label: '充值记录',
            icon: Receipt,
            permission: 'billing.payments.view',
          },
          {
            href: '/admin/billing/refunds',
            label: '退款审核',
            icon: Undo2,
            permission: 'billing.refunds.view',
          },
          {
            href: '/admin/billing/events',
            label: 'Stripe 事件',
            icon: Activity,
            permission: 'billing.events.view',
          },
        ],
      },
      {
        key: 'billing-credits',
        label: '积分管理',
        icon: Coins,
        items: [
          {
            href: '/admin/billing/credits',
            label: '积分总览',
            icon: Coins,
            exact: true,
            permission: 'credit.view',
          },
          {
            href: '/admin/billing/credits/purchase',
            label: '充值',
            icon: CreditCard,
            permission: 'credit.view',
          },
          {
            href: '/admin/billing/credits/signup',
            label: '注册赠送',
            icon: Gift,
            permission: 'credit.view',
          },
          {
            href: '/admin/billing/credits/daily-check-in',
            label: '每日登录',
            icon: CalendarCheck,
            permission: 'credit.view',
          },
          {
            href: '/admin/billing/credits/referral',
            label: '邀请奖励',
            icon: Users,
            permission: 'credit.view',
          },
          {
            href: '/admin/billing/credits/admin-adjust',
            label: '手动调整',
            icon: SlidersHorizontal,
            permission: 'credit.view',
          },
        ],
      },
      {
        key: 'billing-recharge',
        label: '充值配置',
        icon: CreditCard,
        items: [
          {
            href: '/admin/billing/settings',
            label: '充值设置',
            icon: CreditCard,
            permission: 'billing.manage',
          },
          {
            href: '/admin/billing/bonus-config',
            label: '赠送积分',
            icon: Gift,
            permission: 'billing.manage',
          },
          {
            href: '/admin/billing/packages',
            label: '积分套餐',
            icon: ShoppingBag,
            permission: 'billing.manage',
          },
        ],
      },
      {
        key: 'billing-pricing',
        label: 'MV定价',
        icon: Coins,
        items: [
          {
            href: '/admin/billing/models',
            label: 'MV 模型配置',
            icon: Boxes,
            permission: 'billing.manage',
          },
          {
            href: '/admin/billing/video-pricing',
            label: '清晰度与品质',
            icon: Film,
            permission: 'billing.manage',
          },
          {
            href: '/admin/billing/pricing',
            label: '定价策略',
            icon: SlidersHorizontal,
            permission: 'billing.manage',
          },
          {
            href: '/admin/billing/step-prices',
            label: '步骤价格',
            icon: ListOrdered,
            permission: 'billing.manage',
          },
        ],
      },
      {
        key: 'billing-music',
        label: '音乐定价',
        icon: Disc3,
        items: [
          {
            href: '/admin/billing/music-pricing',
            label: '音乐模型与定价',
            icon: Disc3,
            permission: 'billing.manage',
          },
        ],
      },
      {
        key: 'billing-analytics',
        label: '成本分析',
        icon: BarChart3,
        items: [
          {
            href: '/admin/billing',
            label: '财务总览',
            icon: BarChart3,
            exact: true,
            permission: 'billing.overview.view',
          },
          {
            href: '/admin/billing/cost',
            label: '成本统计',
            icon: LineChart,
            permission: 'billing.cost.view',
          },
          {
            href: '/admin/billing/profit',
            label: '利润分析',
            icon: TrendingUp,
            permission: 'billing.cost.view',
          },
          {
            href: '/admin/billing/bonus',
            label: '赠送积分',
            icon: Gift,
            permission: 'billing.cost.view',
          },
          {
            href: '/admin/billing/referrals',
            label: '邀请拉新',
            icon: Users,
            permission: 'billing.cost.view',
          },
        ],
      },
    ],
  },
  {
    key: 'ai',
    title: 'AI 中心',
    subgroups: [
      {
        key: 'ai-provider',
        label: 'Provider 管理',
        icon: Cloud,
        items: [
          {
            href: '/admin/ai-providers',
            label: 'AI Provider',
            icon: Cloud,
            permission: 'provider.manage',
          },
        ],
      },
      {
        key: 'ai-routing',
        label: '路由策略',
        icon: Route,
        items: [
          {
            href: '/admin/ai-routing',
            label: 'AI 路由配置',
            icon: Cable,
            permission: 'ai.routing.view',
          },
        ],
      },
    ],
  },
  {
    key: 'system',
    title: '系统中心',
    subgroups: [
      {
        key: 'sys-rbac',
        label: '权限管理',
        icon: ShieldCheck,
        items: [
          {
            href: '/admin/admin-users',
            label: '后台管理员',
            icon: KeyRound,
            permission: 'admin.manage',
          },
          {
            href: '/admin/roles',
            label: '角色权限',
            icon: ShieldCheck,
            permission: 'admin.manage',
          },
        ],
      },
      {
        key: 'sys-ops',
        label: '系统管理',
        icon: Settings,
        items: [
          { href: '/admin/logs', label: '系统日志', icon: Terminal, permission: 'logs.view' },
          {
            href: '/admin/settings',
            label: '系统设置',
            icon: Settings,
            permission: 'system.manage',
          },
          {
            href: '/admin/local-storage',
            label: '本地存储',
            icon: HardDrive,
            permission: 'system.manage',
          },
        ],
      },
    ],
  },
  {
    key: 'risk',
    title: '风控中心',
    subgroups: [
      {
        key: 'risk-policy',
        label: '风控策略',
        icon: Shield,
        items: [
          {
            href: '/admin/risk/config',
            label: '封控参数',
            icon: Shield,
            permission: 'risk.view',
          },
          {
            href: '/admin/risk/blocklist',
            label: '封控黑名单',
            icon: ShieldAlert,
            permission: 'risk.view',
          },
          {
            href: '/admin/risk/allowlist',
            label: '信任白名单',
            icon: ShieldCheck,
            permission: 'risk.view',
          },
        ],
      },
    ],
  },
];

// ─── 工具函数 ────────────────────────────────────────────────────────────

function itemVisible(permissions: string[], item: NavLink): boolean {
  const perm = item.permission ?? resolveRoutePermission(item.href);
  if (!perm) return true;
  return hasPermission(permissions, perm);
}

function subgroupVisible(permissions: string[], subgroup: NavSubgroup): boolean {
  return subgroup.items.some((item) => itemVisible(permissions, item));
}

function sectionVisible(permissions: string[], section: NavSection): boolean {
  if (section.items?.length) {
    return section.items.some((item) => itemVisible(permissions, item));
  }
  return (section.subgroups ?? []).some((sg) => subgroupVisible(permissions, sg));
}

function isLinkActive(pathname: string, href: string, exact = false): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

/** 同组菜单中取最长匹配路径，避免 /admin/users 与 /admin/users/email-logs 同时高亮 */
function pickActiveNavItem(pathname: string, items: NavLink[]): NavLink | undefined {
  let best: NavLink | undefined;
  for (const item of items) {
    if (!isLinkActive(pathname, item.href, item.exact)) continue;
    if (!best || item.href.length > best.href.length) best = item;
  }
  return best;
}

function subgroupHasActive(pathname: string, subgroup: NavSubgroup): boolean {
  return !!pickActiveNavItem(pathname, subgroup.items);
}

function sectionHasActive(pathname: string, section: NavSection): boolean {
  if (section.items?.some((item) => isLinkActive(pathname, item.href, item.exact))) {
    return true;
  }
  return (section.subgroups ?? []).some((sg) => subgroupHasActive(pathname, sg));
}

function collectSubgroupKeys(pathname: string): Set<string> {
  const keys = new Set<string>();
  for (const section of NAV_SECTIONS) {
    for (const sg of section.subgroups ?? []) {
      if (subgroupHasActive(pathname, sg)) keys.add(sg.key);
    }
  }
  return keys;
}

// ─── 子组件 ──────────────────────────────────────────────────────────────

function NavLeaf({
  item,
  badges,
  depth = 2,
  activeHref,
}: {
  item: NavLink;
  badges: Record<string, number>;
  depth?: number;
  /** 同组内最长匹配 href；传入时仅该项高亮 */
  activeHref?: string;
}) {
  const pathname = usePathname();
  const active =
    activeHref !== undefined
      ? activeHref === item.href
      : isLinkActive(pathname, item.href, item.exact);
  const badge = item.badgeKey ? badges[item.badgeKey] : 0;
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-lg text-sm transition-all duration-150',
        depth === 2 ? 'ml-3 mr-1.5 pl-3 pr-2.5 py-2.5' : 'px-3 py-2.5',
        active
          ? 'bg-blue-50 text-blue-800 font-medium'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-blue-600" />
      )}
      {Icon && (
        <Icon
          className={cn(
            'h-4 w-4 flex-shrink-0 transition-colors',
            active ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-700',
          )}
        />
      )}
      <span className="flex-1 truncate">{item.label}</span>
      {badge > 0 && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full text-[11px] font-bold bg-red-500 text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

function NavSubgroupBlock({
  subgroup,
  permissions,
  badges,
  expanded,
  onToggle,
}: {
  subgroup: NavSubgroup;
  permissions: string[];
  badges: Record<string, number>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const visibleItems = subgroup.items.filter((item) => itemVisible(permissions, item));
  if (!visibleItems.length) return null;

  const active = subgroupHasActive(pathname, subgroup);
  const activeHref = pickActiveNavItem(pathname, visibleItems)?.href;
  const SubIcon = subgroup.icon;

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors',
          active ? 'text-blue-900' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/80',
        )}
      >
        {SubIcon && (
          <SubIcon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-blue-600' : 'text-slate-500')} />
        )}
        <span className="flex-1 text-[13px] font-semibold tracking-wide truncate">
          {subgroup.label}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 flex-shrink-0 text-slate-500 transition-transform duration-200',
            expanded ? 'rotate-0' : '-rotate-90',
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="pt-0.5 pb-1 space-y-0.5 border-l-2 border-slate-200 ml-5">
            {visibleItems.map((item) => (
              <NavLeaf key={item.href} item={item} badges={badges} activeHref={activeHref} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NavSectionBlock({
  section,
  permissions,
  badges,
  expandedSubgroups,
  onToggleSubgroup,
  showDivider,
}: {
  section: NavSection;
  permissions: string[];
  badges: Record<string, number>;
  expandedSubgroups: Set<string>;
  onToggleSubgroup: (key: string) => void;
  showDivider?: boolean;
}) {
  const pathname = usePathname();
  if (!sectionVisible(permissions, section)) return null;

  const sectionActive = sectionHasActive(pathname, section);

  const sectionHeader = (
    <div className="px-3 pt-3 pb-2">
      <span
        className={cn(
          'text-[10px] font-semibold tracking-wide',
          sectionActive ? 'text-slate-600' : 'text-slate-400',
        )}
      >
        {section.title}
      </span>
    </div>
  );

  // 仪表盘等直链区块
  if (section.items?.length) {
    const visible = section.items.filter((item) => itemVisible(permissions, item));
    if (!visible.length) return null;
    return (
      <div className={cn(showDivider && 'border-t border-slate-200 mt-1 pt-1')}>
        {sectionHeader}
        <div className="space-y-0.5 px-1.5 pb-1">
          {visible.map((item) => (
            <NavLeaf key={item.href} item={item} badges={badges} depth={1} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(showDivider && 'border-t border-slate-200 mt-1 pt-1')}>
      {sectionHeader}
      <div className="px-1 pb-1">
        {(section.subgroups ?? []).map((sg) =>
          subgroupVisible(permissions, sg) ? (
            <NavSubgroupBlock
              key={sg.key}
              subgroup={sg}
              permissions={permissions}
              badges={badges}
              expanded={expandedSubgroups.has(sg.key)}
              onToggle={() => onToggleSubgroup(sg.key)}
            />
          ) : null,
        )}
      </div>
    </div>
  );
}

// ─── 主组件 ──────────────────────────────────────────────────────────────

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { adminUser, permissions, logout } = useAdminAuthStore();

  const [expandedSubgroups, setExpandedSubgroups] = useState<Set<string>>(() =>
    collectSubgroupKeys(pathname),
  );

  // 路由变化时自动展开含当前页的二级分组
  useEffect(() => {
    setExpandedSubgroups((prev) => {
      const next = new Set(prev);
      for (const key of collectSubgroupKeys(pathname)) next.add(key);
      return next;
    });
  }, [pathname]);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['admin', 'feedback', 'unread'],
    queryFn: () => apiClient.get('/admin/feedback/unread-count') as any,
    refetchInterval: 30_000,
    retry: false,
    enabled: hasPermission(permissions, 'feedback.view'),
  });

  const badges = useMemo(
    () => ({ feedbackUnread: unreadData?.count ?? 0 }),
    [unreadData?.count],
  );

  const visibleSections = useMemo(
    () => NAV_SECTIONS.filter((s) => sectionVisible(permissions, s)),
    [permissions],
  );

  const toggleSubgroup = (key: string) => {
    setExpandedSubgroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className="w-[252px] h-full flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <div className="h-12 flex items-center px-4 border-b border-slate-200 flex-shrink-0 bg-white">
        <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Shield className="h-3.5 w-3.5 text-white" />
        </div>
        <p className="ml-2.5 text-sm font-semibold text-slate-700 truncate">管理后台</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto scrollbar-thin">
        {visibleSections.map((section, idx) => (
          <NavSectionBlock
            key={section.key}
            section={section}
            permissions={permissions}
            badges={badges}
            expandedSubgroups={expandedSubgroups}
            onToggleSubgroup={toggleSubgroup}
            showDivider={idx > 0}
          />
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-4 flex-shrink-0 border-t border-slate-200/80 pt-3 bg-white/60">
        <div className="flex items-center gap-2.5 px-2 py-2 mb-1 rounded-lg bg-slate-50">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-bold text-white">
              {adminUser?.displayName?.[0]?.toUpperCase() || 'A'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-800 font-semibold truncate">{adminUser?.displayName}</p>
            <p className="text-xs text-slate-500 truncate">{adminUser?.email || '管理员'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors font-medium"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </div>
    </aside>
  );
}
