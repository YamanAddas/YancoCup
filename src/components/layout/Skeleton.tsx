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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="yc-hex-3d">
          <div className="yc-hex-wrap">
            <div className="yc-hex-border" />
            <div className="yc-hex-card h-[140px]">
              <div className="yc-hex-glass" />
              <div className="relative z-10 p-5 flex flex-col gap-3">
                <div className="flex justify-between">
                  <div className="h-3 w-20 bg-yc-bg-elevated rounded animate-pulse" />
                  <div className="h-3 w-14 bg-yc-bg-elevated rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end gap-1 flex-1">
                    <div className="w-10 h-10 rounded-full bg-yc-bg-elevated animate-pulse" />
                    <div className="h-3 w-12 bg-yc-bg-elevated rounded animate-pulse" />
                  </div>
                  <div className="h-6 w-14 bg-yc-bg-elevated rounded animate-pulse" />
                  <div className="flex flex-col items-start gap-1 flex-1">
                    <div className="w-10 h-10 rounded-full bg-yc-bg-elevated animate-pulse" />
                    <div className="h-3 w-12 bg-yc-bg-elevated rounded animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
