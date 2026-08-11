"use client";

import React from "react";
import Link from "next/link";
import { RentosMark } from "@/components/rentos-mark";

/**
 * The masthead on every public, org-scoped page.
 *
 * It leads with the landlord's name, not ours: someone reporting a burst pipe
 * needs to see that they are talking to the people who manage their building.
 */
export function PublicOrgHeader({
  orgName,
  slug,
  tagline,
}: {
  orgName: string;
  slug: string;
  tagline?: string;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
        <Link href={`/o/${slug}`} className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand">
            <RentosMark className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold font-heading leading-tight">{orgName}</h1>
            {tagline && (
              <p className="text-[10px] text-muted-foreground leading-tight">{tagline}</p>
            )}
          </div>
        </Link>
      </div>
    </header>
  );
}

/** Shown while the organization is being resolved, or when the slug is wrong. */
export function PublicOrgState({
  loading,
  error,
}: {
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="max-w-sm space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl gradient-brand">
          <RentosMark className="h-7 w-7 text-white" />
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <h1 className="text-lg font-semibold font-heading">Page not available</h1>
            <p className="text-sm text-muted-foreground">
              {error ?? "We could not find that organization."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
