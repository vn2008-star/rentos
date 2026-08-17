"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, ShieldAlert, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  buildRentDemand, checkNotice, payOrQuitDeadline, skippedDays,
  type NoticePayeeDetails,
} from "@/lib/rent-notices";
import { NoticeDocument, PrintButton } from "@/components/rent-documents";
import type { Lease, Organization, PayOrQuitNotice, Property, ServiceMethod, Tenant, Transaction, Unit } from "@/lib/types";
import { errorMessage } from "@/lib/errors";
import toast from "react-hot-toast";

/**
 * Issuing a three-day notice, with the law's requirements enforced before the
 * document exists rather than discovered in a courtroom.
 *
 * The amount is computed, not typed. A landlord who could type it would type
 * the figure from the rent roll — which includes the late fee, and would void
 * the notice.
 */
export function IssueNoticeDialog({
  open,
  onOpenChange,
  lease,
  tenants,
  unit,
  property,
  org,
  transactions,
  onIssue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lease: Lease | null;
  tenants: Tenant[];
  unit: Unit | null;
  property: Property | null;
  org: Organization | null;
  transactions: Transaction[];
  onIssue: (notice: Omit<PayOrQuitNotice, "id" | "orgId" | "createdAt" | "updatedAt" | "issuedBy" | "issuedAt" | "status">) => Promise<string>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [servedOn, setServedOn] = useState(today);
  const [serviceMethod, setServiceMethod] = useState<ServiceMethod>("personal");
  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState<PayOrQuitNotice | null>(null);
  const [payee, setPayee] = useState<NoticePayeeDetails>({
    name: "", phone: "", address: "", hours: "Monday to Friday, 9am to 5pm",
    method: "in_person", bankName: "", accountNumber: "", electronicDescription: "",
  });

  // Prefill from the organization once it loads, without stamping over typing.
  React.useEffect(() => {
    if (!org) return;
    setPayee((prev) => (prev.name ? prev : { ...prev, name: org.name }));
  }, [org]);

  const leaseTenants = tenants.filter((t) => lease?.tenantIds.includes(t.id));
  const tenantNames = leaseTenants.map((t) => `${t.firstName} ${t.lastName}`);
  const unitAddress = property
    ? `${property.address.street}${unit ? `, Unit ${unit.unitNumber}` : ""}, ${property.address.city}, ${property.address.state} ${property.address.zip}`
    : "";

  const demand = useMemo(
    () => (lease ? buildRentDemand({ lease, transactions, asOf: servedOn }) : null),
    [lease, transactions, servedOn]
  );

  const deadline = payOrQuitDeadline(servedOn);
  const skipped = skippedDays(servedOn, deadline);

  const problems = useMemo(
    () =>
      demand
        ? checkNotice({ demand, payee, tenantNames, unitAddress, servedOn })
        : [],
    [demand, payee, tenantNames, unitAddress, servedOn]
  );
  const blockers = problems.filter((p) => p.severity === "blocker");
  const warnings = problems.filter((p) => p.severity === "warning");

  const handleIssue = async () => {
    if (!lease || !demand || blockers.length) return;
    setSaving(true);
    try {
      const record = {
        leaseId: lease.id,
        unitId: lease.unitId,
        propertyId: lease.propertyId,
        tenantIds: lease.tenantIds,
        tenantNames,
        unitAddress,
        amountDemanded: demand.total,
        periods: demand.periods.map(({ period, dueDate, owed }) => ({ period, dueDate, owed })),
        excludedCharges: demand.excluded,
        payee,
        servedOn,
        serviceMethod,
        deadline,
      };
      await onIssue(record);
      setIssued({
        ...record,
        id: "preview", orgId: org?.id ?? "", status: "served",
        issuedBy: org?.name ?? "Property manager",
        issuedAt: new Date().toISOString(),
        createdAt: "", updatedAt: "",
      });
      toast.success("Notice recorded — print it and serve it today.");
    } catch (err) {
      toast.error(errorMessage(err, "Could not record the notice."));
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    setIssued(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader className="no-print">
          <DialogTitle>
            {issued ? "Notice recorded — now serve it" : "Three-day notice to pay rent or quit"}
          </DialogTitle>
        </DialogHeader>

        {issued ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 no-print">
              <p className="text-xs text-muted-foreground">
                Serve it today — the deadline was computed from {servedOn}. Keep a copy.
              </p>
              <PrintButton label="Print notice" />
            </div>
            <NoticeDocument notice={issued} />
            <DialogFooter className="no-print">
              <Button variant="outline" onClick={close}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* What may be demanded, computed. */}
            <div className="rounded-lg border border-border/50 bg-background/40 p-3">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium">Rent demanded</p>
                <p className="text-2xl font-bold font-heading">
                  ${demand ? demand.total.toLocaleString() : "0"}
                </p>
              </div>
              <div className="mt-2 space-y-1">
                {demand?.periods.map((p) => (
                  <div key={p.period} className="flex justify-between text-xs text-muted-foreground">
                    <span>{p.period}</span>
                    <span>${p.owed.toLocaleString()}</span>
                  </div>
                ))}
                {demand && demand.periods.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nothing outstanding on this lease.</p>
                )}
              </div>
              {demand && demand.excluded.length > 0 && (
                <p className="mt-2 flex items-start gap-1.5 border-t border-border/30 pt-2 text-[11px] text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
                  <span>
                    Left out on purpose:{" "}
                    {demand.excluded.map((e) => `${e.label} $${e.amount.toLocaleString()}`).join(", ")}.
                    Only rent may be demanded — adding these would void the notice.
                  </span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date of service *</Label>
                <Input type="date" value={servedOn} onChange={(e) => setServedOn(e.target.value)} />
              </div>
              <div>
                <Label>How it is served</Label>
                <Select value={serviceMethod} onValueChange={(v) => v && setServiceMethod(v as ServiceMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personally, to the tenant</SelectItem>
                    <SelectItem value="substituted">Substituted, plus mail</SelectItem>
                    <SelectItem value="post_and_mail">Posted on the door, plus mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {deadline && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <p>
                  Pay-or-quit deadline: <strong>{deadline}</strong>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Three days from the day after service. {skipped.length
                    ? `${skipped.length} day${skipped.length === 1 ? "" : "s"} not counted: ${skipped.map((d) => `${d.date} (${d.reason.toLowerCase()})`).join(", ")}.`
                    : "No weekends or judicial holidays fall in the period."}
                </p>
              </div>
            )}

            <div className="space-y-3 rounded-lg border border-border/50 bg-background/40 p-3">
              <p className="text-sm font-medium">Where the tenant pays</p>
              <p className="text-[11px] text-muted-foreground -mt-2">
                Required by CCP § 1161(2) — a notice without these details is defective.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Payable to *</Label>
                  <Input value={payee.name} onChange={(e) => setPayee({ ...payee, name: e.target.value })} placeholder="Owner or agent" />
                </div>
                <div>
                  <Label>Telephone *</Label>
                  <Input value={payee.phone} onChange={(e) => setPayee({ ...payee, phone: e.target.value })} placeholder="(530) 555-0100" />
                </div>
                <div className="col-span-2">
                  <Label>Address *</Label>
                  <Input value={payee.address} onChange={(e) => setPayee({ ...payee, address: e.target.value })} placeholder="Street, city, state, zip" />
                </div>
                <div className="col-span-2">
                  <Label>How payment may be made</Label>
                  <Select value={payee.method} onValueChange={(v) => v && setPayee({ ...payee, method: v as NoticePayeeDetails["method"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_person">In person</SelectItem>
                      <SelectItem value="bank">Deposit to a bank account</SelectItem>
                      <SelectItem value="electronic">Electronically, as already agreed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {payee.method === "in_person" && (
                  <div className="col-span-2">
                    <Label>Usual days and hours *</Label>
                    <Input value={payee.hours} onChange={(e) => setPayee({ ...payee, hours: e.target.value })} />
                  </div>
                )}
                {payee.method === "bank" && (
                  <>
                    <div><Label>Bank *</Label><Input value={payee.bankName} onChange={(e) => setPayee({ ...payee, bankName: e.target.value })} /></div>
                    <div><Label>Account number *</Label><Input value={payee.accountNumber} onChange={(e) => setPayee({ ...payee, accountNumber: e.target.value })} /></div>
                  </>
                )}
                {payee.method === "electronic" && (
                  <div className="col-span-2">
                    <Label>Which method *</Label>
                    <Input value={payee.electronicDescription} onChange={(e) => setPayee({ ...payee, electronicDescription: e.target.value })} placeholder="The RentOS tenant portal" />
                  </div>
                )}
              </div>
            </div>

            {blockers.length > 0 && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-red-400">
                  <ShieldAlert className="h-4 w-4" /> This notice would be defective
                </p>
                <ul className="mt-1.5 space-y-1">
                  {blockers.map((p) => (
                    <li key={p.field} className="text-xs text-red-300">· {p.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {warnings.map((p) => (
              <p key={p.field} className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {p.message}
              </p>
            ))}

            <p className="text-[11px] text-muted-foreground">
              RentOS prepares the document and computes the dates. It is not legal advice, and an
              eviction turns on service being done correctly — have a lawyer review anything you
              intend to file on.
            </p>

            <DialogFooter>
              <Button variant="outline" onClick={close}>Cancel</Button>
              <Button
                onClick={handleIssue}
                disabled={saving || blockers.length > 0}
                className={cn("border-0 text-white", blockers.length ? "" : "gradient-brand")}
              >
                {saving ? "Recording…" : "Record and print"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
