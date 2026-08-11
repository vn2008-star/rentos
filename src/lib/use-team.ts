"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { Collections } from "./firestore";
import { isFirebaseConfigured } from "./demo";
import { useAuthStore } from "./store";
import { authedJson } from "./api-client";
import type { OrgInvite, UserProfile, UserRole } from "./types";

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
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setMembers(DEMO_MEMBERS);
      setInvites([]);
      setLoading(false);
      return;
    }
    if (!user?.orgId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubMembers = onSnapshot(
      query(collection(db, Collections.USERS), where("orgId", "==", user.orgId)),
      (snap) => {
        setMembers(
          snap.docs.map((d) => ({ ...d.data(), id: d.id }) as UserProfile)
        );
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("[useTeam] members read failed:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    const unsubInvites = onSnapshot(
      query(
        collection(db, Collections.INVITES),
        where("orgId", "==", user.orgId),
        where("status", "==", "pending")
      ),
      (snap) => {
        setInvites(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as OrgInvite));
      },
      (err) => console.error("[useTeam] invites read failed:", err)
    );

    return () => {
      unsubMembers();
      unsubInvites();
    };
  }, [user?.orgId]);

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
