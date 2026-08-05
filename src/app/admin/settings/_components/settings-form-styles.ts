import { cn } from '@/lib/utils';

/** SecretInput 对齐通用 Input 视觉 */
export const SECRET_INPUT_CLS = cn(
  'rounded-[10px] border-slate-200/90 bg-white',
  'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
  'focus:ring-[3px] focus:ring-blue-500/15 focus:border-blue-400',
);

export const CONTROL_WIDE = 'sm:w-[360px] w-[220px]';
export const CONTROL_MD = 'sm:w-[280px] w-[200px]';
