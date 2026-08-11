"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Wrench, FileText, ArrowRight, BedDouble, Bath, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePublicOrg } from "@/lib/use-public-org";
import { PublicOrgHeader, PublicOrgState } from "@/components/public-org-header";

/**
 * The public front door for one organization: /o/{slug}.
 *
 * Everything a person outside the company might need — report a repair, apply
 * for a home — without an account and without seeing anybody's data.
 */
export default function PublicOrgHome() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const { data, loading, error } = usePublicOrg(slug);

  if (!data) return <PublicOrgState loading={loading} error={error} />;

  const propertyById = new Map(data.properties.map((p) => [p.id, p]));
  const available = data.units.filter((u) => u.status === "available");

  return (
    <div className="min-h-screen bg-background">
      <PublicOrgHeader orgName={data.org.name} slug={slug} tagline="Residents & applicants" />

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold font-heading">How can we help?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            No account needed for either of these.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link href={`/o/${slug}/report`}>
            <Card className="h-full border-border/50 bg-card/50 transition-colors hover:border-primary/40">
              <CardContent className="space-y-2 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
                  <Wrench className="h-5 w-5 text-amber-400" />
                </div>
                <h2 className="font-semibold font-heading">Report a repair</h2>
                <p className="text-sm text-muted-foreground">
                  Something broken, leaking or unsafe. Goes straight to the
                  maintenance team.
                </p>
                <span className="inline-flex items-center gap-1 text-sm text-primary">
                  Report an issue <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/o/${slug}/apply`}>
            <Card className="h-full border-border/50 bg-card/50 transition-colors hover:border-primary/40">
              <CardContent className="space-y-2 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15">
                  <FileText className="h-5 w-5 text-violet-400" />
                </div>
                <h2 className="font-semibold font-heading">Apply for a home</h2>
                <p className="text-sm text-muted-foreground">
                  {available.length > 0
                    ? `${available.length} ${available.length === 1 ? "home" : "homes"} available now.`
                    : "Register your interest for upcoming vacancies."}
                </p>
                <span className="inline-flex items-center gap-1 text-sm text-primary">
                  Start an application <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        </div>

        {available.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold font-heading">Available now</h2>
            <div className="space-y-2">
              {available.map((u) => {
                const property = propertyById.get(u.propertyId);
                return (
                  <Card key={u.id} className="border-border/50 bg-card/50">
                    <CardContent className="flex flex-wrap items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {property?.name ?? "Home"} — Unit {u.unitNumber}
                        </p>
                        <p className="flex items-center gap-3 text-xs text-muted-foreground">
                          {property && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {property.address.city}, {property.address.state}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <BedDouble className="h-3 w-3" /> {u.beds}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Bath className="h-3 w-3" /> {u.baths}
                          </span>
                        </p>
                      </div>
                      <Badge variant="secondary" className="font-semibold">
                        ${u.rent.toLocaleString()}/mo
                      </Badge>
                      <Button
                        size="sm"
                        className="gradient-brand text-white border-0"
                        render={<Link href={`/o/${slug}/apply?unit=${u.id}`} />}
                      >
                        Apply
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Already a resident?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in to your portal
          </Link>
        </p>
      </main>
    </div>
  );
}
