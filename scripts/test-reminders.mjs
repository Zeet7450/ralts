// ─── Reminder logic — unit tests ───────────────────────────────────────────
//
// Run:  node --test scripts/test-reminders.mjs
//
// These cover the user-reported symptoms:
//   - "12:00 actually schedules for 12:00"
//   - arbitrary minutes (01, 13, 27, 44, 59) survive round-trip
//   - the picker → DB → picker round-trip never silently rounds minutes
//   - the picker → DB → picker round-trip never shifts the hour by a
//     timezone offset
//   - reminder picker fires only when due, only once, only for active
//     tasks

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// We import the TS source through jiti (resolved from pnpm store).
// This avoids adding a build step just to run tests.
const require = createRequire(import.meta.url);
const jiti = require(
  "../node_modules/.pnpm/jiti@2.7.0/node_modules/jiti/lib/jiti.cjs"
);
const load = jiti(import.meta.url, { interopDefault: true });

const {
  formatIsoForStorage,
  parseStoredValue,
  formatTimeOfDay,
  formatPickerDisplay,
  pickDueReminders,
  formatReminderPush,
} = load("../src/lib/reminders.ts");

// ─── ISO round-trip ─────────────────────────────────────────────────────────

test("formatIsoForStorage produces full ISO with timezone", () => {
  const d = new Date(2026, 5, 24, 12, 13, 0, 0); // local
  const iso = formatIsoForStorage(d);
  // Must be full ISO (length 24+ with the .000Z suffix), not the
  // sliced "YYYY-MM-DDTHH:mm" the picker used to produce.
  assert.ok(iso.length >= 24, `expected full ISO, got ${iso}`);
  assert.match(iso, /T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test("12:00 round-trips back to 12:00 local", () => {
  const picked = new Date(2026, 5, 24, 12, 0, 0, 0); // local noon
  const stored = formatIsoForStorage(picked);
  const back = parseStoredValue(stored);
  assert.ok(back, "stored value must parse");
  assert.equal(back.getHours(), 12, `expected hour 12, got ${back.getHours()}`);
  assert.equal(back.getMinutes(), 0);
});

test("arbitrary minutes 01, 13, 27, 44, 59 round-trip exactly", () => {
  for (const minute of [1, 13, 27, 44, 59]) {
    const picked = new Date(2026, 5, 24, 9, minute, 0, 0); // local
    const stored = formatIsoForStorage(picked);
    const back = parseStoredValue(stored);
    assert.ok(back);
    assert.equal(
      back.getMinutes(),
      minute,
      `minute ${minute} lost in round-trip: stored=${stored}, back=${back?.toISOString()}`
    );
    assert.equal(back.getHours(), 9, `hour drifted for minute ${minute}`);
  }
});

test("every minute 00-59 round-trips", () => {
  for (let m = 0; m < 60; m++) {
    const picked = new Date(2026, 5, 24, 14, m, 0, 0);
    const stored = formatIsoForStorage(picked);
    const back = parseStoredValue(stored);
    assert.ok(back);
    assert.equal(back.getMinutes(), m, `minute ${m} lost`);
    assert.equal(back.getHours(), 14);
  }
});

test("parseStoredValue accepts legacy sliced strings without crashing", () => {
  // The bug we replaced used to produce strings like "2026-06-24T12:00".
  // The new parser must not return NaN for those — it should still parse
  // them, just with whatever interpretation JS gives (local).
  const legacy = "2026-06-24T12:00";
  const d = parseStoredValue(legacy);
  assert.ok(d);
  assert.equal(d.getHours(), 12);
  assert.equal(d.getMinutes(), 0);
});

test("parseStoredValue rejects garbage", () => {
  assert.equal(parseStoredValue(""), null);
  assert.equal(parseStoredValue(null), null);
  assert.equal(parseStoredValue(undefined), null);
  assert.equal(parseStoredValue("not a date"), null);
});

// ─── Time-of-day display ────────────────────────────────────────────────────

test("formatTimeOfDay zero-pads", () => {
  const d = new Date(2026, 5, 24, 3, 7, 0, 0);
  assert.equal(formatTimeOfDay(d), "03:07");
});

test("formatPickerDisplay renders a localized date + time", () => {
  const d = new Date(2026, 5, 24, 12, 0, 0, 0);
  const s = formatPickerDisplay(d, "en-US");
  assert.ok(s.includes("Jun"), `expected "Jun" in ${s}`);
  assert.ok(s.includes("24"), `expected "24" in ${s}`);
  assert.ok(s.includes("2026"));
  // Hour + minute should appear in 12-hour format with AM/PM.
  assert.match(s, /\d{1,2}:\d{2}\s?(AM|PM)/);
});

// ─── Reminder picker logic ──────────────────────────────────────────────────

const task = (overrides) => ({
  id: "t",
  user_id: "u",
  title: "Test",
  description: null,
  checklist: [],
  due_date: null,
  reminder_times: [],
  reminder_sent_at: null,
  is_completed: false,
  completed_at: null,
  created_at: "",
  updated_at: "",
  ...overrides,
});

test("pickDueReminders fires when due_date <= now and not completed and not yet sent", () => {
  const dueIso = new Date(2026, 5, 24, 11, 59, 0, 0).toISOString();
  const t = task({ due_date: dueIso });
  const fired = pickDueReminders([t], new Date(2026, 5, 24, 12, 0, 0, 0));
  assert.equal(fired.length, 1);
});

test("pickDueReminders does NOT fire when due_date is in the future", () => {
  const dueIso = new Date(2026, 5, 24, 13, 0, 0, 0).toISOString();
  const t = task({ due_date: dueIso });
  const fired = pickDueReminders([t], new Date(2026, 5, 24, 12, 0, 0, 0));
  assert.equal(fired.length, 0);
});

test("pickDueReminders does NOT fire for completed tasks", () => {
  const dueIso = new Date(2026, 5, 24, 11, 59, 0, 0).toISOString();
  const t = task({ due_date: dueIso, is_completed: true });
  const fired = pickDueReminders([t], new Date(2026, 5, 24, 12, 0, 0, 0));
  assert.equal(fired.length, 0);
});

test("pickDueReminders does NOT fire twice (reminder_sent_at set)", () => {
  const dueIso = new Date(2026, 5, 24, 11, 59, 0, 0).toISOString();
  const sentAt = new Date(2026, 5, 24, 12, 0, 0, 0).toISOString();
  const t = task({ due_date: dueIso, reminder_sent_at: sentAt });
  const fired = pickDueReminders([t], new Date(2026, 5, 24, 12, 5, 0, 0));
  assert.equal(fired.length, 0);
});

test("pickDueReminders fires at the exact scheduled minute (12:00)", () => {
  // User picked 12:00. We fire when now >= due_date. At now = 12:00:00.000
  // we should fire; at 11:59:59.999 we should not.
  const dueIso = new Date(2026, 5, 24, 12, 0, 0, 0).toISOString();
  const t = task({ due_date: dueIso });
  assert.equal(
    pickDueReminders([t], new Date(2026, 5, 24, 12, 0, 0, 0)).length,
    1,
    "should fire at 12:00"
  );
  assert.equal(
    pickDueReminders([t], new Date(2026, 5, 24, 11, 59, 59, 999)).length,
    0,
    "should not fire at 11:59:59"
  );
});

test("pickDueReminders fires for arbitrary minutes (13, 27, 44, 59)", () => {
  for (const minute of [1, 13, 27, 44, 59]) {
    const dueIso = new Date(2026, 5, 24, 12, minute, 0, 0).toISOString();
    const t = task({ due_date: dueIso });
    const fired = pickDueReminders([t], new Date(2026, 5, 24, 13, 0, 0, 0));
    assert.equal(fired.length, 1, `task at minute ${minute} should have fired`);
  }
});

test("pickDueReminders ignores tasks with no due_date", () => {
  const t = task({ due_date: null });
  const fired = pickDueReminders([t], new Date(2026, 5, 24, 12, 0, 0, 0));
  assert.equal(fired.length, 0);
});

// ─── Notification text ──────────────────────────────────────────────────────

test("formatReminderPush produces title/body/tag", () => {
  const push = formatReminderPush({ id: "abc", title: "Pay bill", description: "PLN" });
  assert.equal(push.title, "Ralts · Reminder");
  assert.equal(push.body, "Pay bill — PLN");
  assert.equal(push.tag, "task-reminder-abc");
});

test("formatReminderPush omits description when empty", () => {
  const push = formatReminderPush({ id: "abc", title: "Pay bill", description: "" });
  assert.equal(push.body, "Pay bill");
});

test("formatReminderPush trims whitespace in description", () => {
  const push = formatReminderPush({ id: "abc", title: "Pay bill", description: "  PLN  " });
  assert.equal(push.body, "Pay bill — PLN");
});
