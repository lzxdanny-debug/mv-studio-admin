'use client';

/**
 * 通用确认弹窗（视觉层）。
 *
 * 设计原则：
 *   · 实色遮罩 + 实色卡片（不用半透明感）
 *   · 5 种 variant：danger / warning / default / success / info，色调清晰
 *   · 支持 hideCancel（变成 alert：无取消按钮、ESC/点遮罩不关闭）
 *   · ESC 关闭、点击遮罩关闭（alert 模式除外）
 *   · 确认按钮 autoFocus，可直接 Enter 确认
 *
 * 一般不直接用这个组件；优先用 useConfirm() / useAlert() Hook（见 dialog-provider.tsx）。
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ConfirmVariant = 'danger' | 'warning' | 'default' | 'success' | 'info';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  /** 隐藏取消按钮 + 顶部关闭叉 + 不响应 ESC/点遮罩（alert 单按钮模式） */
  hideCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// 主操作按钮 —— danger 用实心红，其他用淡色填充
const CONFIRM_BUTTON_CLS: Record<ConfirmVariant, string> = {
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm',
  warning:
    'bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-200',
  default:
    'bg-teal-600 hover:bg-teal-700 text-white shadow-sm',
  success:
    'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-200',
  info: 'bg-sky-100 hover:bg-sky-200 text-sky-800 border border-sky-200',
};

// 左上图标色
const ICON_CLS: Record<ConfirmVariant, string> = {
  danger: 'text-red-600 bg-red-50',
  warning: 'text-amber-600 bg-amber-50',
  default: 'text-teal-600 bg-teal-50',
  success: 'text-emerald-600 bg-emerald-50',
  info: 'text-sky-600 bg-sky-50',
};

const ICONS: Record<ConfirmVariant, React.ElementType> = {
  danger: AlertTriangle,
  warning: AlertTriangle,
  default: AlertCircle,
  success: CheckCircle,
  info: Info,
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  hideCancel = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // ESC 关闭（alert 模式不响应）
  useEffect(() => {
    if (!open || hideCancel) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, hideCancel, onCancel]);

  if (!open) return null;

  const Icon = ICONS[variant];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={(e) => {
        // 仅 confirm 模式响应背景点击
        if (!hideCancel && e.target === overlayRef.current) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      {/* 实色深遮罩 */}
      <div className="absolute inset-0 bg-black/60" />

      {/* 卡片本体 */}
      <div className="relative w-full max-w-md mx-4 bg-white border border-slate-200 rounded-2xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.35)] overflow-hidden">
        {/* 关闭叉（alert 模式隐藏） */}
        {!hideCancel && (
          <button
            onClick={onCancel}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="关闭"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="p-6">
          {/* 图标 + 标题 + 说明 */}
          <div className="flex items-start gap-4 mb-2">
            <div
              className={cn(
                'p-2.5 rounded-xl flex-shrink-0',
                ICON_CLS[variant],
              )}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div className="pt-1 min-w-0 flex-1">
              <h3
                id="confirm-modal-title"
                className="text-slate-900 font-semibold text-base leading-snug"
              >
                {title}
              </h3>
              {description && (
                <div className="mt-2 text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                  {description}
                </div>
              )}
            </div>
          </div>

          {/* 操作区 */}
          <div className="flex items-center justify-end gap-2 mt-6">
            {!hideCancel && (
              <button
                onClick={onCancel}
                type="button"
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={onConfirm}
              autoFocus
              type="button"
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                CONFIRM_BUTTON_CLS[variant],
              )}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
