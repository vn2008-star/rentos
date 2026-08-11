"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  MapPin, Bed, Bath, Maximize, Calendar, Send, Loader2,
  Home, Star, Check, ArrowRight, Building2, Shield, CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import toast from "react-hot-toast";

/**
 * The public advert for one vacancy.
 *
 * Reads through /api/public/listing/{id}: the listing itself is world-readable,
 * but the unit and property it describes are staff-only by rule, so the join has
 * to happen server-side. Applications post to /api/public/apply and are filed
 * against the organization that owns the listing — this page used to read from
 * mock data and "submit" applications to a 1.5-second timer.
 */

interface ListingPayload {
  listing: {
    id: string;
    orgId: string;
    unitId: string;
    propertyId: string;
    title: string;
    description: string;
    photos: string[];
    rent: number;
    availableDate: string;
  };
  unit: {
    id: string;
    unitNumber: string;
    beds: number;
    baths: number;
    sqft: number;
    deposit: number;
    amenities: string[];
    photos: string[];
  } | null;
  property: {
    id: string;
    name: string;
    address: { street: string; city: string; state: string; zip: string };
    amenities: string[];
    description: string;
    totalUnits: number;
    yearBuilt: number | null;
  } | null;
  org: { id: string; name: string; slug: string } | null;
}

export default function PublicListingPage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<ListingPayload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [showApply, setShowApply] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [appForm, setAppForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    currentAddress: "", employer: "", income: "", moveInDate: "", message: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/listing/${encodeURIComponent(id)}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) setLoadError(body.error || "This listing is not available.");
        else setData(body as ListingPayload);
      } catch {
        if (!cancelled) setLoadError("Could not reach the server.");
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleApply = async () => {
    if (!data?.org) return;
    if (!appForm.firstName || !appForm.lastName || !appForm.email) {
      toast.error("Please fill in the required fields");
      return;
    }
    setApplying(true);
    try {
      const res = await fetch("/api/public/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org: data.org.slug,
          unitId: data.listing.unitId,
          ...appForm,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not submit the application.");
      setApplied(true);
      toast.success("Application submitted.");
    } catch (err: any) {
      toast.error(err?.message || "Could not submit the application.");
    } finally {
      setApplying(false);
    }
  };

  if (loadError || (!data && !loadError)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="space-y-4 text-center">
          {loadError ? (
            <>
              <Home className="mx-auto h-16 w-16 text-muted-foreground/30" />
              <h1 className="text-2xl font-bold font-heading text-white">
                Listing not available
              </h1>
              <p className="text-sm text-muted-foreground">{loadError}</p>
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading listing…
            </p>
          )}
        </div>
      </div>
    );
  }

  const { listing, unit, property, org } = data!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold font-heading">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 text-xs font-bold text-white">
              R
            </div>
            RentOS
          </Link>
          <div className="flex gap-2">
            {org && (
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 text-white/70 hover:text-white"
                render={<Link href={`/o/${org.slug}`} />}
              >
                More from {org.name}
              </Button>
            )}
            <Button
              size="sm"
              className="border-0 bg-gradient-to-r from-blue-500 to-violet-500 text-white"
              onClick={() => setShowApply(true)}
            >
              Apply Now <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="relative">
        <div className="flex aspect-[21/8] items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
          {listing.photos?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.photos[0]}
              alt={listing.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="space-y-3 text-center">
              <Building2 className="mx-auto h-16 w-16 text-white/10" />
              <p className="text-sm text-white/30">Photos coming soon</p>
            </div>
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 mx-auto -mt-20 max-w-6xl px-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="border-white/5 bg-slate-900/90 backdrop-blur-xl">
              <CardContent className="space-y-4 p-6">
                <div>
                  <h1 className="text-2xl font-bold font-heading text-white lg:text-3xl">
                    {listing.title}
                  </h1>
                  {property && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-white/60">
                      <MapPin className="h-4 w-4" />
                      {property.address.street}, {property.address.city},{" "}
                      {property.address.state} {property.address.zip}
                    </div>
                  )}
                </div>
                {unit && (
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2">
                      <Bed className="h-4 w-4 text-blue-400" />
                      <span className="text-sm font-medium">
                        {unit.beds === 0 ? "Studio" : `${unit.beds} Bed`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2">
                      <Bath className="h-4 w-4 text-cyan-400" />
                      <span className="text-sm font-medium">{unit.baths} Bath</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2">
                      <Maximize className="h-4 w-4 text-violet-400" />
                      <span className="text-sm font-medium">
                        {unit.sqft.toLocaleString()} sqft
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2">
                      <Calendar className="h-4 w-4 text-amber-400" />
                      <span className="text-sm font-medium">{listing.availableDate}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/5 bg-slate-900/90">
              <CardHeader>
                <CardTitle className="font-heading text-lg text-white">
                  About this unit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm leading-relaxed text-white/70">
                  {listing.description}
                </p>
              </CardContent>
            </Card>

            {(unit || property) && (
              <Card className="border-white/5 bg-slate-900/90">
                <CardHeader>
                  <CardTitle className="font-heading text-lg text-white">Amenities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[...(unit?.amenities ?? []), ...(property?.amenities ?? [])].map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-white/70">
                        <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                        {a}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {property && (
              <Card className="border-white/5 bg-slate-900/90">
                <CardHeader>
                  <CardTitle className="font-heading text-lg text-white">
                    About {property.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-white/70">{property.description}</p>
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Building2 className="h-4 w-4" />
                    {property.totalUnits} total units · Built {property.yearBuilt || "N/A"}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="sticky top-20 border-white/5 bg-slate-900/90">
              <CardContent className="space-y-5 p-6">
                <div>
                  <p className="text-3xl font-bold font-heading text-white">
                    ${listing.rent.toLocaleString()}
                    <span className="text-base font-normal text-white/50">/mo</span>
                  </p>
                  {unit && (
                    <p className="mt-1 text-xs text-white/40">
                      Security deposit: ${unit.deposit.toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Button
                    className="h-11 w-full border-0 bg-gradient-to-r from-blue-500 to-violet-500 text-base text-white"
                    onClick={() => setShowApply(true)}
                  >
                    Apply Now <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  {org && (
                    <Button
                      variant="outline"
                      className="w-full border-white/10 text-white/70 hover:text-white"
                      render={<Link href={`/o/${org.slug}`} />}
                    >
                      <Send className="mr-2 h-4 w-4" /> Contact {org.name}
                    </Button>
                  )}
                </div>

                <div className="space-y-3 border-t border-white/5 pt-4">
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Shield className="h-4 w-4 text-emerald-400" />
                    <span>Listed by {org?.name ?? "the property manager"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Calendar className="h-4 w-4 text-blue-400" />
                    <span>Available {listing.availableDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Star className="h-4 w-4 text-amber-400" />
                    <span>Powered by RentOS</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showApply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto border-white/10 bg-slate-900">
            {applied ? (
              <CardContent className="space-y-4 p-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold font-heading text-white">
                  Application received
                </h2>
                <p className="text-sm text-white/60">
                  {org?.name ?? "The property manager"} will contact you at {appForm.email}.
                </p>
                <Button
                  variant="outline"
                  className="w-full border-white/10 text-white/70"
                  onClick={() => setShowApply(false)}
                >
                  Close
                </Button>
              </CardContent>
            ) : (
              <>
                <CardHeader>
                  <CardTitle className="font-heading text-white">
                    Apply for {unit ? (unit.beds === 0 ? "Studio" : `${unit.beds}BR`) : "this home"}
                    {property ? ` at ${property.name}` : ""}
                  </CardTitle>
                  <p className="text-xs text-white/50">
                    ${listing.rent.toLocaleString()}/mo · Available {listing.availableDate}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-white/70">First Name *</Label>
                      <Input
                        className="border-white/10 bg-white/5 text-white"
                        value={appForm.firstName}
                        onChange={(e) => setAppForm({ ...appForm, firstName: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-white/70">Last Name *</Label>
                      <Input
                        className="border-white/10 bg-white/5 text-white"
                        value={appForm.lastName}
                        onChange={(e) => setAppForm({ ...appForm, lastName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-white/70">Email *</Label>
                    <Input
                      type="email"
                      className="border-white/10 bg-white/5 text-white"
                      value={appForm.email}
                      onChange={(e) => setAppForm({ ...appForm, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-white/70">Phone</Label>
                    <Input
                      className="border-white/10 bg-white/5 text-white"
                      value={appForm.phone}
                      onChange={(e) => setAppForm({ ...appForm, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-white/70">Current Address</Label>
                    <Input
                      className="border-white/10 bg-white/5 text-white"
                      value={appForm.currentAddress}
                      onChange={(e) => setAppForm({ ...appForm, currentAddress: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-white/70">Employer</Label>
                      <Input
                        className="border-white/10 bg-white/5 text-white"
                        value={appForm.employer}
                        onChange={(e) => setAppForm({ ...appForm, employer: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-white/70">Annual Income</Label>
                      <Input
                        inputMode="numeric"
                        className="border-white/10 bg-white/5 text-white"
                        value={appForm.income}
                        onChange={(e) => setAppForm({ ...appForm, income: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-white/70">Desired Move-in Date</Label>
                    <Input
                      type="date"
                      className="border-white/10 bg-white/5 text-white"
                      value={appForm.moveInDate}
                      onChange={(e) => setAppForm({ ...appForm, moveInDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-white/70">Anything else?</Label>
                    <Textarea
                      rows={3}
                      className="border-white/10 bg-white/5 text-white"
                      placeholder="Pets, roommates, questions…"
                      value={appForm.message}
                      onChange={(e) => setAppForm({ ...appForm, message: e.target.value })}
                    />
                  </div>

                  <Button
                    onClick={handleApply}
                    disabled={applying}
                    className="w-full gap-2 border-0 bg-gradient-to-r from-blue-500 to-violet-500 text-white"
                  >
                    {applying && <Loader2 className="h-4 w-4 animate-spin" />}
                    {applying ? "Submitting…" : "Submit Application"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full text-white/40 hover:text-white/60"
                    onClick={() => setShowApply(false)}
                  >
                    Cancel
                  </Button>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      )}

      <footer className="mt-16 border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-xs text-white/30">
          <p>© 2025 RentOS. All rights reserved.</p>
          <p>Listing ID: {listing.id}</p>
        </div>
      </footer>
    </div>
  );
}
