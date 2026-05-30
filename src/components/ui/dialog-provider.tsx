'use client';

/**
 * 全局 Dialog Provider — 提供 imperative Promise API 替代 window.confirm/alert。
 *
 * ╭─ 使用方式 ─────────────────────────────────────────────────────────────────╮
 * │  // 1. 在 src/app/providers.tsx 顶层包裹（已配置）                          │
 * │  <DialogProvider>{children}</DialogProvider>                                │
 * │                                                                            │
 * │  // 2. 任何子组件中：                                                       │
 * │  const confirm = useConfirm();                                             │
 * │  const ok = await confirm({                                                │
 * │    title: '确定删除？',                                                     │
 * │    description: '此操作不可撤销',                                           │
 * │    variant: 'danger',                                                      │
 * │  });                                                                       │
 * │  if (!ok) return;                                                          │
 * │                                                                            │
 * │  const alert = useAlert();                                                 │
 * │  await alert('保存失败');                              // 简洁形式          │
 * │  await alert({ title, description, variant: 'success' }); // 完整形式      │
 * ╰────────────────────────────────────────────────────────────────────────────╯
 *
 * 设计要点：
 *   · 全局单例：Provider 挂在 app 根，所有页面/组件无需各自管理 state
 *   · Promise 接口：调用方式与 window.confirm() 相同，但不阻塞 JS 主线程
 *   · 队列调度：连续调用 confirm/alert 会排队 FIFO 显示，避免互相覆盖
 *   · 视觉复用：直接渲染 <ConfirmModal>（alert 走 hideCancel 单按钮模式）
 *   · 可扩展：如需 prompt（输入框）/ toast，按相同模式扩展即可
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ConfirmModal, type ConfirmVariant } from './confirm-modal';

// ─── 公开类型 ──────────────────────────────────────────────────────────────────

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}

export interface AlertOptions {
  title: string;
  description?: ReactNode;
  confirmText?: string;
  variant?: ConfirmVariant;
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;
export type AlertFn = (options: AlertOptions | string) => Promise<void>;

// ─── 内部队列项类型 ────────────────────────────────────────────────────────────

interface DialogItem {
  id: number;
  kind: 'confirm' | 'alert';
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  /**
   * resolver 在用户点击按钮后调用：
   * - confirm: true=确认 / false=取消
   * - alert:   总是 true（无 cancel 路径）
   */
  resolve: (value: boolean) => void;
}

// ─── Context ───────────────────────────────────────────────────────────────────

interface DialogContextValue {
  confirm: ConfirmFn;
  alert: AlertFn;
}

const DialogContext = createContext<DialogContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function DialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<DialogItem[]>([]);
  const idRef = useRef(0);

  const enqueue = useCallback((item: Omit<DialogItem, 'id'>): void => {
    idRef.current += 1;
    setQueue((prev) => [...prev, { ...item, id: idRef.current }]);
  }, []);

  const closeTop = useCallback((value: boolean) => {
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      const [head, ...rest] = prev;
      // 在 setState 里调 resolve 安全：resolve 只是触发 promise 回调，不会触发 setState 循环
      head.resolve(value);
      return rest;
    });
  }, []);

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        enqueue({ kind: 'confirm', resolve, ...options });
      }),
    [enqueue],
  );

  const alert = useCallback<AlertFn>(
    (options) => {
      const opts: AlertOptions = typeof options === 'string' ? { title: options } : options;
      return new Promise<void>((resolve) => {
        enqueue({
          kind: 'alert',
          resolve: () => resolve(),
          // alert 默认走 info 色
          variant: opts.variant ?? 'info',
          ...opts,
        });
      });
    },
    [enqueue],
  );

  const value = useMemo<DialogContextValue>(() => ({ confirm, alert }), [confirm, alert]);

  // 仅渲染队列首项（其余排队等待）
  const top = queue[0] ?? null;

  return (
    <DialogContext.Provider value={value}>
      {children}
      {top && (
        <ConfirmModal
          key={top.id}
          open
          title={top.title}
          description={top.description}
          confirmText={top.confirmText ?? (top.kind === 'alert' ? '我知道了' : '确认')}
          cancelText={top.cancelText ?? '取消'}
          variant={top.variant ?? 'default'}
          hideCancel={top.kind === 'alert'}
          onConfirm={() => closeTop(true)}
          onCancel={() => closeTop(false)}
        />
      )}
    </DialogContext.Provider>
  );
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

function useDialogContext(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useConfirm/useAlert 必须在 <DialogProvider> 内部使用');
  }
  return ctx;
}

/**
 * 替代 window.confirm()。
 * 返回 Promise<boolean>：true=用户点确认，false=用户点取消/ESC/点遮罩。
 */
export function useConfirm(): ConfirmFn {
  return useDialogContext().confirm;
}

/**
 * 替代 window.alert()。
 * 返回 Promise<void>：用户点确认后 resolve（不会拒绝）。
 * 可传字符串或完整 options：
 *   await alert('保存失败');
 *   await alert({ title: '上传成功', description: '...', variant: 'success' });
 */
export function useAlert(): AlertFn {
  return useDialogContext().alert;
}
