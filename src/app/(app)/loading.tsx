export default function AppLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-lg bg-accent/50" />
        <div className="h-4 w-72 rounded-md bg-accent/30" />
      </div>
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-3">
            <div className="h-3 w-20 rounded bg-accent/40" />
            <div className="h-8 w-24 rounded bg-accent/50" />
            <div className="h-3 w-28 rounded bg-accent/30" />
          </div>
        ))}
      </div>
      {/* Content skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-4">
            <div className="h-5 w-32 rounded bg-accent/40" />
            {[...Array(4)].map((_, j) => (
              <div key={j} className="h-12 rounded-lg bg-accent/30" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
