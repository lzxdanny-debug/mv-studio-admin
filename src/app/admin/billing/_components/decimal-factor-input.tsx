'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** 中文/全角小数点 → ASCII `.` */
export function normalizeDecimalInput(raw: string): string {
  return raw
    .replace(/[\u3002\uFF0E\uFF61]/g, '.')
    .replace(/,/g, '.');
}

export function parseFactorDraft(raw: string): number | null {
  const normalized = normalizeDecimalInput(raw.trim());
  if (normalized === '' || normalized === '.' || normalized === '-') return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function factorsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

function clampDecimal(n: number, min?: number, max?: number): number {
  let v = n;
  if (min != null) v = Math.max(min, v);
  if (max != null) v = Math.min(max, v);
  return v;
}

/** 表单内小数输入（无独立保存按钮），失焦时提交到父级 */
export function DecimalFieldInput({
  value,
  onChange,
  min,
  max,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  const saved = Number(value) || 0;
  const [draft, setDraft] = useState(() => String(saved));
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (!isEditingRef.current) {
      setDraft(String(saved));
    }
  }, [saved]);

  const commit = (raw: string, force = false) => {
    const parsed = parseFactorDraft(raw);
    const trailingDot = raw.endsWith('.');
    if (!force && trailingDot) return;
    const n = clampDecimal(parsed !== null ? parsed : saved, min, max);
    setDraft(String(n));
    if (!factorsEqual(n, saved)) {
      onChange(n);
    } else if (parsed === null && force) {
      setDraft(String(saved));
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      value={draft}
      className={className}
      onFocus={() => {
        isEditingRef.current = true;
      }}
      onBlur={() => {
        isEditingRef.current = false;
        commit(draft, true);
      }}
      onChange={(e) => {
        const next = normalizeDecimalInput(e.target.value);
        if (next === '' || /^\d*\.?\d*$/.test(next)) {
          setDraft(next);
          commit(next, false);
        }
      }}
    />
  );
}

/**
 * 系数类小数输入：与盈利系数体验一致，但用 text+inputMode=decimal，
 * 避免 type=number 无法输入 "0.5" / "1." 等中间态的问题。
 */
export function DecimalFactorInput({
  value,
  onSave,
  saving,
  className,
  inputClassName,
}: {
  value: number;
  onSave: (next: number) => void;
  saving?: boolean;
  className?: string;
  inputClassName?: string;
}) {
  const saved = Number(value) || 0;
  const [draft, setDraft] = useState(() => String(saved));
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (!isEditingRef.current) {
      setDraft(String(saved));
    }
  }, [saved]);

  const parsed = parseFactorDraft(draft);
  const dirty = parsed !== null && !factorsEqual(parsed, saved);

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={draft}
        onFocus={() => {
          isEditingRef.current = true;
        }}
        onBlur={() => {
          isEditingRef.current = false;
          const next = parseFactorDraft(draft);
          setDraft(next !== null ? String(next) : String(saved));
        }}
        onChange={(e) => {
          const next = normalizeDecimalInput(e.target.value);
          if (next === '' || /^\d*\.?\d*$/.test(next)) {
            setDraft(next);
          }
        }}
        className={inputClassName}
      />
      <button
        type="button"
        disabled={!dirty || saving}
        onClick={() => {
          const next = parseFactorDraft(draft);
          if (next === null) return;
          isEditingRef.current = false;
          setDraft(String(next));
          onSave(next);
        }}
        className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex-shrink-0"
      >
        保存
      </button>
    </div>
  );
}
