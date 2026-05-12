"use client";

import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, DollarSign, User, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { STRPricing, STRBooking } from "@/lib/types";
import { calculateSTRRate } from "@/lib/listing-generator";

interface STRCalendarProps {
  pricing: STRPricing;
  bookings: STRBooking[];
  blockedDates?: string[];
  onToggleBlock?: (date: string) => void;
  onSelectDate?: (date: string) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function STRCalendar({ pricing, bookings, blockedDates = [], onToggleBlock, onSelectDate }: STRCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: { date: string; day: number; rate: number; status: "available" | "booked" | "blocked"; booking?: STRBooking; isToday: boolean; isWeekend: boolean }[] = [];

    const today = new Date().toISOString().split("T")[0];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = dateObj.toISOString().split("T")[0];
      const rate = calculateSTRRate(pricing, dateObj);
      const dayOfWeek = dateObj.getDay();

      // Check if booked
      const booking = bookings.find(b =>
        dateStr >= b.checkIn && dateStr < b.checkOut && b.status !== "cancelled"
      );

      // Check if blocked
      const isBlocked = blockedDates.includes(dateStr);

      let status: "available" | "booked" | "blocked" = "available";
      if (booking) status = "booked";
      else if (isBlocked) status = "blocked";

      days.push({
        date: dateStr,
        day: d,
        rate,
        status,
        booking,
        isToday: dateStr === today,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      });
    }

    return { firstDay, days };
  }, [year, month, bookings, blockedDates, pricing]);

  const navigateMonth = (dir: -1 | 1) => {
    setCurrentMonth(new Date(year, month + dir, 1));
    setSelectedDate(null);
  };

  const handleDayClick = (date: string, status: string) => {
    setSelectedDate(date);
    onSelectDate?.(date);
    if (status !== "booked") {
      onToggleBlock?.(date);
    }
  };

  // Revenue summary
  const monthBookings = bookings.filter(b => {
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    return b.checkIn.startsWith(monthStr) || b.checkOut.startsWith(monthStr);
  });
  const monthRevenue = monthBookings.reduce((sum, b) => sum + b.totalAmount, 0);
  const bookedNights = calendarDays.days.filter(d => d.status === "booked").length;
  const occupancyRate = calendarDays.days.length > 0
    ? Math.round((bookedNights / calendarDays.days.length) * 100)
    : 0;

  // Seasonal indicator
  const activeSeasons = pricing.seasonalRates.filter(
    s => (month + 1) >= s.startMonth && (month + 1) <= s.endMonth
  );

  return (
    <div className="space-y-4">
      {/* Month stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold font-heading text-emerald-400">${monthRevenue.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Revenue</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold font-heading">{bookedNights}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Booked</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold font-heading">{occupancyRate}%</p>
            <p className="text-[10px] text-muted-foreground uppercase">Occupancy</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <CardTitle className="font-heading text-base">{MONTHS[month]} {year}</CardTitle>
              {activeSeasons.length > 0 && (
                <div className="flex gap-1 justify-center mt-1">
                  {activeSeasons.map((s, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">{s.name} ({s.rateMultiplier}×)</Badge>
                  ))}
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-4 px-3">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-[10px] font-medium text-muted-foreground text-center py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for offset */}
            {Array.from({ length: calendarDays.firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Day cells */}
            {calendarDays.days.map(day => {
              const isSelected = selectedDate === day.date;

              return (
                <button
                  key={day.date}
                  className={cn(
                    "aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-xs transition-all relative",
                    "hover:ring-1 hover:ring-primary/50",
                    day.status === "booked" && "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30",
                    day.status === "blocked" && "bg-red-500/15 text-red-400/70 hover:bg-red-500/25",
                    day.status === "available" && "bg-emerald-500/10 text-foreground hover:bg-emerald-500/20",
                    day.isToday && "ring-1 ring-primary",
                    day.isWeekend && day.status === "available" && "bg-amber-500/10",
                    isSelected && "ring-2 ring-primary shadow-lg shadow-primary/20",
                  )}
                  onClick={() => handleDayClick(day.date, day.status)}
                  title={day.booking ? `${day.booking.guestName} · $${day.rate}/night` : `$${day.rate}/night`}
                >
                  <span className="font-medium text-[11px]">{day.day}</span>
                  <span className={cn("text-[8px]", day.status === "booked" ? "text-blue-400/70" : "text-muted-foreground")}>${day.rate}</span>
                  {day.booking && (
                    <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded bg-emerald-500/30" /> Available</div>
            <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded bg-blue-500/30" /> Booked</div>
            <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded bg-red-500/20" /> Blocked</div>
            <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded bg-amber-500/20" /> Weekend</div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Summary */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-400" /> Dynamic Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Base nightly rate</span><span className="font-medium">${pricing.baseNightlyRate}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Weekend premium</span><span className="font-medium text-amber-400">+{pricing.weekendPremiumPercent}%</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Cleaning fee</span><span className="font-medium">${pricing.cleaningFee}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Min stay</span><span className="font-medium">{pricing.minimumStay} night{pricing.minimumStay !== 1 ? "s" : ""}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Max guests</span><span className="font-medium">{pricing.maxGuests}</span></div>
          {pricing.seasonalRates.length > 0 && (
            <div className="pt-2 border-t border-border/30 space-y-1">
              <p className="text-muted-foreground font-medium">Seasonal Rates</p>
              {pricing.seasonalRates.map((s, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">{s.name} (Mo {s.startMonth}–{s.endMonth})</span>
                  <span className="font-medium">{s.rateMultiplier}× · ${Math.round(pricing.baseNightlyRate * s.rateMultiplier)}/night</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
