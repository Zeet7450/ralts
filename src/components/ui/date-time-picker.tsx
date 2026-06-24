"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DateTimePickerFieldProps {
  label: string;
  value: string; // ISO datetime string
  onChange: (value: string) => void;
  placeholder?: string;
}

export function DateTimePickerField({ label, value, onChange, placeholder = "Select date and time" }: DateTimePickerFieldProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [viewYear, setViewYear] = React.useState(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d.getFullYear();
    }
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = React.useState(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d.getMonth();
    }
    return new Date().getMonth();
  });

  // Parse existing value
  const selectedDate = value ? new Date(value) : null;
  const selectedTime = selectedDate
    ? `${String(selectedDate.getHours()).padStart(2, "0")}:${String(selectedDate.getMinutes()).padStart(2, "0")}`
    : "09:00";

  const displayValue = selectedDate
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(selectedDate)
    : "";

  const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  // Every minute from 00 to 59 — no quarter-hour rounding.
  const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

  const handleDateSelect = (date: Date) => {
    // Keep the time the user already picked (or the 09:00 default if no date
    // was selected yet). The Date is in *local* time because that's what the
    // calendar grid uses; we convert to UTC ISO so the value round-trips
    // through Supabase's TIMESTAMPTZ column without timezone drift.
    const [h, m] = selectedTime.split(":").map(Number);
    date.setHours(h, m, 0, 0);
    onChange(date.toISOString());
  };

  const handleTimeChange = (hour: number, minute: number) => {
    if (!selectedDate) return;
    const newDate = new Date(selectedDate);
    newDate.setHours(hour, minute, 0, 0);
    onChange(newDate.toISOString());
  };

  const navigateMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  // Build calendar cells
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const startPadding = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const cells: (number | null)[] = [
    ...Array(startPadding).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString("en-US", { month: "long" });

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-text-secondary">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "w-full h-11 rounded-lg border border-border bg-surface px-3 text-sm text-left",
          "flex items-center justify-between",
          "hover:border-accent/50 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-background",
          value ? "text-text-primary" : "text-text-tertiary"
        )}
      >
        <span>{displayValue || placeholder}</span>
        <svg className="h-4 w-4 text-text-tertiary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsOpen(false)} />

          {/* Sheet — bottom sheet on mobile, centered modal on desktop */}
          <div className="relative w-full max-w-sm bg-surface rounded-t-2xl sm:rounded-2xl p-5 pb-6 safe-area-pb animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in sm:zoom-in-95 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => navigateMonth(-1)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-text-primary">
                {monthName} {viewYear}
              </span>
              <button
                type="button"
                onClick={() => navigateMonth(1)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>

            {/* Calendar */}
            <div className="w-full">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="flex items-center justify-center h-8">
                    <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">{day}</span>
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((day, idx) => {
                  if (day === null) return <div key={`pad-${idx}`} className="h-11" />;

                  const date = new Date(viewYear, viewMonth, day);
                  const isSelected =
                    selectedDate &&
                    date.getFullYear() === selectedDate.getFullYear() &&
                    date.getMonth() === selectedDate.getMonth() &&
                    date.getDate() === selectedDate.getDate();

                  const today = new Date();
                  const isToday =
                    date.getFullYear() === today.getFullYear() &&
                    date.getMonth() === today.getMonth() &&
                    date.getDate() === today.getDate();

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleDateSelect(date)}
                      className={cn(
                        "h-11 w-full flex items-center justify-center rounded-lg text-sm transition-colors",
                        isSelected
                          ? "bg-accent text-white font-semibold"
                          : isToday
                          ? "border border-accent text-accent font-medium"
                          : "text-text-primary hover:bg-surface-elevated"
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time selector */}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide mb-2">Time</p>
              <div className="flex gap-2">
                <select
                  value={selectedTime.split(":")[0]}
                  onChange={(e) => handleTimeChange(parseInt(e.target.value, 10), parseInt(selectedTime.split(":")[1], 10))}
                  className="flex-1 h-10 rounded-lg border border-border bg-surface px-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}
                    </option>
                  ))}
                </select>
                <span className="flex items-center text-text-secondary text-sm">:</span>
                <select
                  value={selectedTime.split(":")[1]}
                  onChange={(e) => handleTimeChange(parseInt(selectedTime.split(":")[0], 10), parseInt(e.target.value, 10))}
                  className="flex-1 h-10 rounded-lg border border-border bg-surface px-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {MINUTES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 h-10 rounded-lg border border-border bg-surface-elevated text-sm font-medium text-text-primary hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 h-10 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}