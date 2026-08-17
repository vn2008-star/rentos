"use client";

import { CircleAlert, FileCheck2, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getLeaseTemplate, requirementsFor, type RequirementTiming,
} from "@/lib/lease-templates";

/**
 * What the law still expects of the landlord on this tenancy.
 *
 * A checklist, in one place, at the moment the lease is being written — which
 * is the only moment it is any use. It is not legal advice and says so; the
 * citations are there so anybody can go and read the actual section.
 */

const TIMING_LABEL: Record<RequirementTiming, string> = {
  "before-signing": "Before signing",
  "at-signing": "In the lease",
  "within-5-days": "First 5 days",
  "at-renewal": "At renewal",
  "at-move-out": "At move-out",
};

const TIMING_TONE: Record<RequirementTiming, string> = {
  "before-signing": "text-amber-400 border-amber-500/30",
  "at-signing": "text-primary border-primary/30",
  "within-5-days": "text-violet-400 border-violet-500/30",
  "at-renewal": "text-blue-400 border-blue-500/30",
  "at-move-out": "text-muted-foreground border-border/50",
};

export function LeaseRequirements({
  templateId,
  yearBuilt,
  className,
}: {
  templateId: string | undefined | null;
  /** Drives the lead paint item — it applies only to pre-1978 buildings. */
  yearBuilt?: number;
  className?: string;
}) {
  const template = getLeaseTemplate(templateId);
  const requirements = requirementsFor(templateId, {
    builtBefore1978: typeof yearBuilt === "number" && yearBuilt < 1978,
  });

  if (!template) return null;

  return (
    <Card className={cn("border-border/50 bg-card/50", className)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold font-heading">
              What this lease requires of you
            </h3>
          </div>
          <Badge variant="outline" className="text-[10px] h-5">{template.jurisdiction}</Badge>
        </div>

        <ul className="space-y-2">
          {requirements.map((req) => (
            <li key={req.id} className="flex gap-2.5">
              <Badge
                variant="outline"
                className={cn("h-5 shrink-0 text-[10px] whitespace-nowrap", TIMING_TONE[req.timing])}
              >
                {TIMING_LABEL[req.timing]}
              </Badge>
              <div className="min-w-0">
                <p className="text-xs font-medium leading-snug">{req.label}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{req.detail}</p>
              </div>
            </li>
          ))}
        </ul>

        {template.sourceUrl && (
          <a
            href={template.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            Get the current {template.name} <ExternalLink className="h-3 w-3" />
          </a>
        )}

        <p className="flex items-start gap-1.5 border-t border-border/30 pt-2 text-[11px] text-muted-foreground">
          <CircleAlert className="h-3.5 w-3.5 shrink-0 mt-px" />
          <span>
            A checklist, not legal advice. Requirements change — verify anything
            you are relying on, and have a lawyer look at the lease you actually sign.
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
