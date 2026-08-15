"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addDoc, collection, onSnapshot, query, where,
} from "firebase/firestore";
import { db } from "./firebase";
import { Collections } from "./collections";
import { isFirebaseConfigured } from "./demo";
import { useAuthStore } from "./store";
import type { Feedback, FeedbackType } from "./types";

/**
 * Sending feedback, and following what happened to it.
 *
 * Writes go straight to Firestore rather than through an API route: the rules
 * already pin the submitter to their own uid and organization, and a round trip
 * through the server would add nothing but latency. Replies are the opposite —
 * only an operator may write those, so they come from /api/admin/feedback.
 */

/** Replies the person has already seen, so the dot means "new" and not "any". */
function seenKey(uid: string): string {
  return `rentos.feedback-seen.${uid}`;
}

function readSeen(uid: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(seenKey(uid)) || "[]") as string[];
  } catch {
    return [];
  }
}

export function useFeedback() {
  const user = useAuthStore((s) => s.user);
  // An operator mid-support-session has user.orgId pointing at the customer.
  // Feedback is about RentOS, so it is filed against their own organization —
  // and the create rule compares against the real profile anyway, so using the
  // overridden one would simply be denied.
  const homeOrgId = useAuthStore((s) => s.homeOrgId);
  const orgId = homeOrgId ?? user?.orgId ?? "";

  const userId = user?.id;
  const userRole = user?.role;

  // Whether a subscription is even possible is render-time knowledge, so it is
  // decided here rather than by an effect that sets loading before bailing out.
  const canSubscribe = isFirebaseConfigured() && Boolean(userId) && userRole !== "guest";

  const [history, setHistory] = useState<Feedback[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [unreadReplies, setUnreadReplies] = useState(0);

  // Their own submissions, live — so a reply lands without a reload.
  useEffect(() => {
    if (!canSubscribe || !userId) return;

    const unsubscribe = onSnapshot(
      query(collection(db, Collections.FEEDBACK), where("userId", "==", userId)),
      (snap) => {
        const items = snap.docs
          .map((d) => ({ ...d.data(), id: d.id }) as Feedback)
          .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
        setHistory(items);
        setLoaded(true);

        const seen = readSeen(userId);
        setUnreadReplies(
          items.filter((f) => f.adminNotes?.trim() && !seen.includes(f.id)).length
        );
      },
      (err) => {
        console.error("[feedback] could not read history", err);
        setLoaded(true);
      }
    );

    return unsubscribe;
  }, [userId, canSubscribe]);

  const loading = canSubscribe && !loaded;

  // Depends on `userId` rather than reaching through `user`, so the dependency
  // the compiler infers is the one written down.
  const markRepliesSeen = useCallback(() => {
    if (!userId) return;
    const answered = history.filter((f) => f.adminNotes?.trim()).map((f) => f.id);
    try {
      localStorage.setItem(seenKey(userId), JSON.stringify(answered));
    } catch {
      /* private browsing — the dot just comes back next time */
    }
    setUnreadReplies(0);
  }, [history, userId]);

  const submit = useCallback(
    async (input: { type: FeedbackType; message: string; rating: number; page: string }) => {
      if (!user) throw new Error("You need to be signed in to send feedback.");
      if (!isFirebaseConfigured()) {
        throw new Error("Feedback is unavailable in demo mode.");
      }

      await addDoc(collection(db, Collections.FEEDBACK), {
        orgId,
        userId: user.id,
        userName: user.displayName,
        userEmail: user.email,
        // The real role, not an impersonated one — otherwise a report filed
        // while looking through a tenant's eyes would arrive labelled as theirs.
        userRole: useAuthStore.getState().homeRole ?? user.role,
        page: input.page,
        type: input.type,
        message: input.message.trim().slice(0, 4000),
        rating: input.rating > 0 ? input.rating : null,
        status: "new",
        createdAt: new Date().toISOString(),
      });
    },
    [user, orgId]
  );

  return { history, loading, unreadReplies, submit, markRepliesSeen };
}
