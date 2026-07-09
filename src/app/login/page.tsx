'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import apiClient from '@/lib/api';

interface CaptchaChallenge {
  captchaId: string;
  imageDataUrl: string;
  expiresInSec: number;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, logout, isAuthenticated, adminUser } = useAdminAuthStore();
  const [mounted, setMounted] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      const data = (await apiClient.get('/admin/auth/captcha')) as CaptchaChallenge;
      setCaptcha(data);
      setCaptchaCode('');
    } catch (err: any) {
      setError(err?.message || '验证码加载失败，请刷新页面');
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      void loadCaptcha();
    }
  }, [mounted, loadCaptcha]);

  useEffect(() => {
    if (!mounted) return;
    if (isAuthenticated && adminUser) {
      const hasToken =
        !!localStorage.getItem('admin_access_token') ||
        !!localStorage.getItem('admin_refresh_token');
      if (hasToken) {
        router.replace('/admin');
      } else {
        logout();
      }
    }
  }, [mounted, isAuthenticated, adminUser, router, logout]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!captcha?.captchaId) {
      setError('验证码未就绪，请稍后重试');
      return;
    }
    if (!captchaCode.trim()) {
      setError('请输入验证码');
      return;
    }
    setLoading(true);
    try {
      await login(identifier, password, {
        captchaId: captcha.captchaId,
        captchaCode: captchaCode.trim(),
      });
      router.replace('/admin');
    } catch (err: any) {
      setError(err?.message || '登录失败，请检查账号密码');
      await loadCaptcha();
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return <div style={{ height: '100vh', backgroundColor: '#f5f7fa' }} />;
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-teal-600 flex items-center justify-center shadow-lg shadow-teal-100">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-900">AI Studio 管理后台</h1>
            <p className="text-sm text-slate-500 mt-1">仅限管理员登录</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">管理员邮箱</label>
            <input
              type="email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="admin@example.com"
              required
              autoComplete="username"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">密码</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
                autoComplete="current-password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">图形验证码</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadCaptcha()}
                disabled={captchaLoading}
                title="点击换一张"
                className="flex-shrink-0 h-12 w-[132px] rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center cursor-pointer hover:border-teal-300 hover:bg-teal-50/40 disabled:opacity-50 disabled:cursor-wait transition-colors"
              >
                {captcha?.imageDataUrl && !captchaLoading ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={captcha.imageDataUrl}
                    alt="验证码，点击刷新"
                    className="h-full w-full object-contain pointer-events-none"
                  />
                ) : (
                  <span className="text-[10px] text-slate-400">
                    {captchaLoading ? '刷新中…' : '加载中…'}
                  </span>
                )}
              </button>
              <input
                type="text"
                value={captchaCode}
                onChange={(e) => setCaptchaCode(e.target.value.toUpperCase())}
                placeholder="验证码"
                required
                autoComplete="off"
                maxLength={6}
                className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all uppercase tracking-widest"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || captchaLoading || !captcha}
            className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-sm text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
