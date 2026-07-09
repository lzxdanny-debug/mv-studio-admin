import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '@/lib/api';
import {
  canAccessRoute,
  canAccessTab,
  hasPermission as checkPerm,
} from '@/lib/admin-permissions';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  status: string;
}

interface AdminAuthState {
  adminUser: AdminUser | null;
  roles: string[];
  permissions: string[];
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string,
    captcha: { captchaId: string; captchaCode: string },
  ) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  hasRoutePermission: (path: string) => boolean;
  hasTabPermission: (pageKey: string, tabKey: string) => boolean;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set, get) => ({
      adminUser: null,
      roles: [],
      permissions: [],
      isAuthenticated: false,

      login: async (email, password, captcha) => {
        const result = (await apiClient.post('/admin/auth/login', {
          email,
          password,
          captchaId: captcha.captchaId,
          captchaCode: captcha.captchaCode,
        })) as {
          adminUser: AdminUser;
          roles: string[];
          permissions: string[];
          accessToken: string;
          refreshToken: string;
        };
        localStorage.setItem('admin_access_token', result.accessToken);
        localStorage.setItem('admin_refresh_token', result.refreshToken);
        set({
          adminUser: result.adminUser,
          roles: result.roles,
          permissions: result.permissions,
          isAuthenticated: true,
        });
      },

      logout: () => {
        localStorage.removeItem('admin_access_token');
        localStorage.removeItem('admin_refresh_token');
        set({
          adminUser: null,
          roles: [],
          permissions: [],
          isAuthenticated: false,
        });
        try {
          localStorage.removeItem('admin-auth');
        } catch {
          /* ignore */
        }
      },

      refreshSession: async () => {
        try {
          const result = (await apiClient.get('/admin/auth/me')) as {
            adminUser: AdminUser;
            roles: string[];
            permissions: string[];
          };
          set({
            adminUser: result.adminUser,
            roles: result.roles,
            permissions: result.permissions,
            isAuthenticated: true,
          });
        } catch {
          set({
            adminUser: null,
            roles: [],
            permissions: [],
            isAuthenticated: false,
          });
        }
      },

      hasPermission: (code) => checkPerm(get().permissions, code),

      hasRoutePermission: (path) => canAccessRoute(get().permissions, path),

      hasTabPermission: (pageKey, tabKey) =>
        canAccessTab(get().permissions, pageKey, tabKey),
    }),
    {
      name: 'admin-auth',
      partialize: (state) => ({
        adminUser: state.adminUser,
        roles: state.roles,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

/** @deprecated 兼容旧引用，请改用 useAdminAuthStore */
export const useAuthStore = useAdminAuthStore;
