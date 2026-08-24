'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SecretInputProps {
  configured?: boolean;
  maskedPreview?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showToggle?: boolean;
  copyable?: boolean;
  onReveal?: () => Promise<string>;
  type?: 'password' | 'text';
}

/** 已配置密钥输入：默认展示掩码预览，聚焦后清空以便填写新值；留空提交表示不修改 */
export function SecretInput({
  configured = false,
  maskedPreview = '',
  value,
  onChange,
  placeholder,
  className,
  showToggle = false,
  copyable = false,
  onReveal,
  type = 'password',
}: SecretInputProps) {
  const [editing, setEditing] = useState(false);
  const [visible, setVisible] = useState(false);
  const [revealedValue, setRevealedValue] = useState('');
  const [revealing, setRevealing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!value) setEditing(false);
  }, [value, maskedPreview]);

  const showPreview = configured && !!maskedPreview && !editing && !value;
  const displayValue = showPreview
    ? visible && revealedValue
      ? revealedValue
      : maskedPreview
    : value;
  const inputType = showPreview && onReveal ? 'text' : showToggle && visible ? 'text' : type;

  const reveal = async (): Promise<string> => {
    if (revealedValue) return revealedValue;
    if (!onReveal) return value;
    setRevealing(true);
    try {
      const secret = await onReveal();
      setRevealedValue(secret);
      return secret;
    } finally {
      setRevealing(false);
    }
  };

  const handleToggle = async () => {
    if (visible) {
      setVisible(false);
      setRevealedValue('');
      return;
    }
    if (showPreview && onReveal) {
      try {
        const secret = await reveal();
        if (!secret) return;
      } catch {
        return;
      }
    }
    setVisible(true);
  };

  const handleCopy = async () => {
    try {
      const secret = showPreview ? await reveal() : value;
      if (!secret) return;
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // onReveal 的调用方负责展示具体错误；此处避免点击事件产生未处理拒绝。
    }
  };

  return (
    <div className="relative">
      <input
        type={inputType}
        autoComplete="new-password"
        placeholder={
          configured
            ? editing
              ? '输入新值以替换'
              : maskedPreview || '留空则不修改'
            : placeholder
        }
        value={displayValue}
        onFocus={() => {
          if (showPreview) setEditing(true);
        }}
        onChange={(e) => {
          setEditing(true);
          onChange(e.target.value);
        }}
        onBlur={() => {
          if (!value) setEditing(false);
        }}
        className={cn(
          'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 font-mono',
          (showToggle || copyable) && 'pr-[76px]',
          showPreview && 'text-slate-500',
          className,
        )}
      />
      <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {copyable && (
          <button
            type="button"
            onClick={() => void handleCopy()}
            disabled={revealing || (!configured && !value)}
            title={copied ? '已复制' : '复制'}
            aria-label={copied ? '已复制' : '复制密钥'}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {revealing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        {showToggle && (
          <button
            type="button"
            onClick={() => void handleToggle()}
            disabled={revealing || (!configured && !value)}
            title={visible ? '隐藏' : '查看'}
            aria-label={visible ? '隐藏密钥' : '查看密钥'}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {revealing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : visible ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
