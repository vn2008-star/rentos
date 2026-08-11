"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Bell, AlertCircle, DollarSign, Wrench, FileText, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { NotificationKind } from "@/lib/types";

const KIND_ICON: Record<NotificationKind, React.ComponentType<{ className?: string }>> = {
  payment_failed: AlertCircle,
  payment_received: DollarSign,
  maintenance_urgent: Wrench,
  maintenance_reported: Wrench,
  lease_expiring: CalendarClock,
  application_received: FileText,
};

const KIND_TONE: Record<NotificationKind, string> = {
  payment_failed: "text-red-400 bg-red-500/15",
  payment_received: "text-emerald-400 bg-emerald-500/15",
  maintenance_urgent: "text-amber-400 bg-amber-500/15",
  maintenance_reported: "text-sky-400 bg-sky-500/15",
  lease_expiring: "text-blue-400 bg-blue-500/15",
  application_received: "text-violet-400 bg-violet-500/15",
};

/** Relative time that degrades to a date once it stops being useful. */
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const recent = notifications.slice(0, 8);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 relative"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full gradient-brand px-1 text-[10px] font-semibold text-white ring-2 ring-card">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        }
      />

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              onClick={(e) => { e.preventDefault(); markAllAsRead(); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />

        {recent.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            You&apos;re all caught up
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {recent.map((n) => {
              const Icon = KIND_ICON[n.kind] ?? Bell;
              return (
                <DropdownMenuItem
                  key={n.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 px-3 py-2.5",
                    !n.read && "bg-primary/5"
                  )}
                  onClick={() => {
                    if (!n.read) markAsRead(n.id);
                    if (n.href) router.push(n.href);
                  }}
                >
                  <div className={cn("mt-0.5 rounded-md p-1.5 shrink-0", KIND_TONE[n.kind])}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm leading-tight", !n.read && "font-medium")}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full gradient-brand" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
