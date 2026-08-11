"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wrench, Loader2, ArrowRight } from "lucide-react";
import { RentosMark } from "@/components/rentos-mark";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The old, org-less repair form used to live here.
 *
 * It could not work: with no organization in the URL it fell back to whichever
 * portfolio the browser happened to have, which for a visitor with no account
 * meant the demo data. Reports went nowhere. Repair intake is now scoped to one
 * organization at /o/{slug}/report, and this page's job is to get people there.
 */
export default function ReportRedirectPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const org = new URLSearchParams(window.location.search).get("org");
    if (org) {
      setRedirecting(true);
      router.replace(`/o/${encodeURIComponent(org)}/report`);
    }
  }, [router]);

  if (redirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Taking you to the repair form…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[440px] space-y-6">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-brand shadow-lg shadow-primary/25">
            <RentosMark className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading tracking-tight">
              Report a repair
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Repair requests go to the company that manages your building.
            </p>
          </div>
        </div>

        <Card className="border-border/50 bg-card/80">
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label>Your property manager&apos;s address</Label>
              <div className="flex gap-2">
                <div className="flex items-center rounded-lg border border-border/60 bg-muted/40 px-2 text-sm text-muted-foreground">
                  /o/
                </div>
                <Input
                  placeholder="davis-housing-services"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.trim().toLowerCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && slug) router.push(`/o/${slug}/report`);
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                It is on the notice or link they sent you — for example{" "}
                <span className="font-mono">/o/davis-housing-services</span>.
              </p>
            </div>

            <Button
              className="w-full gap-2 gradient-brand text-white border-0"
              disabled={!slug}
              onClick={() => router.push(`/o/${slug}/report`)}
            >
              Continue <ArrowRight className="h-4 w-4" />
            </Button>

            <div className="flex items-start gap-2 rounded-lg bg-accent/30 p-3 text-xs text-muted-foreground">
              <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Already have a resident account?{" "}
                <Link href="/portal/maintenance" className="text-primary hover:underline">
                  Report it from your portal
                </Link>{" "}
                — you can attach photos there.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
