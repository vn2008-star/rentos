"use client";

import { useCallback, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { Collections } from "./collections";
import { isFirebaseConfigured } from "./demo";
import { useAuthStore } from "./store";
import { authedJson } from "./api-client";
import type { SupportSession } from "./types";

/**
 * Keeps the app in step with the operator's live support grant.
 *
 * Firestore is the source of truth — the same document the security rules read
 * — so a grant revoked from anywhere, or one that simply runs out, takes the UI
 * with it. Nothing here decides what may be read or written; it decides what
 * the screen is pointed at.
 */
export function useSupportSessionWatcher(): void {
  const user = useAuthStore((s) => s.user);
  const homeOrgId = useAuthStore((s) => s.homeOrgId);
  const setSupportSession = useAuthStore((s) => s.setSupportSession);

  // The operator's own uid, which is the session document's id. Read from
  // homeOrgId's sibling rather than user.orgId, which is overridden while a
  // session is open.
  const uid = user?.id;
  const isOperator = user?.role === "super_admin";

  useEffect(() => {
    if (!isFirebaseConfigured() || !uid || !isOperator) return;

    const unsubscribe = onSnapshot(
      doc(db, Collections.SUPPORT_SESSIONS, uid),
      (snap) => {
        if (!snap.exists()) {
          setSupportSession(null);
          return;
        }

        const data = snap.data();
        const expiresAt: Date =
          typeof data.expiresAt?.toDate === "function"
            ? data.expiresAt.toDate()
            : new Date(data.expiresAt);

        // An expired grant is already dead to the rules; treat it as gone here
        // too rather than showing a customer's name over an app that has quietly
        // stopped being able to load anything.
        if (expiresAt.getTime() <= Date.now()) {
          setSupportSession(null);
          return;
        }

        setSupportSession({
          adminUid: data.adminUid,
          adminEmail: data.adminEmail,
          orgId: data.orgId,
          orgName: data.orgName,
          reason: data.reason,
          writeEnabled: Boolean(data.writeEnabled),
          startedAt: data.startedAt,
          expiresAt: expiresAt.toISOString(),
        });
      },
      (err) => {
        console.error("[support] could not read the session", err);
        setSupportSession(null);
      }
    );

    return unsubscribe;
    // homeOrgId is in the deps so the watcher re-attaches after a sign-in that
    // arrives before the profile does.
  }, [uid, isOperator, homeOrgId, setSupportSession]);

  // The snapshot listener never fires for the passage of time, so the expiry
  // has to be watched separately or the banner would count down past zero.
  const session = useAuthStore((s) => s.supportSession);
  useEffect(() => {
    if (!session) return;
    const remaining = new Date(session.expiresAt).getTime() - Date.now();
    const timer = setTimeout(() => setSupportSession(null), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [session, setSupportSession]);
}

export function useSupportSession() {
  const session = useAuthStore((s) => s.supportSession);
  const setSupportSession = useAuthStore((s) => s.setSupportSession);

  const start = useCallback(
    async (input: {
      orgId: string;
      reason: string;
      minutes: number;
      writeEnabled: boolean;
    }) => {
      const { session: created } = await authedJson<{ session: SupportSession }>(
        "/api/admin/support-session",
        { method: "POST", body: JSON.stringify(input) }
      );
      setSupportSession(created);
      return created;
    },
    [setSupportSession]
  );

  const end = useCallback(async () => {
    await authedJson<{ ended: true }>("/api/admin/support-session", {
      method: "DELETE",
    });
    setSupportSession(null);
  }, [setSupportSession]);

  return { session, start, end };
}

/** Minutes left, floored at zero. */
export function minutesLeft(session: SupportSession | null): number {
  if (!session) return 0;
  const ms = new Date(session.expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 60000));
}
