import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { Collections } from "@/lib/collections";
import { isAdvertisable, subletFeedDisabled } from "@/lib/public-sublets";
import { notifyOrg } from "@/lib/server-notify";
import type { Organization, RentalApplication, Sublet } from "@/lib/types";

/**
 * POST /api/public/sublet/{id}/enquire — someone wants the room.
 *
 * Sublets could be published and found but not answered: a student could read
 * the advert and had no way to say so. This is the other end of that, and it is
 * unauthenticated for the same reason the feed is public — the people looking
 * for a room for one quarter are not RentOS users and never will be.
 *
 * The enquiry is filed as an application against the sublet's unit, so it lands
 * in the pipeline the manager already works, and its id is appended to the
 * sublet so the tenant's portal count is real rather than decorative.
 */

/** Trims and caps a free-text field. */
function text(value: unknown, max: number): string {
    return String(value ?? "").trim().slice(0, max);
}

export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> }
) {
    const { id } = await ctx.params;

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
    }

    const firstName = text(body.firstName, 80);
    const lastName = text(body.lastName, 80);
    const email = text(body.email, 200).toLowerCase();
    const phone = text(body.phone, 60);
    const message = text(body.message, 2000);
    const university = text(body.university, 160);
    const moveInDate = text(body.moveInDate, 20);

    if (!firstName || !email) {
        return NextResponse.json(
            { error: "A name and an email address are required" },
            { status: 400 }
        );
    }
    if (!email.includes("@")) {
        return NextResponse.json({ error: "That email address does not look right" }, { status: 400 });
    }

    const db = await getAdminDb();
    const subletRef = db.collection(Collections.SUBLETS).doc(id);
    const snap = await subletRef.get();
    if (!snap.exists) {
        return NextResponse.json({ error: "Sublet not found" }, { status: 404 });
    }

    const sublet = snap.data() as Sublet;
    const today = new Date().toISOString().slice(0, 10);

    // The same gate the feed applies. Answering an advert that was withdrawn,
    // refused or never approved would put a stranger's details against a room
    // the landlord never agreed to let — and 404 rather than an explanation,
    // because "pending approval" is not a stranger's business.
    if (!isAdvertisable(sublet, today)) {
        return NextResponse.json({ error: "Sublet not found" }, { status: 404 });
    }

    const orgSnap = await db.collection(Collections.ORGANIZATIONS).doc(sublet.orgId).get();
    const org = orgSnap.exists ? (orgSnap.data() as Organization) : null;
    if (subletFeedDisabled(org)) {
        return NextResponse.json({ error: "Sublet not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const applicationRef = db.collection(Collections.APPLICATIONS).doc();

    const application: Omit<RentalApplication, "id"> = {
        orgId: sublet.orgId,
        unitId: sublet.unitId,
        propertyId: sublet.propertyId,
        subletId: id,
        status: "submitted",
        applicant: {
            firstName,
            lastName,
            email,
            phone,
            // A sublet enquiry asks for none of this. Empty rather than absent,
            // so every consumer can read the shape without guarding each field.
            currentAddress: "",
            employer: university,
            income: 0,
            moveInDate: moveInDate || sublet.startDate,
        },
        references: [],
        notes: message,
        createdAt: now,
        updatedAt: now,
    };

    // One transaction so an enquiry cannot be filed without being attached, and
    // two people enquiring at once cannot overwrite each other's id on the
    // sublet — a lost enquiry here is somebody who thinks they have applied.
    await db.runTransaction(async (tx) => {
        const fresh = await tx.get(subletRef);
        const current = (fresh.data() as Sublet | undefined)?.applicationIds ?? [];
        tx.set(applicationRef, application);
        tx.update(subletRef, {
            applicationIds: [...current, applicationRef.id],
            updatedAt: now,
        });
    });

    // Best effort — the enquiry is already recorded, and failing to post a
    // notification is not a reason to tell the enquirer it did not work.
    try {
        await notifyOrg({
            orgId: sublet.orgId,
            kind: "application_received",
            title: "Sublet enquiry",
            body: `${firstName} ${lastName}`.trim() + ` is interested in "${sublet.title}".`,
            audience: "manager",
            href: "/sublets",
        });
    } catch (err) {
        console.warn("[sublet-enquire] could not notify the org:", err);
    }

    return NextResponse.json({ success: true, id: applicationRef.id }, { status: 201 });
}
