"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { Collections } from "./firestore";
import { isFirebaseConfigured } from "./demo";
import { useAuthStore } from "./store";
import { authedJson } from "./api-client";
import type { OrgInvite, UserProfile, UserRole } from "./types";
import { errorMessage } from "@/lib/errors";

/**
 * The people in the signed-in user's organization, and the invitations waiting
 * to be accepted.
 *
 * Reads are ordinary client queries — the rules let org staff read profiles and
 * invites belonging to their own org. Every write goes through an API route
 * instead, because orgId and role decide what a profile may see, and the rules
 * refuse to let a browser write either.
 */

const DEMO_MEMBERS: UserProfile[] = [
  {
    id: "demo-owner",
    email: "owner@rentos.demo",
    displayName: "Demo Owner",
    role: "owner",
    orgId: "org-1",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "demo-manager",
    email: "manager@rentos.demo",
    displayName: "Demo Manager",
    role: "manager",
    orgId: "org-1",
    createdAt: "2024-02-01T00:00:00Z",
  },
];

export function useTeam() {
  const user = useAuthStore((s) => s.user);
  const demo = !isFirebaseConfigured();
  const orgId = user?.orgId;

  // Stamped with the orgId the roster came from, so "is this answer about the
  // org we are currently asking about" is decided during render rather than by
  // an effect resetting state synchronously.
  const [remote, setRemote] = useState<{
    orgId: string | null;
    members: UserProfile[];
    error: string | null;
  }>({ orgId: null, members: [], error: null });
  const [remoteInvites, setRemoteInvites] = useState<OrgInvite[]>([]);

  useEffect(() => {
    // Demo mode has no backend and a profile with no orgId names no roster.
    // Both are answered during render below.
    if (demo || !orgId) return;

    const unsubMembers = onSnapshot(
      query(collection(db, Collections.USERS), where("orgId", "==", orgId)),
      (snap) => {
        setRemote({
          orgId,
          members: snap.docs.map((d) => ({ ...d.data(), id: d.id }) as UserProfile),
          error: null,
        });
      },
      (err) => {
        console.error("[useTeam] members read failed:", err);
        setRemote({ orgId, members: [], error: errorMessage(err) });
      }
    );

    const unsubInvites = onSnapshot(
      query(
        collection(db, Collections.INVITES),
        where("orgId", "==", orgId),
        where("status", "==", "pending")
      ),
      (snap) => {
        setRemoteInvites(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as OrgInvite));
      },
      (err) => console.error("[useTeam] invites read failed:", err)
    );

    return () => {
      unsubMembers();
      unsubInvites();
    };
  }, [orgId, demo]);

  const settled = remote.orgId === orgId;
  const members = demo ? DEMO_MEMBERS : settled ? remote.members : [];
  const invites = demo || !settled ? [] : remoteInvites;
  const loading = demo || !orgId ? false : !settled;
  const error = demo || !settled ? null : remote.error;

  const invite = useCallback(
    async (input: { email: string; role: UserRole; tenantId?: string; vendorId?: string }) =>
      authedJson<{ invite: OrgInvite; acceptUrl: string }>("/api/invites", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    []
  );

  const revokeInvite = useCallback(
    async (inviteId: string) =>
      authedJson<{ revoked: true }>("/api/invites/revoke", {
        method: "POST",
        body: JSON.stringify({ inviteId }),
      }),
    []
  );

  const changeRole = useCallback(
    async (userId: string, role: UserRole) =>
      authedJson<{ userId: string; role: UserRole }>("/api/org/members", {
        method: "PATCH",
        body: JSON.stringify({ userId, role }),
      }),
    []
  );

  const removeMember = useCallback(
    async (userId: string) =>
      authedJson<{ removed: true }>("/api/org/members", {
        method: "DELETE",
        body: JSON.stringify({ userId }),
      }),
    []
  );

  return { members, invites, loading, error, invite, revokeInvite, changeRole, removeMember };
}

export async function acceptInvite(inviteId: string) {
  return authedJson<{
    orgId: string;
    orgName: string;
    role: UserRole;
    tenantId: string | null;
    vendorId: string | null;
  }>("/api/invites/accept", {
    method: "POST",
    body: JSON.stringify({ inviteId }),
  });
}
