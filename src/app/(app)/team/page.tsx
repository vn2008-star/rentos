"use client";

import React, { useState } from "react";
import {
  Users, UserPlus, Mail, Copy, Loader2, ShieldCheck, Trash2, Clock, Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useTeam } from "@/lib/use-team";
import { useOrganization } from "@/lib/use-org";
import { useAuthStore } from "@/lib/store";
import { INVITABLE_ROLES, ROLE_LABELS, isOwnerOrManagerRole } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import toast from "react-hot-toast";

function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U";
}

export default function TeamPage() {
  const user = useAuthStore((s) => s.user);
  const { org } = useOrganization();
  const { members, invites, loading, invite, revokeInvite, changeRole, removeMember } = useTeam();

  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("manager");
  const [sending, setSending] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage = isOwnerOrManagerRole(user?.role);

  const handleInvite = async () => {
    setSending(true);
    try {
      const { acceptUrl } = await invite({ email: email.trim(), role });
      setLastLink(acceptUrl);
      setEmail("");
      toast.success("Invitation created — send them the link.");
    } catch (err: any) {
      toast.error(err?.message || "Could not create the invitation.");
    } finally {
      setSending(false);
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

  const handleRoleChange = async (userId: string, next: UserRole) => {
    setBusyId(userId);
    try {
      await changeRole(userId, next);
      toast.success("Role updated.");
    } catch (err: any) {
      toast.error(err?.message || "Could not change that role.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from ${org?.name ?? "this organization"}? They keep their login but lose all access.`)) return;
    setBusyId(userId);
    try {
      await removeMember(userId);
      toast.success(`${name} removed.`);
    } catch (err: any) {
      toast.error(err?.message || "Could not remove that person.");
    } finally {
      setBusyId(null);
    }
  };

  const staff = members.filter((m) => m.role !== "tenant" && m.role !== "contractor" && m.role !== "guest");
  const linked = members.filter((m) => m.role === "tenant" || m.role === "contractor");

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading lg:text-3xl">Team</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Who can see and manage {org?.name ?? "your portfolio"}
          </p>
        </div>
        {canManage && (
          <Button
            className="gap-2 gradient-brand text-white border-0"
            onClick={() => { setShowInvite(true); setLastLink(null); }}
          >
            <UserPlus className="h-4 w-4" /> Invite
          </Button>
        )}
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Staff
            <Badge variant="secondary" className="ml-1">{staff.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading team...
            </div>
          )}

          {!loading && staff.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">No staff accounts yet.</p>
          )}

          {staff.map((m) => {
            const isOwner = org?.ownerId === m.id;
            const isSelf = user?.id === m.id;
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/40 p-3"
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="bg-accent text-xs font-semibold">
                    {initials(m.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {m.displayName}
                    {isSelf && <span className="text-muted-foreground font-normal"> (you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>

                {isOwner ? (
                  <Badge className="gap-1 gradient-brand text-white border-0">
                    <ShieldCheck className="h-3 w-3" /> Owner
                  </Badge>
                ) : canManage && !isSelf ? (
                  <Select
                    value={m.role}
                    onValueChange={(v) => v != null && handleRoleChange(m.id, v as UserRole)}
                    disabled={busyId === m.id}
                  >
                    <SelectTrigger className="w-[168px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVITABLE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary">{ROLE_LABELS[m.role]}</Badge>
                )}

                {canManage && !isSelf && !isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    disabled={busyId === m.id}
                    onClick={() => handleRemove(m.id, m.displayName)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Pending invitations
              <Badge variant="secondary" className="ml-1">{invites.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/40 p-3"
              >
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABELS[inv.role]} · expires{" "}
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => copy(`${window.location.origin}/invite/${inv.id}`)}
                >
                  <Copy className="h-3.5 w-3.5" /> Link
                </Button>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={async () => {
                      try {
                        await revokeInvite(inv.id);
                        toast.success("Invitation revoked.");
                      } catch (err: any) {
                        toast.error(err?.message || "Could not revoke.");
                      }
                    }}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {linked.length > 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Check className="h-4 w-4" /> Portal accounts
              <Badge variant="secondary" className="ml-1">{linked.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Tenants and contractors who have signed in. They see only their own
              lease, payments or assigned jobs.
            </p>
            {linked.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/40 p-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-accent text-[10px] font-semibold">
                    {initials(m.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{m.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
                <Badge variant="secondary">{ROLE_LABELS[m.role]}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Invite someone</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sending}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => v != null && setRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVITABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {lastLink && (
              <div className="space-y-2 rounded-lg border border-border/50 bg-accent/30 p-3">
                <p className="text-xs text-muted-foreground">
                  RentOS does not send email yet — copy this link and send it to them.
                  Only the invited address can accept it, and it expires in 14 days.
                </p>
                <div className="flex gap-2">
                  <Input readOnly value={lastLink} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copy(lastLink)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>
              {lastLink ? "Done" : "Cancel"}
            </Button>
            <Button
              className="gradient-brand text-white border-0 gap-2"
              disabled={sending || !email.includes("@")}
              onClick={handleInvite}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Create invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
