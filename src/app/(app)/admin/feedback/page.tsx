"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  MessageSquare, Loader2, AlertTriangle, ArrowLeft, Star, Send, Bug,
  Lightbulb, Sparkles, MessageCircle,
} from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { authedJson } from "@/lib/api-client";
import { ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { Feedback, FeedbackStatus, FeedbackType } from "@/lib/types";
import toast from "react-hot-toast";

/**
 * What customers have told us, across every organization.
 *
 * Replies are the point. A bug report that disappears teaches the person not to
 * send the next one, and the next one might be the one that matters.
 */

const FILTERS: { value: FeedbackStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "reviewed", label: "Read" },
  { value: "planned", label: "Planned" },
  { value: "done", label: "Done" },
  { value: "dismissed", label: "Won't do" },
];

const TYPE_META: Record<FeedbackType, { icon: React.ComponentType<{ className?: string }>; tone: string; label: string }> = {
  bug: { icon: Bug, tone: "text-red-400", label: "Bug" },
  feature: { icon: Lightbulb, tone: "text-amber-400", label: "Request" },
  enhancement: { icon: Sparkles, tone: "text-violet-400", label: "Improvement" },
  feedback: { icon: MessageCircle, tone: "text-cyan-400", label: "Feedback" },
};

const STATUS_STYLE: Record<FeedbackStatus, string> = {
  new: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  reviewed: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  planned: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  done: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  dismissed: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

function FeedbackCenter() {
  const [items, setItems] = useState<Feedback[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<FeedbackStatus | "all">("all");
  const [error, setError] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await authedJson<{ feedback: Feedback[]; counts: Record<string, number> }>(
        "/api/admin/feedback"
      );
      setItems(r.feedback);
      setCounts(r.counts);
    } catch (err: any) {
      setError(err?.message || "Could not load feedback.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const respond = async (id: string, status: FeedbackStatus, adminNotes?: string) => {
    setBusy(true);
    try {
      await authedJson("/api/admin/feedback", {
        method: "POST",
        body: JSON.stringify({ id, status, adminNotes }),
      });
      setReplyTo(null);
      setReply("");
      await load();
      toast.success(adminNotes ? "Replied." : "Updated.");
    } catch (err: any) {
      toast.error(err?.message || "Could not update that.");
    } finally {
      setBusy(false);
    }
  };

  const shown = (items ?? []).filter((f) => filter === "all" || f.status === filter);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> RentOS Admin
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight font-heading lg:text-3xl">
          <MessageSquare className="h-6 w-6 text-primary" /> Feedback
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          What customers have sent from inside the app
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            className={cn("gap-1.5", filter === f.value && "gradient-brand text-white border-0")}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
            {counts[f.value] > 0 && (
              <span className="text-[10px] opacity-70">{counts[f.value]}</span>
            )}
          </Button>
        ))}
      </div>

      {!items && !error && (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading feedback…
        </div>
      )}

      {items && shown.length === 0 && (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nothing here.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {shown.map((f) => {
          const meta = TYPE_META[f.type] ?? TYPE_META.feedback;
          return (
            <Card key={f.id} className="border-border/50 bg-card/50">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <meta.icon className={cn("h-4 w-4", meta.tone)} />
                  <span className="text-sm font-medium">{meta.label}</span>
                  <Badge variant="outline" className={cn("text-[10px]", STATUS_STYLE[f.status])}>
                    {FILTERS.find((x) => x.value === f.status)?.label ?? f.status}
                  </Badge>
                  {typeof f.rating === "number" && f.rating > 0 && (
                    <span className="flex items-center gap-0.5 text-xs text-amber-400">
                      {f.rating}
                      <Star className="h-3 w-3 fill-amber-400" />
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {new Date(f.createdAt).toLocaleString()}
                  </span>
                </div>

                <p className="whitespace-pre-line text-sm">{f.message}</p>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="bg-accent text-[9px]">
                      {f.userName?.slice(0, 2).toUpperCase() || "??"}
                    </AvatarFallback>
                  </Avatar>
                  <span>{f.userName}</span>
                  <span>·</span>
                  <span>{ROLE_LABELS[f.userRole] ?? f.userRole}</span>
                  <span>·</span>
                  <span>{f.orgName ?? f.orgId}</span>
                  <span>·</span>
                  <span className="font-mono">{f.page}</span>
                </div>

                {f.adminNotes?.trim() && (
                  <div className="rounded-md border-l-2 border-primary/50 bg-primary/5 p-2">
                    <p className="text-[10px] font-medium text-primary">Your reply</p>
                    <p className="mt-0.5 whitespace-pre-line text-xs">{f.adminNotes}</p>
                  </div>
                )}

                {replyTo === f.id ? (
                  <div className="space-y-2">
                    <Textarea
                      rows={3}
                      autoFocus
                      placeholder="They will see this in the app."
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      {(["reviewed", "planned", "done", "dismissed"] as FeedbackStatus[]).map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => respond(f.id, s, reply.trim() || undefined)}
                        >
                          {FILTERS.find((x) => x.value === s)?.label}
                        </Button>
                      ))}
                      <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)} disabled={busy}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => { setReplyTo(f.id); setReply(f.adminNotes ?? ""); }}
                    >
                      <Send className="h-3 w-3" /> Reply
                    </Button>
                    {f.status === "new" && (
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => respond(f.id, "reviewed")}>
                        Mark read
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminFeedbackPage() {
  return (
    <AuthGuard roles={["super_admin"]}>
      <FeedbackCenter />
    </AuthGuard>
  );
}
