"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { authedJson } from "@/lib/api-client";
import { PLANS } from "@/lib/plans";
import type { PlanId } from "@/lib/types";

/**
 * The operator console: every organization on the platform.
 *
 * Support work needs a view across customers, which by design nothing else in
 * this app has — every other screen is scoped to one organization by the
 * security rules.
 */

interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  plan: PlanId;
  billingStatus: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  payoutsReady: boolean;
  createdAt: string | null;
  counts: { units: number; tenants: number; people: number };
}

const STATUS_STYLE: Record<string, string> = {
  trialing: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  past_due: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  canceled: "bg-red-500/15 text-red-400 border-red-500/30",
  incomplete: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

function AdminConsole() {
  const [orgs, setOrgs] = useState<AdminOrg[] | null>(null);
  const [error, setError] = useState("");
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    authedJson<{ orgs: AdminOrg[]; truncated: boolean }>("/api/admin/orgs")
      .then((r) => { setOrgs(r.orgs); setTruncated(r.truncated); })
      .catch((err) => setError(err?.message || "Could not load organizations."));
  }, []);

  const totals = (orgs ?? []).reduce(
    (acc, o) => ({
      units: acc.units + o.counts.units,
      tenants: acc.tenants + o.counts.tenants,
      paying: acc.paying + (o.billingStatus === "active" ? 1 : 0),
    }),
    { units: 0, tenants: 0, paying: 0 }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight font-heading lg:text-3xl">
          <ShieldCheck className="h-6 w-6 text-primary" /> RentOS Admin
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Every organization on the platform
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!orgs && !error && (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading organizations…
        </div>
      )}

      {orgs && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: "Organizations", value: orgs.length },
              { label: "Paying", value: totals.paying },
              { label: "Units managed", value: totals.units },
              { label: "Tenants", value: totals.tenants },
            ].map((stat) => (
              <Card key={stat.label} className="border-border/50 bg-card/50">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold font-heading">
                    {stat.value.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-base">Organizations</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Tenants</TableHead>
                    <TableHead className="text-right">People</TableHead>
                    <TableHead>Payouts</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgs.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <div className="font-medium">{o.name}</div>
                        <Link
                          href={`/o/${o.slug}`}
                          className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-primary"
                        >
                          /o/{o.slug} <ExternalLink className="h-3 w-3" />
                        </Link>
                      </TableCell>
                      <TableCell>{PLANS[o.plan]?.name ?? o.plan}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_STYLE[o.billingStatus] ?? ""}
                        >
                          {o.billingStatus.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{o.counts.units}</TableCell>
                      <TableCell className="text-right">{o.counts.tenants}</TableCell>
                      <TableCell className="text-right">{o.counts.people}</TableCell>
                      <TableCell>
                        {o.payoutsReady ? (
                          <span className="text-emerald-400">Ready</span>
                        ) : (
                          <span className="text-muted-foreground">Not set up</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {truncated && (
                <p className="pt-3 text-xs text-muted-foreground">
                  Showing the first 500 organizations.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard roles={["super_admin"]}>
      <AdminConsole />
    </AuthGuard>
  );
}
