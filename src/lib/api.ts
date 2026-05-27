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

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('admin_refresh_token');

      if (!refreshToken) {
        // No refresh token — user was never logged in or already signed out.
        // Just reject; the AdminLayout guard will redirect to /login if needed.
        return Promise.reject(error.response?.data || error);
      }

      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const tokens = response.data?.data ?? response.data;
        const { accessToken, refreshToken: newRefreshToken } = tokens;
        localStorage.setItem('admin_access_token', accessToken);
        localStorage.setItem('admin_refresh_token', newRefreshToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch {
        // Refresh failed → session truly expired.
        // Clear tokens AND the Zustand-persisted auth state so the login page
        // doesn't see isAuthenticated=true and redirect straight back to /admin.
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
