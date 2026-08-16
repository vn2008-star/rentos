import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, writeBatch,
  type DocumentData, type QueryConstraint, onSnapshot, type Unsubscribe,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import { useAuthStore } from "./store";

// ============================================
// Generic Firestore CRUD
// ============================================

/**
 * All queries are scoped by orgId to enforce multi-tenancy.
 */

/**
 * Stops a read-only demo visitor before the write leaves the browser.
 *
 * The security rules already refuse these — 'guest' satisfies no write rule
 * anywhere — but "Missing or insufficient permissions" is a terrible thing to
 * show someone who is evaluating the product. Failing here means they get a
 * sentence that explains itself, and it covers every write in the app rather
 * than every button being remembered individually.
 *
 * The store is read imperatively because this module is not a React hook.
 */
function assertWritable(): void {
  const state = useAuthStore.getState();

  if (state.user?.role === "guest") {
    throw new Error(
      "This is a read-only demo — start a free trial to make changes."
    );
  }

  // An operator looking through a tenant's or contractor's eyes. The rules
  // refuse these too; stopping here turns a permission error into an
  // explanation of why the app is behaving like a customer rather than staff.
  if (state.supportSession?.viewAsRole) {
    throw new Error(
      `You are viewing as ${state.supportSession.viewAsSubjectName ?? "a customer"} — ` +
        "exit the support session to make changes."
    );
  }
}

export async function createDocument<T extends DocumentData>(
  collectionName: string,
  data: T,
  customId?: string
): Promise<string> {
  assertWritable();
  const docData = { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  if (customId) {
    await updateDoc(doc(db, collectionName, customId), docData).catch(async () => {
      const { setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, collectionName, customId), docData);
    });
    return customId;
  }
  const docRef = await addDoc(collection(db, collectionName), docData);
  return docRef.id;
}

export async function getDocument<T>(
  collectionName: string,
  docId: string
): Promise<(T & { id: string }) | null> {
  const snap = await getDoc(doc(db, collectionName, docId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as T & { id: string };
}

export async function queryDocuments<T>(
  collectionName: string,
  orgId: string,
  constraints: QueryConstraint[] = [],
  maxResults = 100
): Promise<(T & { id: string })[]> {
  const q = query(
    collection(db, collectionName),
    where("orgId", "==", orgId),
    ...constraints,
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T & { id: string }));
}

export async function updateDocument(
  collectionName: string,
  docId: string,
  data: Partial<DocumentData>
): Promise<void> {
  assertWritable();
  await updateDoc(doc(db, collectionName, docId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Writes exactly the given fields — no updatedAt stamp.
 *
 * Some rules pin down which keys a write may touch. Notifications are the
 * case that bit us: the rule allows a client to flip `read` and nothing else,
 * so the updatedAt that updateDocument adds made every "mark as read" fail
 * permission checks. The failure was invisible — the badge cleared optimistically
 * and came back on the next reload.
 */
export async function updateDocumentFields(
  collectionName: string,
  docId: string,
  data: Partial<DocumentData>
): Promise<void> {
  assertWritable();
  await updateDoc(doc(db, collectionName, docId), data);
}

export async function deleteDocument(
  collectionName: string,
  docId: string
): Promise<void> {
  assertWritable();
  await deleteDoc(doc(db, collectionName, docId));
}

// ============================================
// Writes that must land together
// ============================================

/**
 * An id for a document that does not exist yet.
 *
 * Firestore generates ids client-side, which is what lets a batch write a new
 * record and the cross-links pointing at it in the same commit.
 */
export function newDocumentId(collectionName: string): string {
  return doc(collection(db, collectionName)).id;
}

export type BatchWrite =
  | { op: "set"; collection: string; id: string; data: DocumentData }
  | { op: "update"; collection: string; id: string; data: Partial<DocumentData> }
  | { op: "delete"; collection: string; id: string };

/**
 * Commits several writes atomically — all of them, or none.
 *
 * Assignment is the case this exists for. Moving a tenant into a unit means
 * writing the tenant and marking the unit occupied, and doing those as two
 * requests leaves a real failure mode: the tenant lands, the unit write is
 * denied or dropped, and a unit somebody lives in stays listed as available
 * until it is let a second time. Occupancy is not cosmetic — the dashboard's
 * occupancy rate, the analytics revenue and the rent roll all count it.
 */
export async function commitBatch(writes: BatchWrite[]): Promise<void> {
  if (writes.length === 0) return;
  assertWritable();

  const batch = writeBatch(db);
  for (const write of writes) {
    const ref = doc(db, write.collection, write.id);
    if (write.op === "delete") {
      batch.delete(ref);
    } else if (write.op === "set") {
      batch.set(ref, {
        ...write.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(ref, { ...write.data, updatedAt: serverTimestamp() });
    }
  }
  await batch.commit();
}

// ============================================
// Real-time Listener
// ============================================

export function subscribeToCollection<T>(
  collectionName: string,
  orgId: string,
  callback: (docs: (T & { id: string })[]) => void,
  constraints: QueryConstraint[] = [],
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, collectionName),
    where("orgId", "==", orgId),
    ...constraints
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as T & { id: string }));
    callback(docs);
  }, (err) => {
    // Callers need to know: a denied or failed read must not be mistaken for
    // "this org has no records".
    console.error(`Subscription error on ${collectionName}:`, err);
    onError?.(err);
  });
}

// ============================================
// File Upload
// ============================================

export async function uploadFile(
  path: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  assertWritable();
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
}

export async function uploadMultipleFiles(
  basePath: string,
  files: File[]
): Promise<string[]> {
  const urls = await Promise.all(
    files.map((file, i) => uploadFile(`${basePath}/${Date.now()}-${i}-${file.name}`, file))
  );
  return urls;
}

// ============================================
// Collection-specific helpers
// ============================================

// Re-exported for the client code that has always imported it from here.
// Server code should import from ./collections directly — see that file for why.
export { Collections } from "./collections";
