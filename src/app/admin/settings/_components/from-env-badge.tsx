export function FromEnvBadge({ fromEnv }: { fromEnv?: boolean }) {
  if (!fromEnv) return null;
  return (
    <span className="ml-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
      来自环境变量
    </span>
  );
}
