import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A placeholder block for content that has not arrived yet.
 *
 * The list pages subscribe to Firestore on mount, so there is a beat between
 * the first paint and the first snapshot. Rendering the real empty state during
 * that beat tells a manager they have no properties a moment before three
 * appear, which reads as a glitch — or worse, as data loss. A skeleton says
 * "still loading" instead, and holds roughly the space the content will take so
 * the page does not jump when it lands.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
      {...props}
    />
  )
}

/**
 * Placeholder cards matching the list pages' grid.
 *
 * `className` takes the same grid classes as the real grid it stands in for, so
 * the columns line up and the swap is not a re-layout.
 */
function CardGridSkeleton({
  count = 6,
  height = "h-64",
  className,
}: {
  count?: number
  height?: string
  className?: string
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3", className)}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn("w-full rounded-xl", height)} />
      ))}
    </div>
  )
}

/** Placeholder rows, for the pages that render a list rather than a grid. */
function ListSkeleton({ count = 5, height = "h-20" }: { count?: number; height?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn("w-full rounded-xl", height)} />
      ))}
    </div>
  )
}

export { Skeleton, CardGridSkeleton, ListSkeleton }
