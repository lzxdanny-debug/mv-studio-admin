import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '@/lib/api';

interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      login: async (identifier, password) => {
        // 使用专属的本地管理员登录接口，不依赖 Mountsea
        // apiClient 拦截器已自动解包 { success, data } 外层，直接拿到业务对象
        const result = await apiClient.post('/auth/admin-login', {
          email: identifier,
          password,
        }) as any;
        const { user, accessToken, refreshToken } = result;
        if (user.role !== 'admin') {
          throw new Error('当前账号无管理员权限');
        }
        localStorage.setItem('admin_access_token', accessToken);
        localStorage.setItem('admin_refresh_token', refreshToken);
        set({ user, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem('admin_access_token');
        localStorage.removeItem('admin_refresh_token');
        set({ user: null, isAuthenticated: false });
        // Also clear the persisted state immediately so a page refresh
        // doesn't resurrect the session before the store re-hydrates.
        try {
          localStorage.removeItem('admin-auth');
        } catch { /* ignore */ }
      },

      refreshUser: async () => {
        try {
          const user = await apiClient.get('/auth/me') as any;
          if (user.role !== 'admin') {
            set({ user: null, isAuthenticated: false });
            return;
          }
          set({ user, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'admin-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
);
