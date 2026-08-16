"use client";

import React, { useState } from "react";
import { Plus, Search, Phone, Mail, MapPin, MoreHorizontal, Edit2, Trash2, Eye, Wifi, WifiOff, Send, Copy, ShieldCheck, KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { useTenants, useUnits, useProperties, useLeases } from "@/lib/hooks";
import { useTeam } from "@/lib/use-team";
import { useAuthStore } from "@/lib/store";
import { isOwnerOrManagerRole } from "@/lib/roles";
import { errorMessage } from "@/lib/errors";
import type { Tenant } from "@/lib/types";
import toast from "react-hot-toast";
import { useQuickAdd } from "@/lib/quick-add";

const emptyForm = { firstName: "", lastName: "", email: "", phone: "", unitId: "", propertyId: "", notes: "" };

export default function TenantsPage() {
  const { tenants, loading, isLive, addTenant, editTenant, removeTenant } = useTenants();
  const { units } = useUnits();
  const { properties } = useProperties();
  const { leases } = useLeases();
  const { invite } = useTeam();
  const user = useAuthStore((s) => s.user);
  const canInvite = isOwnerOrManagerRole(user?.role);

  const [showAdd, setShowAdd] = useState(false);
  // Opens this dialog when Quick Add in the top bar asked for it.
  useQuickAdd("tenant", () => setShowAdd(true));
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [viewing, setViewing] = useState<Tenant | null>(null);
  const [inviteLink, setInviteLink] = useState<{ name: string; url: string } | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const filtered = tenants.filter((t) => {
    const q = search.toLowerCase();
    return `${t.firstName} ${t.lastName}`.toLowerCase().includes(q) || t.email.toLowerCase().includes(q) || t.phone.includes(q);
  });

  const handleAdd = async () => {
    setSaving(true);
    try {
      await addTenant({
        firstName: form.firstName, lastName: form.lastName, email: form.email,
        phone: form.phone, unitId: form.unitId || undefined, propertyId: form.propertyId || undefined,
        notes: form.notes || undefined,
      });
      toast.success(
        form.unitId
          ? `${form.firstName} ${form.lastName} added — that unit is now occupied`
          : `${form.firstName} ${form.lastName} added`
      );
      setShowAdd(false);
      setForm(emptyForm);
    } catch (err) { toast.error(errorMessage(err, "Failed to add tenant")); }
    finally { setSaving(false); }
  };

  const openEdit = (tenant: Tenant) => {
    setForm({
      firstName: tenant.firstName, lastName: tenant.lastName, email: tenant.email,
      phone: tenant.phone, unitId: tenant.unitId ?? "", propertyId: tenant.propertyId ?? "",
      notes: tenant.notes ?? "",
    });
    setEditing(tenant);
  };

  const handleEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      // unitId is sent even when blank: clearing it is how a manager moves
      // somebody out, and that has to reach the unit so it can be re-let.
      await editTenant(editing.id, {
        firstName: form.firstName, lastName: form.lastName, email: form.email,
        phone: form.phone, unitId: form.unitId, propertyId: form.propertyId,
        notes: form.notes,
      });
      toast.success("Tenant updated");
      setEditing(null);
      setForm(emptyForm);
    } catch (err) { toast.error(errorMessage(err, "Failed to save changes")); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}"? Their unit is released and can be let again.`)) return;
    try {
      await removeTenant(id);
      toast.success("Tenant removed");
    } catch (err) { toast.error(errorMessage(err, "Failed to remove tenant")); }
  };

  /**
   * Invites a tenant to the resident portal.
   *
   * The alternative — and until now the only route in — was hoping the tenant
   * worked out for themselves that they should register with the exact address
   * on file, and that the automatic match would find it. This makes it a link a
   * manager can send.
   */
  const handleInvite = async (tenant: Tenant) => {
    if (!tenant.email) { toast.error("Add an email address for this tenant first."); return; }
    setInvitingId(tenant.id);
    try {
      const { acceptUrl } = await invite({ email: tenant.email, role: "tenant", tenantId: tenant.id });
      setInviteLink({ name: `${tenant.firstName} ${tenant.lastName}`, url: acceptUrl });
      toast.success("Invitation created — send them the link.");
    } catch (err) {
      toast.error(errorMessage(err, "Could not create the invitation."));
    } finally {
      setInvitingId(null);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copied.");
    } catch {
      toast.error("Could not copy — select the link and copy it by hand.");
    }
  };

  const avatarColors = ["bg-blue-500/20 text-blue-400", "bg-emerald-500/20 text-emerald-400", "bg-violet-500/20 text-violet-400", "bg-rose-500/20 text-rose-400", "bg-amber-500/20 text-amber-400", "bg-cyan-500/20 text-cyan-400"];

  /** Units a tenant can be put in: the vacant ones, plus the one they are in. */
  const assignableUnits = (propertyId: string, keepUnitId?: string) =>
    units.filter(u => u.propertyId === propertyId && (u.status === "available" || u.id === keepUnitId));

  const tenantFields = (keepUnitId?: string) => (
    <div className="grid grid-cols-2 gap-4">
      <div><Label>First Name</Label><Input placeholder="Sarah" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
      <div><Label>Last Name</Label><Input placeholder="Chen" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
      <div className="col-span-2"><Label>Email</Label><Input type="email" placeholder="tenant@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
      <div className="col-span-2"><Label>Phone</Label><Input placeholder="(530) 555-0000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
      <div className="col-span-2"><Label>Assign to Property</Label><Select value={form.propertyId} onValueChange={v => v != null && setForm({ ...form, propertyId: v, unitId: "" })}><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger><SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
      {form.propertyId && (
        <div className="col-span-2"><Label>Assign to Unit</Label><Select value={form.unitId} onValueChange={v => v != null && setForm({ ...form, unitId: v })}><SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger><SelectContent>{assignableUnits(form.propertyId, keepUnitId).map(u => <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber} — ${u.rent}/mo</SelectItem>)}</SelectContent></Select></div>
      )}
      <div className="col-span-2"><Label>Notes</Label><Textarea placeholder="Optional notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Tenants</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            {loading ? "Loading tenants…" : `${tenants.length} tenants across your properties`}
            <Badge variant="outline" className={`text-[10px] gap-1 ${isLive ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}`}>
              {isLive ? <><Wifi className="h-2.5 w-2.5" /> Live</> : <><WifiOff className="h-2.5 w-2.5" /> Demo</>}
            </Badge>
          </p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setShowAdd(true); }} className="gradient-brand text-white border-0 shadow-lg shadow-primary/25 gap-1.5"><Plus className="h-4 w-4" /> Add Tenant</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search tenants..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/50 bg-card/50"><CardContent className="p-3 text-center"><p className="text-2xl font-bold font-heading">{tenants.length}</p><p className="text-[11px] text-muted-foreground">Total</p></CardContent></Card>
        <Card className="border-border/50 bg-card/50"><CardContent className="p-3 text-center"><p className="text-2xl font-bold font-heading text-emerald-400">{tenants.filter(t => t.unitId).length}</p><p className="text-[11px] text-muted-foreground">Assigned</p></CardContent></Card>
        <Card className="border-border/50 bg-card/50"><CardContent className="p-3 text-center"><p className="text-2xl font-bold font-heading text-amber-400">{tenants.filter(t => !t.unitId).length}</p><p className="text-[11px] text-muted-foreground">Unassigned</p></CardContent></Card>
        <Card className="border-border/50 bg-card/50"><CardContent className="p-3 text-center"><p className="text-2xl font-bold font-heading text-blue-400">{tenants.filter(t => t.userId).length}</p><p className="text-[11px] text-muted-foreground">On the portal</p></CardContent></Card>
      </div>

      {/* Tenant Cards */}
      {loading ? (
        <CardGridSkeleton count={8} height="h-48" className="gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:grid-cols-2" />
      ) : (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((tenant, idx) => {
          const unit = units.find(u => u.id === tenant.unitId);
          const prop = properties.find(p => p.id === tenant.propertyId);
          const initials = `${tenant.firstName[0]}${tenant.lastName[0]}`;
          return (
            <Card key={tenant.id} className="group border-border/50 bg-card/50 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 ring-2 ring-border/50 group-hover:ring-primary/30 transition-all">
                      <AvatarFallback className={`${avatarColors[idx % avatarColors.length]} text-sm font-semibold`}>{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-sm font-heading group-hover:text-primary transition-colors">{tenant.firstName} {tenant.lastName}</h3>
                      {unit ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Unit {unit.unitNumber} · {prop?.name || "—"}</p>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30 h-5">Unassigned</Badge>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>} />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="cursor-pointer" onClick={() => setViewing(tenant)}><Eye className="h-4 w-4 mr-2" /> View Profile</DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer" onClick={() => openEdit(tenant)}><Edit2 className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                      {canInvite && !tenant.userId && (
                        <DropdownMenuItem className="cursor-pointer" disabled={invitingId === tenant.id} onClick={() => handleInvite(tenant)}>
                          <Send className="h-4 w-4 mr-2" /> {invitingId === tenant.id ? "Creating…" : "Invite to portal"}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="cursor-pointer text-destructive" onClick={() => handleDelete(tenant.id, `${tenant.firstName} ${tenant.lastName}`)}><Trash2 className="h-4 w-4 mr-2" /> Remove</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p className="flex items-center gap-2"><Mail className="h-3 w-3" />{tenant.email}</p>
                  <p className="flex items-center gap-2"><Phone className="h-3 w-3" />{tenant.phone}</p>
                </div>
                <Badge variant="outline" className={`text-[10px] h-5 gap-1 ${tenant.userId ? "text-emerald-400 border-emerald-500/30" : "text-muted-foreground border-border/50"}`}>
                  {tenant.userId ? <><ShieldCheck className="h-2.5 w-2.5" /> Portal active</> : <><KeyRound className="h-2.5 w-2.5" /> No portal access</>}
                </Badge>
                {tenant.notes && <p className="text-xs text-muted-foreground/60 italic border-t border-border/30 pt-2">{tenant.notes}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}

      {/* Profile Sheet */}
      <Sheet open={!!viewing} onOpenChange={() => setViewing(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {viewing && (() => {
            const unit = units.find(u => u.id === viewing.unitId);
            const prop = properties.find(p => p.id === viewing.propertyId);
            const lease = leases.find(l => l.tenantIds.includes(viewing.id));
            return (
              <div className="space-y-6">
                <SheetHeader><SheetTitle className="font-heading text-lg">{viewing.firstName} {viewing.lastName}</SheetTitle></SheetHeader>

                <Card className="border-border/50 bg-card/50">
                  <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium break-all">{viewing.email}</p></div>
                    <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{viewing.phone || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Unit</p><p className="font-medium">{unit ? `Unit ${unit.unitNumber}` : "Unassigned"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Property</p><p className="font-medium">{prop?.name ?? "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Move-in</p><p className="font-medium">{viewing.moveInDate ?? "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Portal</p><p className="font-medium">{viewing.userId ? "Active" : "Not set up"}</p></div>
                  </CardContent>
                </Card>

                {lease && (
                  <Card className="border-border/50 bg-card/50">
                    <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="col-span-2"><p className="text-xs text-muted-foreground">Lease</p><p className="font-medium capitalize">{lease.status.replace("_", " ")} · {lease.startDate} to {lease.endDate}</p></div>
                      <div><p className="text-xs text-muted-foreground">Rent</p><p className="font-medium text-emerald-400">${lease.rentAmount.toLocaleString()}/mo</p></div>
                      <div><p className="text-xs text-muted-foreground">Deposit</p><p className="font-medium">${lease.securityDeposit.toLocaleString()}</p></div>
                    </CardContent>
                  </Card>
                )}

                {viewing.emergencyContact?.name && (
                  <Card className="border-border/50 bg-card/50">
                    <CardContent className="p-4 text-sm">
                      <p className="text-xs text-muted-foreground">Emergency contact</p>
                      <p className="font-medium">{viewing.emergencyContact.name} · {viewing.emergencyContact.relationship}</p>
                      <p className="text-muted-foreground">{viewing.emergencyContact.phone}</p>
                    </CardContent>
                  </Card>
                )}

                {viewing.notes && (
                  <Card className="border-border/50 bg-card/50">
                    <CardContent className="p-4 text-sm"><p className="text-xs text-muted-foreground mb-1">Notes</p><p>{viewing.notes}</p></CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => { const t = viewing; setViewing(null); openEdit(t); }}><Edit2 className="h-4 w-4 mr-2" /> Edit</Button>
                  {canInvite && !viewing.userId && (
                    <Button className="gradient-brand text-white border-0" disabled={invitingId === viewing.id} onClick={() => handleInvite(viewing)}>
                      <Send className="h-4 w-4 mr-2" /> Invite to portal
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Add New Tenant</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">{tenantFields()}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!form.firstName || !form.lastName || !form.email || saving} className="gradient-brand text-white border-0">{saving ? "Saving..." : "Add Tenant"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Edit Tenant</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">{tenantFields(editing?.unitId)}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!form.firstName || !form.lastName || !form.email || saving} className="gradient-brand text-white border-0">{saving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invitation link — shown once, because it is not stored anywhere the
          manager can go back for it. */}
      <Dialog open={!!inviteLink} onOpenChange={(open) => { if (!open) setInviteLink(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-heading">Portal invitation for {inviteLink?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Send them this link. It expires in 14 days, and only the address it was
              issued to can accept it — forwarding it gives nobody access.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={inviteLink?.url ?? ""} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => inviteLink && copy(inviteLink.url)}><Copy className="h-4 w-4" /></Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteLink(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
