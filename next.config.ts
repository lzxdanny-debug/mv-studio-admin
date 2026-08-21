import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NextConfig } from 'next';

/** next.config 评估时 Next 尚未加载 .env，需手动读 DEV_LAN_HOST */
function readDevLanHost(): string | undefined {
  const fromEnv = process.env.DEV_LAN_HOST?.trim();
  if (fromEnv) return fromEnv.replace(/:\d+$/, '');

  for (const file of ['.env.development.local', '.env.local']) {
    const path = join(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      if (trimmed.startsWith('DEV_LAN_HOST=')) {
        const value = trimmed.slice('DEV_LAN_HOST='.length).trim();
        if (value) return value.replace(/:\d+$/, '');
      }
    }
  }
  return undefined;
}

const devLanHost = readDevLanHost();

const nextConfig: NextConfig = {
  // 明确限定 Turbopack 的项目边界，避免其拾取上级 ai-studio 的锁文件，
  // 从而在页面移动后持有跨仓库的失效文件索引。
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: true,
  },
  // Next.js 16 只匹配 hostname，不含端口：'192.168.0.186' ✓  '192.168.0.186:4002' ✗
  ...(devLanHost ? { allowedDevOrigins: [devLanHost] } : {}),
};

export default nextConfig;
