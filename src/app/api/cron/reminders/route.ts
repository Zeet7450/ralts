import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { pickDueReminders, formatReminderPush } from "@/lib/reminders";

// ─── Cron route ─────────────────────────────────────────────────────────────
//
// Triggered by Vercel Cron (see vercel.json: "*/1 * * * *"). On each tick:
//   1. Find every task whose due moment has arrived, is not completed, and
//      has not been reminded yet.
//   2. Send a push to that user's subscribed endpoint using the existing
//      web-push + VAPID config.
//   3. Mark `reminder_sent_at = NOW()` so we never fire twice for the same
//      task. (The user can still re-edit the due date to re-arm.)
//
// Auth: requires the CRON_SECRET env var in the `authorization: Bearer …`
// header. Vercel injects this automatically for cron invocations.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

let vapidConfigured = false;
function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export async function GET(request: NextRequest) {
  // Vercel Cron auth — same shape as Vercel's docs.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ensureVapidConfigured()) {
    return NextResponse.json(
      { error: "VAPID keys not configured" },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const now = new Date();

  // Pull candidates. The reminder_sent_at IS NULL filter does the
  // dedupe — we never re-fire for the same task unless the user
  // edits the due_date (which doesn't reset the flag today, by design).
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, user_id, title, description, due_date, is_completed, reminder_sent_at")
    .is("reminder_sent_at", null)
    .eq("is_completed", false)
    .not("due_date", "is", null)
    .lte("due_date", now.toISOString());

  if (error) {
    console.error("[cron/reminders] query failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const due = pickDueReminders(tasks || [], now);

  // Group by user so we only need one push-subscription lookup per user.
  const byUser = new Map<string, typeof due>();
  for (const t of due) {
    const arr = byUser.get(t.user_id) ?? [];
    arr.push(t);
    byUser.set(t.user_id, arr);
  }

  const sent: { user_id: string; task_id: string; ok: boolean; error?: string }[] = [];

  for (const [userId, userTasks] of byUser) {
    const { data: subscription } = await supabase
      .from("push_subscriptions")
      .select("endpoint, keys")
      .eq("user_id", userId)
      .single();

    if (!subscription) {
      for (const t of userTasks) {
        sent.push({ user_id: userId, task_id: t.id, ok: false, error: "no subscription" });
      }
      continue;
    }

    for (const t of userTasks) {
      const { title, body, tag } = formatReminderPush(t);
      const payload = JSON.stringify({
        title,
        body,
        icon: "/icons/android-chrome-192x192.png",
        badge: "/icons/android-chrome-192x192.png",
        tag,
        data: { url: "/tasks", taskId: t.id },
      });

      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: subscription.keys },
          payload
        );
        sent.push({ user_id: userId, task_id: t.id, ok: true });
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        sent.push({
          user_id: userId,
          task_id: t.id,
          ok: false,
          error: e?.message || `status ${e?.statusCode}`,
        });
        // If the subscription is gone, drop it so we don't keep retrying.
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", userId);
        }
      }
    }
  }

  // Mark successful sends so the next tick skips them.
  const okIds = sent.filter((s) => s.ok).map((s) => s.task_id);
  if (okIds.length > 0) {
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ reminder_sent_at: now.toISOString() })
      .in("id", okIds);
    if (updateError) {
      console.error("[cron/reminders] mark-sent failed:", updateError);
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: tasks?.length ?? 0,
    due: due.length,
    sent: sent.filter((s) => s.ok).length,
    failed: sent.filter((s) => !s.ok).length,
    details: sent,
    ran_at: now.toISOString(),
  });
}
