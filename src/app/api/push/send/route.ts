import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import webpush from "web-push";

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return true;

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!ensureVapidConfigured()) {
      return NextResponse.json(
        { error: "Push notifications are not configured on the server" },
        { status: 503 }
      );
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
