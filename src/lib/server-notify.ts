import { getAdminDb } from "./firebase-admin";
import { Collections } from "./firestore";
import type { NotificationKind } from "./types";

/**
 * Writes an in-app notification from the server.
 *
 * Clients may never create notifications — the rules forbid it — or a tenant
 * could fabricate a "rent received" notice. Everything that needs to tell
 * somebody something (the Stripe webhook, public intake) goes through here.
 *
 * Never throws: a notification that fails to write must not fail the payment,
 * repair request or application it was reporting on.
 */
export async function notifyOrg(n: {
  orgId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  audience: "manager" | "tenant";
  tenantId?: string;
  href?: string;
}): Promise<void> {
  try {
    const db = await getAdminDb();
    await db.collection(Collections.NOTIFICATIONS).add({
      ...n,
      tenantId: n.tenantId ?? null,
      read: false,
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[notify] Failed to write notification:", err?.message);
  }
}
