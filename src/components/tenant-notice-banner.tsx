"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRentDocuments } from "@/lib/hooks";

/**
 * Tells a resident, plainly, that a pay-or-quit notice is running against them.
 *
 * They were handed the paper too — but paper gets lost, roommates take it in,
 * and a student renting their first place may not know what it means. The
 * portal is where they pay, so it is where the deadline belongs. The tone is
 * deliberately factual rather than threatening: the useful thing here is the
 * number, the date, and the button that clears it.
 */
export function TenantNoticeBanner() {
  const { notices } = useRentDocuments();

  const live = notices
    .filter((n) => n.status === "served")
    .sort((a, b) => b.servedOn.localeCompare(a.servedOn))[0];

  if (!live) return null;

  const today = new Date().toISOString().slice(0, 10);
  const expired = live.deadline < today;

  return (
    <Card className="border-red-500/40 bg-red-500/5">
      <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-red-500/15 p-2 shrink-0">
            <ShieldAlert className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {expired
                ? "The deadline on your three-day notice has passed"
                : `Pay ${live.amountDemanded.toLocaleString(undefined, { style: "currency", currency: "USD" })} by ${live.deadline}`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {expired
                ? "Paying now may still resolve it — contact your landlord straight away."
                : "A three-day notice to pay rent or quit was served on you. Paying the rent demanded within the period ends it."}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Served {live.servedOn} · rent only, no other charges ·{" "}
              free tenant advice: Legal Services of Northern California, Yolo County.
            </p>
          </div>
        </div>
        <Link href="/portal/payments" className="shrink-0">
          <Button size="sm" className="gradient-brand text-white border-0">Pay now</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
