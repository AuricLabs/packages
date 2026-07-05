interface TableSkeletonProps {
  rows?: number;
}

export function TableSkeleton({ rows = 8 }: TableSkeletonProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-10 animate-pulse rounded bg-zinc-800" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded bg-zinc-800/60" />
      ))}
    </div>
  );
}
