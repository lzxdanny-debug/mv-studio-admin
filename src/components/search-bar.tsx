'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width?: string;
  /** 防抖延迟毫秒数，默认 350 */
  debounce?: number;
}

/**
 * 通用搜索框：输入后自动防抖触发，也支持按 Enter 或清除按钮。
 */
export function SearchBar({
  value,
  onChange,
  placeholder = '搜索...',
  width = 'w-56',
  debounce = 350,
}: SearchBarProps) {
  const [input, setInput] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 外部 value 变化时同步 input（例如清除）
  useEffect(() => {
    setInput(value);
  }, [value]);

  const fire = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v.trim()), debounce);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    fire(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (timer.current) clearTimeout(timer.current);
      onChange(input.trim());
    }
    if (e.key === 'Escape') {
      setInput('');
      if (timer.current) clearTimeout(timer.current);
      onChange('');
    }
  };

  const clear = () => {
    setInput('');
    if (timer.current) clearTimeout(timer.current);
    onChange('');
  };

  return (
    <div className={`relative ${width}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
      <input
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
      />
      {input && (
        <button
          onClick={clear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
