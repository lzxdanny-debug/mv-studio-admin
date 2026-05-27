'use client';

import { AlertTriangle, RefreshCw, LogIn, Inbox } from 'lucide-react';
import { useRouter } from 'next/navigation';

function goToLogin() {
  // Clear stale Zustand-persisted auth state before navigating so the login
  // page doesn't see isAuthenticated=true and immediately redirect back.
  try {
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin-auth');
  } catch { /* ignore */ }
  window.location.href = '/login';
}

interface QueryStateProps {
  isLoading?: boolean;
  isError?: boolean;
  error?: any;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  /** height of the container, defaults to 'h-64' */
  height?: string;
  children: React.ReactNode;
}

/** Resolves an error object from React Query / axios into a human-readable message. */
function resolveErrorMsg(error: any): { msg: string; isAuth: boolean } {
  const statusCode = error?.statusCode ?? error?.response?.status;
  const msg =
    error?.message ||
    error?.error ||
    error?.response?.data?.message ||
    '请求失败，请稍后重试';

  if (statusCode === 401 || msg.includes('登录') || msg.includes('授权') || msg.includes('token')) {
    return { msg: '登录已过期，请重新登录', isAuth: true };
  }
  if (statusCode === 403) {
    return { msg: '权限不足，无法访问此资源', isAuth: false };
  }
  return { msg, isAuth: false };
}

/**
 * Wrapper that renders loading / error / empty states automatically.
 * Usage:
 *   <QueryState isLoading={isLoading} isError={isError} error={error} isEmpty={!data?.length}>
 *     <YourTable ... />
 *   </QueryState>
 */
export function QueryState({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyMessage = '暂无数据',
  emptyIcon,
  height = 'h-64',
  children,
}: QueryStateProps) {
  const router = useRouter(); // kept for potential future use

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${height}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-slate-300 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">加载中…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    const { msg, isAuth } = resolveErrorMsg(error);
    return (
      <div className={`flex items-center justify-center ${height}`}>
        <div className="flex flex-col items-center gap-4 max-w-xs text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">加载失败</p>
            <p className="text-xs text-slate-400">{msg}</p>
          </div>
          {isAuth ? (
            <button
              onClick={goToLogin}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-colors"
            >
              <LogIn className="h-3.5 w-3.5" />
              重新登录
            </button>
          ) : (
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              刷新重试
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={`flex items-center justify-center ${height}`}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
            {emptyIcon ?? <Inbox className="h-5 w-5 text-slate-400" />}
          </div>
          <p className="text-sm text-slate-400">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
