"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  minutesLeft, useSupportSession, useSupportSessionWatcher,
} from "@/lib/use-support-session";

/**
 * The bar that says whose data an operator is looking at.
 *
 * It belongs in every shell, not just the staff one: impersonating a tenant
 * puts the operator in the resident portal, which is exactly where mistaking
 * somebody else's account for your own would do the most damage. So this
 * carries the watcher with it and is mounted by all three layouts.
 *
 * Renders nothing when no session is open.
 */
export function SupportBanner() {
  const router = useRouter();
  useSupportSessionWatcher();
  const { session, end } = useSupportSession();

  if (!session) return null;

  const exit = async () => {
    try {
      await end();
    } catch {
      /* the grant expires on its own regardless */
    }
    router.push("/admin");
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-violet-500/30 bg-violet-500/15 px-4 py-2 text-xs text-violet-200 lg:px-6">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
      <span>
        Support session —{" "}
        {session.viewAsRole ? (
          <>
            you are seeing what <strong>{session.viewAsSubjectName}</strong> sees
            as a {session.viewAsRole} at <strong>{session.orgName}</strong>{" "}
            (read-only)
          </>
        ) : (
          <>
            you are viewing <strong>{session.orgName}</strong>
            {session.writeEnabled ? (
              <span className="font-semibold text-amber-300"> with editing enabled</span>
            ) : (
              " (read-only)"
            )}
          </>
        )}
        . Expires in {minutesLeft(session)} min.
      </span>
      <Button
        size="xs"
        variant="outline"
        className="ml-auto border-violet-400/40 bg-transparent text-violet-100 hover:bg-violet-500/20"
        onClick={exit}
      >
        Exit
      </Button>
    </div>
  );
}
