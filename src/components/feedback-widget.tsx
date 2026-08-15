"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import {
  MessageSquare, Bug, Lightbulb, Sparkles, MessageCircle,
  Star, Loader2, CheckCircle2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { useFeedback } from "@/lib/use-feedback";
import { isFirebaseConfigured } from "@/lib/demo";
import type { FeedbackStatus, FeedbackType } from "@/lib/types";
import { errorMessage } from "@/lib/errors";

/**
 * "Send feedback", from wherever the person is standing.
 *
 * The page is captured automatically, because where they were is the first
 * thing needed to act on a bug report and the last thing anyone remembers to
 * mention. So is their role: "payments is broken" means different things from a
 * manager and from a tenant.
 *
 * The history tab is not decoration. Somebody who reports a bug and hears
 * nothing does not report the second one; showing the status change, and the
 * reply, is what keeps the channel alive.
 */

const TYPES: { value: FeedbackType; label: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { value: "bug", label: "Something's broken", icon: Bug, tone: "text-red-400" },
  { value: "feature", label: "I need something", icon: Lightbulb, tone: "text-amber-400" },
  { value: "enhancement", label: "Could be better", icon: Sparkles, tone: "text-violet-400" },
  { value: "feedback", label: "Just telling you", icon: MessageCircle, tone: "text-cyan-400" },
];

const STATUS: Record<FeedbackStatus, { label: string; className: string }> = {
  new: { label: "Sent", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  reviewed: { label: "Read", className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  planned: { label: "Planned", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  done: { label: "Done", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  dismissed: { label: "Won't do", className: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
};

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function FeedbackWidget() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const { history, unreadReplies, submit, markRepliesSeen } = useFeedback();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"send" | "history">("send");
  const [type, setType] = useState<FeedbackType>("feedback");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // Demo visitors have no account to attach feedback to, and the demo is open
  // to the internet — an open write path there is a spam queue.
  if (!user || user.role === "guest" || !isFirebaseConfigured()) return null;

  const openAt = (target: "send" | "history") => {
    setOpen(true);
    setTab(target);
    setError("");
    if (target === "history") markRepliesSeen();
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSending(true);
    setError("");
    try {
      await submit({ type, message, rating, page: pathname || "/" });
      setSent(true);
      setMessage("");
      setRating(0);
      setType("feedback");
      setTimeout(() => { setSent(false); setTab("history"); markRepliesSeen(); }, 1400);
    } catch (err) {
      setError(errorMessage(err, "Could not send that. Please try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => openAt("send")}
        aria-label="Send feedback"
        title="Send feedback"
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full gradient-brand text-white shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
      >
        <MessageSquare className="h-5 w-5" />
        {unreadReplies > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-black ring-2 ring-background">
            {unreadReplies}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl sm:mr-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h2 className="flex-1 text-sm font-semibold font-heading">Feedback</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex border-b border-border/50 px-2">
              {(["send", "history"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => (t === "history" ? openAt("history") : setTab("send"))}
                  className={cn(
                    "relative px-3 py-2 text-xs font-medium transition-colors",
                    tab === t ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "send" ? "Send" : `Yours${history.length ? ` (${history.length})` : ""}`}
                  {t === "history" && unreadReplies > 0 && (
                    <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  )}
                  {tab === t && (
                    <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full gradient-brand" />
                  )}
                </button>
              ))}
            </div>

            <div className="max-h-[calc(85vh-6rem)] overflow-y-auto p-4">
              {tab === "send" ? (
                sent ? (
                  <div className="space-y-3 py-8 text-center">
                    <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
                    <p className="text-sm font-medium">Sent — thank you.</p>
                    <p className="text-xs text-muted-foreground">
                      You&apos;ll see any reply under &ldquo;Yours&rdquo;.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      {TYPES.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setType(t.value)}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition-colors",
                            type === t.value
                              ? "border-primary/50 bg-primary/10"
                              : "border-border/50 hover:border-border"
                          )}
                        >
                          <t.icon className={cn("h-4 w-4 shrink-0", t.tone)} />
                          {t.label}
                        </button>
                      ))}
                    </div>

                    <Textarea
                      rows={5}
                      autoFocus
                      placeholder="What happened, or what would help?"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">How is RentOS treating you?</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            onClick={() => setRating(rating === n ? 0 : n)}
                            onMouseEnter={() => setHovered(n)}
                            onMouseLeave={() => setHovered(0)}
                            aria-label={`${n} out of 5`}
                          >
                            <Star
                              className={cn(
                                "h-4 w-4 transition-colors",
                                n <= (hovered || rating)
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-muted-foreground/40"
                              )}
                            />
                          </button>
                        ))}
                      </div>
                      <span className="ml-auto text-[10px] text-muted-foreground">optional</span>
                    </div>

                    {error && <p className="text-xs text-destructive">{error}</p>}

                    <p className="text-[10px] text-muted-foreground">
                      Sent with the page you&apos;re on ({pathname}) and your name, so we
                      can find what you saw.
                    </p>

                    <Button
                      className="w-full gap-2 gradient-brand text-white border-0"
                      disabled={sending || !message.trim()}
                      onClick={handleSubmit}
                    >
                      {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Send feedback
                    </Button>
                  </div>
                )
              ) : history.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nothing sent yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {history.map((f) => {
                    const meta = TYPES.find((t) => t.value === f.type);
                    const status = STATUS[f.status] ?? STATUS.new;
                    return (
                      <div key={f.id} className="rounded-lg border border-border/50 bg-background/40 p-3">
                        <div className="flex items-center gap-2">
                          {meta && <meta.icon className={cn("h-3.5 w-3.5", meta.tone)} />}
                          <Badge variant="outline" className={cn("text-[10px]", status.className)}>
                            {status.label}
                          </Badge>
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {timeAgo(f.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-line text-sm">{f.message}</p>
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">{f.page}</p>
                        {f.adminNotes?.trim() && (
                          <div className="mt-2 rounded-md border-l-2 border-primary/50 bg-primary/5 p-2">
                            <p className="text-[10px] font-medium text-primary">RentOS replied</p>
                            <p className="mt-0.5 whitespace-pre-line text-xs">{f.adminNotes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
