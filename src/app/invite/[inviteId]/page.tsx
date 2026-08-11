"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, MailCheck, ShieldX, ArrowRight, LogIn } from "lucide-react";
import { RentosMark } from "@/components/rentos-mark";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store";
import { acceptInvite } from "@/lib/use-team";
import { ROLE_LABELS } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import toast from "react-hot-toast";

interface InviteSummary {
  orgName: string;
  email: string;
  role: UserRole;
  invitedByName: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <div className="relative w-full max-w-[440px] space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl gradient-brand shadow-lg shadow-primary/25">
            <RentosMark className="h-8 w-8 text-white" />
          </div>
        </div>
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-2xl shadow-primary/5">
          <CardContent className="p-6 space-y-5 text-center">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  const params = useParams<{ inviteId: string }>();
  const inviteId = params?.inviteId as string;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [invite, setInvite] = useState<InviteSummary | null>(null);
  const [loadError, setLoadError] = useState("");
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!inviteId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invites/${inviteId}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) setLoadError(data.error || "This invitation could not be found.");
        else setInvite(data as InviteSummary);
      } catch {
        if (!cancelled) setLoadError("Could not reach the server.");
      }
    })();
    return () => { cancelled = true; };
  }, [inviteId]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const result = await acceptInvite(inviteId);
      if (user) {
        setUser({
          ...user,
          orgId: result.orgId,
          role: result.role,
          tenantId: result.tenantId ?? undefined,
          vendorId: result.vendorId ?? undefined,
        });
      }
      toast.success(`You have joined ${result.orgName}.`);
      router.replace(result.role === "tenant" ? "/portal" : result.role === "contractor" ? "/dashboard" : "/dashboard");
    } catch (err: any) {
      toast.error(err?.message || "Could not accept the invitation.");
      setAccepting(false);
    }
  };

  if (!invite && !loadError) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking invitation...
        </div>
      </Shell>
    );
  }

  if (loadError || !invite) {
    return (
      <Shell>
        <ShieldX className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="text-lg font-semibold font-heading">Invitation not available</h1>
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button variant="outline" className="w-full" render={<Link href="/login" />}>
          Go to sign in
        </Button>
      </Shell>
    );
  }

  if (invite.status !== "pending") {
    const reason =
      invite.status === "accepted"
        ? "This invitation has already been used."
        : invite.status === "expired"
          ? "This invitation has expired."
          : "This invitation was revoked.";
    return (
      <Shell>
        <ShieldX className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold font-heading">{reason}</h1>
        <p className="text-sm text-muted-foreground">
          Ask {invite.invitedByName} at {invite.orgName} to send a new one.
        </p>
        <Button variant="outline" className="w-full" render={<Link href="/login" />}>
          Go to sign in
        </Button>
      </Shell>
    );
  }

  const header = (
    <>
      <MailCheck className="mx-auto h-10 w-10 text-primary" />
      <div>
        <h1 className="text-xl font-bold font-heading">Join {invite.orgName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {invite.invitedByName} invited <span className="font-medium text-foreground">{invite.email}</span>{" "}
          to join as {ROLE_LABELS[invite.role]}.
        </p>
      </div>
    </>
  );

  if (isLoading) {
    return (
      <Shell>
        {header}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking your session...
        </div>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        {header}
        <p className="text-xs text-muted-foreground">
          Sign in with {invite.email} — or create an account using that address —
          then open this link again.
        </p>
        <div className="space-y-2">
          <Button className="w-full gap-2 gradient-brand text-white border-0" render={<Link href={`/login?next=/invite/${inviteId}`} />}>
            <LogIn className="h-4 w-4" /> Sign in
          </Button>
          <Button variant="outline" className="w-full" render={<Link href={`/register?next=/invite/${inviteId}`} />}>
            Create an account
          </Button>
        </div>
      </Shell>
    );
  }

  const emailMatches = user.email.trim().toLowerCase() === invite.email.trim().toLowerCase();

  if (!emailMatches) {
    return (
      <Shell>
        {header}
        <p className="text-sm text-destructive">
          You are signed in as {user.email}. This invitation can only be accepted by{" "}
          {invite.email}.
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            await useAuthStore.getState().logout();
            router.replace(`/login?next=/invite/${inviteId}`);
          }}
        >
          Sign in as someone else
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      {header}
      <Button
        className="w-full gap-2 gradient-brand text-white border-0"
        disabled={accepting}
        onClick={handleAccept}
      >
        {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        Accept invitation
      </Button>
      <p className="text-xs text-muted-foreground">
        Your email must be verified before you can accept. If it is not, check
        your inbox for the verification link and sign in again.
      </p>
    </Shell>
  );
}
