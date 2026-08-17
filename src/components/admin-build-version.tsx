'use client';

import { useEffect, useState } from 'react';
import { BUILD_INFO } from '@/generated/build-info';
import { API_URL } from '@/lib/api';

type BuildInfo = {
  service: string;
  version: string;
  gitSha: string;
  buildTime: string;
};

function formatBuildTime(iso: string) {
  if (!iso || iso.startsWith('1970')) return '';
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

export function AdminBuildVersion() {
  const [apiInfo, setApiInfo] = useState<BuildInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    const apiOrigin = API_URL.replace(/\/api\/?$/, '');
    fetch(`${apiOrigin}/version`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.service) setApiInfo(data as BuildInfo);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const builtAt = formatBuildTime(BUILD_INFO.buildTime);

  return (
    <div className="px-3 pb-2 text-[10px] leading-relaxed text-slate-400">
      <p title={BUILD_INFO.buildTime}>
        Admin v{BUILD_INFO.version} · {BUILD_INFO.gitSha}
        {builtAt ? ` · ${builtAt}` : ''}
      </p>
      {apiInfo && (
        <p className="mt-0.5" title={apiInfo.buildTime}>
          API v{apiInfo.version} · {apiInfo.gitSha}
        </p>
      )}
    </div>
  );
}
