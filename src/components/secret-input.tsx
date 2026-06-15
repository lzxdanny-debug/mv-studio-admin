'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SecretInputProps {
  configured?: boolean;
  maskedPreview?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showToggle?: boolean;
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
  type = 'password',
}: SecretInputProps) {
  const [editing, setEditing] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!value) setEditing(false);
  }, [value, maskedPreview]);

  const showPreview = configured && !!maskedPreview && !editing && !value;
  const displayValue = showPreview ? maskedPreview : value;
  const inputType = showToggle && visible ? 'text' : type;

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
          'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-slate-50 font-mono',
          showToggle && 'pr-9',
          showPreview && 'text-slate-500',
          className,
        )}
      />
      {showToggle && (
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}
