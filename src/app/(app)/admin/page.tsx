"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, ExternalLink, AlertTriangle, Eye } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { authedJson } from "@/lib/api-client";
import { useAuthStore } from "@/lib/store";
import { useSupportSession } from "@/lib/use-support-session";
import { PLANS } from "@/lib/plans";
import type { PlanId } from "@/lib/types";
import toast from "react-hot-toast";

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

const DURATIONS = [15, 30, 60, 120];

type ViewAsMode = "staff" | "tenant" | "contractor";

interface OrgPeople {
  tenants: { id: string; name: string; hasLogin: boolean }[];
  vendors: { id: string; name: string; hasLogin: boolean }[];
}

const VIEW_AS_MODES: { value: ViewAsMode; label: string; hint: string }[] = [
  { value: "staff", label: "Their staff", hint: "The customer's own dashboard" },
  { value: "tenant", label: "A tenant", hint: "What one resident sees in the portal" },
  { value: "contractor", label: "A contractor", hint: "What one vendor sees of their jobs" },
];

function AdminConsole() {
  const router = useRouter();
  // homeOrgId, not user.orgId: while a support session is open the latter points
  // at the customer, which would label the wrong row "yours".
  const ownOrgId = useAuthStore((s) => s.homeOrgId ?? s.user?.orgId);
  const { start } = useSupportSession();

  const [orgs, setOrgs] = useState<AdminOrg[] | null>(null);
  const [error, setError] = useState("");
  const [truncated, setTruncated] = useState(false);

  // The organization a support session is being opened for, if any.
  const [target, setTarget] = useState<AdminOrg | null>(null);
  const [reason, setReason] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [writeEnabled, setWriteEnabled] = useState(false);
  const [opening, setOpening] = useState(false);

  // Whose eyes to look through. "staff" is the customer's own dashboard.
  const [viewAs, setViewAs] = useState<ViewAsMode>("staff");
  const [subjectId, setSubjectId] = useState("");
  const [people, setPeople] = useState<OrgPeople | null>(null);

  // Loaded only once an organization is chosen — the list is that customer's
  // roster, so it is fetched on demand rather than alongside every org.
  useEffect(() => {
    if (!target) { setPeople(null); return; }
    let cancelled = false;
    authedJson<OrgPeople>(`/api/admin/org-people?orgId=${encodeURIComponent(target.id)}`)
      .then((r) => { if (!cancelled) setPeople(r); })
      .catch(() => { if (!cancelled) setPeople({ tenants: [], vendors: [] }); });
    return () => { cancelled = true; };
  }, [target]);

  const subjects =
    viewAs === "tenant" ? people?.tenants ?? []
    : viewAs === "contractor" ? people?.vendors ?? []
    : [];

  const openSession = async () => {
    if (!target) return;
    setOpening(true);
    try {
      await start({
        orgId: target.id,
        reason: reason.trim(),
        minutes,
        writeEnabled,
        viewAsRole: viewAs === "staff" ? null : viewAs,
        viewAsSubjectId: viewAs === "staff" ? undefined : subjectId,
      });
      toast.success(`Viewing ${target.name}.`);
      setTarget(null);
      // Straight to the portal the impersonated person actually uses.
      router.push(
        viewAs === "tenant" ? "/portal" : viewAs === "contractor" ? "/dashboard" : "/dashboard"
      );
    } catch (err: any) {
      toast.error(err?.message || "Could not open the support session.");
    } finally {
      setOpening(false);
    }
  };

  const canOpen =
    reason.trim().length >= 4 && (viewAs === "staff" || subjectId !== "");

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
                    <TableHead className="text-right">Support</TableHead>
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
                      <TableCell className="text-right">
                        {o.id === ownOrgId ? (
                          <span className="text-xs text-muted-foreground">yours</span>
                        ) : (
                          <Button
                            size="xs"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => { setTarget(o); setReason(""); setWriteEnabled(false); }}
                          >
                            <Eye className="h-3 w-3" /> View as
                          </Button>
                        )}
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

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              View {target?.name} as support
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              You will see this customer&apos;s real data. Access is logged with
              your name and the reason below, ends when the timer runs out, and
              is read-only unless you say otherwise.
            </p>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                placeholder="e.g. Ticket 412 — rent payment not showing"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={opening}
              />
            </div>

            <div className="space-y-2">
              <Label>View as</Label>
              <div className="grid grid-cols-3 gap-2">
                {VIEW_AS_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => { setViewAs(mode.value); setSubjectId(""); }}
                    className={`rounded-lg border p-2 text-left text-xs transition-colors ${
                      viewAs === mode.value
                        ? "border-primary/50 bg-primary/10"
                        : "border-border/50 hover:border-border"
                    }`}
                  >
                    <span className="block font-medium">{mode.label}</span>
                    <span className="block text-[10px] text-muted-foreground">{mode.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {viewAs !== "staff" && (
              <div className="space-y-2">
                <Label>Which {viewAs === "tenant" ? "tenant" : "contractor"}?</Label>
                {people === null ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                  </p>
                ) : subjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    This organization has no {viewAs === "tenant" ? "tenants" : "contractors"} on record.
                  </p>
                ) : (
                  <Select value={subjectId} onValueChange={(v) => v != null && setSubjectId(v)}>
                    <SelectTrigger><SelectValue placeholder="Choose a person" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {viewAs === "tenant" && !p.hasLogin ? " — no portal login" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-[10px] text-muted-foreground">
                  You will see exactly what they see, including what they cannot.
                  Always read-only.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="flex gap-2">
                {DURATIONS.map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant={minutes === m ? "default" : "outline"}
                    className={minutes === m ? "gradient-brand text-white border-0" : ""}
                    onClick={() => setMinutes(m)}
                  >
                    {m}m
                  </Button>
                ))}
              </div>
            </div>

            {/* Editing exists only in the staff view. A record written while
                looking through somebody's eyes would carry their name for
                something they did not do. */}
            {viewAs === "staff" && (
              <label className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={writeEnabled}
                  onChange={(e) => setWriteEnabled(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-amber-500"
                  disabled={opening}
                />
                <span>
                  <span className="font-medium text-amber-300">Allow editing</span>
                  <span className="block text-xs text-muted-foreground">
                    Only tick this if you are fixing something for them. Changes are
                    made under your account, not theirs.
                  </span>
                </span>
              </label>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={opening}>
              Cancel
            </Button>
            <Button
              className="gap-2 gradient-brand text-white border-0"
              disabled={opening || !canOpen}
              onClick={openSession}
            >
              {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Start session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
