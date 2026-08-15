/**
 * The render-time reduction behind every list in the app.
 *
 * useFirestoreCollection holds one piece of state — the documents in hand, plus
 * the query they answer — and derives everything the UI reads from it. Keeping
 * that derivation here, free of React and Firebase, is what makes it testable:
 * it decides whether a list shows data, a skeleton, or an error, and getting it
 * wrong is wrong on every screen at once.
 *
 * The central idea is the query key. Documents are stamped with the query that
 * produced them, so "does what I am holding answer what I am being asked?" is a
 * comparison rather than something an effect has to reset on its way out. A
 * snapshot for a previous org, collection or filter is not a stale answer to the
 * current question — it is an answer to a different one, and showing it would be
 * worse than showing nothing.
 */

/** How far along the current subscription is. */
export type CollectionStatus =
  /** Subscribed, no snapshot yet. */
  | "waiting"
  /** A snapshot arrived. */
  | "live"
  /** The read failed — permissions, network, quota. */
  | "error"
  /** Nothing arrived within the grace period; stop waiting rather than hang. */
  | "timeout";

export interface CollectionState<T> {
  /** The query these documents answer, or null when no query is possible. */
  key: string | null;
  docs: T[];
  status: CollectionStatus;
  error: string | null;
}

export interface ResolvedCollection<T> {
  data: T[];
  loading: boolean;
  isLive: boolean;
  error: string | null;
}

/**
 * What the UI should render, given the state in hand and the query being asked.
 *
 * `fallbackDocs` is what to show when nothing answers the current query: the
 * mock portfolio in demo mode, and an empty list once Firebase is live. Mock
 * data is the demo affordance and nothing more — when Firebase is configured but
 * a collection is switched off for the caller's role, the honest answer is
 * "nothing", not a fabricated portfolio.
 */
export function resolveCollection<T>(input: {
  canSubscribe: boolean;
  queryKey: string | null;
  fallbackDocs: T[];
  state: CollectionState<T>;
}): ResolvedCollection<T> {
  const { canSubscribe, queryKey, fallbackDocs, state } = input;

  const answered = state.key === queryKey;

  return {
    data: answered ? state.docs : fallbackDocs,
    // Only ever waiting on a subscription that can actually happen. Demo mode
    // and a switched-off collection are answers, not pending questions.
    loading: canSubscribe && (!answered || state.status === "waiting"),
    isLive: answered && state.status === "live",
    // A failure reported for a different query says nothing about this one.
    error: answered && state.status === "error" ? state.error : null,
  };
}

/**
 * Applies a caller's optimistic write.
 *
 * Writes land on what the caller is actually looking at, which is the resolved
 * data rather than whatever documents happen to be in state — those can belong
 * to a previous query. The write also claims the current query, so a row added
 * optimistically is not immediately discarded as an answer to a stale one.
 */
export function applyCollectionWrite<T>(
  prev: CollectionState<T>,
  queryKey: string | null,
  fallbackDocs: T[],
  update: T[] | ((docs: T[]) => T[])
): CollectionState<T> {
  const base = prev.key === queryKey ? prev.docs : fallbackDocs;
  return {
    ...prev,
    key: queryKey,
    docs: typeof update === "function" ? (update as (d: T[]) => T[])(base) : update,
  };
}
