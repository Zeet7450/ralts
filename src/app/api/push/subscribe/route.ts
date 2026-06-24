import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.warn("[push/subscribe] unauthorized", { authError: authError?.message });
      return NextResponse.json(
        { error: "Unauthorized — sign in again and retry." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: "Invalid subscription payload (need endpoint + keys.p256dh + keys.auth)" },
        { status: 400 }
      );
    }

    // Upsert subscription (replace if exists). Note: user_id has a unique
    // constraint so this naturally replaces any prior device's subscription.
    // If multi-device delivery is needed later, switch the constraint to endpoint.
    const { error: upsertError } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint,
          keys,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("[push/subscribe] failed to save subscription:", upsertError);
      return NextResponse.json(
        { error: `Failed to save subscription: ${upsertError.message}` },
        { status: 500 }
      );
    }

    console.log("[push/subscribe] saved subscription for user", user.id, "endpoint", endpoint.slice(0, 60));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[push/subscribe] unexpected error:", err);
    return NextResponse.json(
      { error: `Internal server error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await supabase.from("push_subscriptions").delete().eq("user_id", user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[push/unsubscribe] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
