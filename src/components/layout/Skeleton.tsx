/** Reusable skeleton placeholder for loading states */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-yc-bg-surface border border-yc-border rounded-xl animate-pulse ${className}`}
    />
  );
}

export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-4 bg-yc-bg-elevated rounded animate-pulse ${className}`}
    />
  );
}

export function SkeletonMatchCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} className="h-36" />
      ))}
    </div>
  );
}
