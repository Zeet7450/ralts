import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title = "Ralts", body: notificationBody = "Test notification", tag = "ralts-test" } = body;

    // Get user's push subscription
    const { data: subscription, error: subError } = await supabase
      .from("push_subscriptions")
      .select("endpoint, keys")
      .eq("user_id", user.id)
      .single();

    if (subError || !subscription) {
      return NextResponse.json({ error: "No push subscription found" }, { status: 404 });
    }

    const pushPayload = JSON.stringify({
      title,
      body: notificationBody,
      icon: "/icons/android-chrome-192x192.png",
      badge: "/icons/android-chrome-192x192.png",
      tag,
      data: { url: "/dashboard" },
    });

    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.keys },
      pushPayload
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Push send error:", err);

    // If subscription expired or invalid, return specific error
    if (err.statusCode === 404 || err.statusCode === 410) {
      return NextResponse.json({ error: "Subscription expired", code: "EXPIRED" }, { status: 410 });
    }

    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}
