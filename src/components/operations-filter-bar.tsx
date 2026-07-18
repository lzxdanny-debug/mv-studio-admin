'use client';

export type OperationsFilterKey = '' | 'isPublic' | 'hot' | 'recommended' | 'homepageFeatured';

export const OPERATIONS_FILTER_OPTIONS: Array<{ label: string; value: OperationsFilterKey }> = [
  { label: '全部', value: '' },
  { label: '公开', value: 'isPublic' },
  { label: '热门', value: 'hot' },
  { label: '推荐', value: 'recommended' },
  { label: '首页推荐', value: 'homepageFeatured' },
];

export function operationsFilterToQueryParams(
  filter: OperationsFilterKey,
): Record<string, string> {
  if (!filter) return {};
  return { [filter]: 'true' };
}

export function OperationsFilterBar({
  value,
  onChange,
}: {
  value: OperationsFilterKey;
  onChange: (next: OperationsFilterKey) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-semibold text-slate-500">运营</span>
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
        {OPERATIONS_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value || 'all'}
            type="button"
            onClick={() => onChange(opt.value)}
            className={
              value === opt.value
                ? 'px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500 text-white'
                : 'px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100'
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
