"use client";

import Link from "next/link";
import { Rocket, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSetupProgress } from "@/lib/use-setup";

/**
 * The nudge back to the setup guide, on the screen everybody lands on.
 *
 * It removes itself the moment the required steps are done — a permanent
 * checklist on the dashboard is something people learn to scroll past, and an
 * org that finished setting up months ago should never see it again.
 */
export function SetupProgressCard() {
  const { done, total, percent, complete, next, loading } = useSetupProgress();

  // Nothing to say while the reads are in flight: a card that appears, claims
  // "0 of 6 done" and then vanishes is worse than one that arrives a beat late.
  if (loading || complete || !next) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-violet-500/5">
      <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-brand shadow-lg shadow-primary/25">
            <Rocket className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold font-heading">
              Finish setting up — {done} of {total} done
            </p>
            <p className="text-xs text-muted-foreground truncate">Next: {next.title.toLowerCase()}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden h-2 w-28 overflow-hidden rounded-full bg-border/50 sm:block">
            <div className="h-full rounded-full gradient-brand transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
          <Link href="/getting-started">
            <Button size="sm" variant="outline" className="gap-1.5">
              Open guide <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
