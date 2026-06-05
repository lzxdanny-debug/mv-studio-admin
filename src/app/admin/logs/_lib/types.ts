export type LogLevel = 'log' | 'warn' | 'error' | 'debug' | 'verbose' | 'fatal' | 'unknown';

export interface ParsedLogLine {
  timestamp: string | null;
  level: LogLevel;
  context: string | null;
  userTag: string | null;
  message: string;
  raw: string;
}

export interface LogLine extends ParsedLogLine {
  file: string;
  seq: number;
}

export interface LogFileMeta {
  name: string;
  size: number;
  mtime: string;
  active: boolean;
  app: string;
  stream: 'out' | 'err';
  /** 单文件超过 oversizeThreshold（默认 500MB），UI 应高亮提示先 logrotate */
  oversize: boolean;
}

export interface SearchHit {
  file: string;
  lineNumber: number;
  parsed: ParsedLogLine;
}

export interface SearchResult {
  hits: SearchHit[];
  truncated: boolean;
  scanned: { files: number; bytes: number };
  elapsedMs: number;
}

export interface FilesResp {
  files: LogFileMeta[];
  logDir: string;
}

export type SseEnvelope =
  | { type: 'line'; payload: LogLine }
  | { type: 'error'; payload: { message: string; fatal?: boolean } }
  | { type: 'heartbeat'; t: number };
