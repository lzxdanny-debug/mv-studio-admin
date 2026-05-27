import type { Metadata } from 'next';
import Providers from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Studio 管理后台',
  description: '平台管理后台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning style={{ backgroundColor: '#f1f5f9' }}>
      <body style={{ backgroundColor: '#f1f5f9', color: '#0f172a', margin: 0 }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
