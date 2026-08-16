import type { QueryConstraint, Unsubscribe } from "firebase/firestore";
import { subscribeToCollection } from "./firestore";

/**
 * One Firestore listener per distinct query, shared by every component asking
 * for it.
 *
 * Without this, each call to a list hook opened its own onSnapshot. That is not
 * one listener per screen — it is one per hook call, and the hooks compose. The
 * dashboard alone opened fourteen: six from the page, six more from the pending
 * tasks card (which needs leases, inspections, maintenance, keys, units and
 * tenants), and two from the sidebar's badge counts. Nine of those were distinct
 * queries; five were the same query asked again a component away, each paying
 * for its own full read of the collection.
 *
 * Navigation was the other half of it. A listener died with the page that opened
 * it, so going Units → Dashboard → Units re-read every unit in the organization
 * and showed a skeleton while it happened, every time, forever.
 *
 * So: keyed by the query, ref-counted, and kept alive for a grace period after
 * the last subscriber leaves. A remount inside that window gets the documents
 * synchronously and issues no read at all. Firestore bills the initial snapshot
 * of a query, then only what changes — dropping and re-establishing a listener
 * pays that initial cost again, which is why the grace period is worth more than
 * the memory it holds.
 */

/** How long a listener with no subscribers is kept before it is torn down. */
const IDLE_GRACE_MS = 60_000;

interface Subscriber<T> {
  onData: (docs: T[]) => void;
  onError: (err: Error) => void;
}

interface Entry {
  /** The most recent snapshot, or null before the first one arrives. */
  docs: unknown[] | null;
  error: Error | null;
  subscribers: Set<Subscriber<never>>;
  unsubscribe: Unsubscribe | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

const cache = new Map<string, Entry>();

/**
 * The documents already in hand for a query, or null if none are.
 *
 * Read during render so a component that mounts onto a query somebody else is
 * already watching starts with the data rather than a loading state.
 */
export function peekCollection<T>(key: string): T[] | null {
  return (cache.get(key)?.docs as T[] | undefined) ?? null;
}

/**
 * Attaches to the shared listener for `key`, starting one if it is not running.
 *
 * `onData` is called synchronously with the cached snapshot when there is one,
 * so callers must be somewhere a state update is legal — an effect, not a
 * render.
 */
export function subscribeShared<T>(
  key: string,
  query: {
    collectionName: string;
    orgId: string;
    constraints: QueryConstraint[];
  },
  subscriber: Subscriber<T>
): () => void {
  let entry = cache.get(key);

  if (!entry) {
    entry = { docs: null, error: null, subscribers: new Set(), unsubscribe: null, idleTimer: null };
    cache.set(key, entry);
  }

  // Somebody wants it again — cancel the pending teardown rather than let the
  // listener die and be rebuilt a moment later.
  if (entry.idleTimer) {
    clearTimeout(entry.idleTimer);
    entry.idleTimer = null;
  }

  const self = entry;
  self.subscribers.add(subscriber as Subscriber<never>);

  if (!self.unsubscribe) {
    self.unsubscribe = subscribeToCollection<unknown>(
      query.collectionName,
      query.orgId,
      (docs) => {
        self.docs = docs;
        self.error = null;
        for (const s of self.subscribers) (s.onData as (d: unknown[]) => void)(docs);
      },
      query.constraints,
      (err) => {
        // Deliberately not clearing `docs`: a query that has answered once and
        // then hits a network blip should not have its last good answer thrown
        // away. Each subscriber decides what to show.
        self.error = err;
        for (const s of self.subscribers) s.onError(err);
      }
    );
  } else {
    // Catch the newcomer up on what the listener already knows.
    if (self.docs) subscriber.onData(self.docs as T[]);
    else if (self.error) subscriber.onError(self.error);
  }

  return () => {
    self.subscribers.delete(subscriber as Subscriber<never>);
    if (self.subscribers.size > 0 || self.idleTimer) return;

    self.idleTimer = setTimeout(() => {
      // Re-check: someone may have subscribed and left again inside the window.
      if (self.subscribers.size > 0) {
        self.idleTimer = null;
        return;
      }
      self.unsubscribe?.();
      cache.delete(key);
    }, IDLE_GRACE_MS);
  };
}

/**
 * Drops every shared listener and everything they had read.
 *
 * Signing out has to do this, or the next person to sign in on the same device
 * is handed the previous account's documents out of the cache before their own
 * query has answered. Queries are keyed by orgId, so this is belt and braces
 * against a same-org handover — but that is exactly the case where showing the
 * wrong thing would be least visible.
 */
export function clearCollectionCache(): void {
  for (const entry of cache.values()) {
    if (entry.idleTimer) clearTimeout(entry.idleTimer);
    entry.unsubscribe?.();
  }
  cache.clear();
}
