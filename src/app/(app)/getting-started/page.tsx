"use client";

import React from "react";
import Link from "next/link";
import {
  Check, ArrowRight, Rocket, PartyPopper, Megaphone, ClipboardCheck,
  CalendarDays, Users, Wrench, Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSetupProgress } from "@/lib/use-setup";
import { useAuthStore } from "@/lib/store";
import { useOrganization } from "@/lib/use-org";

/**
 * What to do first, in the order the product actually requires.
 *
 * A new org lands on a dashboard of zeroes with sixteen things in the sidebar
 * and nothing saying which one comes first. This is that answer, and it reads
 * the org's own records rather than a checklist — so it is already correct for
 * somebody who set half of this up last week.
 */

/** Worth knowing about, but nobody has to do them to get paid. */
const laterOn = [
  { label: "Advertise a vacancy", href: "/listings", icon: Megaphone, note: "Generate a listing and take applications online." },
  { label: "Take repair requests", href: "/maintenance", icon: Wrench, note: "Tenants file them from the portal; you assign a vendor." },
  { label: "Schedule an inspection", href: "/inspections", icon: ClipboardCheck, note: "Move-in, move-out and routine, with photos." },
  { label: "Plan the month", href: "/calendar", icon: CalendarDays, note: "Showings, renewals and inspections in one place." },
  { label: "Add your team", href: "/team", icon: Users, note: "Managers, leasing agents and maintenance staff." },
];

export default function GettingStartedPage() {
  const { steps, done, total, percent, complete, next, loading } = useSetupProgress();
  const user = useAuthStore((s) => s.user);
  const { org } = useOrganization();

  const firstName = user?.displayName?.split(" ")[0] || "there";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Getting started</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {complete
            ? `${org?.name ?? "Your portfolio"} is set up and collecting rent.`
            : `Six steps from an empty account to collecting rent, ${firstName}.`}
        </p>
      </div>

      {/* Progress */}
      <Card className={cn(
        "border-primary/30",
        complete
          ? "bg-gradient-to-br from-emerald-500/10 to-teal-500/5"
          : "bg-gradient-to-br from-primary/5 to-violet-500/5"
      )}>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                complete ? "bg-emerald-500/15" : "gradient-brand shadow-lg shadow-primary/25"
              )}>
                {complete
                  ? <PartyPopper className="h-6 w-6 text-emerald-400" />
                  : <Rocket className="h-6 w-6 text-white" />}
              </div>
              <div>
                <p className="font-semibold font-heading">
                  {loading ? "Checking your portfolio…" : complete ? "You are all set" : `${done} of ${total} done`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {complete
                    ? "Everything below is optional from here."
                    : next
                      ? `Next: ${next.title.toLowerCase()}`
                      : " "}
                </p>
              </div>
            </div>
            {!complete && next && (
              <Link href={next.href}>
                <Button className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 gap-1.5">
                  {next.cta} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-border/50">
            <div
              className={cn("h-full rounded-full transition-all duration-500", complete ? "bg-emerald-500" : "gradient-brand")}
              style={{ width: `${loading ? 0 : percent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, i) => (
          <Card
            key={step.id}
            className={cn(
              "border-border/50 bg-card/50 transition-colors",
              step.done ? "opacity-70" : "hover:border-primary/20"
            )}
          >
            <CardContent className="p-4 flex items-start gap-4">
              <div className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                step.done
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-accent/60 text-muted-foreground"
              )}>
                {step.done ? <Check className="h-4 w-4" /> : i + 1}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className={cn("font-semibold text-sm font-heading", step.done && "line-through decoration-1")}>
                    {step.title}
                  </h3>
                  {step.optional && (
                    <Badge variant="outline" className="h-5 text-[10px] text-muted-foreground border-border/50">Optional</Badge>
                  )}
                  {step.done && step.detail && (
                    <Badge variant="outline" className="h-5 text-[10px] text-emerald-400 border-emerald-500/30">{step.detail}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{step.why}</p>
              </div>

              <Link href={step.href} className="shrink-0">
                <Button variant={step.done ? "ghost" : "outline"} size="sm" className="gap-1.5">
                  {step.done ? "Review" : step.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* How tenants get in — the question every landlord asks on day one. */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm font-heading">How your tenants get in</h2>
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>
              <span className="text-foreground font-medium">They do not need an account to reach you.</span>{" "}
              Anyone can apply for a vacancy or report a repair from your public
              pages — that is what step 7 turns on.
            </p>
            <p>
              <span className="text-foreground font-medium">They do need one to pay rent.</span>{" "}
              Send a portal invitation from the tenant list. The link only works
              for the address it was issued to, so forwarding it gives nobody
              access. Once they accept they can pay, report repairs, read their
              lease and sign it.
            </p>
            <p>
              <span className="text-foreground font-medium">Approving an application does the rest for you.</span>{" "}
              Moving an approved applicant in creates the tenant, writes an
              active lease and marks the unit occupied in one go.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Later on */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold font-heading text-muted-foreground">When you need it</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {laterOn.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="h-full border-border/50 bg-card/50 hover:border-primary/20 transition-colors">
                <CardContent className="p-4 flex items-start gap-3">
                  <item.icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
