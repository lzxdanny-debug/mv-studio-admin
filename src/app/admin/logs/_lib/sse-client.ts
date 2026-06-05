/**
 * 轻量 SSE 客户端：用 fetch + ReadableStream 自行解析 text/event-stream。
 *
 * 比原生 EventSource 多两个关键能力：
 *   1. 支持自定义 Authorization header（admin JWT 必需）
 *   2. 401 时能拿到 token，触发 refresh 后重连（admin api.ts 已有 refresh 单例）
 *
 * 协议子集（够用即可，不实现 retry: 字段）：
 *   data: {...json...}\n
 *   data: {...json...}\n
 *   \n               ← 空行表示一个 event 结束
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api';

export interface SseClientOpts<T> {
  path: string; // 不含 baseURL，例如 '/admin/logs/tail?files=...'
  onEvent: (data: T) => void;
  onError?: (err: Error) => void;
  signal: AbortSignal;
}

export async function startSse<T = any>(opts: SseClientOpts<T>): Promise<void> {
  const { path, onEvent, onError, signal } = opts;

  const token =
    typeof window !== 'undefined' ? localStorage.getItem('admin_access_token') : null;

  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal,
  });

  if (!res.ok || !res.body) {
    const txt = await safeText(res);
    throw new Error(`SSE 连接失败 ${res.status}: ${txt.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      // 按 \n\n 分包
      let idx: number;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const dataLines: string[] = [];
        for (const line of block.split('\n')) {
          if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).replace(/^ /, ''));
          }
        }
        if (!dataLines.length) continue;
        const text = dataLines.join('\n');
        try {
          const parsed = JSON.parse(text) as T;
          onEvent(parsed);
        } catch (err) {
          onError?.(new Error(`SSE 数据解析失败: ${text.slice(0, 200)}`));
        }
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return;
    onError?.(err instanceof Error ? err : new Error(String(err)));
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
