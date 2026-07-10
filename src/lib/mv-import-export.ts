/**
 * Admin 端 MV 项目导出 / 导入工具。
 *
 * 后端端点：
 *   - GET  /admin/mv/projects/:id/export → 返回完整 JSON 载荷
 *   - POST /admin/mv/projects/import     → 接收载荷，归属到当前 admin
 *
 * 设计要点：
 *   - 文件本体不打包，URL 原样保留指向线上 COS，本地通过公网直拉
 *   - 主键全部重新生成 UUID（同一载荷可重复导入产生副本）
 *   - 失败 toast：组件层调用方负责，本模块只 throw
 */

import apiClient from '@/lib/api';

export interface MvExportPayload {
  version: number;
  exportedAt: string;
  source: {
    projectId: string;
    userId: string;
    userEmail: string | null;
    userDisplayName: string | null;
    originalCreatedAt: string;
  };
  project: {
    id: string;
    title: string;
    [k: string]: unknown;
  };
  shots: Array<Record<string, unknown>>;
  planning: Array<Record<string, unknown>>;
  assets: Array<Record<string, unknown>>;
  agentMessages?: Array<Record<string, unknown>>;
}

/**
 * 把标题里影响文件名安全性的字符替换为 `-`，限制长度防文件名过长。
 * 用于生成形如 `mv-超长歌曲名-3a8f-20260528-0930.json` 的文件名。
 */
function slugifyForFilename(input: string, maxLen = 40): string {
  const cleaned = (input || '').trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!cleaned) return 'untitled';
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

function formatTimestamp(d = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes())
  );
}

/**
 * 触发浏览器下载某个 MV 项目的导出 JSON。
 * 失败时抛错给调用方做 toast。
 */
export async function exportMvProject(projectId: string, title?: string): Promise<void> {
  const payload = (await apiClient.get(
    `/admin/mv/projects/${projectId}/export`,
  )) as MvExportPayload;

  if (!payload || typeof payload !== 'object' || !payload.project) {
    throw new Error('导出失败：服务端返回的载荷格式不正确');
  }

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const idShort = projectId.slice(0, 4);
  const titleSlug = slugifyForFilename(title ?? payload.project.title ?? '');
  const filename = `mv-${titleSlug}-${idShort}-${formatTimestamp()}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 读取 File 内容并 POST 到导入端点。
 * 返回新建项目的 ID，调用方可据此跳转到详情页。
 * 校验：必须是合法 JSON，必须含 version + project，否则前端先拒掉，不浪费请求。
 */
export async function importMvProject(file: File): Promise<{ newProjectId: string }> {
  const text = await file.text();
  let payload: MvExportPayload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('文件不是合法的 JSON，请确认选择的是导出生成的 .json 文件');
  }
  if (!payload || typeof payload !== 'object' || !payload.version || !payload.project) {
    throw new Error('JSON 格式不正确：缺少 version 或 project 字段');
  }

  return (await apiClient.post(
    '/admin/mv/projects/import',
    payload,
  )) as { newProjectId: string };
}
