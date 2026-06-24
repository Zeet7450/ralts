// ─── Reminder scheduling — pure logic ───────────────────────────────────────
//
// Two responsibilities:
//   1. Round-trip a user-picked (year, month, day, hour, minute) through
//      ISO 8601 + UTC + TIMESTAMPTZ storage without losing the chosen
//      minute or shifting the hour.
//   2. Decide, given a list of tasks and a "now" timestamp, which tasks
//      should fire a reminder right now.
//
// These are pure functions so they can be unit-tested without React,
// Supabase, or the network.

import type { Task } from "@/types";

type TaskSummary = Pick<Task, "id" | "title" | "description">;

/**
 * Convert a local-time Date (the value the user picked in the calendar
 * grid) into the full ISO 8601 string we store. Full ISO — never slice —
 * because a sliced string like "2026-06-24T12:00" has *no* timezone and
 * is parsed as local time on the next read, which causes a silent shift
 * the moment it round-trips through Supabase's TIMESTAMPTZ column.
 */
export function formatIsoForStorage(date: Date): string {
  return date.toISOString();
}

/**
 * Parse a stored value (which may come back from Supabase as a full ISO
 * with Z, or — for legacy rows — as a sliced local-time string) into a
 * Date. Returns null on invalid input.
 */
export function parseStoredValue(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Build the "HH:mm" string the time selector binds to. Reads in *local*
 * time so what the user sees matches what they picked.
 */
export function formatTimeOfDay(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Display string for the closed-state trigger button — e.g. "Jun 24,
 * 2026, 12:13 PM". Local time, since the picker is a local-time control.
 */
export function formatPickerDisplay(d: Date, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Build a fresh Date for "today at hour:minute" in local time, with
 * seconds and milliseconds zeroed. Used when the user picks a date in
 * the calendar grid but hasn't changed the time yet.
 */
export function todayAtTime(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

/**
 * Decision: which tasks should fire a reminder right now?
 *
 * A task fires when ALL of:
 *   - has a due_date
 *   - is not completed
 *   - has not been reminded yet (reminder_sent_at is null/undefined)
 *   - the due moment is at or before `now`
 *
 * "Now" is passed in so the function is deterministic and unit-testable.
 */
export function pickDueReminders<
  T extends {
    due_date: string | null;
    is_completed: boolean;
    reminder_sent_at?: string | null;
  },
>(tasks: T[], now: Date): T[] {
  return tasks.filter((t) => {
    if (!t.due_date || t.is_completed) return false;
    if (t.reminder_sent_at) return false;
    const due = parseStoredValue(t.due_date);
    if (!due) return false;
    return due.getTime() <= now.getTime();
  });
}

/**
 * Build the (title, body, tag) for a reminder push. Kept here so the
 * server cron and any future client-side scheduler format notifications
 * identically.
 */
export function formatReminderPush(task: TaskSummary): {
  title: string;
  body: string;
  tag: string;
} {
  const title = "Ralts · Reminder";
  const body = task.description?.trim()
    ? `${task.title} — ${task.description.trim()}`
    : task.title;
  const tag = `task-reminder-${task.id ?? ""}`;
  return { title, body, tag };
}
