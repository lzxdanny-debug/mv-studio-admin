import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api';

/**
 * Resets the Zustand-persisted admin auth state without importing the store
 * (avoids circular dependency). The store key is defined in auth.store.ts as
 * 'admin-auth'. We only reset user/isAuthenticated to avoid stale redirect loops.
 */
function clearPersistedAuthState() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('admin-auth');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.state) {
      parsed.state.user = null;
      parsed.state.isAuthenticated = false;
      localStorage.setItem('admin-auth', JSON.stringify(parsed));
    }
  } catch {
    localStorage.removeItem('admin-auth');
  }
}

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: false,
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/**
 * 单例化 refresh —— 同一时刻只有一个 /auth/refresh 在飞。
 *
 * 历史问题：admin 后台同时存在多个轮询（sidebar feedback unread-count 每 30s + 列表页 react-query），
 *   token 过期那一刻可能并发触发多个 401。如果每个 401 都独立去调 /auth/refresh，
 *   后端会用最新一次的 jti 覆盖 Redis，前面已经"在路上"的 refresh 用的还是旧 jti 会校验失败 → 踢登录。
 *
 * 解决方案：refresh 共享同一个 in-flight Promise，所有并发 401 等同一个结果。
 *   refresh 完成后无论成败都清掉 promise，下一波 401 才会发起新的 refresh。
 */
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = localStorage.getItem('admin_refresh_token');
    if (!refreshToken) {
      throw new Error('NO_REFRESH_TOKEN');
    }
    const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
    const tokens = response.data?.data ?? response.data;
    const { accessToken, refreshToken: newRefreshToken } = tokens;
    localStorage.setItem('admin_access_token', accessToken);
    localStorage.setItem('admin_refresh_token', newRefreshToken);
    return accessToken;
  })();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

apiClient.interceptors.response.use(
  (response) => {
    // API 的 TransformInterceptor 统一包了一层 { success, data, timestamp }
    // 在这里解包，让调用方直接拿到业务数据
    const body = response.data;
    if (body && typeof body === 'object' && 'success' in body) {
      return body.data;
    }
    return body;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      // 没有 refresh token —— 用户从未登录或已登出，直接 reject，
      // AdminLayout 的 guard 会负责把它重定向到 /login
      if (!localStorage.getItem('admin_refresh_token')) {
        return Promise.reject(error.response?.data || error);
      }

      try {
        const newAccessToken = await refreshAccessToken();
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch {
        // Refresh failed → session truly expired (refresh 也过期 / 被踢下线 / redis 失效)。
        // 清掉所有持久化状态，避免 /login 看到 isAuthenticated=true 又跳回来。
        localStorage.removeItem('admin_access_token');
        localStorage.removeItem('admin_refresh_token');
        clearPersistedAuthState();
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }

    return Promise.reject(error.response?.data || error);
  },
);

export default apiClient;
